import { backendFetch } from "@/lib/backend-fetch";
import { clearFeedback } from "@/lib/answer-feedback";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Keyboard, Loader2, Megaphone, Mic, Send } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { SpeakButton } from "@/components/SpeakButton";
import { startRecorder, type Recorder } from "@/lib/recorder";
import { REGIONS } from "@/lib/data";
import { supabase } from "@/lib/backend-db";

export const Route = createFileRoute("/voice")({
  head: () => ({
    meta: [
      { title: "농업인 의견 남기기 · 말해농" },
      {
        name: "description",
        content:
          "농지정책과 농지은행 사업에 대한 의견·애로사항을 말로 남기면 담당자가 텍스트로 확인합니다.",
      },
      { property: "og:title", content: "농업인 Voice · 말해농" },
      {
        property: "og:description",
        content: "농지정책 의견과 애로사항을 말로 남기는 농업인 의견 공간입니다.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VoicePage,
});

const PROMPT =
  "농지정책이나 농지은행 사업에 대해 하고 싶은 말씀을 편하게 해 주세요. 불편한 점, 바라는 점 모두 좋습니다. 다 말씀하시면 버튼을 한 번 더 눌러 주세요. 이름과 전화번호는 남기지 않습니다.";

const AGE_GROUPS = ["30대 이하", "40대", "50대", "60대", "70대", "80대 이상"];
const CAREERS = ["5년 미만", "5~10년", "10~20년", "20~30년", "30년 이상"];
const GENDERS = ["남성", "여성", "밝히지 않음"];

function VoicePage() {
  useEffect(() => { clearFeedback(); }, []);
  const [step, setStep] = useState<"speak" | "profile" | "done">("speak");
  const [text, setText] = useState("");
  const [source, setSource] = useState<"voice" | "text">("voice");
  const [status, setStatus] = useState<"idle" | "recording" | "processing">("idle");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [showText, setShowText] = useState(false);
  const [ageGroup, setAgeGroup] = useState<string | null>(null);
  const [career, setCareer] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const recRef = useRef<Recorder | null>(null);
  const startedAt = useRef(0);
  const lastVoiceAt = useRef(0);
  const spokeRef = useRef(false);
  const vadTimer = useRef<number | null>(null);

  const clearVad = () => {
    if (vadTimer.current) {
      window.clearInterval(vadTimer.current);
      vadTimer.current = null;
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
      setText(t);
      setSource("voice");
      setStatus("idle");
      setStep("profile");
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
        if (elapsed > 120000) return void stop();
      }, 200);
    } catch (e) {
      console.error(e);
      setError("마이크를 사용할 수 없어요. 마이크 권한을 허용해 주세요.");
      setStatus("idle");
    }
  };

  useEffect(
    () => () => {
      clearVad();
      recRef.current?.cancel();
    },
    [],
  );

  const submitTyped = () => {
    const t = typed.trim();
    if (t.length < 5) {
      setError("조금 더 자세히 적어 주세요.");
      return;
    }
    setText(t);
    setSource("text");
    setError(null);
    setStep("profile");
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("farmer_voices").insert({
      content: text,
      age_group: ageGroup,
      farming_years: career,
      gender,
      region,
      source,
    });
    setSaving(false);
    if (insertError) {
      console.error("farmer_voices insert failed", insertError);
      setError("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setStep("done");
  };

  const recording = status === "recording";
  const processing = status === "processing";

  if (step === "done") {
    return (
      <PageShell back="/">
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <CheckCircle2 className="h-24 w-24 text-primary" />
          <h1 className="mt-5 text-[30px] leading-tight font-black">
            소중한 의견 감사합니다
          </h1>
          <p className="mt-3 text-[20px] text-muted-foreground">
            남겨 주신 말씀은 담당자가 글로 확인하고
            <br />
            농지정책 개선에 활용합니다.
          </p>
          <div className="mt-6 w-full rounded-2xl border-2 border-primary/30 bg-card p-4 text-left text-[19px] leading-relaxed">
            “{text}”
          </div>
          <div className="mt-8 w-full space-y-3">
            <button
              type="button"
              onClick={() => {
                setText("");
                setTyped("");
                setShowText(false);
                setStep("speak");
              }}
              className="btn-huge block w-full bg-primary text-center text-primary-foreground"
              style={{ minHeight: 72, fontSize: 22 }}
            >
              의견 하나 더 남기기
            </button>
            <Link
              to="/"
              className="block w-full rounded-2xl bg-secondary px-4 py-4 text-center text-[20px] font-bold text-secondary-foreground"
            >
              처음 화면으로
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  if (step === "profile") {
    return (
      <PageShell back="/">
        <div className="mt-2 flex items-center gap-2 text-primary">
          <Megaphone className="h-6 w-6" />
          <span className="text-lg font-bold">마지막 · 간단한 정보</span>
        </div>
        <h1 className="mt-2 text-[28px] leading-tight font-black">
          어떤 분의 의견인지만 알려 주세요
        </h1>
        <p className="mt-2 text-[19px] text-muted-foreground">
          이름·전화번호는 받지 않습니다. 원하지 않으면 건너뛰어도 됩니다.
        </p>

        <div className="mt-4 rounded-2xl border-2 border-primary/30 bg-card p-4 text-[19px] leading-relaxed">
          “{text}”
        </div>

        <Choice label="연령" options={AGE_GROUPS} value={ageGroup} onChange={setAgeGroup} />
        <Choice label="영농경력" options={CAREERS} value={career} onChange={setCareer} />
        <Choice label="성별" options={GENDERS} value={gender} onChange={setGender} />
        <Choice label="지역" options={REGIONS} value={region} onChange={setRegion} />

        {error && (
          <div className="mt-4 rounded-2xl bg-destructive/10 p-4 text-[19px] font-semibold text-destructive">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-3 pb-4">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="btn-huge flex w-full items-center justify-center gap-2 bg-primary text-primary-foreground disabled:opacity-60"
            style={{ minHeight: 76, fontSize: 24 }}
          >
            {saving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Send className="h-6 w-6" />}
            의견 남기기
          </button>
          <button
            type="button"
            onClick={() => setStep("speak")}
            className="w-full rounded-2xl bg-secondary px-4 py-4 text-[19px] font-bold text-secondary-foreground"
          >
            다시 말하기
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell back="/">
      <div className="mt-2 flex items-center gap-2 text-primary">
        <Megaphone className="h-6 w-6" />
        <span className="text-lg font-bold">농업인 의견 남기기</span>
      </div>
      <h1 className="mt-2 text-[30px] leading-tight font-black">
        {recording ? "듣고 있어요..." : "하고 싶은 말씀을 해 주세요"}
      </h1>
      <p className="mt-2 text-[20px] text-muted-foreground">
        농지정책·농지은행 사업에 대한 의견, 애로사항, 바라는 점
      </p>
      <div className="mt-2">
        <SpeakButton text={PROMPT} auto label="안내 다시 듣기" />
      </div>

      <div className="mt-6 rounded-2xl bg-secondary/60 p-5 text-[19px] text-foreground/80">
        예) “임대차 절차가 너무 복잡해서 힘듭니다.”
        <br />예) “농지연금 조건을 좀 완화해 주면 좋겠어요.”
        <br />예) “젊은 사람이 농지 구하기가 정말 어렵습니다.”
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
            aria-label={recording ? "말씀 완료" : "녹음 시작"}
            className="relative grid h-40 w-40 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl transition active:scale-95"
            style={{ transform: recording ? `scale(${1 + level * 0.15})` : undefined }}
          >
            {processing ? (
              <Loader2 className="h-16 w-16 animate-spin" />
            ) : (
              <Mic className="h-16 w-16" />
            )}
          </button>
        </div>
        <p className="mt-4 text-center text-[22px] font-bold">
          {processing
            ? "말씀을 글로 옮기는 중..."
            : recording
              ? "다 말씀하셨으면 버튼을 한 번 더 눌러 주세요"
              : "버튼을 눌러 말씀 시작"}
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl bg-destructive/10 p-4 text-[19px] font-semibold text-destructive">
          {error}
        </div>
      )}

      <div className="mt-8 border-t-2 border-dashed border-border pt-5 pb-4">
        {!showText ? (
          <button
            type="button"
            onClick={() => setShowText(true)}
            className="mx-auto flex items-center gap-2 rounded-full bg-secondary px-5 py-3 text-[19px] font-bold text-secondary-foreground"
          >
            <Keyboard className="h-6 w-6" />
            말씀이 불편하시면 글로 적기
          </button>
        ) : (
          <div className="space-y-3">
            <label className="block text-[19px] font-bold text-foreground/80">
              의견을 적어 주세요
            </label>
            <textarea
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              rows={5}
              placeholder="예) 농지 임대차 절차를 간소화해 주세요."
              className="w-full rounded-2xl border-2 border-border bg-card p-4 text-[20px] leading-relaxed focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={submitTyped}
              className="btn-huge flex w-full items-center justify-center gap-2 bg-primary text-primary-foreground"
              style={{ minHeight: 64, fontSize: 22 }}
            >
              <Send className="h-6 w-6" /> 이대로 남기기
            </button>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function Choice({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-6">
      <p className="text-[19px] font-bold text-foreground/80">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            aria-pressed={value === o}
            className={`rounded-2xl border-2 px-4 py-3 text-[18px] font-bold transition active:scale-95 ${
              value === o
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
