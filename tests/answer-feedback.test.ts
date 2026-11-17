import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FeedbackSubmission } from '../src/lib/answer-feedback.ts';

type FeedbackStore = typeof import('../src/lib/answer-feedback.ts');
let moduleSequence = 0;
async function freshStore(): Promise<FeedbackStore> {
  // A fresh module represents a page reload; sessionStorage survives it.
  const url = new URL('../src/lib/answer-feedback.ts', import.meta.url);
  url.searchParams.set('feedback-test', String(++moduleSequence));
  return await import(url.href) as FeedbackStore;
}

class SessionStorageMock {
  values = new Map<string, string>();
  blocked = false;
  getItem(key: string) { if (this.blocked) throw new Error('Storage blocked'); return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.blocked) throw new Error('Storage blocked'); this.values.set(key, value); }
  removeItem(key: string) { if (this.blocked) throw new Error('Storage blocked'); this.values.delete(key); }
}

async function withSession(run: (store: FeedbackStore, storage: SessionStorageMock, browser: EventTarget) => Promise<void> | void) {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const storage = new SessionStorageMock();
  const browser = Object.assign(new EventTarget(), { sessionStorage: storage });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
  try { await run(await freshStore(), storage, browser); }
  finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
}

test('receipt survives same-domain navigation, opens survey only on request, and clears for another inquiry', async () => {
  await withSession((store, storage, browser) => {
    let changes = 0;
    browser.addEventListener(store.FEEDBACK_CHANGED, () => changes++);
    store.rememberFeedback({ answerId: 'answer-a', token: 'receipt-a' }, 'farmland', '농지연금 문의', '담당 지사에 문의해 주세요.');
    assert.equal(store.readFeedback()?.contactAttempted, false);
    assert.equal(store.readFeedback()?.submitted, false);
    store.keepFeedbackDomain('farmland');
    assert.equal(store.readFeedback()?.answerId, 'answer-a');
    store.noteContactAttempt();
    assert.equal(store.readFeedback()?.contactAttempted, true);
    // Opening the telephone app does not record completed contact or submit a rating.
    assert.equal(store.readFeedback()?.submission, undefined);
    assert.equal(store.readFeedback()?.submitted, false);
    store.keepFeedbackDomain('survey');
    assert.equal(store.readFeedback(), null);
    assert.equal(storage.values.size, 0);
    assert.ok(changes >= 3);
    store.rememberFeedback({ answerId: 'answer-b', token: 'receipt-b' }, 'survey', '전수조사 문의', '안내');
    store.clearFeedback();
    assert.equal(store.readFeedback(), null);
    assert.equal(storage.values.size, 0);
  });
});

test('a stale answer cannot mutate the latest receipt and submitted ratings do not reopen', async () => {
  await withSession(store => {
    store.rememberFeedback({ answerId: 'latest', token: 'receipt' }, 'farmland', '질문', '답변');
    store.updateFeedback('older', { submitted: true, dismissed: true });
    assert.equal(store.readFeedback()?.submitted, false);
    assert.equal(store.readFeedback()?.dismissed, false);
    store.updateFeedback('latest', { submitted: true, dismissed: true });
    store.noteContactAttempt();
    assert.equal(store.readFeedback()?.dismissed, true);
    store.rememberFeedback(undefined, 'farmland', '새 질문', '새 답변');
    assert.equal(store.readFeedback(), null);
  });
});

test('exact submitted rating payload and receipt survive reload for idempotent retry', async () => {
  await withSession(async (store, storage) => {
    const submission: FeedbackSubmission = { contactCompleted: true, satisfaction: 4, accuracy: 'accurate', reuseConsent: false };
    store.rememberFeedback({ answerId: 'rated-answer', token: 'scoped-token' }, 'survey', '질문', '답변');
    store.updateFeedback('rated-answer', { contactAttempted: true, submission });
    const persisted = JSON.parse([...storage.values.values()][0]);
    assert.deepEqual(persisted.submission, submission);
    const reloaded = await freshStore();
    assert.deepEqual(reloaded.readFeedback()?.submission, submission);
    assert.equal(reloaded.readFeedback()?.answerId, 'rated-answer');
    assert.equal(reloaded.readFeedback()?.token, 'scoped-token');
    assert.equal(reloaded.readFeedback()?.submitted, false);
  });
});

test('expired receipts do not offer a survey after reload or contact attempt', async () => {
  await withSession(async (store) => {
    const originalNow = Date.now;
    const start = originalNow();
    try {
      Date.now = () => start;
      store.rememberFeedback({ answerId: 'expired', token: 'token' }, 'farmland', '질문', '답변');
      store.noteContactAttempt();
      Date.now = () => start + 7 * 86400000 + 1;
      const reloaded = await freshStore();
      assert.equal(reloaded.readFeedback(), null);
      reloaded.noteContactAttempt();
      assert.equal(reloaded.readFeedback(), null);
      assert.equal(store.readFeedback(), null);
    } finally { Date.now = originalNow; }
  });
});

test('blocked sessionStorage falls back to memory without breaking receipt or clear actions', async () => {
  await withSession((store, storage) => {
    storage.blocked = true;
    assert.equal(store.readFeedback(), null);
    store.rememberFeedback({ answerId: 'memory-answer', token: 'receipt' }, 'farmland', '질문', '답변');
    assert.equal(store.readFeedback()?.answerId, 'memory-answer');
    store.noteContactAttempt();
    assert.equal(store.readFeedback()?.contactAttempted, true);
    store.updateFeedback('memory-answer', { submitted: true });
    assert.equal(store.readFeedback()?.submitted, true);
    store.clearFeedback();
    assert.equal(store.readFeedback(), null);
  });
});
