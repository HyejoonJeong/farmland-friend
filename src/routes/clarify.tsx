import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { SpeakButton } from "@/components/SpeakButton";
import { useApp } from "@/lib/store";
import { startRecorder, type Recorder } from "@/lib/recorder";
import { Mic, Square, Loader2 } from "lucide-react";

export const Route = createFileRoute("/clarify")({
  head: () => ({
    meta: [
      { title: "확인 질문 · 농사 도우미" },
      { name: "description", content: "정확한 안내를 위해 짧은 확인 질문에 답해 주세요." },
    ],
  }),
  component: ClarifyPage,
});

function ClarifyPage() {
  const { intent, transcript, region, appendClarification, setIntent } = useApp();
  const nav = useNavigate();
  const [status, setStatus] = useState<"idle" | "recording" | "processing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const recRef = useRef<Recorder | null>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!intent) nav({ to: "/situation" });
  }, [intent, nav]);

  const question =
    intent?.followUp ??
    "말씀 주신 내용이 조금 헷갈립니다. 조금 더 자세히 알려 주세요.";

  const start = async () => {
    setError(null);
    try {
      const rec = await startRecorder(setLevel);
      recRef.current = rec;
      startedAt.current = Date.now();
      setStatus("recording");
    } catch {
      setError("마이크를 사용할 수 없어요.");
    }
  };

  const stop = async () => {
    const rec = recRef.current;
    if (!rec) return;
    setStatus("processing");
    const dur = Date.now() - startedAt.current;
    const blob = await rec.stop();
    recRef.current = null;
    if (dur < 500) {
      setStatus("idle");
      setError("조금 더 길게 말씀해 주세요.");
      return;
    }
    try {
      const form = new FormData();
      form.append("file", blob, "clarify");
      const s = await fetch("/api/stt", { method: "POST", body: form });
      if (!s.ok) throw new Error();
      const { text } = (await s.json()) as { text: string };
      appendClarification(text);
      const res = await fetch("/api/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript, region, clarification: text }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setIntent(data);
      nav({ to: "/intent" });
    } catch {
      setError("문제가 생겼어요. 다시 시도해 주세요.");
      setStatus("idle");
    }
  };

  useEffect(() => () => recRef.current?.cancel(), []);

  const recording = status === "recording";
  const processing = status === "processing";

  return (
    <PageShell back="/situation" step={{ current: 3, total: 5 }}>
      <h1 className="mt-4 text-[30px] leading-tight font-black">
        한 가지만 더 여쭐게요
      </h1>
      <p className="mt-4 rounded-2xl bg-accent/25 p-5 text-[22px] font-semibold leading-relaxed">
        {question}
      </p>
      <div className="mt-3">
        <SpeakButton text={question} auto label="질문 다시 듣기" />
      </div>

      <div className="mt-10 grid place-items-center">
        <div className="relative grid h-44 w-44 place-items-center">
          {recording && (
            <span className="mic-ring absolute inset-0 rounded-full bg-primary/40" />
          )}
          <button
            type="button"
            onClick={recording ? stop : start}
            disabled={processing}
            className={`relative grid h-36 w-36 place-items-center rounded-full shadow-xl active:scale-95 ${
              recording
                ? "bg-destructive text-destructive-foreground"
                : "bg-primary text-primary-foreground"
            }`}
            style={{
              transform: recording ? `scale(${1 + level * 0.15})` : undefined,
            }}
            aria-label={recording ? "정지" : "답변 녹음"}
          >
            {processing ? (
              <Loader2 className="h-14 w-14 animate-spin" />
            ) : recording ? (
              <Square className="h-14 w-14" />
            ) : (
              <Mic className="h-14 w-14" />
            )}
          </button>
        </div>
        <p className="mt-4 text-[20px] font-bold">
          {processing
            ? "정리하는 중..."
            : recording
              ? "다 답하시면 눌러 주세요"
              : "답을 말씀해 주세요"}
        </p>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-[19px] font-semibold text-destructive">
          {error}
        </p>
      )}
    </PageShell>
  );
}