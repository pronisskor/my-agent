import * as http from "http";

const MODEL_NAME = "google/gemma-4-e4b"; // ✅ 수정: 실제 모델명으로 변경

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function callLLM(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
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
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 1234,
        path: "/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            const message = json.choices?.[0]?.message;

            // ✅ 수정: gemma4는 thinking 모델이라 content가 비어있고
            // reasoning_content에 실제 답변이 들어옴 → 둘 다 확인
            const content =
              (message?.content && message.content.trim() !== ""
                ? message.content
                : message?.reasoning_content) ?? "";

            resolve(content);
          } catch (e) {
            reject(new Error("LLM 응답 파싱 실패: " + data));
          }
        });
      }
    );

    req.on("error", (e) =>
      reject(new Error("LM Studio 연결 실패: " + e.message))
    );
    req.write(body);
    req.end();
  });
}
