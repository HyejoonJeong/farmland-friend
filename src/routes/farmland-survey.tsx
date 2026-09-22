import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Building2,
  Check,
  CircleAlert,
  ClipboardCheck,
  Database,
  Landmark,
  MapPin,
  Phone,
  Sprout,
  Users,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { SpeakButton } from "@/components/SpeakButton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  FARMLAND_BANK,
  HUMAN_SUPPORT_PHONE,
  MUNICIPAL_FALLBACK,
  MUNICIPAL_OFFICES,
  REGIONS,
  REGION_TO_FB_BRANCH,
} from "@/lib/data";

export const Route = createFileRoute("/farmland-survey")({
  head: () => ({
    meta: [
      { title: "2026년도 농지전수조사 안내 · 말해농" },
      {
        name: "description",
        content: "2026년도 농지전수조사의 목적, 주요 궁금증, 조사 결과 활용과 지역별 농지은행 문의처를 안내합니다.",
      },
      { property: "og:title", content: "2026년도 농지전수조사 안내 · 말해농" },
      {
        property: "og:description",
        content: "농지전수조사의 목적과 주요 문답을 확인하고 관할 농지은행에 문의하세요.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FarmlandSurveyPage,
});

const FAQS = [
  {
    question: "농지법을 위반하면 무조건 처분되나요?",
    answer:
      "아닙니다. 고의적인 농지 투기 등 중대한 위반은 엄정 조치하지만, 일반적이고 경미한 위반은 충분한 기간을 두고 정상화·양성화 기회를 제공합니다.",
  },
  {
    question: "상속받은 농지를 직접 농사짓지 않고 임대하고 있습니다. 어떻게 되나요?",
    answer: "농지대장에 임대차 정보를 등재하거나 농지은행에 위탁하면 문제 없습니다.",
  },
  {
    question: "나이가 많아 직접 농사를 짓기 어렵습니다. 어떻게 해야 하나요?",
    answer:
      "농지은행에 임대를 맡기거나, 농지은행의 공공매입·은퇴직불·농지연금 제도를 이용할 수 있습니다. 희망하실 경우 농지은행에 관리를 맡길 수 있는 방안도 마련할 예정입니다.",
  },
  {
    question: "농업인이 휴경하거나 농사짓기 어려운 농지를 가지고 있는데 팔리지도 않습니다.",
    answer:
      "앞으로 특별조치법을 제정해 희망하실 경우 농지은행에 관리를 맡길 수 있는 방안을 마련할 예정입니다.",
  },
  {
    question: "농업용 창고 등 시설물이 있는데 농지 전용 절차를 받지 못했습니다.",
    answer:
      "앞으로 특별조치법을 제정해 일정 요건을 충족하면 사후에도 전용이 가능하도록 할 계획입니다.",
  },
];

const USES = [
  {
    icon: ClipboardCheck,
    title: "농지 제도를 현실에 맞게 개선",
    items: ["임대차·휴경 허용 사유 확대", "임차농 권리 보호 강화", "불법 전용 시설의 합리적 양성화"],
  },
  {
    icon: Database,
    title: "정확한 농지 정보를 미래 세대에 전달",
    items: ["농지 현황 데이터베이스 구축", "적정 농지 확보·보전", "지역 여건에 맞는 농지 관리"],
  },
  {
    icon: Users,
    title: "농업의 안정적인 세대 전환 지원",
    items: ["고령농의 안정적인 은퇴 지원", "청년농·전업농의 농지 진입 지원", "분산 농지 집적화와 공동 영농 활성화"],
  },
  {
    icon: Sprout,
    title: "농지를 활용해 사람이 돌아오는 농촌 조성",
    items: ["맹지·저활용 농지의 새로운 활용", "태양광 등 대체 소득원 발굴", "농촌의 새로운 소득·활동 공간 조성"],
  },
];

const SPEAK_TEXT =
  "2026년도 농지전수조사는 법 위반 농지를 모두 처분하기 위한 것이 아닙니다. 전국 농지의 소유와 이용 실태를 정확히 파악하고 농지 데이터를 구축하여 현실에 맞는 농지 관리와 제도 개선에 활용하기 위한 조사입니다. 고의적인 투기나 중대한 불법 전용은 농지법 원칙에 따라 조치하지만, 일반적이고 경미한 위반은 정상화 기회를 제공합니다. 더 궁금한 점은 화면 아래에서 농지 소재지와 문의 내용을 선택해 주세요. 조사 일정이나 방식은 관할 시군청에, 임대나 연금 등 농지 관리는 농지은행에 문의하시면 됩니다.";

const TOPICS = [
  {
    key: "survey" as const,
    title: "조사 일정·방식 등 전반적인 문의",
    description: "농지전수조사는 정부와 지자체가 시행합니다. 조사 시기, 대상, 방법 등은 관할 시·군청에 문의하세요.",
  },
  {
    key: "bank" as const,
    title: "농지 관리·제도 상담",
    description: "임대·위탁, 농지연금, 은퇴직불, 매입 등 제도권 농지 관리는 한국농어촌공사 농지은행이 안내합니다.",
  },
];

function FarmlandSurveyPage() {
  const [region, setRegion] = useState<string | null>(null);
  const [topic, setTopic] = useState<"survey" | "bank" | null>(null);
  const contact = useMemo(() => {
    if (!region || !topic) return null;
    if (topic === "survey") {
      const office =
        MUNICIPAL_OFFICES.find((item) => item.region === region) ?? MUNICIPAL_FALLBACK;
      return {
        kind: "지자체",
        branch: office.name,
        duty: "농지전수조사 담당 부서 연결 (대표번호)",
        phone: office.phone,
      };
    }
    if (region === "기타 지역") {
      return { kind: "농지은행", branch: "농지은행 대표상담", duty: "농지 관리·제도 관련 문의", phone: HUMAN_SUPPORT_PHONE };
    }
    const branch = REGION_TO_FB_BRANCH[region];
    if (!branch) return null;
    const candidates = FARMLAND_BANK.filter((item) => item.branch === branch);
    const preferred =
      candidates.find((item) => item.duty.includes("지사 농지사업")) ??
      candidates.find((item) => item.duty.includes("농지총괄")) ??
      candidates[0];
    if (!preferred) return null;
    return { kind: "농지은행", branch: `한국농어촌공사 ${branch}지사`, duty: preferred.duty, phone: preferred.phone };
  }, [region, topic]);

  return (
    <PageShell back="/">
      <section className="pt-3">
        <p className="font-bold text-primary">2026년도 안내</p>
        <h1 className="mt-1 text-[34px] leading-tight font-black">
          농지전수조사,
          <br />왜 하나요?
        </h1>
        <p className="mt-4 text-[19px] font-semibold leading-relaxed text-foreground/80">
          법 위반 농지를 찾아 모두 처분하기 위해서가 아닙니다. 전국 농지의 소유·이용 실태를 정확히 파악하고,
          현실에 맞는 농지 관리와 제도 개선에 활용하기 위한 조사입니다.
        </p>
        <div className="mt-4">
          <SpeakButton text={SPEAK_TEXT} label="안내 듣기" />
        </div>
      </section>

      <section className="mt-7">
        <h2 className="text-[25px] font-black">많이 궁금해하시는 내용</h2>
        <Accordion type="single" collapsible className="mt-3 space-y-3">
          {FAQS.map((faq, index) => (
            <AccordionItem key={faq.question} value={`faq-${index}`} className="overflow-hidden rounded-2xl border-2 border-border bg-card px-4">
              <AccordionTrigger className="gap-3 py-5 text-[19px] leading-snug font-bold no-underline hover:no-underline">
                <span className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-base font-black text-primary-foreground">Q</span>
                  <span>{faq.question}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pl-11 text-[18px] leading-relaxed text-foreground/80">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="mt-7 rounded-2xl border-2 border-destructive/35 bg-destructive/5 p-5">
        <div className="flex items-center gap-2 text-destructive">
          <CircleAlert className="h-6 w-6" />
          <h2 className="text-[22px] font-black">투기·중대한 불법 전용은 조치합니다</h2>
        </div>
        <div className="mt-4 space-y-4 text-[17px] leading-relaxed">
          <div>
            <h3 className="font-black">투기에 해당하는 경우</h3>
            <p className="mt-1 text-foreground/80">시세차익·개발이익·보상 등을 재산상 이익으로 취하기 위해 거짓·부정한 방식으로 농지를 취득한 행위입니다.</p>
            <ul className="mt-2 space-y-1 font-semibold">
              <li>① 토지거래허가구역에서 거짓으로 농지 취득 후 무단 휴경·불법 임대</li>
              <li>② 농업법인의 부동산업 영위</li>
              <li>③ 경매 등으로 공유 취득한 후 무단 휴경·불법 임대</li>
            </ul>
            <p className="mt-2 font-black text-destructive">처분명령이 부과될 수 있습니다.</p>
          </div>
          <div className="border-t border-destructive/20 pt-4">
            <h3 className="font-black">중대한 불법 전용</h3>
            <p className="mt-1 text-foreground/80">농업진흥지역에 설치할 수 없는 야영장 등을 설치하거나, 다른 법률에서 금지한 시설로 농지를 불법 전용한 경우입니다.</p>
            <p className="mt-2 font-black text-destructive">원상회복 명령이 내려질 수 있습니다.</p>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[25px] font-black">조사 결과는 이렇게 활용합니다</h2>
        <div className="mt-3 grid gap-3">
          {USES.map(({ icon: Icon, title, items }, index) => (
            <article key={title} className="rounded-2xl border-2 border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary font-black text-primary">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <div className="flex items-center gap-2 text-primary">
                    <Icon className="h-5 w-5" />
                    <h3 className="text-[19px] font-black leading-snug">{title}</h3>
                  </div>
                  <ul className="mt-3 space-y-2 text-[17px] font-semibold text-foreground/80">
                    {items.map((item) => (
                      <li key={item} className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-primary" />{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-4 rounded-2xl bg-primary p-5 text-center text-[20px] font-black leading-relaxed text-primary-foreground">
          투기는 근절하고, 농업인이 안심하고 농사지을 수 있도록 추진합니다.
        </p>
      </section>

      <section className="mt-8 pb-8">
        <div className="flex items-center gap-2 text-primary">
          <MapPin className="h-6 w-6" />
          <h2 className="text-[25px] font-black">더 궁금한 점이 있으신가요?</h2>
        </div>
        <p className="mt-2 text-[18px] font-semibold text-foreground/75">
          농지 소재지를 선택한 뒤, 어떤 점이 궁금한지 골라주세요. 내용에 맞는 문의처를 알려드립니다.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {REGIONS.map((item) => (
            <Button
              key={item}
              type="button"
              variant={region === item ? "default" : "outline"}
              onClick={() => setRegion(item)}
              className="h-14 rounded-xl text-[18px] font-bold"
            >
              {item}
            </Button>
          ))}
        </div>

        {region && (
          <div className="mt-5 grid gap-3">
            {TOPICS.map((item) => {
              const active = topic === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTopic(item.key)}
                  className={`rounded-2xl border-2 p-5 text-left transition-colors ${
                    active ? "border-primary bg-primary/[0.06]" : "border-border bg-card"
                  }`}
                >
                  <p className={`text-[20px] font-black ${active ? "text-primary" : "text-foreground"}`}>
                    {item.title}
                  </p>
                  <p className="mt-1 text-[16px] font-semibold leading-relaxed text-foreground/70">
                    {item.description}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {contact && (
          <div className="mt-5 rounded-2xl border-2 border-primary bg-primary/[0.06] p-5" aria-live="polite">
            <div className="flex items-center gap-2 text-primary">
              {contact.kind === "지자체" ? <Landmark className="h-6 w-6" /> : <Building2 className="h-6 w-6" />}
              <p className="text-[17px] font-bold">{region} 관할 {contact.kind} 문의처</p>
            </div>
            <h3 className="mt-2 text-[23px] leading-tight font-black">{contact.branch}</h3>
            <p className="mt-1 text-[17px] font-semibold text-foreground/75">{contact.duty}</p>
            <p className="mt-3 text-[30px] font-black text-primary">{contact.phone}</p>
            <Button asChild className="mt-4 h-16 w-full rounded-xl text-[22px] font-black">
              <a href={`tel:${contact.phone}`}><Phone className="h-6 w-6" />전화로 문의하기</a>
            </Button>
          </div>
        )}
      </section>
    </PageShell>
  );
}