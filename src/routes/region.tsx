import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { SpeakButton } from "@/components/SpeakButton";
import { REGIONS } from "@/lib/data";
import { useApp } from "@/lib/store";
import { MapPin } from "lucide-react";

export const Route = createFileRoute("/region")({
  head: () => ({
    meta: [
      { title: "지역 선택 · 농사 도우미" },
      { name: "description", content: "먼저 살고 계신 지역을 선택해 주세요." },
    ],
  }),
  component: RegionPage,
});

const PROMPT = "먼저 어르신이 살고 계신 지역을 눌러 주세요.";

function RegionPage() {
  const region = useApp((s) => s.region);
  const setRegion = useApp((s) => s.setRegion);
  const nav = useNavigate();

  const pick = (r: string) => {
    setRegion(r);
    nav({ to: "/listen" });
  };

  return (
    <PageShell back="/" step={{ current: 1, total: 5 }}>
      <div className="mt-2 flex items-center gap-2 text-primary">
        <MapPin className="h-6 w-6" />
        <span className="text-lg font-bold">1단계 · 지역 선택</span>
      </div>
      <h1 className="mt-2 text-[30px] leading-tight font-black">
        어디에 살고 계세요?
      </h1>
      <div className="mt-2">
        <SpeakButton text={PROMPT} auto label="안내 듣기" />
      </div>

      <ul className="mt-5 grid grid-cols-2 gap-3">
        {REGIONS.map((r) => {
          const selected = region === r;
          return (
            <li key={r}>
              <button
                type="button"
                onClick={() => pick(r)}
                className={`btn-huge w-full border-2 text-center transition ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground"
                }`}
              >
                {r}
              </button>
            </li>
          );
        })}
      </ul>
    </PageShell>
  );
}