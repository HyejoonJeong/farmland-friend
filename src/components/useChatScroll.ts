import { useEffect, useLayoutEffect, useRef } from "react";
import { isNearChatBottom } from "@/lib/chat-scroll";

export function useChatScroll(update: unknown, status: string) {
  const contentRef = useRef<HTMLDivElement>(null);
  const following = useRef(false);
  const followLatest = () => {
    following.current = true;
  };
  useEffect(() => {
    const onScroll = () => {
      following.current = isNearChatBottom(
        window.scrollY,
        window.innerHeight,
        document.documentElement.scrollHeight,
      );
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const follow = () => {
      if (following.current)
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    };
    follow();
    const observer = new ResizeObserver(follow);
    observer.observe(content);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [update, status]);
  return { contentRef, followLatest };
}
