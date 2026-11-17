import { useEffect, useRef, useState } from "react";
import { backendFetch } from "@/lib/backend-fetch";
import {
  clearFeedback,
  keepFeedbackDomain,
  rememberFeedback,
  type FeedbackDomain,
  type FeedbackReceipt,
} from "@/lib/answer-feedback";
import { startRecorder, type Recorder } from "@/lib/recorder";
import { useChatScroll } from "./useChatScroll";

type Turn = { role: "user" | "assistant"; content: string };
type Status = "idle" | "starting" | "recording" | "processing" | "thinking";

export function useConsultation(domain: FeedbackDomain, meter = true) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [typed, setTyped] = useState("");
  const active = useRef(false);
  const generation = useRef(0);
  const locked = useRef(false);
  const history = useRef<Turn[]>([]);
  const operation = useRef<AbortController | null>(null);
  const recorder = useRef<Recorder | null>(null);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chat = useChatScroll(turns, status);

  useEffect(() => {
    active.current = true;
    keepFeedbackDomain(domain);
    return () => {
      active.current = false;
      generation.current++;
      operation.current?.abort();
      clearTimeout(timer.current);
      recorder.current?.cancel();
      recorder.current = null;
      locked.current = false;
    };
  }, [domain]);

  const append = (turn: Turn) => {
    history.current = [...history.current, turn];
    setTurns(history.current);
  };
  const request = async (
    path: string,
    init: RequestInit,
    controller: AbortController,
    milliseconds: number,
  ) => {
    const timeout = setTimeout(() => controller.abort(), milliseconds);
    try {
      const response = await backendFetch(path, { ...init, signal: controller.signal });
      if (!response.ok) throw new Error(`상담 요청 실패 (${response.status})`);
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  };
  const valid = (controller: AbortController) =>
    active.current && operation.current === controller && !controller.signal.aborted;

  const run = async (task: (controller: AbortController) => Promise<void>, message: string) => {
    if (locked.current || !active.current) return;
    locked.current = true;
    const controller = new AbortController();
    operation.current = controller;
    generation.current++;
    setError(null);
    try {
      await task(controller);
    } catch (cause) {
      if (active.current && operation.current === controller) {
        console.error(cause);
        setError(message);
      }
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        locked.current = false;
        if (active.current) setStatus("idle");
      }
    }
  };

  const send = async (question: string, controller: AbortController) => {
    chat.followLatest();
    clearFeedback();
    const previous = history.current.slice(-6);
    append({ role: "user", content: question });
    setStatus("thinking");
    const data = (await request(
      domain === "survey" ? "/api/survey-ask" : "/api/ask",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history: previous }),
      },
      controller,
      60000,
    )) as { answer?: unknown; feedback?: FeedbackReceipt };
    if (!valid(controller)) return;
    if (typeof data.answer !== "string" || !data.answer.trim()) throw new Error("빈 상담 답변");
    rememberFeedback(data.feedback, domain, question, data.answer);
    append({ role: "assistant", content: data.answer });
  };
  const ask = async (question: string) => {
    if (recorder.current) return;
    await run(
      (controller) => send(question, controller),
      "답변을 가져오지 못했어요. 잠시 후 다시 물어봐 주세요.",
    );
  };
  const submitTyped = () => {
    if (locked.current || recorder.current) return;
    const question = typed.trim();
    if (question.length < 3) {
      setError("궁금한 점을 조금 더 적어 주세요.");
      return;
    }
    setTyped("");
    void ask(question);
  };
  const stop = async () => {
    const rec = recorder.current;
    if (!rec || locked.current) return;
    recorder.current = null; // Detach before awaiting so a double click cannot stop it twice.
    clearTimeout(timer.current);
    await run(async (controller) => {
      setStatus("processing");
      const duration = Date.now() - startedAt.current;
      const blob = await rec.stop();
      if (!valid(controller)) return;
      if (duration < 800 || blob.size < 2048) {
        setError("녹음이 너무 짧아요. 한 번 더 말씀해 주세요.");
        return;
      }
      const form = new FormData();
      form.append("file", blob, "recording");
      const data = (await request(
        "/api/stt",
        { method: "POST", body: form },
        controller,
        45000,
      )) as { text?: unknown };
      if (!valid(controller)) return;
      const question = typeof data.text === "string" ? data.text.trim() : "";
      if (!question) {
        setError("소리를 알아듣지 못했어요. 조금 더 크게 다시 말씀해 주세요.");
        return;
      }
      await send(question, controller);
    }, "연결에 문제가 있어요. 잠시 후 다시 시도해 주세요.");
  };
  const start = async () => {
    if (locked.current || recorder.current || !active.current) return;
    locked.current = true;
    const current = ++generation.current;
    setError(null);
    setStatus("starting");
    try {
      const rec = await startRecorder(
        meter
          ? (value) => {
              if (active.current && generation.current === current) setLevel(value);
            }
          : undefined,
      );
      if (!active.current || generation.current !== current) {
        rec.cancel();
        return;
      }
      recorder.current = rec;
      startedAt.current = Date.now();
      setStatus("recording");
      timer.current = setTimeout(() => void stop(), 60000);
    } catch (cause) {
      if (active.current && generation.current === current) {
        console.error(cause);
        setError("마이크를 사용할 수 없어요. 마이크 권한을 허용해 주세요.");
        setStatus("idle");
      }
    } finally {
      if (generation.current === current) locked.current = false;
    }
  };
  return {
    turns,
    status,
    error,
    setError,
    level,
    typed,
    setTyped,
    chat,
    ask,
    submitTyped,
    start,
    stop,
    recording: status === "recording",
    busy: status === "starting" || status === "processing" || status === "thinking",
  };
}
