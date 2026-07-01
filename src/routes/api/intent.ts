import { createFileRoute } from "@tanstack/react-router";
import { INTENTS, type IntentKey } from "@/lib/data";

export const Route = createFileRoute("/api/intent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const body = (await request.json().catch(() => ({}))) as {
          text?: string;
          region?: string;
          clarification?: string;
        };
        const text = (body.text ?? "").trim();
        if (!text) return new Response("Missing text", { status: 400 });

        const catalogue = INTENTS.map(
          (i) =>
            `- ${i.key}: ${i.label} (담당업무: ${i.business}). 예: ${i.examples.slice(0, 4).join(" / ")}`,
        ).join("\n");

        const system = `당신은 한국 농촌 고객님의 민원 음성 발화를 이해해 담당 업무 카테고리로 분류하는 도우미입니다.
지역 방언과 완곡한 표현을 모두 이해합니다. 지역: ${body.region ?? "미상"}.
아래 카테고리 중 정확히 하나를 고르세요:
${catalogue}

반드시 아래 JSON 스키마로만 응답하세요. 다른 텍스트, 마크다운, 코드펜스 금지.
{
  "intent": "카테고리 key",
  "confidence": 0~1 사이 소수,
  "summary": "한 문장으로 고객님의 상황을 쉬운 말로 요약 (존댓말)",
  "needsClarification": true/false,
  "followUp": "확신이 낮을 때만 한 문장 후속 질문, 아니면 빈 문자열"
}
confidence가 0.7 미만이거나 두 카테고리 중 헷갈리면 needsClarification=true 로 하고 followUp에 고객님이 예/아니오로 답할 수 있는 짧은 질문을 넣으세요.`;

        const userMsg = body.clarification
          ? `발화: "${text}"\n추가 답변: "${body.clarification}"`
          : `발화: "${text}"`;

        const res = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: system },
                { role: "user", content: userMsg },
              ],
              response_format: { type: "json_object" },
            }),
          },
        );

        if (!res.ok) {
          const t = await res.text().catch(() => "");
          return new Response(t || "Intent failed", { status: res.status });
        }
        const data = await res.json();
        const content: string = data.choices?.[0]?.message?.content ?? "{}";
        let parsed: {
          intent?: string;
          confidence?: number;
          summary?: string;
          needsClarification?: boolean;
          followUp?: string;
        };
        try {
          parsed = JSON.parse(content);
        } catch {
          parsed = {};
        }

        const validKeys = INTENTS.map((i) => i.key) as string[];
        const intent = (validKeys.includes(parsed.intent ?? "")
          ? parsed.intent
          : "farmland_rent_out") as IntentKey;
        const confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0.5));
        const needsClar =
          Boolean(parsed.needsClarification) || confidence < 0.7;

        return Response.json({
          intent,
          confidence,
          summary: parsed.summary ?? text,
          needsClarification: needsClar && !body.clarification,
          followUp: needsClar ? (parsed.followUp ?? "혹시 조금 더 자세히 말씀해 주실 수 있을까요?") : "",
        });
      },
    },
  },
});