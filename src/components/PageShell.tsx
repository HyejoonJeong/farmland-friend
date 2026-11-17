import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type CSSProperties,
} from "react";
import { chatViewport } from "@/lib/chat-scroll";
import { Link } from "@tanstack/react-router";
import { ArrowUp } from "lucide-react";
import krcLogo from "@/assets/krc-logo.png";
import serviceLogo from "@/assets/malhaenong-logo.png";
import { SiteSearch } from "@/components/SiteSearch";
import { SiteNavigation } from "@/components/SiteNavigation";
import { BackButton } from "@/components/BackButton";

import { AnswerFeedback } from "./AnswerFeedback";
import { noteContactAttempt } from "@/lib/answer-feedback";

export function PageShell({
  children,
  back,
  step,
  home = false,
  className = "",
  composer,
  chat,
}: {
  children: ReactNode;
  back?: string | null;
  step?: { current: number; total: number };
  home?: boolean;
  className?: string;
  composer?: ReactNode;
  chat?: {
    scrollRef: RefObject<HTMLDivElement | null>;
    contentRef: RefObject<HTMLDivElement | null>;
    onScroll: () => void;
  };
}) {
  const [showBackToTop, setShowBackToTop] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<CSSProperties>({});
  const [compact, setCompact] = useState(false);
  const fixedChat = composer !== undefined;
  useEffect(() => {
    if (!fixedChat) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const update = () => {
      const vv = window.visualViewport;
      const editing = document.activeElement instanceof HTMLTextAreaElement;
      const next = chatViewport(
        vv?.height ?? window.innerHeight,
        vv?.offsetTop ?? 0,
        document.documentElement.clientHeight,
        editing,
      );
      setCompact(next.compact);
      setViewport({
        height: `${next.height}px`,
        top: `${next.top}px`,
        "--chat-dock-height": `${dockRef.current?.offsetHeight ?? 0}px`,
      } as CSSProperties);
    };
    const observer = new ResizeObserver(update);
    if (dockRef.current) observer.observe(dockRef.current);
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      document.body.style.overflow = previous;
      observer.disconnect();
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, [fixedChat]);
  useEffect(() => {
    const update = () => setShowBackToTop(window.scrollY > 0);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  const backToTop = () => {
    headerRef.current?.focus({ preventScroll: true });
    if (fixedChat && chat?.scrollRef.current) {
      chat.scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  return (
    <div
      onClickCapture={(event) => {
        const target = event.target;
        if (target instanceof Element && target.closest('a[href^="tel:"]')) noteContactAttempt();
      }}
      style={fixedChat ? viewport : undefined}
      data-keyboard={compact || undefined}
      className={`app-shell mx-auto flex min-h-dvh w-full flex-col bg-background text-foreground ${home ? "home-shell" : "max-w-md"} ${fixedChat ? "chat-shell" : ""} ${className}`}
    >
      <header ref={headerRef} tabIndex={-1} className="site-header sticky top-0 z-10">
        <div className="header-brand">
          {!home && <BackButton fallback={back ?? "/"} />}
          <Link
            to="/"
            reloadDocument={home}
            className="service-brand"
            aria-label={home ? "말해농 홈 새로고침" : "말해농 홈"}
          >
            <img src={serviceLogo} alt="말해농" width={154} />
          </Link>
        </div>
        <div className="header-tools">
          {step && (
            <span className="header-step">
              {step.current} / {step.total}
            </span>
          )}
          <SiteNavigation />
        </div>
      </header>
      <main className="flex flex-1 flex-col px-5 pb-6">
        {fixedChat ? (
          <>
            <div
              ref={chat?.scrollRef}
              className="chat-scroll"
              tabIndex={0}
              aria-label="상담 대화와 안내"
              onScroll={() => {
                chat?.onScroll();
                setShowBackToTop((chat?.scrollRef.current?.scrollTop ?? 0) > 0);
              }}
            >
              <div ref={chat?.contentRef} className="chat-content">
                {children}
                <AnswerFeedback />
                <footer className="site-footer">
                  <img src={krcLogo} alt="KRC 한국농어촌공사" width={180} />
                </footer>
              </div>
            </div>
            <div ref={dockRef} className="chat-dock">
              {composer}
            </div>
          </>
        ) : (
          <>
            {children}
            <AnswerFeedback />
          </>
        )}
      </main>
      {!fixedChat && (
        <footer className="site-footer">
          <img src={krcLogo} alt="KRC 한국농어촌공사" width={180} />
        </footer>
      )}
      <div className="floating-actions">
        <SiteSearch />
        {showBackToTop && (
          <button
            type="button"
            className="back-to-top"
            onClick={backToTop}
            aria-label="맨 위로 이동"
          >
            <ArrowUp size={26} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
