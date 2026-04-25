import { callLLM } from "./llm";
import { Memory } from "./memory";

export type Persona = "planner" | "generator" | "evaluator";
export type Trigger = "generator" | "evaluator" | "planner" | "stop" | "done" | null;

export const MAX_RETRY = 3;

// ──────────────────────────────
// 트리거 감지
// ──────────────────────────────
export function detectTrigger(output: string): Trigger {
  const lines = output.trim().split("\n").reverse();
  for (const line of lines) {
    if (line.includes("NEXT:생성자")) { return "generator"; }
    if (line.includes("NEXT:평가자")) { return "evaluator"; }
    if (line.includes("NEXT:계획자")) { return "planner"; }
    if (line.includes("STOP:사용자보고")) { return "stop"; }
    if (line.includes("DONE")) { return "done"; }
  }
  return null;
}

// ──────────────────────────────
// 계획서 구간만 추출
// ──────────────────────────────
function extractPlan(output: string): string {
  const marker = "# 계획서";
  const idx = output.indexOf(marker);
  if (idx !== -1) {
    // 트리거 키워드 줄은 제거하고 저장
    return output
      .slice(idx)
      .split("\n")
      .filter((line) => !line.match(/^(NEXT:|STOP:|DONE)/))
      .join("\n")
      .trim();
  }
  // 마커가 없으면 트리거 키워드 줄만 제거해서 저장
  return output
    .split("\n")
    .filter((line) => !line.match(/^(NEXT:|STOP:|DONE)/))
    .join("\n")
    .trim();
}

// ──────────────────────────────
// 계획자
// ──────────────────────────────
export async function runPlanner(memory: Memory, userInput: string): Promise<string> {
  const index = memory.readSkill("index.md");
  const skill = memory.readSkill("planner.md");
  const plan  = memory.read("기획서.txt");

  const systemPrompt = `
너는 계획자야. 사용자의 요청을 분석하고 실행 가능한 계획서를 만드는 것이 너의 유일한 역할이야.
코드를 직접 작성하지 마. 무엇을 만들지에만 집중해.
작업 시작 전 읽은 파일명을 첫 줄에 반드시 나열해.
형식: [읽은 파일: skills/index.md, skills/planner.md]
계획서는 반드시 "# 계획서" 헤더로 시작해야 해.
작업 완료 후 마지막 줄에 반드시 NEXT:생성자 를 출력해.

=== skills/index.md ===
${index || "(없음)"}

=== skills/planner.md ===
${skill || "(없음)"}

=== memory/기획서.txt (기존 기획서) ===
${plan || "(없음)"}
`.trim();

  return await callLLM(systemPrompt, userInput);
}

// ──────────────────────────────
// 생성자
// ──────────────────────────────
export async function runGenerator(memory: Memory): Promise<string> {
  const index       = memory.readSkill("index.md");
  const skill       = memory.readSkill("generator.md");
  const plan        = memory.read("기획서.txt");
  const workLog     = memory.read("작업일지.txt");
  const errorReport = memory.read("오류보고서.txt");

  const systemPrompt = `
너는 생성자야. 기획서를 바탕으로 실제로 작동하는 코드를 작성하는 것이 너의 유일한 역할이야.
기획서에 없는 것을 임의로 추가하지 마.
작업 시작 전 읽은 파일명을 첫 줄에 반드시 나열해.
형식: [읽은 파일: skills/index.md, skills/generator.md, memory/기획서.txt]
작업 완료 후 마지막 줄에 반드시 NEXT:평가자 를 출력해.

=== skills/index.md ===
${index || "(없음)"}

=== skills/generator.md ===
${skill || "(없음)"}

=== memory/기획서.txt ===
${plan || "(없음 - 계획자를 먼저 실행하세요)"}

=== memory/작업일지.txt (이전 작업 기록) ===
${workLog || "(없음)"}

=== memory/오류보고서.txt (평가자 피드백) ===
${errorReport || "(없음)"}
`.trim();

  return await callLLM(systemPrompt, "기획서를 읽고 코드 작성을 시작해.");
}

// ──────────────────────────────
// 평가자
// ──────────────────────────────
export async function runEvaluator(memory: Memory, retryCount: number): Promise<string> {
  const index       = memory.readSkill("index.md");
  const skill       = memory.readSkill("evaluator.md");
  const plan        = memory.read("기획서.txt");
  const workLog     = memory.read("작업일지.txt");
  const errorReport = memory.read("오류보고서.txt");

  const systemPrompt = `
너는 평가자야. 생성된 코드의 오류, 보안, 품질을 검토하는 것이 너의 유일한 역할이야.
눈으로만 보고 판단하지 마. 반드시 실행 테스트를 진행해.
칭찬하지 마. 문제를 찾는 것이 목적이야.
작업 시작 전 읽은 파일명을 첫 줄에 반드시 나열해.
현재 재시도 횟수: ${retryCount}/${MAX_RETRY}
오류 있으면: 오류보고서.txt 내용을 작성하고 마지막 줄에 NEXT:생성자 출력 (${MAX_RETRY}회 초과 시 STOP:사용자보고)
오류 없으면: 마지막 줄에 DONE 출력

=== skills/index.md ===
${index || "(없음)"}

=== skills/evaluator.md ===
${skill || "(없음)"}

=== memory/기획서.txt ===
${plan || "(없음)"}

=== memory/작업일지.txt ===
${workLog || "(없음)"}

=== memory/오류보고서.txt (이전 오류 기록) ===
${errorReport || "(없음)"}
`.trim();

  return await callLLM(systemPrompt, "코드를 평가하고 오류를 보고해.");
}

// ──────────────────────────────
// 메모리 저장
// ──────────────────────────────
export function saveMemory(persona: Persona, output: string, memory: Memory) {
  if (persona === "planner") {
    // 계획서 구간만 추출해서 저장 (LLM 출력 잡음 제거)
    memory.write("기획서.txt", extractPlan(output));
  } else if (persona === "generator") {
    memory.append("작업일지.txt", output);
    memory.delete("오류보고서.txt");
  } else if (persona === "evaluator") {
    const trigger = detectTrigger(output);
    if (trigger === "generator" || trigger === "stop") {
      memory.write("오류보고서.txt", output);
    }
  }
}
