"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_RETRY = void 0;
exports.detectTrigger = detectTrigger;
exports.saveMemory = saveMemory;
exports.runPlanner = runPlanner;
exports.runGenerator = runGenerator;
exports.runEvaluator = runEvaluator;
const llm_1 = require("./llm");
exports.MAX_RETRY = 3;
// ──────────────────────────────
// Trigger detection (all English, ASCII only)
// ──────────────────────────────
function detectTrigger(output) {
    if (/NEXT\s*:\s*GENERATOR/i.test(output))
        return "generator";
    if (/NEXT\s*:\s*EVALUATOR/i.test(output))
        return "evaluator";
    if (/NEXT\s*:\s*PLANNER/i.test(output))
        return "planner";
    if (/\bDONE\b/.test(output))
        return "done";
    if (/\bSTOP\b/.test(output))
        return "stop";
    if (/\bFEEDBACK\b/.test(output))
        return "feedback";
    return null;
}
// ──────────────────────────────
// Memory save
// ──────────────────────────────
function saveMemory(persona, output, memory) {
    if (persona === "planner") {
        // Try to extract plan block, otherwise save full output
        const match = output.match(/## PLAN[\s\S]*?(?=\n---|\n##|$)/);
        if (match) {
            memory.write("plan.txt", match[0].trim());
        }
        else {
            memory.write("plan.txt", output.trim());
        }
    }
    else if (persona === "generator") {
        const timestamp = new Date().toISOString();
        memory.append("worklog.txt", `\n[${timestamp}]\n${output.slice(0, 500)}`);
    }
    else if (persona === "evaluator") {
        if (/\bDONE\b/.test(output)) {
            memory.delete("errorreport.txt");
        }
        else {
            memory.write("errorreport.txt", output);
        }
    }
}
// ──────────────────────────────
// Planner
// ──────────────────────────────
async function runPlanner(memory, userInput) {
    const skill = memory.readSkill("planner.md");
    const prevPlan = memory.read("plan.txt");
    const prevContext = prevPlan
        ? `\n\n---\n[PREVIOUS PLAN]\n${prevPlan}\n---\n`
        : "";
    const systemPrompt = [skill, prevContext].filter(Boolean).join("\n");
    return (0, llm_1.callLLM)(systemPrompt, userInput);
}
// ──────────────────────────────
// Generator
// ──────────────────────────────
async function runGenerator(memory) {
    const skill = memory.readSkill("generator.md");
    const plan = memory.read("plan.txt");
    const planContext = plan
        ? `\n\n---\n[PLAN]\n${plan}\n---`
        : "\n\n---\n[WARNING: No plan found. Planner must run first.]\n---";
    const errorReport = memory.read("errorreport.txt");
    const errorContext = errorReport
        ? `\n\n---\n[ERROR REPORT - You must fix these errors]\n${errorReport}\n---`
        : "";
    const workLog = memory.read("worklog.txt");
    const workContext = workLog
        ? `\n\n---\n[WORK LOG]\n${workLog}\n---`
        : "";
    const systemPrompt = [skill, planContext, errorContext, workContext]
        .filter(Boolean)
        .join("\n");
    const userMessage = errorReport
        ? "Fix the errors in the error report. End with NEXT:EVALUATOR."
        : "Read the plan and write all the code. End with NEXT:EVALUATOR.";
    return (0, llm_1.callLLM)(systemPrompt, userMessage);
}
// ──────────────────────────────
// Evaluator
// ──────────────────────────────
async function runEvaluator(memory, retryCount) {
    const skill = memory.readSkill("evaluator.md");
    const plan = memory.read("plan.txt");
    const planContext = plan
        ? `\n\n---\n[PLAN - use this as completion criteria]\n${plan}\n---`
        : "";
    const workLog = memory.read("worklog.txt");
    const workContext = workLog
        ? `\n\n---\n[WORK LOG]\n${workLog}\n---`
        : "";
    const prevError = memory.read("errorreport.txt");
    const errorContext = prevError
        ? `\n\n---\n[PREVIOUS ERROR REPORT]\n${prevError}\n---`
        : "";
    const systemPrompt = [skill, planContext, workContext, errorContext]
        .filter(Boolean)
        .join("\n");
    const userMessage = `Retry count: ${retryCount}/${exports.MAX_RETRY}. Evaluate the work log against the plan.`;
    return (0, llm_1.callLLM)(systemPrompt, userMessage);
}
