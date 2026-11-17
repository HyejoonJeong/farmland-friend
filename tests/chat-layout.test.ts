import { test, expect } from "bun:test";
import { isNearChatBottom } from "../src/lib/chat-scroll";

test("answers follow only when the reader remains near the conversation bottom", () => {
  expect(isNearChatBottom(400, 600, 1000)).toBe(true);
  expect(isNearChatBottom(336, 600, 1000)).toBe(true);
  expect(isNearChatBottom(335, 600, 1000)).toBe(false);
  expect(isNearChatBottom(0, 600, 200)).toBe(true);
  expect(isNearChatBottom(0, 600, 5000)).toBe(false);
});
