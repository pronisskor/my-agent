import * as vscode from "vscode";
import { Memory } from "./memory";
import {
  Persona,
  MAX_RETRY,
  detectTrigger,
  runPlanner,
  runGenerator,
  runEvaluator,
  saveMemory,
} from "./agent";

// ──────────────────────────────
// 확장 활성화
// ──────────────────────────────
export function activate(context: vscode.ExtensionContext) {
  const provider = new AgentViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("my-agent.chatView", provider)
  );
}

export function deactivate() {}

// ──────────────────────────────
// 웹뷰 프로바이더
// ──────────────────────────────
class AgentViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private memory?: Memory;
  private currentPersona: Persona = "planner";
  private retryCount = 0;
  private isRunning = false;

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml();

    // 워크스페이스 루트 설정
    const workspaceRoot =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
    if (workspaceRoot) {
      this.memory = new Memory(workspaceRoot);
    }

    // 웹뷰에서 메시지 수신
    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === "userInput") {
        await this.handleUserInput(msg.text);
      } else if (msg.type === "reset") {
        this.reset();
      }
    });
  }

  // ──────────────────────────────
  // 사용자 입력 처리
  // ──────────────────────────────
  private async handleUserInput(userInput: string) {
    if (this.isRunning) { return; }
    if (!this.memory) {
      this.postMessage("system", "⚠️ 워크스페이스 폴더를 먼저 열어주세요.");
      return;
    }

    this.isRunning = true;
    this.postMessage("user", userInput);

    try {
      await this.runLoop(userInput);
    } catch (e: any) {
      this.postMessage("system", `❌ 오류: ${e.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  // ──────────────────────────────
  // 에이전트 루프
  // ──────────────────────────────
  private async runLoop(userInput: string) {
    let input = userInput;

    while (true) {
      this.postMessage("system", `▶ 페르소나: ${this.getPersonaLabel()}`);

      let output = "";

      if (this.currentPersona === "planner") {
        output = await runPlanner(this.memory!, input);
      } else if (this.currentPersona === "generator") {
        output = await runGenerator(this.memory!);
      } else if (this.currentPersona === "evaluator") {
        output = await runEvaluator(this.memory!, this.retryCount);
      }

      // 출력 표시
      this.postMessage("assistant", output);

      // 메모리 저장
      saveMemory(this.currentPersona, output, this.memory!);

      // 트리거 감지
      const trigger = detectTrigger(output);
      this.postMessage("system", `🔁 트리거: ${trigger ?? "없음"}`);

      if (trigger === "generator") {
        if (this.currentPersona === "evaluator") {
          this.retryCount++;
          if (this.retryCount > MAX_RETRY) {
            this.postMessage("system", `⛔ ${MAX_RETRY}회 재시도 실패. 오류보고서를 확인해주세요.`);
            break;
          }
          this.postMessage("system", `🔄 재시도 ${this.retryCount}/${MAX_RETRY}`);
        }
        this.currentPersona = "generator";

      } else if (trigger === "evaluator") {
        this.retryCount = 0;
        this.currentPersona = "evaluator";

      } else if (trigger === "planner") {
        this.currentPersona = "planner";
        this.retryCount = 0; // 계획자로 돌아올 때 재시도 횟수 초기화
        break; // 사용자 입력 대기

      } else if (trigger === "done") {
        this.postMessage("system", "✅ 모든 작업 완료!");
        this.currentPersona = "planner";
        this.retryCount = 0;
        break;

      } else if (trigger === "stop") {
        this.postMessage("system", "⛔ 작업 중단. 사용자 확인이 필요합니다.");
        break;

      } else {
        // 트리거 없음 → 사용자 입력 대기
        this.postMessage("system", "💬 다음 지시를 입력해주세요.");
        break;
      }

      input = ""; // 루프 이후 input 초기화
    }
  }

  // ──────────────────────────────
  // 리셋
  // ──────────────────────────────
  private reset() {
    this.currentPersona = "planner";
    this.retryCount = 0;
    this.isRunning = false;
    this.postMessage("system", "🔄 초기화 완료. 계획자부터 다시 시작합니다.");
  }

  private getPersonaLabel(): string {
    const map: Record<Persona, string> = {
      planner: "계획자 🗂",
      generator: "생성자 ⚙️",
      evaluator: "평가자 🔍",
    };
    return map[this.currentPersona];
  }

  // ──────────────────────────────
  // 웹뷰로 메시지 전송
  // ──────────────────────────────
  private postMessage(role: string, text: string) {
    this._view?.webview.postMessage({ role, text });
  }

  // ──────────────────────────────
  // 채팅 UI HTML
  // ──────────────────────────────
  private getHtml(): string {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-sideBar-background);
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
  #header {
    padding: 8px 12px;
    background: var(--vscode-titleBar-activeBackground);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: bold;
    font-size: 12px;
  }
  #reset-btn {
    background: transparent;
    border: 1px solid var(--vscode-button-border);
    color: var(--vscode-foreground);
    padding: 2px 8px;
    cursor: pointer;
    border-radius: 3px;
    font-size: 11px;
  }
  #chat {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .msg {
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .msg.user {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    align-self: flex-end;
    max-width: 85%;
  }
  .msg.assistant {
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    align-self: flex-start;
    max-width: 100%;
  }
  .msg.system {
    background: transparent;
    color: var(--vscode-descriptionForeground);
    font-size: 11px;
    text-align: center;
    border-top: 1px dashed var(--vscode-panel-border);
    border-bottom: 1px dashed var(--vscode-panel-border);
    padding: 4px;
  }
  #input-area {
    padding: 8px 12px;
    border-top: 1px solid var(--vscode-panel-border);
    display: flex;
    gap: 6px;
  }
  #input {
    flex: 1;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 12px;
    resize: none;
    font-family: inherit;
  }
  #send-btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  }
  #send-btn:hover { opacity: 0.9; }
</style>
</head>
<body>
<div id="header">
  <span>🤖 My Agent</span>
  <button id="reset-btn" onclick="reset()">초기화</button>
</div>
<div id="chat"></div>
<div id="input-area">
  <textarea id="input" rows="2" placeholder="무엇을 만들어 드릴까요?"></textarea>
  <button id="send-btn" onclick="send()">전송</button>
</div>

<script>
  const vscode = acquireVsCodeApi();
  const chat = document.getElementById('chat');
  const input = document.getElementById('input');

  // 메시지 수신
  window.addEventListener('message', (event) => {
    const { role, text } = event.data;
    addMessage(role, text);
  });

  function addMessage(role, text) {
    const div = document.createElement('div');
    div.className = 'msg ' + role;
    div.textContent = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }

  function send() {
    const text = input.value.trim();
    if (!text) { return; }
    vscode.postMessage({ type: 'userInput', text });
    input.value = '';
  }

  function reset() {
    chat.innerHTML = '';
    vscode.postMessage({ type: 'reset' });
  }

  // Enter 전송, Shift+Enter 줄바꿈
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
</script>
</body>
</html>`;
  }
}
