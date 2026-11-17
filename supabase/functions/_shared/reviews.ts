import { ApiError, requireEnv, textField, type Env } from './openai.ts';
import { sameSecret } from './admin.ts';
import { INTENT_META } from './knowledge/clarify-flow.ts';
import { INTENTS, type IntentKey } from './knowledge/data.ts';
import { KNOWLEDGE_VERSION } from './knowledge/version.ts';

export async function reviewDatabase(env: Env, path: string, init: RequestInit = {}, signal?: AbortSignal) {
  const key = requireEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${requireEnv(env, 'SUPABASE_URL')}/rest/v1/${path}`, {
    ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12_000)]) : AbortSignal.timeout(12_000),
  });
  if (!response.ok) { await response.body?.cancel(); throw new ApiError(503, '답변 검토 저장소에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
  return response;
}

// This is a first-pass mask, not a substitute for the administrator's privacy review.
export function redactPersonalData(text: string) {
  return text.replace(/\b\d{6}[-\s]?[1-4]\d{6}\b/g, '[주민번호 삭제]')
    .replace(/\b01[016789][- .]?\d{3,4}[- .]?\d{4}\b/g, '[휴대전화 삭제]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[이메일 삭제]');
}

type Example = { id: string; intent: string; category: string; question: string; answer: string; source_reference: string };
export async function approvedAnswers(env: Env, domain: string, query: string, signal?: AbortSignal): Promise<Example[]> {
  const response = await reviewDatabase(env, 'rpc/search_approved_answers', {
    method: 'POST', body: JSON.stringify({ search_text: query.slice(0, 4000), search_domain: domain, current_version: KNOWLEDGE_VERSION }),
  }, signal);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length > 3) throw new ApiError(503, '참고 답변을 확인하지 못했습니다.');
  return rows;
}

export async function saveAnswerDraft(env: Env, value: {domain: string; question: string; answer: string; intent: string; category: string; reference_ids: unknown[]; conversation_context: {role: string; content: string}[]}, signal?: AbortSignal) {
  await reviewDatabase(env, 'consultation_answers', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ ...value, question: redactPersonalData(value.question), answer: redactPersonalData(value.answer),
      original_question: redactPersonalData(value.question), original_answer: redactPersonalData(value.answer),
      conversation_context: value.conversation_context.map(item => ({ role: item.role, content: redactPersonalData(item.content) })),
      status: 'pending', knowledge_version: KNOWLEDGE_VERSION }),
  }, signal);
}

const validStatuses = ['pending', 'approved', 'rejected', 'retired'];
export async function adminReviews(request: Request, env: Env): Promise<Response> {
  const body = await request.json();
  if (!await sameSecret(textField(body.key, '관리자 인증', 500), requireEnv(env, 'ADMIN_ACCESS_KEY'))) throw new ApiError(401, '관리자 인증이 필요합니다.');
  if (body.action === 'list') {
    const status = textField(body.status, '상태', 20);
    if (!validStatuses.includes(status)) throw new ApiError(400, '검토 상태가 올바르지 않습니다.');
    const offset = Number(body.offset ?? 0);
    if (!Number.isInteger(offset) || offset < 0 || offset > 1000000) throw new ApiError(400, '조회 위치가 올바르지 않습니다.');
    const params = new URLSearchParams({ select: '*', status: `eq.${status}`, order: 'created_at.desc,id.desc', limit: '21', offset: String(offset) });
    const response = await reviewDatabase(env, `consultation_answers?${params}`, {}, request.signal);
    const rows = await response.json();
    return Response.json({ rows: rows.slice(0, 20), hasMore: rows.length > 20, knowledgeVersion: KNOWLEDGE_VERSION });
  }
  if (body.action !== 'update') throw new ApiError(400, '검토 작업이 올바르지 않습니다.');
  const id = textField(body.id, '답변 번호', 36);
  if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id) || !Number.isInteger(body.revision) || body.revision < 1) throw new ApiError(400, '답변 버전을 확인해 주세요.');
  const status = textField(body.status, '상태', 20);
  if (!validStatuses.includes(status)) throw new ApiError(400, '검토 상태가 올바르지 않습니다.');
  const intent = textField(body.intent, '업무', 80) as IntentKey;
  if (!INTENTS.some(item => item.key === intent)) throw new ApiError(400, '업무를 선택해 주세요.');
  const question = textField(body.question, '재사용 질문', 2000);
  const answer = textField(body.answer, '재사용 답변', status === 'approved' ? 1200 : 6000);
  const source = textField(body.source_reference, '근거 자료', 500, status === 'approved');
  const reviewer = textField(body.reviewer, '검토자', 100, status === 'approved');
  let expires: string | null = null;
  if (status === 'approved') {
    if (body.privacy_checked !== true) throw new ApiError(400, '개인정보 제거와 내용 검토를 확인해 주세요.');
    if (redactPersonalData(question) !== question || redactPersonalData(answer) !== answer) throw new ApiError(400, '개인정보를 제거한 뒤 승인해 주세요.');
    const expiry = typeof body.valid_until === 'string' ? Date.parse(body.valid_until) : NaN;
    if (!Number.isFinite(expiry) || expiry <= Date.now() || expiry > Date.now() + 366 * 86400000) throw new ApiError(400, '유효기한은 오늘 이후 1년 이내로 선택해 주세요.');
    expires = new Date(expiry).toISOString();
  }
  const patch = { intent, category: INTENT_META[intent].category, question, answer, status,
    source_reference: source, reviewer, reviewed_at: status === 'approved' ? new Date().toISOString() : null,
    valid_until: expires, knowledge_version: KNOWLEDGE_VERSION };
  const response = await reviewDatabase(env, `consultation_answers?id=eq.${id}&revision=eq.${body.revision}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch),
  }, request.signal);
  const rows = await response.json();
  if (rows.length !== 1) throw new ApiError(409, '다른 검토자가 수정한 답변입니다. 목록을 새로고침한 뒤 다시 검토해 주세요.');
  return Response.json({ ok: true, row: rows[0] });
}
