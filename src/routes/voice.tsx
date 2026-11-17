import { backendFetch } from "@/lib/backend-fetch";
import { clearFeedback } from "@/lib/answer-feedback";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Mic, Send, Square } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { startRecorder, type Recorder } from "@/lib/recorder";
import { supabase } from "@/lib/backend-db";

export const Route = createFileRoute("/voice")({
  head: () => ({
    meta: [
      { title: "의견 남기기 · 말해농" },
      {
        name: "description",
        content: "문의유형을 선택하고 궁금한 점이나 개선 의견을 글 또는 음성으로 남겨주세요.",
      },
      { property: "og:title", content: "의견 남기기 · 말해농" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VoicePage,
});

const INQUIRY_TYPES = [
  "농지은행사업",
  "농지전수조사",
  "서비스 이용",
  "정책·서비스 개선",
  "기타",
] as const;
type InquiryType = (typeof INQUIRY_TYPES)[number];
type InputStatus = "idle" | "starting" | "recording" | "processing" | "saving";
const MAX_LENGTH = 500;

function VoicePage() {
  useEffect(() => clearFeedback(), []);
  const [inquiryType, setInquiryType] = useState<InquiryType>(INQUIRY_TYPES[0]);
  const [text, setText] = useState("");
  const [source, setSource] = useState<"voice" | "text">("text");
  const [status, setStatus] = useState<InputStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const recordingStartedAt = useRef(0);
  const recordingTimer = useRef<number | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const busyRef = useRef(false);

  const clearRecordingTimer = () => {
    if (recordingTimer.current !== null) {
      window.clearTimeout(recordingTimer.current);
      recordingTimer.current = null;
    }
  };
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearRecordingTimer();
      requestRef.current?.abort();
      recorderRef.current?.cancel();
    };
  }, []);

  const stop = async () => {
    const recorder = recorderRef.current;
    if (!recorder || busyRef.current) return;
    busyRef.current = true;
    recorderRef.current = null;
    clearRecordingTimer();
    setStatus("processing");
    let timeout: number | undefined;
    try {
      const duration = Date.now() - recordingStartedAt.current;
      const blob = await recorder.stop();
      if (!mountedRef.current) return;
      if (duration < 800 || blob.size < 2048) {
        setError("녹음이 너무 짧아요. 조금 더 길게 말씀해 주세요.");
        return;
      }
      const controller = new AbortController();
      requestRef.current = controller;
      timeout = window.setTimeout(() => controller.abort(), 45000);
      const form = new FormData();
      form.append("file", blob, "recording");
      const response = await backendFetch("/api/stt", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Transcription failed");
      const data: { text?: unknown } = await response.json();
      const transcript = typeof data.text === "string" ? data.text.trim() : "";
      if (!mountedRef.current) return;
      if (!transcript) {
        setError("말씀을 알아듣지 못했어요. 다시 말씀하거나 글로 입력해 주세요.");
        return;
      }
      // Preserve long recordings for review instead of silently cutting them off.
      setText(transcript);
      setSource("voice");
      if (transcript.length > MAX_LENGTH)
        setError("음성으로 입력된 내용이 500자를 넘었어요. 내용을 줄여 주세요.");
      else setNotice("말씀을 글로 옮겼어요. 내용을 확인한 뒤 보내주세요.");
    } catch {
      recorder.cancel();
      if (mountedRef.current)
        setError("음성을 글로 옮기지 못했어요. 다시 말씀하거나 글로 입력해 주세요.");
    } finally {
      window.clearTimeout(timeout);
      requestRef.current = null;
      busyRef.current = false;
      if (mountedRef.current) setStatus("idle");
    }
  };

  const start = async () => {
    if (busyRef.current || recorderRef.current) return;
    busyRef.current = true;
    setError(null);
    setNotice("");
    setStatus("starting");
    try {
      const recorder = await startRecorder();
      if (!mountedRef.current) {
        recorder.cancel();
        return;
      }
      recorderRef.current = recorder;
      recordingStartedAt.current = Date.now();
      setStatus("recording");
      recordingTimer.current = window.setTimeout(() => void stop(), 120000);
    } catch {
      if (mountedRef.current) {
        setError("마이크를 사용할 수 없어요. 권한을 확인하거나 글로 입력해 주세요.");
        setStatus("idle");
      }
    } finally {
      busyRef.current = false;
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busyRef.current || status !== "idle") return;
    const content = text.trim();
    if (content.length < 5) {
      setError("문의 내용을 5자 이상 입력해 주세요.");
      textareaRef.current?.focus();
      return;
    }
    if (text.length > MAX_LENGTH) {
      setError("문의 내용은 500자 이내로 입력해 주세요.");
      textareaRef.current?.focus();
      return;
    }
    busyRef.current = true;
    setStatus("saving");
    setError(null);
    setNotice("");
    try {
      // Retain the inquiry type in the existing content column, including in
      // current admin views and CSV exports, without requiring a DB migration.
      const { error: insertError } = await supabase.from("farmer_voices").insert({
        content: `[문의 유형: ${inquiryType}]\n${content}`,
        source,
      });
      if (insertError) throw insertError;
      if (!mountedRef.current) return;
      setText(content);
      setDone(true);
    } catch {
      if (mountedRef.current)
        setError("의견을 보내지 못했어요. 입력한 내용은 그대로 있으니 다시 시도해 주세요.");
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setStatus("idle");
    }
  };

  const recording = status === "recording";
  const pending = status === "starting" || status === "processing" || status === "saving";
  const hasText = text.length > 0;
  const statusMessage =
    status === "starting"
      ? "마이크를 준비하고 있어요."
      : recording
        ? "듣고 있어요. 다 말씀하시면 오른쪽 버튼을 다시 눌러 주세요."
        : status === "processing"
          ? "말씀을 글로 옮기고 있어요."
          : status === "saving"
            ? "의견을 보내고 있어요."
            : notice;
  const actionLabel =
    status === "starting"
      ? "마이크 준비 중"
      : status === "processing"
        ? "음성을 글로 옮기는 중"
        : status === "saving"
          ? "의견 보내는 중"
          : recording
            ? "녹음 마치기"
            : hasText
              ? "의견 보내기"
              : "녹음 시작";

  if (done)
    return (
      <PageShell back="/" className="opinion-shell">
        <section className="opinion-complete">
          <CheckCircle2 size={72} aria-hidden="true" />
          <h1>소중한 의견 감사합니다</h1>
          <p>남겨주신 의견은 더 나은 서비스를 만드는 데 활용하겠습니다.</p>
          <div className="opinion-receipt">
            <span>{inquiryType}</span>
            <p>{text}</p>
          </div>
          <div className="opinion-complete-actions">
            <button
              type="button"
              onClick={() => {
                setInquiryType(INQUIRY_TYPES[0]);
                setText("");
                setSource("text");
                setError(null);
                setNotice("");
                setDone(false);
              }}
            >
              의견 하나 더 남기기
            </button>
            <Link to="/">처음 화면으로</Link>
          </div>
        </section>
      </PageShell>
    );

  return (
    <PageShell back="/" className="opinion-shell">
      <section className="opinion-page" aria-labelledby="opinion-title">
        <h1 id="opinion-title">의견 남기기</h1>
        <p className="opinion-intro">궁금한 점이나 바라는 점을 편하게 남겨주세요.</p>
        <form onSubmit={submit}>
          <fieldset className="opinion-types" disabled={status !== "idle"}>
            <legend>문의 유형</legend>
            <div className="opinion-type-options">
              {INQUIRY_TYPES.map((type) => (
                <label key={type} className="opinion-type">
                  <input
                    type="radio"
                    name="inquiry-type"
                    value={type}
                    checked={inquiryType === type}
                    onChange={() => setInquiryType(type)}
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="opinion-content">
            <label htmlFor="opinion-message">문의 내용</label>
            <div className="opinion-composer" aria-busy={pending}>
              <textarea
                ref={textareaRef}
                id="opinion-message"
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setSource("text");
                  setError(null);
                  setNotice("");
                }}
                readOnly={status !== "idle"}
                maxLength={MAX_LENGTH}
                rows={7}
                placeholder="문의 내용을 입력해 주세요."
                aria-invalid={Boolean(error)}
                aria-describedby={`opinion-count opinion-status${error ? " opinion-error" : ""}`}
              />
              <div className="opinion-composer-footer">
                <span
                  id="opinion-count"
                  className={text.length > MAX_LENGTH ? "opinion-over-limit" : undefined}
                >
                  {text.length} / {MAX_LENGTH}
                </span>
                <button
                  type={hasText && status === "idle" ? "submit" : "button"}
                  className="opinion-action mic-listening"
                  data-recording={recording}
                  onClick={
                    recording
                      ? () => void stop()
                      : !hasText && !pending
                        ? () => void start()
                        : undefined
                  }
                  disabled={pending}
                  aria-label={actionLabel}
                  title={actionLabel}
                >
                  {pending ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : recording ? (
                    <Square fill="currentColor" size={20} aria-hidden="true" />
                  ) : hasText ? (
                    <Send aria-hidden="true" />
                  ) : (
                    <Mic aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
            <p id="opinion-status" className="opinion-status" role="status" aria-live="polite">
              {statusMessage}
            </p>
            {error && (
              <p id="opinion-error" className="opinion-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </form>
      </section>
    </PageShell>
  );
}
