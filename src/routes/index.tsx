import { createFileRoute } from "@tanstack/react-router";
import { QuestionConversation } from "@/routes/ask";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "말해농 · 농지은행 AI 음성 민원 안내" },
      {
        name: "description",
        content:
          "농지은행에 궁금한 점, 편하게 말씀하세요. 말해농이 답변하고 담당자에게 연결해 드립니다.",
      },
      { property: "og:title", content: "말해농 · 농지은행 AI 음성 민원 안내" },
      { property: "og:description", content: "말로 물어보고, 쉽게 안내받는 농지은행 민원 도우미" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <QuestionConversation
      embedded
      intro={
        <>
          <section className="welcome-panel welcome-chat-panel" aria-labelledby="welcome-title">
            <div className="welcome-copy">
              <p className="welcome-eyebrow">
                <span /> 농지은행 AI 음성 민원 안내
              </p>
              <h1 id="welcome-title">
                농지 이야기, <br />
                편하게 <span>말해농</span>
              </h1>
            </div>
          </section>
        </>
      }
    />
  );
}
