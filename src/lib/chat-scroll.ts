export function isNearChatBottom(scrollTop: number, clientHeight: number, scrollHeight: number) {
  return scrollHeight - clientHeight - scrollTop <= 64;
}
