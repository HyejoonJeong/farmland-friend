import { ApiError, requireEnv, textField, type Env } from './openai.ts';
import { sameSecret } from './admin.ts';
import { reviewDatabase } from './reviews.ts';
import { KNOWLEDGE_VERSION } from './knowledge/version.ts';

const uuid = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;
const encoder = new TextEncoder();
async function signature(env: Env, payload: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(requireEnv(env, 'SUPABASE_SERVICE_ROLE_KEY')), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode('answer-feedback-v1:' + payload)));
  return Array.from(bytes, b => b.toString(16).padStart(2,'0')).join('');
}
export async function feedbackReceipt(env: Env, answerId: string, now = Date.now()) {
  const expires = String(Math.floor(now / 1000) + 7 * 86400);
  return { answerId, token: expires + '.' + await signature(env, answerId + '.' + expires) };
}
export async function verifyFeedbackReceipt(env: Env, answerId: string, token: string, now = Date.now()) {
  const parts = token.split('.');
  if (!uuid.test(answerId) || parts.length !== 2 || !/^\d{10}$/.test(parts[0]) || !/^[a-f0-9]{64}$/.test(parts[1])) return false;
  const expiry = Number(parts[0]) * 1000;
  if (expiry <= now || expiry > now + 7 * 86400000 + 1000) return false;
  return sameSecret(parts[1], await signature(env, answerId + '.' + parts[0]));
}
export function reusableEligible(row: Record<string, any>, now = Date.now()) {
  return !['retired','rejected'].includes(row.status) && row.feedback_contact_completed === true &&
    row.feedback_satisfaction >= 4 && row.feedback_accuracy === 'accurate' && row.feedback_reuse_consent === true &&
    !!row.feedback_submitted_at && !!row.reuse_answer && !!row.reuse_question && row.knowledge_version === KNOWLEDGE_VERSION &&
    Date.parse(row.reuse_valid_until) > now;
}
export async function answerFeedback(request: Request, env: Env) {
  const body = await request.json();
  const id = textField(body.answerId, '답변 번호', 36);
  const token = textField(body.token, '평가 확인', 100);
  if (!await verifyFeedbackReceipt(env, id, token)) throw new ApiError(401, '평가 기간이 지났거나 이 답변의 평가 링크가 아닙니다.');
  if (body.contactCompleted !== true || !Number.isInteger(body.satisfaction) || body.satisfaction < 1 || body.satisfaction > 5 ||
      !['accurate','partly','inaccurate','unsure'].includes(body.accuracy) || typeof body.reuseConsent !== 'boolean') {
    throw new ApiError(400, '담당자 상담 완료 여부와 만족도·정확도를 선택해 주세요.');
  }
  const response = await reviewDatabase(env, 'rpc/submit_answer_feedback', { method:'POST', body:JSON.stringify({
    answer_id:id, satisfaction:body.satisfaction, accuracy:body.accuracy, reuse_consent:body.reuseConsent,
  }) }, request.signal);
  const result = await response.json();
  if (result.error === 'missing') throw new ApiError(404, '평가할 답변을 찾지 못했습니다.');
  if (result.error === 'conflict') throw new ApiError(409, '이미 평가한 답변입니다. 한 답변에는 한 번만 참여할 수 있습니다.');
  return Response.json({ok:true, eligible:reusableEligible(result)});
}
export async function adminFeedback(request: Request, env: Env) {
  const body = await request.json();
  if (!await sameSecret(textField(body.key,'관리자 인증',500),requireEnv(env,'ADMIN_ACCESS_KEY'))) throw new ApiError(401,'관리자 인증이 필요합니다.');
  if (body.action === 'list') {
    const offset = Number(body.offset ?? 0);
    if (!Number.isInteger(offset) || offset < 0 || offset > 1000000) throw new ApiError(400,'조회 위치가 올바르지 않습니다.');
    const params = new URLSearchParams({select:'*',feedback_submitted_at:'not.is.null',order:'feedback_submitted_at.desc,id.desc',limit:'21',offset:String(offset)});
    const rows = await (await reviewDatabase(env,`consultation_answers?${params}`,{},request.signal)).json();
    return Response.json({rows:rows.slice(0,20).map((r:Record<string,any>)=>({...r,reusable_eligible:reusableEligible(r)})),hasMore:rows.length>20,knowledgeVersion:KNOWLEDGE_VERSION});
  }
  if (body.action !== 'exclude' || typeof body.id !== 'string' || !uuid.test(body.id) || !Number.isInteger(body.revision) || body.revision < 1) throw new ApiError(400,'제외할 답변을 확인해 주세요.');
  const rows = await (await reviewDatabase(env,`consultation_answers?id=eq.${body.id}&revision=eq.${body.revision}`,{
    method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'retired'}),
  },request.signal)).json();
  if (rows.length !== 1) throw new ApiError(409,'답변 상태가 변경되었습니다. 목록을 새로고침해 주세요.');
  return Response.json({ok:true});
}
