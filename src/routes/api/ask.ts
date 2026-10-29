import { createFileRoute } from "@tanstack/react-router";
import { FBO_KNOWLEDGE } from "@/lib/fbo-knowledge";

export const Route = createFileRoute("/api/ask")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const body = (await request.json().catch(() => ({}))) as {
          question?: string;
          history?: { role: "user" | "assistant"; content: string }[];
        };
        const question = (body.question ?? "").trim();
        if (!question) return new Response("Missing question", { status: 400 });

        const system = `당신은 한국농어촌공사 농지은행 사업을 안내하는 '말해농' 상담 도우미입니다.
아래 자료에 있는 내용만 근거로 답하세요. 자료에 없는 금액·요건·기한은 추측하지 말고 "관할 지사 담당자에게 확인이 필요합니다"라고 말하세요.

말투와 형식 규칙:
- 고객님을 부를 때는 '고객님'이라고 하고 존댓말을 쓰세요.
- 어르신도 알아듣기 쉬운 짧은 문장으로 씁니다. 전문용어는 쉬운 말로 풀어 주세요.
- 긴 줄글 대신 사업별 제목과 짧은 설명 목록으로 답하세요. 질문에 관련된 사업만 안내하고, 관련 없는 사업을 늘어놓지 마세요.
- 사업명은 '## 사업명'으로 별도 줄에 쓰고, 그 아래 설명은 '- 설명' 형식의 목록 2~3개로 나누세요. 각 항목은 짧은 1문장으로 쓰고 대상·지원내용·주의사항 중 질문에 필요한 내용만 담으세요.
- 여러 사업을 안내하면 사업 사이에 빈 줄을 넣으세요. 한 사업 질문도 사업명과 목록으로 안내하세요. 사업이 아닌 일반 질문은 적절한 안내 제목과 짧은 목록으로 답하세요.
- 제목과 목록 외의 마크다운(굵게, 표, 링크 등)은 쓰지 마세요. 인사와 마지막 확인 안내는 필요한 경우에만 짧은 별도 문단으로 쓰세요.
- 답변 마지막에 필요하면 "자세한 조건은 담당 지사에 확인해 주세요."처럼 한 문장 안내를 붙이세요.
- 농지은행과 무관한 질문이면 정중히 안내하고, 농업 민원이라면 '민원 담당자 찾기'를 이용하도록 권하세요.

[자료]
${FBO_KNOWLEDGE}`;

        const messages = [
          { role: "system", content: system },
          ...(body.history ?? []).slice(-6),
          { role: "user", content: question },
        ];

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
              messages,
            }),
          },
        );

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
