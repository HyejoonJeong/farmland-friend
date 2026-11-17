import { backendFetch } from "@/lib/backend-fetch";
import { clearFeedback, keepFeedbackDomain, rememberFeedback, type FeedbackReceipt } from "@/lib/answer-feedback";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  MapPin,
  Loader2,
  MessageCircleQuestion,
  Mic,
  Phone,
  Send,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { SpeakButton } from "@/components/SpeakButton";
import { startRecorder, type Recorder } from "@/lib/recorder";
import { HUMAN_SUPPORT_PHONE } from "@/lib/data";

const SURVEY_CENTER_PHONE = "1811-8852";

export const Route = createFileRoute("/survey-consult")({
  head: () => ({
    meta: [
      { title: "농지 전수조사 음성 상담 · 말해농" },
      {
        name: "description",
        content:
          "2026년도 농지 전수조사가 궁금하시면 말로 물어보세요. 상담센터 매뉴얼을 바탕으로 쉬운 말로 답해드립니다.",
      },
      { property: "og:title", content: "농지 전수조사 음성 상담 · 말해농" },
      {
        property: "og:description",
        content: "처분 걱정, 이행강제금, 양성화 특례기간 등 농지 전수조사 궁금증을 말로 물어보세요.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SurveyConsultPage,
});

const PROMPT =
  "농지 전수조사 상담입니다. 처분 걱정, 이행강제금, 비닐하우스나 창고 같은 시설, 임대차 계약 등 궁금한 점을 편하게 말씀해 주세요. 다 말씀하시면 버튼을 한 번 더 눌러 주세요.";

const SUGGESTIONS = [
  "직접 농사 안 지으면 땅을 팔아야 하나요?",
  "비닐하우스를 창고로 쓰고 있는데 괜찮나요?",
  "계약서 없이 농지를 빌려주고 있어요.",
  "양성화 특례기간은 꼭 신청해야 하나요?",
];

interface Turn {
  role: "user" | "assistant";
  content: string;
}

function SurveyConsultPage() {
  const pageActive = useRef(false);
  const questionSequence = useRef(0);
  useEffect(() => { pageActive.current = true; keepFeedbackDomain('survey'); return () => { pageActive.current = false; }; }, []);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [status, setStatus] = useState<"idle" | "recording" | "processing" | "thinking">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [typed, setTyped] = useState("");
  const [showText, setShowText] = useState(false);

  const recRef = useRef<Recorder | null>(null);
  const startedAt = useRef(0);
  const lastVoiceAt = useRef(0);
  const spokeRef = useRef(false);
  const vadTimer = useRef<number | null>(null);
  const lastTurnRef = useRef<HTMLDivElement | null>(null);

  const clearVad = () => {
    if (vadTimer.current) {
      window.clearInterval(vadTimer.current);
      vadTimer.current = null;
    }
  };

  useEffect(
    () => () => {
      clearVad();
      recRef.current?.cancel();
    },
    [],
  );

  // 새 질문/답변이 추가되면 그 말풍선으로 자동 스크롤해 바로 보이게 한다.
  useEffect(() => {
    if (turns.length > 0) {
      lastTurnRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [turns, status]);

  const ask = async (question: string) => {
    const currentRequest = ++questionSequence.current;
    clearFeedback();
    const history = turns.slice(-6);
    setTurns((t) => [...t, { role: "user", content: question }]);
    setStatus("thinking");
    setError(null);
    try {
      const res = await backendFetch("/api/survey-ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { answer: string; feedback?: FeedbackReceipt };
      if (!pageActive.current || currentRequest !== questionSequence.current) return;
      rememberFeedback(data.feedback, 'survey', question, data.answer);
      setTurns((t) => [...t, { role: "assistant", content: data.answer }]);
    } catch (e) {
      if (!pageActive.current || currentRequest !== questionSequence.current) return;
      console.error(e);
      setError("답변을 가져오지 못했어요. 잠시 후 다시 물어봐 주세요.");
    } finally {
      if (pageActive.current && currentRequest === questionSequence.current) setStatus("idle");
    }
  };

  const stop = async () => {
    const rec = recRef.current;
    if (!rec) return;
    clearVad();
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
      const res = await backendFetch("/api/stt", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { text: string };
      const t = (data.text ?? "").trim();
      if (!t) {
        setError("소리를 알아듣지 못했어요. 조금 더 크게 다시 말씀해 주세요.");
        setStatus("idle");
        return;
      }
      await ask(t);
    } catch (e) {
      console.error(e);
      setError("연결에 문제가 있어요. 잠시 후 다시 시도해 주세요.");
      setStatus("idle");
    }
  };

  const start = async () => {
    setError(null);
    spokeRef.current = false;
    try {
      const rec = await startRecorder((v) => {
        setLevel(v);
        if (v > 0.12) {
          lastVoiceAt.current = Date.now();
          if (!spokeRef.current && Date.now() - startedAt.current > 300) {
            spokeRef.current = true;
          }
        }
      });
      recRef.current = rec;
      startedAt.current = Date.now();
      lastVoiceAt.current = Date.now();
      setStatus("recording");
      vadTimer.current = window.setInterval(() => {
        const now = Date.now();
        const elapsed = now - startedAt.current;
        if (elapsed > 60000) return void stop();
      }, 200);
    } catch (e) {
      console.error(e);
      setError("마이크를 사용할 수 없어요. 마이크 권한을 허용해 주세요.");
      setStatus("idle");
    }
  };

  const submitTyped = () => {
    const t = typed.trim();
    if (t.length < 3) {
      setError("궁금한 점을 조금 더 적어 주세요.");
      return;
    }
    setTyped("");
    void ask(t);
  };

  const recording = status === "recording";
  const busy = status === "processing" || status === "thinking";

  return (
    <PageShell back="/farmland-survey">
      <div className="mt-2 flex items-center gap-2 text-primary">
        <MessageCircleQuestion className="h-6 w-6" />
        <span className="text-lg font-bold">농지 전수조사 음성 상담</span>
      </div>
      <h1 className="mt-2 text-[28px] leading-tight font-black">
        {recording ? "듣고 있어요..." : "궁금한 점을 말씀해 주세요"}
      </h1>
      <p className="mt-2 text-[19px] text-muted-foreground">
        처분 걱정 · 이행강제금 · 시설 양성화 · 임대차 등
      </p>
      <div className="mt-2">
        <SpeakButton text={PROMPT} label="안내 듣기" />
      </div>

      {turns.length === 0 && (
        <div className="mt-6">
          <p className="text-[18px] font-bold text-foreground/80">
            이렇게 물어보실 수 있어요
          </p>
          <div className="mt-3 space-y-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void ask(s)}
                disabled={busy}
                className="w-full rounded-2xl border-2 border-primary/30 bg-secondary px-4 py-4 text-left text-[19px] font-semibold text-secondary-foreground transition active:scale-[0.98] disabled:opacity-60"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {turns.length > 0 && (
        <div className="mt-6 space-y-4">
          {turns.map((t, i) => (
            <div
              key={i}
              ref={i === turns.length - 1 ? lastTurnRef : undefined}
              className={
                t.role === "user"
                  ? "ml-auto max-w-[92%] scroll-mt-24 rounded-2xl bg-primary px-4 py-3 text-[19px] leading-relaxed font-semibold text-primary-foreground"
                  : "max-w-full scroll-mt-24 rounded-2xl border-2 border-primary/25 bg-card px-4 py-4 text-[20px] leading-relaxed whitespace-pre-line"
              }
            >
              {t.content}
              {t.role === "assistant" && (
                <div className="mt-3">
                  <SpeakButton text={t.content} label="답변 듣기" />
                </div>
              )}
            </div>
          ))}
          {status === "thinking" && (
            <div className="flex items-center gap-2 text-[19px] font-semibold text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" /> 답변을 찾고 있어요...
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-2xl bg-destructive/10 p-4 text-[19px] font-semibold text-destructive">
          {error}
        </div>
      )}

      <div className="mt-8 grid place-items-center">
        <div className="relative grid h-40 w-40 place-items-center">
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
            disabled={busy}
            aria-label={recording ? "말씀 완료" : "질문 말하기"}
            className="relative grid h-32 w-32 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl transition active:scale-95 disabled:opacity-60"
            style={{ transform: recording ? `scale(${1 + level * 0.15})` : undefined }}
          >
            {busy ? (
              <Loader2 className="h-14 w-14 animate-spin" />
            ) : (
              <Mic className="h-14 w-14" />
            )}
          </button>
        </div>
        <p className="mt-3 text-center text-[20px] font-bold">
          {status === "processing"
            ? "말씀을 글로 옮기는 중..."
            : recording
              ? "다 말씀하셨으면 버튼을 한 번 더 눌러 주세요"
              : "버튼을 눌러 질문하기"}
        </p>
      </div>

      <div className="mt-8 border-t-2 border-dashed border-border pt-5">
        {!showText ? (
          <button
            type="button"
            onClick={() => setShowText(true)}
            className="mx-auto flex items-center gap-2 rounded-full bg-secondary px-5 py-3 text-[19px] font-bold text-secondary-foreground"
          >
            <Keyboard className="h-6 w-6" />
            말씀이 불편하시면 글로 묻기
          </button>
        ) : (
          <div className="space-y-3">
            <label className="block text-[19px] font-bold text-foreground/80">
              궁금한 점을 적어 주세요
            </label>
            <textarea
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              rows={3}
              placeholder="예) 주말농장 하려고 산 땅을 놀리고 있어요"
              className="w-full rounded-2xl border-2 border-border bg-card p-4 text-[20px] leading-relaxed focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={submitTyped}
              disabled={busy}
              className="btn-huge flex w-full items-center justify-center gap-2 bg-primary text-primary-foreground disabled:opacity-60"
              style={{ minHeight: 64, fontSize: 22 }}
            >
              <Send className="h-6 w-6" /> 물어보기
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 space-y-3 pb-6">
        <p className="text-[17px] text-muted-foreground">
          안내는 상담센터 매뉴얼을 바탕으로 한 참고용입니다. 특별조치법과 특례기간은 국회 협의 중이라
          바뀔 수 있습니다.
        </p>
        <a
          href={`tel:${SURVEY_CENTER_PHONE}`}
          className="flex min-h-16 w-full flex-col items-center justify-center rounded-2xl border-2 border-primary bg-accent px-4 py-4 text-[20px] font-bold text-accent-foreground"
        >
          <span className="flex items-center gap-2">
            <Phone className="h-6 w-6" /> 전수조사 상담센터 {SURVEY_CENTER_PHONE}
          </span>
          <span className="text-[16px] font-semibold">평일 9시~16시 · 위반 신고 접수</span>
        </a>
        <Link
          to="/farmland-survey"
          hash="contact"
          className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-4 text-[20px] font-bold text-secondary-foreground"
        >
          <MapPin className="h-6 w-6" /> 우리 지역 담당자 찾기
        </Link>
        <a
          href={`tel:${HUMAN_SUPPORT_PHONE}`}
          className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-4 text-[20px] font-bold text-secondary-foreground"
        >
          <Phone className="h-6 w-6" /> 농지은행 {HUMAN_SUPPORT_PHONE}
        </a>
      </div>
    </PageShell>
  );
}
