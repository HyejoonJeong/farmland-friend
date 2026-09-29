import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { SpeakButton } from "@/components/SpeakButton";
import { useApp } from "@/lib/store";
import {
  CLARIFY_CASES,
  FALLBACK_MESSAGE,
  MAX_CLARIFY_ROUNDS,
  type ClarifyCaseId,
  type ClarifyOption,
} from "@/lib/clarify-flow";
import { RotateCcw } from "lucide-react";

export const Route = createFileRoute("/clarify")({
  head: () => ({
    meta: [
      { title: "확인 질문 · 말해농" },
      { name: "description", content: "정확한 안내를 위해 짧은 확인 질문에 답해 주세요." },
      { property: "og:title", content: "확인 질문 · 말해농" },
      { property: "og:description", content: "버튼 하나로 알맞은 농지은행 업무를 찾아 드려요." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClarifyPage,
});

function ClarifyPage() {
  const { intent, setIntent } = useApp();
  const nav = useNavigate();
  const [caseId, setCaseId] = useState<ClarifyCaseId | null>(null);
  useEffect(() => {
    if (caseId === null && intent?.caseId) setCaseId(intent.caseId);
  }, [intent, caseId]);
  const [round, setRound] = useState(1);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    // Read the live store (the hook returns the empty server snapshot during hydration).
    const live = useApp.getState().intent;
    if (!live) nav({ to: "/listen" });
    else if (!live.caseId && !fallback) nav({ to: "/intent" });
  }, [intent, nav, fallback]);

  if (!intent || !caseId) return null;
  const c = CLARIFY_CASES[caseId];

  const choose = (opt: ClarifyOption) => {
    const trail = [...(intent.trail ?? []), { question: c.question, answer: opt.label }];
    const t = opt.target;
    if ("intent" in t) {
      setIntent({ ...intent, intent: t.intent, trail, caseId: null, needsClarification: false, status: "CLARIFIED" });
      nav({ to: "/intent" });
      return;
    }
    if ("next" in t && round < MAX_CLARIFY_ROUNDS) {
      setIntent({ ...intent, trail });
      setCaseId(t.next);
      setRound(round + 1);
      return;
    }
    setIntent({ ...intent, intent: "general_consult", trail, caseId: null, needsClarification: false, status: "FALLBACK" });
    setFallback(true);
  };

  if (fallback) {
    return (
      <PageShell back="/listen">
        <h1 className="mt-6 text-[30px] leading-tight font-black">{FALLBACK_MESSAGE}</h1>
        <div className="mt-3">
          <SpeakButton text={FALLBACK_MESSAGE} auto label="다시 듣기" />
        </div>
        <div className="mt-auto pt-8">
          <Link
            to="/region"
            className="btn-huge flex w-full items-center justify-center bg-primary text-primary-foreground shadow-lg"
            style={{ minHeight: 80, fontSize: 26 }}
          >
            담당자 연결하기
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell back="/situation" step={{ current: 2, total: 5 }}>
      <p className="mt-4 text-lg font-bold text-primary">
        한 가지만 더 여쭐게요 ({round}/{MAX_CLARIFY_ROUNDS})
      </p>
      <h1 className="mt-2 text-[30px] leading-tight font-black" aria-live="polite">
        {c.question}
      </h1>
      <div className="mt-3">
        <SpeakButton key={caseId} text={c.question} auto label="질문 다시 듣기" />
      </div>

      <div className="mt-6 space-y-3">
        {c.options.map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => choose(o)}
            className="flex w-full items-center gap-4 rounded-3xl border-2 border-primary/30 bg-card p-5 text-left text-[22px] font-bold shadow-sm transition active:scale-[0.98] hover:border-primary"
            style={{ minHeight: 84 }}
          >
            <span className="text-[32px]" aria-hidden>{o.emoji}</span>
            <span>{o.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-auto pt-8">
        <Link
          to="/listen"
          className="btn-huge flex w-full items-center justify-center gap-2 border-2 border-border bg-card text-foreground"
        >
          <RotateCcw className="h-6 w-6" /> 다시 말할래요
        </Link>
      </div>
    </PageShell>
  );
}
