import { createFileRoute } from "@tanstack/react-router";
import SURVEY_MANUAL from "@/lib/survey-manual.txt?raw";

export const Route = createFileRoute("/api/survey-ask")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const body = (await request.json().catch(() => ({}))) as {
          question?: string;
          history?: { role: "user" | "assistant"; content: string }[];
        };
        const question = (body.question ?? "").trim().slice(0, 1000);
        if (!question) return new Response("Missing question", { status: 400 });

        const system = `당신은 한국농어촌공사 '농지 전수조사 상담센터'의 음성 상담 도우미입니다.
아래 [상담 매뉴얼]에 있는 내용만 근거로 답하세요. 매뉴얼에 없는 내용, 개별 농지의 처분 여부 판단, 확정되지 않은 일정·금액은 추측하지 말고 "관할 시·군 담당자에게 확인이 필요합니다"라고 안내하세요.
특례기간·특별조치법은 아직 국회 협의 중이라는 점을 필요할 때 함께 알려 주세요.

말투와 형식 규칙:
- 고객님이라고 부르고 존댓말을 쓰세요. 불안해하는 고객님을 먼저 안심시키는 따뜻한 말투로 답하세요.
- 어르신도 알아듣기 쉬운 짧은 문장, 3~6문장 이내. 표나 마크다운 기호(#, *, **)는 쓰지 마세요.
- 농지은행 사업(매도·임대수탁·농지연금 등) 세부 문의는 관할 지사 농지은행 또는 1577-7770, 조치방향·법적 검토 세부 문의는 관할 시·군 담당자에게 안내하세요.
- 농지법 위반 신고를 원하시면 농지 전수조사 상담센터 1811-8852(평일 9시~16시)로 안내하세요.

[상담 매뉴얼]
${SURVEY_MANUAL}`;

        const messages = [
          { role: "system", content: system },
          ...(body.history ?? []).slice(-6),
          { role: "user", content: question },
        ];

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages }),
        });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          return new Response(t || "Ask failed", { status: res.status });
        }
        const data = await res.json();
        const answer: string =
          data.choices?.[0]?.message?.content?.trim() ??
          "죄송합니다. 답변을 만들지 못했어요. 다시 한 번 물어봐 주세요.";
        return Response.json({ answer });
      },
    },
  },
});
