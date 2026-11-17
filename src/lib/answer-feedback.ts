export interface FeedbackReceipt { answerId: string; token: string }
export type FeedbackDomain = 'farmland' | 'survey';
export interface FeedbackSubmission {
  contactCompleted: true; satisfaction: number;
  accuracy: 'accurate' | 'partly' | 'inaccurate' | 'unsure'; reuseConsent: boolean;
}
export interface PendingFeedback extends FeedbackReceipt {
  domain: FeedbackDomain; question: string; answer: string; savedAt: number;
  contactAttempted: boolean; dismissed: boolean; submitted: boolean;
  submission?: FeedbackSubmission;
}
const STORAGE_KEY = 'malhaenong-answer-feedback-v1';
export const FEEDBACK_CHANGED = 'malhaenong-feedback-changed';
let memory: PendingFeedback | null = null;
let loaded = false;

export function readFeedback(): PendingFeedback | null {
  if (typeof window === 'undefined') return null;
  if (!loaded) {
    loaded = true;
    try {
      const value = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? 'null');
      if (value && typeof value.answerId === 'string' && typeof value.token === 'string' &&
          typeof value.question === 'string' && typeof value.answer === 'string' &&
          (value.domain === 'farmland' || value.domain === 'survey') && Number.isFinite(value.savedAt)) memory = value;
    } catch { /* Storage may be unavailable; the current tab still works in memory. */ }
  }
  if (memory && Date.now() - memory.savedAt > 7 * 86400000) memory = null;
  return memory;
}

function writeFeedback(value: PendingFeedback | null) {
  memory = value; loaded = true;
  if (typeof window === 'undefined') return;
  try {
    if (value) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* No local storage is required to make a call or receive an answer. */ }
  window.dispatchEvent(new Event(FEEDBACK_CHANGED));
}
export function clearFeedback() { writeFeedback(null); }
export function keepFeedbackDomain(domain: FeedbackDomain) {
  const current = readFeedback();
  if (current && current.domain !== domain) clearFeedback();
}
export function rememberFeedback(receipt: FeedbackReceipt | undefined, domain: FeedbackDomain, question: string, answer: string) {
  if (!receipt || typeof receipt.answerId !== 'string' || typeof receipt.token !== 'string') return clearFeedback();
  writeFeedback({ ...receipt, domain, question, answer, savedAt: Date.now(), contactAttempted: false, dismissed: false, submitted: false });
}
export function updateFeedback(answerId: string, patch: Partial<Pick<PendingFeedback, 'contactAttempted' | 'dismissed' | 'submitted' | 'submission'>>) {
  const current = readFeedback();
  if (current?.answerId === answerId) writeFeedback({ ...current, ...patch });
}
export function noteContactAttempt() {
  const current = readFeedback();
  if (current && !current.submitted) updateFeedback(current.answerId, { contactAttempted: true, dismissed: false });
}
