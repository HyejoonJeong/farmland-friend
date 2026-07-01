import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { SpeakButton } from "@/components/SpeakButton";
import { REGIONS } from "@/lib/data";
import { useApp } from "@/lib/store";
import { MapPin } from "lucide-react";

export const Route = createFileRoute("/region")({
  head: () => ({
    meta: [
      { title: "농지 위치 선택 · 농사 도우미" },
      { name: "description", content: "농지의 위치를 선택해 주세요." },
    ],
  }),
  component: RegionPage,
});

const PROMPT = "농지가 있는 지역을 눌러 주세요. 담당 기관을 정확하게 안내해 드립니다.";

function RegionPage() {
  const region = useApp((s) => s.region);
  const setRegion = useApp((s) => s.setRegion);
  const nav = useNavigate();

  const pick = (r: string) => {
    setRegion(r);
    nav({ to: "/result" });
  };

  return (
    <PageShell back="/intent" step={{ current: 4, total: 5 }}>
      <div className="mt-2 flex items-center gap-2 text-primary">
        <MapPin className="h-6 w-6" />
        <span className="text-lg font-bold">4단계 · 농지 위치</span>
      </div>
      <h1 className="mt-2 text-[30px] leading-tight font-black">
        농지의 위치가<br />어디인가요?
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