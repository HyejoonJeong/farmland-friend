export function isNearChatBottom(scrollTop: number, clientHeight: number, scrollHeight: number) {
  return scrollHeight - clientHeight - scrollTop <= 64;
}

export function chatViewport(
  height: number,
  offsetTop: number,
  layoutHeight: number,
  editing: boolean,
) {
  return {
    height,
    top: offsetTop,
    compact: editing && (layoutHeight - height > 120 || height < 500),
  };
}
