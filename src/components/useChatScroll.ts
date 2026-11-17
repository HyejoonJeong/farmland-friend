import { useLayoutEffect, useRef } from "react";
import { isNearChatBottom } from "@/lib/chat-scroll";

export function useChatScroll(update: unknown, status: string) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const following = useRef(false);
  const followLatest = () => {
    following.current = true;
  };
  const onScroll = () => {
    const el = scrollRef.current;
    if (el) following.current = isNearChatBottom(el.scrollTop, el.clientHeight, el.scrollHeight);
  };
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    const follow = () => {
      if (following.current) el.scrollTop = el.scrollHeight;
    };
    follow();
    const observer = new ResizeObserver(follow);
    observer.observe(content);
    observer.observe(el);
    return () => observer.disconnect();
  }, [update, status]);
  return { scrollRef, contentRef, onScroll, followLatest };
}
