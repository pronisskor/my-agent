import { Memory } from "./memory";
import { callLLM } from "./llm";

// ──────────────────────────────
// 타입 정의
// ──────────────────────────────
export type Persona = "planner" | "generator" | "evaluator";
export type Trigger =
  | "generator"
  | "evaluator"
  | "planner"
  | "done"
  | "stop"
  | "feedback"
  | null;

export const MAX_RETRY = 3;

// ──────────────────────────────
// 트리거 감지
// ──────────────────────────────
export function detectTrigger(output: string): Trigger {
  if (/NEXT:생성자/i.test(output))       return "generator";
  if (/NEXT:평가자/i.test(output))       return "evaluator";
  if (/NEXT:계획자/i.test(output))       return "planner";
  if (/\bDONE\b/.test(output))           return "done";
  if (/STOP:사용자보고/i.test(output))   return "stop";
  if (/FEEDBACK:반영중/i.test(output))   return "feedback";
  return null;
}

// ──────────────────────────────
// 메모리 저장
// ──────────────────────────────
export function saveMemory(
  persona: Persona,
  output: string,
  memory: Memory
): void {
  if (persona === "planner") {
    // 기획서 블록만 추출해서 저장
    const match = output.match(/## 계획서 초안[\s\S]*?(?=\n---|\n##|$)/);
    if (match) {
      memory.write("기획서.txt", match[0].trim());
    }
  } else if (persona === "generator") {
    // 작업일지에 누적 append
    const timestamp = new Date().toLocaleString("ko-KR");
    memory.append("작업일지.txt", `\n[기록일시: ${timestamp}]\n${output.slice(0, 500)}`);
  } else if (persona === "evaluator") {
    // 오류보고서 저장 (DONE이면 삭제)
    if (/\bDONE\b/.test(output)) {
      memory.delete("오류보고서.txt");
    } else {
      memory.write("오류보고서.txt", output);
    }
  }
}

// ──────────────────────────────
// 계획자 실행
// ──────────────────────────────
export async function runPlanner(
  memory: Memory,
  userInput: string
): Promise<string> {

  // ★ Skill 강제 주입: planner.md 반드시 읽음
  const plannerSkill = memory.readSkill("planner.md");

  // 이전 기획서가 있으면 컨텍스트로 추가 (피드백 루프용)
  const prevPlan = memory.read("기획서.txt");
  const prevContext = prevPlan
    ? `\n\n---\n[이전 기획서]\n${prevPlan}\n---\n`
    : "";

  const systemPrompt = [
    plannerSkill,
    prevContext,
  ].filter(Boolean).join("\n");

  return callLLM(systemPrompt, userInput);
}

// ──────────────────────────────
// 생성자 실행
// ──────────────────────────────
export async function runGenerator(memory: Memory): Promise<string> {

  // ★ Skill 강제 주입: generator.md 반드시 읽음
  const generatorSkill = memory.readSkill("generator.md");

  // 기획서는 반드시 읽음
  const plan = memory.read("기획서.txt");
  const planContext = plan
    ? `\n\n---\n[기획서]\n${plan}\n---`
    : "\n\n---\n[경고: 기획서가 없습니다. 계획자를 먼저 실행하세요.]\n---";

  // 오류보고서가 있으면 수정 모드로 주입
  const errorReport = memory.read("오류보고서.txt");
  const errorContext = errorReport
    ? `\n\n---\n[평가자 오류보고서 — 반드시 이 오류를 수정해야 한다]\n${errorReport}\n---`
    : "";

  // 작업일지가 있으면 컨텍스트로 추가
  const workLog = memory.read("작업일지.txt");
  const workContext = workLog
    ? `\n\n---\n[작업일지]\n${workLog}\n---`
    : "";

  const systemPrompt = [
    generatorSkill,
    planContext,
    errorContext,
    workContext,
  ].filter(Boolean).join("\n");

  // 오류보고서가 있으면 수정 지시, 없으면 기술계획서 작성 지시
  const userMessage = errorReport
    ? "오류보고서를 참고해서 해당 오류를 수정하고 NEXT:평가자를 출력해줘."
    : "기획서를 읽고 기술 구현 계획서를 작성해서 사용자에게 제출해줘.";

  return callLLM(systemPrompt, userMessage);
}

// ──────────────────────────────
// 평가자 실행
// ──────────────────────────────
export async function runEvaluator(
  memory: Memory,
  retryCount: number
): Promise<string> {

  // ★ Skill 강제 주입: evaluator.md 반드시 읽음
  const evaluatorSkill = memory.readSkill("evaluator.md");

  // 기획서 반드시 읽음 (완료 기준 대조용)
  const plan = memory.read("기획서.txt");
  const planContext = plan
    ? `\n\n---\n[기획서 — 완료 기준 대조 기준]\n${plan}\n---`
    : "";

  // 작업일지 읽음 (생성된 파일 목록 파악)
  const workLog = memory.read("작업일지.txt");
  const workContext = workLog
    ? `\n\n---\n[작업일지 — 생성된 파일 및 특이사항]\n${workLog}\n---`
    : "";

  // 이전 오류보고서 읽음 (이력 파악)
  const prevError = memory.read("오류보고서.txt");
  const errorContext = prevError
    ? `\n\n---\n[이전 오류보고서 — 이력 참고]\n${prevError}\n---`
    : "";

  const systemPrompt = [
    evaluatorSkill,
    planContext,
    workContext,
    errorContext,
  ].filter(Boolean).join("\n");

  const userMessage = `현재 재시도 횟수: ${retryCount}/${MAX_RETRY}\n평가를 시작해줘. 정적 분석과 CMD 실행 테스트를 반드시 수행해.`;

  return callLLM(systemPrompt, userMessage);
}
