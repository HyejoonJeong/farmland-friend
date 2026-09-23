import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, Landmark, MessageCircleQuestion, Mic } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { SpeakButton } from "@/components/SpeakButton";
import krcLogo from "@/assets/krc-logo.png";
import characterGreen from "@/assets/character-green.png";
import characterYellow from "@/assets/character-yellow.png";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

const WELCOME =
  "안녕하세요, 고객님. 말해농입니다. 상황을 편하게 말씀하시거나 글로 적어 주시면 어디로 전화해야 하는지 알려드릴게요. 시작하려면 아래 큰 초록색 버튼을 눌러 주세요.";

function Home() {
  return (
    <PageShell back={null}>
      <div className="flex items-center justify-start pt-2">
        <img src={krcLogo} alt="KRC 한국농어촌공사" className="h-8 w-auto" />
      </div>
      <section className="flex flex-1 flex-col items-center justify-between gap-8 pt-6">
        <div className="text-center">
          <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-3xl bg-primary/10">
            <Mic className="h-11 w-11 text-primary" />
          </div>
          <p className="text-[20px] font-bold tracking-wide text-primary/80">
            AI 음성 민원 안내
          </p>
          <div className="mt-1 flex items-center justify-center gap-2">
            <img
              src={characterGreen}
              alt=""
              aria-hidden="true"
              className="h-24 w-auto"
            />
            <h1 className="text-[44px] leading-tight font-black text-primary">
              말해농
            </h1>
            <img
              src={characterYellow}
              alt=""
              aria-hidden="true"
              className="h-24 w-auto"
            />
          </div>
          <p className="mt-3 text-[22px] font-semibold text-foreground/80">
            말씀만 하시면
            <br />
            담당자에게 연결해 드립니다
          </p>
        </div>

        <div className="w-full space-y-4">
          <Link
            to="/listen"
            className="btn-huge flex w-full flex-col items-center justify-center bg-primary text-center text-primary-foreground shadow-lg active:scale-[0.98]"
            style={{ minHeight: 92, fontSize: 26 }}
          >
            민원 담당자 찾기
            <span className="mt-1 text-[16px] font-semibold opacity-90">
              말씀하시면 담당 부서로 안내
            </span>
          </Link>

          <Link
            to="/voice"
            className="btn-huge flex w-full flex-col items-center justify-center border-2 border-primary bg-accent text-center text-accent-foreground shadow-lg active:scale-[0.98]"
            style={{ minHeight: 92, fontSize: 26 }}
          >
            의견 남기기
            <span className="mt-1 text-[16px] font-semibold opacity-90">
              농지정책·농지은행에 바라는 말씀
            </span>
          </Link>

          <Link
            to="/farmland-survey"
            className="flex min-h-20 w-full items-center gap-4 rounded-2xl border-2 border-primary/30 bg-secondary px-5 py-4 text-left text-secondary-foreground shadow-sm transition active:scale-[0.98]"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ClipboardList className="h-7 w-7" />
            </span>
            <span>
              <strong className="block text-[21px] leading-tight">2026년도 농지전수조사</strong>
              <span className="mt-1 block text-[16px] font-semibold text-muted-foreground">
                조사 내용과 궁금증 알아보기
              </span>
            </span>
          </Link>

          <Link
            to="/ask"
            className="flex min-h-20 w-full items-center gap-4 rounded-2xl border-2 border-primary/30 bg-secondary px-5 py-4 text-left text-secondary-foreground shadow-sm transition active:scale-[0.98]"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <MessageCircleQuestion className="h-7 w-7" />
            </span>
            <span>
              <strong className="block text-[21px] leading-tight">농지은행 사업 질문하기</strong>
              <span className="mt-1 block text-[16px] font-semibold text-muted-foreground">
                농지연금·임대·구입 궁금증 물어보기
              </span>
            </span>
          </Link>

          <a
            href="https://www.fbo.or.kr/contents/Contents.do?menuId=0500100030"
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-20 w-full items-center gap-4 rounded-2xl border-2 border-primary/30 bg-secondary px-5 py-4 text-left text-secondary-foreground shadow-sm transition active:scale-[0.98]"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Landmark className="h-7 w-7" />
            </span>
            <span>
              <strong className="block text-[21px] leading-tight">농지은행 사업 안내</strong>
              <span className="mt-1 block text-[16px] font-semibold text-muted-foreground">
                농지은행 포털에서 사업 알아보기
              </span>
            </span>
          </a>


          <div className="flex items-center justify-center gap-3">
            <SpeakButton text={WELCOME} label="안내 듣기" />
          </div>

          <div className="pt-6 text-center">
            <Link
              to="/admin"
              className="text-[13px] text-muted-foreground/70 underline"
            >
              관리자 페이지
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
