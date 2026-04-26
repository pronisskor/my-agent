"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const memory_1 = require("./memory");
const agent_1 = require("./agent");
function activate(context) {
    const provider = new AgentViewProvider(context);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider("my-agent.chatView", provider));
}
function deactivate() { }
class AgentViewProvider {
    constructor(context) {
        this.context = context;
        this.currentPersona = "planner";
        this.retryCount = 0;
        this.isRunning = false;
        this.awaitingFeedback = false;
    }
    resolveWebviewView(webviewView) {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this.getHtml();
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
        if (workspaceRoot) {
            this.memory = new memory_1.Memory(workspaceRoot);
        }
        webviewView.webview.onDidReceiveMessage(async (msg) => {
            if (msg.type === "userInput") {
                await this.handleUserInput(msg.text);
            }
            else if (msg.type === "reset") {
                this.reset();
            }
        });
    }
    async handleUserInput(userInput) {
        if (this.isRunning) {
            return;
        }
        if (!this.memory) {
            this.postMessage("system", "⚠️ Please open a workspace folder first.");
            return;
        }
        this.isRunning = true;
        this.postMessage("user", userInput);
        try {
            if (this.awaitingFeedback) {
                this.awaitingFeedback = false;
                this.postMessage("system", `Sending feedback to ${this.getPersonaLabel()}...`);
            }
            await this.runLoop(userInput);
        }
        catch (e) {
            this.postMessage("system", `❌ Error: ${e.message}`);
        }
        finally {
            this.isRunning = false;
        }
    }
    async runLoop(userInput) {
        let input = userInput;
        while (true) {
            this.postMessage("system", `▶ Persona: ${this.getPersonaLabel()}`);
            let output = "";
            if (this.currentPersona === "planner") {
                output = await (0, agent_1.runPlanner)(this.memory, input);
            }
            else if (this.currentPersona === "generator") {
                output = await (0, agent_1.runGenerator)(this.memory);
            }
            else if (this.currentPersona === "evaluator") {
                output = await (0, agent_1.runEvaluator)(this.memory, this.retryCount);
            }
            this.postMessage("assistant", output);
            (0, agent_1.saveMemory)(this.currentPersona, output, this.memory);
            const trigger = (0, agent_1.detectTrigger)(output);
            this.postMessage("system", `🔁 Trigger: ${trigger ?? "none"}`);
            if (trigger === "generator") {
                if (this.currentPersona === "evaluator") {
                    this.retryCount++;
                    if (this.retryCount > agent_1.MAX_RETRY) {
                        this.postMessage("system", `⛔ Failed after ${agent_1.MAX_RETRY} retries. Check the error report.`);
                        break;
                    }
                    this.postMessage("system", `🔄 Retry ${this.retryCount}/${agent_1.MAX_RETRY}`);
                }
                this.currentPersona = "generator";
            }
            else if (trigger === "evaluator") {
                this.retryCount = 0;
                this.currentPersona = "evaluator";
            }
            else if (trigger === "planner") {
                this.currentPersona = "planner";
                this.retryCount = 0;
                break;
            }
            else if (trigger === "done") {
                this.postMessage("system", "✅ All tasks complete!");
                this.currentPersona = "planner";
                this.retryCount = 0;
                break;
            }
            else if (trigger === "stop") {
                this.postMessage("system", "⛔ Stopped. User review required.");
                break;
            }
            else if (trigger === "feedback") {
                this.awaitingFeedback = true;
                this.postMessage("system", `📝 ${this.getPersonaLabel()} waiting for feedback.`);
                break;
            }
            else {
                this.postMessage("system", "💬 Enter your next instruction.");
                break;
            }
            input = "";
        }
    }
    reset() {
        this.currentPersona = "planner";
        this.retryCount = 0;
        this.isRunning = false;
        this.awaitingFeedback = false;
        this.postMessage("system", "🔄 Reset. Starting from Planner.");
    }
    getPersonaLabel() {
        const map = {
            planner: "Planner 🗂",
            generator: "Generator ⚙️",
            evaluator: "Evaluator 🔍",
        };
        return map[this.currentPersona];
    }
    postMessage(role, text) {
        this._view?.webview.postMessage({ role, text });
    }
    getHtml() {
        return `<!DOCTYPE html>
<html lang="en">
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
  <button id="reset-btn" onclick="reset()">Reset</button>
</div>
<div id="chat"></div>
<div id="input-area">
  <textarea id="input" rows="2" placeholder="What would you like to build?"></textarea>
  <button id="send-btn" onclick="send()">Send</button>
</div>

<script>
  const vscode = acquireVsCodeApi();
  const chat = document.getElementById('chat');
  const input = document.getElementById('input');

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
