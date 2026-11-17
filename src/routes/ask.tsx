import { backendFetch } from "@/lib/backend-fetch";
import { clearFeedback, keepFeedbackDomain, rememberFeedback, type FeedbackReceipt } from "@/lib/answer-feedback";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  Keyboard,
  Loader2,
  MessageCircleQuestion,
  Mic,
  Phone,
  Send,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { SpeakButton } from "@/components/SpeakButton";
import { BusinessAnswer, businessAnswerSpeech } from "@/components/BusinessAnswer";
import { startRecorder, type Recorder } from "@/lib/recorder";
import { FBO_PORTAL_URL } from "@/lib/fbo-knowledge";
import { HUMAN_SUPPORT_PHONE, INTENTS, type IntentKey } from "@/lib/data";
import { useApp, type IntentResult } from "@/lib/store";
import greenMascot from "@/assets/mascot-green-3d.png";
import yellowMascot from "@/assets/mascot-yellow-3d.png";

export const Route = createFileRoute("/ask")({
  head: () => ({
    meta: [
      { title: "농지은행 사업 질문하기 · 말해농" },
      {
        name: "description",
        content:
          "농지연금, 임대수탁, 농지 매매·임차, 경영회생 등 농지은행 사업에 대해 말로 물어보면 쉬운 말로 답해드립니다.",
      },
      { property: "og:title", content: "농지은행 사업 질문하기 · 말해농" },
      {
        property: "og:description",
        content: "농지은행 사업이 궁금하시면 말로 물어보세요. 쉬운 말로 알려드립니다.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AskPage,
});

const PROMPT =
  "농지은행 사업에 대해 궁금한 점을 편하게 말씀해 주세요. 농지연금, 농지 임대, 농지 구입, 경영회생 같은 내용을 쉬운 말로 알려드립니다. 다 말씀하시면 버튼을 한 번 더 눌러 주세요.";

const SUGGESTIONS = [
  "농지연금은 누가 받을 수 있나요?",
  "농지를 공사에 맡기면 어떻게 되나요?",
  "청년농인데 농지를 빌릴 수 있나요?",
  "빚이 많은데 농지로 도움받을 방법 있나요?",
];

interface Turn {
  role: "user" | "assistant";
  content: string;
}

function AskPage() {
  return <QuestionConversation />;
}

export function QuestionConversation({ embedded = false }: { embedded?: boolean }) {
  const pageActive = useRef(false);
  const questionSequence = useRef(0);
  useEffect(() => { pageActive.current = true; keepFeedbackDomain('farmland'); return () => { pageActive.current = false; }; }, []);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [status, setStatus] = useState<"idle" | "recording" | "processing" | "thinking">("idle");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [typed, setTyped] = useState("");
  const [showText, setShowText] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const nav = useNavigate();
  const setTranscript = useApp((s) => s.setTranscript);
  const setIntent = useApp((s) => s.setIntent);

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
      const res = await backendFetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { answer: string; feedback?: FeedbackReceipt };
      if (!pageActive.current || currentRequest !== questionSequence.current) return;
      rememberFeedback(data.feedback, "farmland", question, data.answer);
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

  // Q&A에서 바로 담당자 연결: 방금 질문을 사업(intent)으로 분류한 뒤
  // 지역 선택 화면으로 이동해 바로 담당자 연락처를 안내한다.
  const connectToAgent = async () => {
    const lastQuestion = [...turns].reverse().find((t) => t.role === "user")?.content;
    if (!lastQuestion) {
      nav({ to: "/listen" });
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const res = await backendFetch("/api/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: lastQuestion }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as IntentResult;
      const label = INTENTS.find((i) => i.key === data.intent)?.label ?? "";
      setTranscript(lastQuestion);
      setIntent({ ...data, summary: data.summary || `${label} 관련 문의` });
      nav({ to: data.needsClarification ? "/clarify" : "/region" });
    } catch (e) {
      console.error(e);
      setError("담당 업무를 분류하지 못했어요. 말로 다시 설명해 주시겠어요?");
      nav({ to: "/listen" });
    } finally {
      setConnecting(false);
    }
  };

  const recording = status === "recording";
  const busy = status === "processing" || status === "thinking";

  if (embedded) {
    return (
      <div className="home-conversation">
        <div className="home-mic-stage">
          <img
            src={greenMascot}
            alt="초록색 말해농 캐릭터"
            className="home-mascot home-mascot-green"
            width={240}
            height={280}
          />
          <button
            type="button"
            className={`home-microphone ${recording ? "is-recording" : ""}`}
            onClick={recording ? stop : start}
            disabled={busy}
            aria-label={recording ? "말씀 완료" : "질문 말하기"}
            aria-pressed={recording}
          >
            {busy ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Mic aria-hidden="true" />
            )}
          </button>
          <img
            src={yellowMascot}
            alt="노란색 말해농 캐릭터"
            className="home-mascot home-mascot-yellow"
            width={240}
            height={280}
          />
        </div>
        {(recording || status === "processing") && (
          <p className="home-mic-caption" role="status">
            {recording
              ? "듣고 있어요. 다 말씀하셨으면 마이크를 눌러 주세요."
              : "말씀을 글로 옮기는 중이에요..."}
          </p>
        )}
        <form
          className="home-chat-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy && !recording) submitTyped();
          }}
        >
          <label htmlFor="home-question" className="sr-only">
            궁금한 점 입력
          </label>
          <textarea
            id="home-question"
            rows={2}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            disabled={busy || recording}
            placeholder="말해농에게 질문해보세요"
            autoComplete="off"
            maxLength={3000}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button
            type="submit"
            disabled={busy || recording || typed.trim().length < 3}
            aria-label="질문 보내기"
          >
            <Send aria-hidden="true" />
          </button>
        </form>
        <div className="home-chat-hints">
          <SpeakButton text={PROMPT} label="안내 듣기" />
        </div>
        {error && (
          <p className="home-chat-error" role="alert">
            {error}
          </p>
        )}
        <div className="home-chat-messages" aria-live="polite" aria-busy={busy}>
          {turns.map((turn, index) => (
            <div
              key={index}
              ref={index === turns.length - 1 ? lastTurnRef : undefined}
              className={`home-chat-bubble ${turn.role}`}
            >
              {turn.role === "assistant" ? (
                <>
                  <BusinessAnswer text={turn.content} />
                  <SpeakButton text={businessAnswerSpeech(turn.content)} label="답변 듣기" />
                </>
              ) : (
                <p>{turn.content}</p>
              )}
            </div>
          ))}
          {status === "thinking" && (
            <p className="home-thinking" role="status">
              <Loader2 className="animate-spin" size={20} aria-hidden="true" /> 답변을 찾고
              있어요...
            </p>
          )}
        </div>
        {turns.some((turn) => turn.role === "assistant") && (
          <button
            type="button"
            className="home-connect"
            onClick={() => void connectToAgent()}
            disabled={busy || connecting || recording}
          >
            {connecting ? "담당자를 찾고 있어요..." : "이 질문의 담당자 찾아 연결하기"}
          </button>
        )}
      </div>
    );
  }

  return (
    <PageShell back="/">
      <div className="mt-2 flex items-center gap-2 text-primary">
        <MessageCircleQuestion className="h-6 w-6" />
        <span className="text-lg font-bold">농지은행 사업 질문하기</span>
      </div>
      <h1 className="mt-2 text-[28px] leading-tight font-black">
        {recording ? "듣고 있어요..." : "궁금한 점을 말씀해 주세요"}
      </h1>
      <p className="mt-2 text-[19px] text-muted-foreground">
        농지연금 · 농지 빌려주기 · 농지 구하기 · 경영회생 등
      </p>
      <div className="mt-2">
        <SpeakButton text={PROMPT} label="안내 듣기" />
      </div>

      {turns.length === 0 && (
        <div className="mt-6">
          <p className="text-[18px] font-bold text-foreground/80">이렇게 물어보실 수 있어요</p>
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
                  : "max-w-full scroll-mt-24 rounded-2xl border-2 border-primary/25 bg-card px-4 py-4 text-[20px] leading-relaxed"
              }
            >
              {t.role === "assistant" ? <BusinessAnswer text={t.content} /> : t.content}
              {t.role === "assistant" && (
                <div className="mt-3">
                  <SpeakButton text={businessAnswerSpeech(t.content)} label="답변 듣기" />
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
            {busy ? <Loader2 className="h-14 w-14 animate-spin" /> : <Mic className="h-14 w-14" />}
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
              placeholder="예) 농지연금은 언제부터 받을 수 있나요?"
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
          안내는 참고용입니다. 신청 요건과 금액은 해마다 달라질 수 있어 담당자 확인이 필요합니다.
        </p>
        <button
          type="button"
          onClick={() => void connectToAgent()}
          disabled={busy || connecting}
          className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary bg-accent px-4 py-4 text-[20px] font-bold text-accent-foreground disabled:opacity-60"
        >
          {connecting && <Loader2 className="h-6 w-6 animate-spin" />}
          담당자 찾아 연결하기
        </button>
        <p className="text-center text-[16px] text-muted-foreground">
          질문하신 사업의 담당자를 바로 찾아드립니다. 지역만 선택하시면 됩니다.
        </p>
        <a
          href={`tel:${HUMAN_SUPPORT_PHONE}`}
          className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-4 text-[20px] font-bold text-secondary-foreground"
        >
          <Phone className="h-6 w-6" /> 농지은행 {HUMAN_SUPPORT_PHONE}
        </a>
        <a
          href={FBO_PORTAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-4 text-[19px] font-bold text-secondary-foreground"
        >
          <ExternalLink className="h-5 w-5" /> 농지은행 포털에서 자세히 보기
        </a>
      </div>
    </PageShell>
  );
}
