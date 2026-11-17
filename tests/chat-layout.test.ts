import { test, expect } from "bun:test";
import { chatViewport, isNearChatBottom } from "../src/lib/chat-scroll";

test("answers follow only when the reader remains near the conversation bottom", () => {
  expect(isNearChatBottom(400, 600, 1000)).toBe(true);
  expect(isNearChatBottom(336, 600, 1000)).toBe(true);
  expect(isNearChatBottom(335, 600, 1000)).toBe(false);
  expect(isNearChatBottom(0, 600, 200)).toBe(true);
  expect(isNearChatBottom(0, 600, 5000)).toBe(false);
});

test("keyboard viewport uses its visible height and pan offset", () => {
  expect(chatViewport(420, 120, 844, true)).toEqual({ height: 420, top: 120, compact: true });
  expect(chatViewport(844, 0, 844, true).compact).toBe(false);
  expect(chatViewport(420, 0, 420, true).compact).toBe(true);
  expect(chatViewport(420, 0, 844, false).compact).toBe(false);
});
