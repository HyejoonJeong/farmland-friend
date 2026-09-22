import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { SpeakButton } from "@/components/SpeakButton";
import { useApp } from "@/lib/store";
import { Check, RotateCcw, Loader2 } from "lucide-react";

export const Route = createFileRoute("/situation")({
  head: () => ({
    meta: [
      { title: "말씀 확인 · 농사 도우미" },
      { name: "description", content: "들으신 내용이 맞는지 확인해 주세요." },
    ],
  }),
  component: SituationPage,
});

function SituationPage() {
  const { transcript, region, setIntent } = useApp();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!transcript) nav({ to: "/listen" });
  }, [transcript, nav]);

  const confirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript, region }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setIntent(data);
      if (data.needsClarification) nav({ to: "/clarify" });
      else nav({ to: "/intent" });
    } catch (e) {
      console.error(e);
      setError("분석 중 문제가 생겼어요. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  const speakText = `이렇게 말씀하신 게 맞을까요? ${transcript}`;

  return (
    <PageShell back="/listen" step={{ current: 2, total: 5 }}>
      <h1 className="mt-4 text-[30px] leading-tight font-black">
        이렇게 말씀하신 게<br />
        맞을까요?
      </h1>
      <div className="mt-2">
        <SpeakButton text={speakText} auto label="다시 들려주기" />
      </div>

      <blockquote className="mt-5 rounded-2xl border-2 border-primary/40 bg-card p-5 text-[22px] leading-relaxed font-semibold">
        “{transcript}”
      </blockquote>

      {error && (
        <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-[19px] font-semibold text-destructive">
          {error}
        </p>
      )}

      <div className="mt-auto space-y-3 pt-8">
        <button
          type="button"
          onClick={confirm}
          disabled={loading}
          className="btn-huge flex w-full items-center justify-center gap-2 bg-primary text-primary-foreground shadow-lg active:scale-[0.98] disabled:opacity-70"
          style={{ minHeight: 80, fontSize: 26 }}
        >
          {loading ? (
            <>
              <Loader2 className="h-7 w-7 animate-spin" /> 확인 중...
            </>
          ) : (
            <>
              <Check className="h-7 w-7" /> 네, 맞아요
            </>
          )}
        </button>
        <Link
          to="/listen"
          className="btn-huge flex w-full items-center justify-center gap-2 border-2 border-border bg-card text-foreground"
        >
          <RotateCcw className="h-6 w-6" /> 아니요, 다시 말할래요
        </Link>
      </div>
    </PageShell>
  );
}