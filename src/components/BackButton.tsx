import { useCanGoBack, useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export function BackButton({ fallback = "/" }: { fallback?: string | null }) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  return (
    <button
      type="button"
      className="page-back-button"
      aria-label="뒤로가기"
      disabled={!canGoBack && !fallback}
      onClick={() => {
        if (canGoBack) router.history.back();
        else if (fallback) void router.navigate({ to: fallback });
      }}
    >
      <ChevronLeft size={21} aria-hidden="true" />
    </button>
  );
}
