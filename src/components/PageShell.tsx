import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HelpCircle, ChevronLeft } from "lucide-react";
import { HUMAN_SUPPORT_PHONE } from "@/lib/data";

export function PageShell({
  children,
  back,
  step,
}: {
  children: ReactNode;
  back?: string | null;
  step?: { current: number; total: number };
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-background/95 px-4 py-3 backdrop-blur">
        {back !== null && back !== undefined ? (
          <Link
            to={back}
            className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-lg font-semibold text-foreground/80 active:bg-secondary"
            aria-label="이전 화면"
          >
            <ChevronLeft className="h-6 w-6" />
            뒤로
          </Link>
        ) : (
          <div className="h-10 w-10" />
        )}
        {step && (
          <div className="text-base font-semibold text-muted-foreground">
            {step.current} / {step.total}
          </div>
        )}
        <a
          href={`tel:${HUMAN_SUPPORT_PHONE}`}
          className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-2 text-base font-bold text-accent-foreground shadow-sm active:scale-95"
          aria-label="상담원 통화 연결"
        >
          <HelpCircle className="h-5 w-5" />
          도움
        </a>
      </header>
      <main className="flex flex-1 flex-col px-5 pb-6">{children}</main>
    </div>
  );
}