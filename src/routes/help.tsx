import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { SpeakButton } from "@/components/SpeakButton";
import {
  EXTENSION_OFFICES,
  FARMLAND_BRANCH_LABELS,
  FARMLAND_BANK,
  HUMAN_SUPPORT_PHONE,
  NAQS_OFFICES,
  REGION_TO_FB_BRANCH,
} from "@/lib/data";
import { useApp } from "@/lib/store";
import { Phone } from "lucide-react";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "도움 받기 · 농사 도우미" },
      { name: "description", content: "상담원 통화와 주요 기관 연락처 안내" },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  const region = useApp((s) => s.region);
  const branch = region ? REGION_TO_FB_BRANCH[region] : null;
  const branchLabel = branch ? FARMLAND_BRANCH_LABELS[branch] : null;
  const fb = branchLabel ? FARMLAND_BANK.filter((c) => c.branch === branchLabel) : [];
  const ext = region ? EXTENSION_OFFICES.filter((o) => o.region === region) : [];
  const naqs = region
    ? NAQS_OFFICES.filter((o) => o.region.includes(region.replace(/[시군]$/, "")))
    : [];

  const intro = `혼자 하기 어려우시면 언제든 상담원에게 바로 통화하실 수 있어요. 아래 큰 주황색 버튼을 눌러 주세요.`;

  return (
    <PageShell back="/">
      <h1 className="mt-4 text-[30px] leading-tight font-black">도움 받기</h1>
      <div className="mt-2">
        <SpeakButton text={intro} auto label="안내 듣기" />
      </div>

      <a
        href={`tel:${HUMAN_SUPPORT_PHONE}`}
        className="btn-huge mt-5 flex w-full items-center justify-center gap-3 bg-accent text-accent-foreground shadow-xl"
        style={{ minHeight: 92, fontSize: 26 }}
      >
        <Phone className="h-7 w-7" />
        상담원 통화 ({HUMAN_SUPPORT_PHONE})
      </a>

      {region && (
        <p className="mt-5 text-[18px] text-muted-foreground">
          {region} 지역 주요 연락처
        </p>
      )}

      <Section title="농지은행 (한국농어촌공사)" items={fb.map((c) => ({
        name: `${c.branch}지사`,
        sub: c.duty,
        phone: c.phone,
      }))} />
      <Section title="농업기술센터" items={ext.map((o) => ({
        name: o.name, sub: o.duty, phone: o.phone,
      }))} />
      <Section title="농산물품질관리원" items={naqs.map((o) => ({
        name: o.name, sub: o.duty, phone: o.phone,
      }))} />

      {!region && (
        <p className="mt-8 text-center text-[19px] text-muted-foreground">
          지역을 먼저 선택하시면
          <br />맞춤 연락처를 보여드려요.
        </p>
      )}
    </PageShell>
  );
}

function Section({
  title,
  items,
}: {
  title: string;
  items: { name: string; sub: string; phone: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="text-[22px] font-bold text-primary">{title}</h2>
      <ul className="mt-3 space-y-3">
        {items.map((it, i) => (
          <li
            key={i}
            className="rounded-2xl border-2 border-border bg-card p-4"
          >
            <p className="text-[20px] font-bold">{it.name}</p>
            <p className="text-[17px] text-muted-foreground">{it.sub}</p>
            <a
              href={`tel:${it.phone}`}
              className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-[22px] font-bold text-primary-foreground"
            >
              <Phone className="h-6 w-6" /> {it.phone}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}