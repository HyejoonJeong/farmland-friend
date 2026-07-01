import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/stt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const inForm = await request.formData();
        const file = inForm.get("file");
        if (!(file instanceof Blob)) {
          return new Response("Missing file", { status: 400 });
        }

        // Choose extension for OpenAI to detect format
        const type = (file.type || "").split(";")[0];
        const ext =
          type === "audio/mp4" || type === "audio/m4a"
            ? "mp4"
            : type === "audio/mpeg"
              ? "mp3"
              : type === "audio/wav"
                ? "wav"
                : "webm";

        const upstream = new FormData();
        upstream.append("model", "openai/gpt-4o-mini-transcribe");
        upstream.append("file", file, `recording.${ext}`);
        upstream.append("language", "ko");

        const res = await fetch(
          "https://ai.gateway.lovable.dev/v1/audio/transcriptions",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${key}` },
            body: upstream,
          },
        );
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          return new Response(txt || "STT failed", { status: res.status });
        }
        const data = await res.json();
        return Response.json({ text: data.text ?? "" });
      },
    },
  },
});