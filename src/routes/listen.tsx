import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { SpeakButton } from "@/components/SpeakButton";
import { useApp } from "@/lib/store";
import { startRecorder, type Recorder } from "@/lib/recorder";

export const Route = createFileRoute("/listen")({
  head: () => ({
    meta: [
      { title: "말씀해 주세요 · 농사 도우미" },
      { name: "description", content: "지금 상황을 편하게 말씀해 주세요. 음성으로 접수해 드립니다." },
    ],
  }),
  component: ListenPage,
});

const PROMPT =
  "지금 상황을 편하게 말씀해 주세요. 예를 들어, 농지를 맡기고 싶다, 농지연금 상담 받고 싶다, 이런 식으로 말씀하시면 됩니다. 다 말씀하시면 붉은색 정지 버튼을 눌러 주세요.";

function ListenPage() {
  const region = useApp((s) => s.region);
  const setTranscript = useApp((s) => s.setTranscript);
  const nav = useNavigate();
  const [status, setStatus] = useState<"idle" | "recording" | "processing" | "error">(
    "idle",
  );
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const recRef = useRef<Recorder | null>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!region) nav({ to: "/region" });
  }, [region, nav]);

  const start = async () => {
    setError(null);
    setLive("");
    try {
      const rec = await startRecorder(setLevel);
      recRef.current = rec;
      startedAt.current = Date.now();
      setStatus("recording");
    } catch (e) {
      console.error(e);
      setError("마이크를 사용할 수 없어요. 마이크 권한을 허용해 주세요.");
      setStatus("error");
    }
  };

  const stop = async () => {
    const rec = recRef.current;
    if (!rec) return;
    setStatus("processing");
    const dur = Date.now() - startedAt.current;
    const blob = await rec.stop();
    recRef.current = null;
    if (dur < 800 || blob.size < 2048) {
      setError("녹음이 너무 짧아요. 한 번 더 말씀해 주세요.");
      setStatus("idle");
      return;
    }
    const form = new FormData();
    form.append("file", blob, "recording");
    try {
      const res = await fetch("/api/stt", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { text: string };
      const text = (data.text ?? "").trim();
      if (!text) {
        setError("소리를 알아듣지 못했어요. 조금 더 크게 다시 말씀해 주세요.");
        setStatus("idle");
        return;
      }
      setLive(text);
      setTranscript(text);
      setTimeout(() => nav({ to: "/situation" }), 400);
    } catch (e) {
      console.error(e);
      setError("연결에 문제가 있어요. 잠시 후 다시 시도해 주세요.");
      setStatus("idle");
    }
  };

  useEffect(() => () => recRef.current?.cancel(), []);

  const recording = status === "recording";
  const processing = status === "processing";

  return (
    <PageShell back="/region" step={{ current: 2, total: 5 }}>
      <div className="mt-2 flex items-center gap-2 text-primary">
        <Mic className="h-6 w-6" />
        <span className="text-lg font-bold">2단계 · 말씀하기 ({region})</span>
      </div>
      <h1 className="mt-2 text-[30px] leading-tight font-black">
        {recording ? "듣고 있어요..." : "무엇을 도와 드릴까요?"}
      </h1>
      <p className="mt-2 text-[20px] text-muted-foreground">
        지금 상황을 편하게 말씀해 주세요.
      </p>
      <div className="mt-2">
        <SpeakButton text={PROMPT} auto label="안내 다시 듣기" />
      </div>

      <div className="mt-6 rounded-2xl bg-secondary/60 p-5 text-[19px] text-foreground/80">
        예) “농사를 못 짓게 돼서 논을 좀 맡기려고 합니다.”
        <br />예) “농지연금 상담 좀 받으려고요.”
        <br />예) “청년농인데 밭 좀 알아봐 주세요.”
      </div>

      <div className="mt-8 grid place-items-center">
        <div className="relative grid h-48 w-48 place-items-center">
          {recording && (
            <>
              <span
                className="mic-ring absolute inset-0 rounded-full bg-primary/40"
                style={{ animationDelay: "0s" }}
              />
              <span
                className="mic-ring absolute inset-0 rounded-full bg-primary/30"
                style={{ animationDelay: "0.5s" }}
              />
            </>
          )}
          <button
            type="button"
            onClick={recording ? stop : start}
            disabled={processing}
            aria-label={recording ? "녹음 정지" : "녹음 시작"}
            className={`relative grid h-40 w-40 place-items-center rounded-full shadow-xl transition active:scale-95 ${
              recording
                ? "bg-destructive text-destructive-foreground"
                : "bg-primary text-primary-foreground"
            }`}
            style={{
              transform: recording ? `scale(${1 + level * 0.15})` : undefined,
            }}
          >
            {processing ? (
              <Loader2 className="h-16 w-16 animate-spin" />
            ) : recording ? (
              <Square className="h-16 w-16" />
            ) : (
              <Mic className="h-16 w-16" />
            )}
          </button>
        </div>
        <p className="mt-4 text-[22px] font-bold">
          {processing
            ? "듣고 정리하는 중..."
            : recording
              ? "말씀이 끝나면 버튼을 눌러 주세요"
              : "버튼을 눌러 말씀 시작"}
        </p>
      </div>

      {live && (
        <div className="mt-4 rounded-2xl border-2 border-primary/30 bg-card p-4 text-[20px]">
          “{live}”
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-2xl bg-destructive/10 p-4 text-[19px] font-semibold text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6 text-center">
        <Link to="/help" className="text-[19px] font-semibold text-primary underline">
          말하기가 어렵나요? 도움 받기
        </Link>
      </div>
    </PageShell>
  );
}