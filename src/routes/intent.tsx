import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { PageShell } from "@/components/PageShell";
import { SpeakButton } from "@/components/SpeakButton";
import { useApp } from "@/lib/store";
import { INTENTS } from "@/lib/data";
import { INTENT_META } from "@/lib/clarify-flow";
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
  const info = INTENTS.find((i) => i.key === intent.intent);
  if (!info) {
    nav({ to: "/listen" });
    return null;
  }

  const meta = INTENT_META[info.key];
  const title = meta?.displayName ?? info.label;
  const desc = meta?.description ?? info.meaning;
  const speak = `이런 업무로 안내해드릴게요. ${title}. ${desc} 맞으시면 담당자 연결하기 버튼을 눌러 주세요.`;

  return (
    <PageShell back="/situation" step={{ current: 3, total: 5 }}>
      <div className="mt-3 text-lg font-bold text-primary">3단계 · 담당 업무 확인</div>
      <h1 className="mt-1 text-[30px] leading-tight font-black">
        이런 업무로 안내해드릴게요
      </h1>
      <div className="mt-2">
        <SpeakButton text={speak} auto label="설명 듣기" />
      </div>

      <section className="mt-5 rounded-3xl border-2 border-primary/40 bg-card p-5 shadow-sm">
        <p className="text-[28px] font-black text-primary">{title}</p>
        <p className="mt-1 text-[17px] font-semibold text-muted-foreground">{info.business}</p>
        <p className="mt-3 text-[21px] leading-relaxed">{desc}</p>
        <div className="mt-4 rounded-2xl bg-secondary/60 p-4 text-[20px]">
          <span className="font-bold">이해한 내용: </span>
          {intent.summary}
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
          <Check className="h-7 w-7" /> 담당자 연결하기
        </Link>
        <Link
          to="/listen"
          className="btn-huge flex w-full items-center justify-center gap-2 border-2 border-border bg-card text-foreground"
        >
          <RotateCcw className="h-6 w-6" /> 다른 업무 찾아보기
        </Link>
      </div>
    </PageShell>
  );
}