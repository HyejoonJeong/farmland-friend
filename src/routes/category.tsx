import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClipboardList, Landmark } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { SpeakButton } from "@/components/SpeakButton";
import { CATEGORIES, type CategoryKey } from "@/lib/data";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/category")({
  head: () => ({
    meta: [
      { title: "민원 종류 선택 · 말해농" },
      {
        name: "description",
        content:
          "농지은행 일반 민원과 농지전수조사 민원 중 무엇을 도와드릴지 선택해 주세요.",
      },
      { property: "og:title", content: "민원 종류 선택 · 말해농" },
      {
        property: "og:description",
        content: "농지은행 일반 민원 또는 농지전수조사 민원을 선택하고 말로 접수하세요.",
      },
    ],
  }),
  component: CategoryPage,
});

const PROMPT =
  "어떤 민원인지 먼저 골라 주세요. 농지 임대나 농지연금처럼 농지은행 일반 민원이면 위쪽 초록색 버튼을, 농지전수조사와 관련된 민원이면 아래쪽 버튼을 눌러 주세요.";

const ICONS = { general: Landmark, census: ClipboardList } as const;

function CategoryPage() {
  const setCategory = useApp((s) => s.setCategory);
  const nav = useNavigate();

  const pick = (key: CategoryKey) => {
    setCategory(key);
    nav({ to: "/listen" });
  };

  return (
    <PageShell back="/">
      <h1 className="mt-4 text-[30px] leading-tight font-black">
        어떤 민원이신가요, 고객님?
      </h1>
      <p className="mt-2 text-[20px] text-muted-foreground">
        아래에서 하나를 골라 주시면 말씀으로 접수해 드립니다.
      </p>
      <div className="mt-2">
        <SpeakButton text={PROMPT} auto label="안내 듣기" />
      </div>

      <div className="mt-8 space-y-5">
        {CATEGORIES.map((c) => {
          const Icon = ICONS[c.key];
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => pick(c.key)}
              className={`w-full rounded-3xl border-2 p-6 text-left shadow-sm transition active:scale-[0.98] ${
                c.key === "general"
                  ? "border-primary bg-primary/[0.07]"
                  : "border-accent bg-accent/20"
              }`}
              style={{ minHeight: 148 }}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-9 w-9 text-primary" />
                <span className="text-[27px] leading-tight font-black">
                  {c.label}
                </span>
              </div>
              <p className="mt-3 text-[19px] leading-relaxed font-semibold text-foreground/70">
                {c.desc}
              </p>
            </button>
          );
        })}
      </div>
    </PageShell>
  );
}
