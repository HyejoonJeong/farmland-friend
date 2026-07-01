import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { PageShell } from "@/components/PageShell";
import { SpeakButton } from "@/components/SpeakButton";
import { useApp } from "@/lib/store";
import { INTENTS } from "@/lib/data";
import { Check, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/intent")({
  head: () => ({
    meta: [
      { title: "업무 확인 · 농사 도우미" },
      { name: "description", content: "찾아드린 담당 업무가 맞는지 확인해 주세요." },
    ],
  }),
  component: IntentPage,
});

function IntentPage() {
  const { intent, transcript } = useApp();
  const nav = useNavigate();

  useEffect(() => {
    if (!intent) nav({ to: "/listen" });
  }, [intent, nav]);

  if (!intent) return null;
  const info = INTENTS.find((i) => i.key === intent.intent)!;

  const speak = `${intent.summary} 이 내용은 ${info.label} 관련 업무로 보입니다. 맞으시면 아래 초록색 버튼을 눌러 주세요.`;
  const conf = Math.round(intent.confidence * 100);

  return (
    <PageShell back="/situation" step={{ current: 3, total: 5 }}>
      <div className="mt-3 text-lg font-bold text-primary">3단계 · 담당 업무 확인</div>
      <h1 className="mt-1 text-[30px] leading-tight font-black">
        이 일이 맞으실까요?
      </h1>
      <div className="mt-2">
        <SpeakButton text={speak} auto label="설명 듣기" />
      </div>

      <section className="mt-5 rounded-3xl border-2 border-primary/40 bg-card p-5 shadow-sm">
        <p className="text-[19px] text-muted-foreground">담당 업무</p>
        <p className="mt-1 text-[28px] font-black text-primary">{info.label}</p>
        <p className="mt-3 text-[19px] font-semibold text-foreground/80">
          {info.business}
        </p>
        <div className="mt-4 rounded-2xl bg-secondary/60 p-4 text-[20px]">
          <span className="font-bold">이해한 내용: </span>
          {intent.summary}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[17px] text-muted-foreground">
          <span>확인 정도</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary"
              style={{ width: `${conf}%` }}
            />
          </div>
          <span className="font-bold">{conf}%</span>
        </div>
      </section>

      <p className="mt-4 text-[18px] text-muted-foreground">
        원래 말씀: “{transcript}”
      </p>

      <div className="mt-auto space-y-3 pt-8">
        <Link
          to="/region"
          className="btn-huge flex w-full items-center justify-center gap-2 bg-primary text-primary-foreground shadow-lg active:scale-[0.98]"
          style={{ minHeight: 80, fontSize: 26 }}
        >
          <Check className="h-7 w-7" /> 네, 맞아요
        </Link>
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