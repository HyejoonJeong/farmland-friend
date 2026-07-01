import { createFileRoute, Link } from "@tanstack/react-router";
import { Mic, Phone } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { SpeakButton } from "@/components/SpeakButton";
import { HUMAN_SUPPORT_PHONE } from "@/lib/data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "농사 도우미 · 말로 신청하세요" },
      {
        name: "description",
        content:
          "고객님을 위한 음성 기반 농업 민원 도우미. 말로 상황을 설명하면 담당 기관과 부서를 바로 연결해드립니다.",
      },
      { property: "og:title", content: "농사 도우미" },
      {
        property: "og:description",
        content: "말로 신청하는 농업 민원 도우미 · 농지은행 · 농업기술센터 · 품관원",
      },
    ],
  }),
  component: Home,
});

const WELCOME =
  "안녕하세요, 고객님. 말해농입니다. 상황을 편하게 말씀하시거나 글로 적어 주시면 어디로 전화해야 하는지 알려드릴게요. 시작하려면 아래 큰 초록색 버튼을 눌러 주세요.";

function Home() {
  return (
    <PageShell back={null}>
      <section className="flex flex-1 flex-col items-center justify-between gap-8 pt-6">
        <div className="text-center">
          <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-3xl bg-primary/10">
            <Mic className="h-11 w-11 text-primary" />
          </div>
          <p className="text-[20px] font-bold tracking-wide text-primary/80">
            AI Voice Civil Service Guide
          </p>
          <h1 className="mt-1 text-[44px] leading-tight font-black text-primary">
            말해농
          </h1>
          <p className="mt-3 text-[22px] font-semibold text-foreground/80">
            말씀만 하시면
            <br />
            담당자에게 연결해 드립니다
          </p>
        </div>

        <div className="w-full space-y-4">
          <Link
            to="/region"
            className="btn-huge block w-full bg-primary text-center text-primary-foreground shadow-lg active:scale-[0.98]"
            style={{ minHeight: 88, fontSize: 28 }}
          >
            시작하기
          </Link>

          <div className="flex items-center justify-center gap-3">
            <SpeakButton text={WELCOME} label="안내 듣기" />
          </div>

          <a
            href={`tel:${HUMAN_SUPPORT_PHONE}`}
            className="btn-huge flex w-full items-center justify-center gap-2 bg-accent text-accent-foreground shadow-md"
          >
            <Phone className="h-6 w-6" />
            상담원 바로 통화
          </a>
        </div>
      </section>
    </PageShell>
  );
}
