import { useEffect, useRef, useState, type ReactNode } from "react";
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
}: {
  children: ReactNode;
  back?: string | null;
  step?: { current: number; total: number };
  home?: boolean;
  className?: string;
}) {
  const [showBackToTop, setShowBackToTop] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const update = () => setShowBackToTop(window.scrollY > 0);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  const backToTop = () => {
    headerRef.current?.focus({ preventScroll: true });
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  return (
    <div onClickCapture={event => {
      const target = event.target;
      if (target instanceof Element && target.closest('a[href^="tel:"]')) noteContactAttempt();
    }}
      className={`app-shell mx-auto flex min-h-dvh w-full flex-col bg-background text-foreground ${home ? "home-shell" : "max-w-md"} ${className}`}
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
      <main className="flex flex-1 flex-col px-5 pb-6">{children}<AnswerFeedback /></main>
      <footer className="site-footer">
        <img src={krcLogo} alt="KRC 한국농어촌공사" width={180} />
      </footer>
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
