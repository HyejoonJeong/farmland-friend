import { createFileRoute } from "@tanstack/react-router";

// Retired after migration. Never call Lovable's metered AI gateway here.
export const Route = createFileRoute("/api/survey-ask")({
  server: { handlers: {
    POST: async () => Response.json(
      { error: "서비스가 업데이트되었습니다. 페이지를 새로고침해 주세요." },
      { status: 410, headers: { "Cache-Control": "no-store" } },
    ),
  } },
});
