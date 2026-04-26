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
exports.callLLM = callLLM;
const http = __importStar(require("http"));
const MODEL_NAME = "google/gemma-4-e4b"; // ✅ 수정: 실제 모델명으로 변경
async function callLLM(systemPrompt, userMessage) {
    const body = JSON.stringify({
        model: MODEL_NAME,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 8192,
        stream: false,
    });
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: "127.0.0.1",
            port: 1234,
            path: "/v1/chat/completions",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
            },
        }, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    const json = JSON.parse(data);
                    const message = json.choices?.[0]?.message;
                    // ✅ 수정: gemma4는 thinking 모델이라 content가 비어있고
                    // reasoning_content에 실제 답변이 들어옴 → 둘 다 확인
                    const content = (message?.content && message.content.trim() !== ""
                        ? message.content
                        : message?.reasoning_content) ?? "";
                    resolve(content);
                }
                catch (e) {
                    reject(new Error("LLM 응답 파싱 실패: " + data));
                }
            });
        });
        req.on("error", (e) => reject(new Error("LM Studio 연결 실패: " + e.message)));
        req.write(body);
        req.end();
    });
}
