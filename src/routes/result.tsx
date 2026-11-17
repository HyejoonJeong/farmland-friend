import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { PageShell } from "@/components/PageShell";
import { SpeakButton } from "@/components/SpeakButton";
import { useApp } from "@/lib/store";
import { INTENTS, REQUIRED_DOCS, matchContact } from "@/lib/data";
import { supabase } from "@/lib/backend-db";
import { Phone, FileText, Building2, Home } from "lucide-react";

export const Route = createFileRoute("/result")({
  head: () => ({
    meta: [
      { title: "담당자 안내 · 농사 도우미" },
      { name: "description", content: "지역·상황에 맞는 담당 기관과 필요한 서류를 안내해 드립니다." },
    ],
  }),
  component: ResultPage,
});

function ResultPage() {
  const { intent, region, transcript, clarification, reset } = useApp();
  const nav = useNavigate();
  const logged = useRef(false);

  useEffect(() => {
    if (!intent || !region) nav({ to: "/" });
  }, [intent, region, nav]);

  const contact = useMemo(
    () => (intent && region ? matchContact(intent.intent, region) : null),
    [intent, region],
  );

  // Accumulate anonymous usage data to improve classification accuracy.
  useEffect(() => {
    if (logged.current || !intent || !region || !contact) return;
    logged.current = true;
    const label = INTENTS.find((i) => i.key === intent.intent)?.label ?? intent.intent;
    void supabase
      .from("usage_logs")
      .insert({
        transcript,
        clarification: clarification || null,
        summary: intent.summary || null,
        intent: intent.intent,
        intent_label: label,
        confidence: intent.confidence,
        region,
        branch: contact.orgName,
        department: contact.department,
        phone: contact.phone,
        source: transcript ? "app" : null,
        category: intent.category ?? null,
        candidates: intent.candidates ?? null,
        classification_status: intent.status ?? "LEGACY",
        clarify_trail: (intent.trail ?? null) as never,
      })
      .then(({ error }) => {
        if (error) console.error("[usage_logs] insert failed", error.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent, region, contact]);


  if (!intent || !region || !contact) return null;
  const info = INTENTS.find((i) => i.key === intent.intent);
  if (!info) {
    nav({ to: "/" });
    return null;
  }
  const docs = REQUIRED_DOCS[intent.intent];
  const applicationDocs = docs?.application;
  const contractDocs = docs?.contract;
  const spokenDocs = intent.intent === 'direct_payment_application' ? '신청 기간과 서류는 관할 읍·면·동에 확인해 주세요.' : [
    applicationDocs?.length ? `신청할 때는 ${applicationDocs.join(", ")}` : "신청 서류는 관할 담당자에게 문의해 주세요",
    contractDocs?.length ? `계약할 때는 ${contractDocs.join(", ")}` : "계약 체결 서류는 관할 담당자에게 문의해 주세요",
  ].join(". ");

  const speak = `${region} 지역, ${info.label} 담당은 ${contact.orgName}, ${contact.department} 입니다. ${contact.phone ? `대표 전화는 ${contact.phone.replace(/-/g, " ")} 입니다. 아래 큰 전화 버튼을 누르시면 바로 연결됩니다.` : contact.duty} ${spokenDocs}.`;

  return (
    <PageShell back="/region" step={{ current: 5, total: 5 }}>
      <div className="mt-3 flex items-center gap-2 text-primary">
        <Building2 className="h-6 w-6" />
        <span className="text-lg font-bold">5단계 · 담당자 안내</span>
      </div>
      <h1 className="mt-1 text-[30px] leading-tight font-black">
        {contact.phone ? "여기로 전화하시면 됩니다" : "관할 읍·면·동에 문의해 주세요"}
      </h1>
      <div className="mt-2">
        <SpeakButton text={speak} auto label="안내 다시 듣기" />
      </div>

      <section className="mt-5 rounded-3xl border-2 border-primary bg-primary/[0.06] p-5">
        <p className="text-[18px] font-bold text-primary">
          {region} · {info.label}
        </p>
        <p className="mt-2 text-[26px] font-black leading-tight">
          {contact.orgName}
        </p>
        <p className="mt-1 text-[20px] font-semibold text-foreground/80">
          담당: {contact.department}
        </p>
        {contact.phone && <p className="mt-3 text-[36px] font-black tracking-wide text-primary">
          {contact.phone}
        </p>}
      </section>

      {contact.phone ? <a
        href={`tel:${contact.phone}`}
        className="btn-huge mt-4 flex w-full items-center justify-center gap-3 bg-primary text-primary-foreground shadow-xl active:scale-[0.98]"
        style={{ minHeight: 92, fontSize: 30 }}
      >
        <Phone className="h-8 w-8" />
        지금 전화하기
      </a> : <p className="mt-4 rounded-xl bg-secondary p-4 text-lg">{contact.duty}</p>}

      {intent.intent !== 'direct_payment_application' && <section className="mt-6 rounded-2xl border-2 border-border bg-card p-5">
        <div className="flex items-center gap-2 text-primary">
          <FileText className="h-6 w-6" />
          <h2 className="text-[22px] font-bold">준비하실 서류</h2>
        </div>
        <DocumentList title="신청 시 서류" documents={applicationDocs} />
        <DocumentList title="계약 체결 시 서류" documents={contractDocs} />
        <p className="mt-4 text-[18px] font-semibold text-foreground/70">
          개인·법인 여부와 신청 조건에 따라 추가 서류가 필요할 수 있습니다.
        </p>
      </section>}

      <div className="mt-6 grid grid-cols-2 gap-3 pb-2">
        <Link
          to="/"
          onClick={() => reset()}
          className="btn-huge flex items-center justify-center gap-2 border-2 border-border bg-card text-foreground"
        >
          <Home className="h-6 w-6" /> 처음으로
        </Link>
        <Link
          to="/help"
          className="btn-huge flex items-center justify-center bg-accent text-accent-foreground"
        >
          다른 도움 받기
        </Link>
      </div>
    </PageShell>
  );
}

function DocumentList({ title, documents }: { title: string; documents: string[] | null | undefined }) {
  return (
    <div className="mt-4">
      <h3 className="text-[19px] font-bold">{title}</h3>
      {documents?.length ? (
        <ul className="mt-2 space-y-2 text-[18px]">
          {documents.map((document) => (
            <li key={document} className="flex items-start gap-3 rounded-xl bg-secondary/50 p-3">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
              <span className="font-semibold leading-snug">{document}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 rounded-xl bg-secondary/50 p-3 text-[18px] font-bold">
          관할 담당자에게 문의
        </p>
      )}
    </div>
  );
}
