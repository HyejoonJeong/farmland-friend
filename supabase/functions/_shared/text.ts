import { feedbackReceipt } from './feedback.ts';
import { knowledgeSources, selectedSource, type ConsultationDomain } from './knowledge-sources.ts';
import { INTENTS, type IntentKey } from './knowledge/data.ts';
import { CATEGORIES, CATEGORY_DEFAULT_CASE, CLARIFY_CASE_IDS, INTENT_META, type Category, type ClarifyCaseId } from './knowledge/clarify-flow.ts';
import { consultPrompt, intentPrompt } from './prompts.ts';
import { approvedAnswers, saveAnswerDraft } from './reviews.ts';
import { ApiError, generateText, historyMessages, textField, type Env } from './openai.ts';

const validKeys = INTENTS.map(item => item.key);
export const INTENT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['category', 'candidates', 'intent', 'level', 'confidence', 'summary', 'caseId'],
  properties: {
    category: { type: 'string', enum: [...CATEGORIES] },
    candidates: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string', enum: validKeys } },
    intent: { type: 'string', enum: validKeys },
    level: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    summary: { type: 'string' },
    caseId: { type: ['string', 'null'], enum: [...CLARIFY_CASE_IDS, null] },
  },
};

export function normalizeIntent(value: unknown, text: string, clarification: string) {
  if (!value || typeof value !== 'object') throw new ApiError(422, '업무 분류 형식이 올바르지 않습니다.');
  const item = value as Record<string, unknown>;
  if (!validKeys.includes(item.intent as IntentKey) ||
      !(CATEGORIES as readonly unknown[]).includes(item.category) ||
      !['HIGH', 'MEDIUM', 'LOW'].includes(String(item.level)) ||
      typeof item.confidence !== 'number' || !Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1 ||
      typeof item.summary !== 'string' || item.summary.length > 2000 ||
      !Array.isArray(item.candidates) || item.candidates.length < 1 || item.candidates.length > 5 ||
      !item.candidates.every(key => validKeys.includes(key as IntentKey))) {
    throw new ApiError(422, '업무 분류 결과를 확인하지 못했습니다.');
  }
  const intent = item.intent as IntentKey;
  const category = INTENT_META[intent].category;
  const level = intent === 'general_consult' && item.level === 'HIGH' ? 'MEDIUM' : item.level as string;
  const caseId = level === 'HIGH' ? null :
    (CLARIFY_CASE_IDS as readonly unknown[]).includes(item.caseId) ? item.caseId as ClarifyCaseId : CATEGORY_DEFAULT_CASE[category] ?? 'general';
  return {
    intent, category, candidates: [intent, ...new Set((item.candidates as IntentKey[]).filter(key => key !== intent))].slice(0, 5), confidence: item.confidence,
    summary: item.summary || text, level, caseId, needsClarification: level !== 'HIGH' && !clarification,
  };
}

export async function classify(request: Request, env: Env): Promise<Response> {
  const body = await request.json();
  const text = textField(body.text, '민원 내용', 4000);
  const region = textField(body.region, '지역', 100, false);
  const clarification = textField(body.clarification, '추가 답변', 2000, false);
  const user = clarification ? `최초 발화: ${JSON.stringify(text)}\n추가 답변: ${JSON.stringify(clarification)}` : `발화: ${JSON.stringify(text)}`;
  const messages = [
    { role: 'system' as const, content: intentPrompt({ region }) },
    { role: 'user' as const, content: `지역: ${JSON.stringify(region)}\n${user}` },
  ];
  const run = async (model?: string) => {
    const output = await generateText(env, messages, INTENT_SCHEMA, model, request.signal);
    let parsed: unknown;
    try { parsed = JSON.parse(output); } catch { throw new ApiError(422, '업무 분류 형식이 올바르지 않습니다.'); }
    return normalizeIntent(parsed, text, clarification);
  };
  try { return Response.json(await run()); }
  catch (error) {
    // Only malformed/refused classification gets one fallback. Unclear meaning keeps the clarification flow.
    if (!(error instanceof ApiError) || error.status !== 422 || env('ENABLE_AI_FALLBACK') !== 'true') throw error;
    return Response.json(await run(env('AI_FALLBACK_MODEL') ?? 'gpt-6.1-sol'));
  }
}

export const CONSULT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['intent', 'answer', 'reference_ids', 'reuse_source_id'],
  properties: {
    intent: { type: 'string', enum: validKeys },
    answer: { type: 'string' },
    reuse_source_id: { type: 'string', enum: [''] },
    reference_ids: { type: 'array', maxItems: 3, items: { type: 'string' } },
  },
};

export function consultationSchema(domain: ConsultationDomain) {
  return { ...CONSULT_SCHEMA, properties: { ...CONSULT_SCHEMA.properties,
    reuse_source_id: { type: 'string', enum: ['', ...knowledgeSources(domain).sources.map(source => source.id)] },
  } };
}

// Expand a matching excerpt to complete source lines, preserving nearby conditions/negation.
// The returned text can only originate in our public knowledge, never in user history.
export function groundedExcerpt(source: string, candidate: unknown): string {
  if (typeof candidate !== 'string') return '';
  const excerpt = candidate.trim();
  if (excerpt.length < 20 || excerpt.length > 1200) return '';
  const position = source.indexOf(excerpt);
  if (position < 0) return '';
  const start = source.lastIndexOf('\n', position - 1) + 1;
  const nextLine = source.indexOf('\n', position + excerpt.length);
  const complete = source.slice(start, nextLine < 0 ? source.length : nextLine).trim();
  return complete.length <= 1200 ? complete : '';
}

export async function consult(request: Request, env: Env): Promise<Response> {
  const body = await request.json();
  if (body.domain !== 'farmland' && body.domain !== 'survey') throw new ApiError(400, '상담 분야를 선택해 주세요.');
  const question = textField(body.question, '질문', 2000);
  const history = historyMessages(body.history);
  const context = history.filter(item => item.role === 'user').slice(-1).map(item => item.content).join(' ');
  const examples = await approvedAnswers(env, body.domain, question + ' ' + context, request.signal);
  const catalogue = INTENTS.map(i => ({ intent: i.key, category: INTENT_META[i.key].category, meaning: i.meaning, business: i.business }));
  const raw = await generateText(env, [
    { role: 'system', content: consultPrompt(body.domain) + '\n업무 목록: ' + JSON.stringify(catalogue) },
    { role: 'user', content: JSON.stringify({ reference_type: 'satisfied_examples', items: examples }) },
    ...history, { role: 'user', content: question },
  ], consultationSchema(body.domain), undefined, request.signal);
  let value: { intent?: unknown; answer?: unknown; reference_ids?: unknown; reuse_source_id?: unknown };
  try { value = JSON.parse(raw); } catch { throw new ApiError(502, '답변 형식을 확인하지 못했습니다.'); }
  if (!value || !validKeys.includes(value.intent as IntentKey) || typeof value.answer !== 'string' || !value.answer.trim() || value.answer.length > 6000 ||
      !Array.isArray(value.reference_ids) || value.reference_ids.length > 3 || !value.reference_ids.every(id => examples.some(e => e.id === id && e.intent === value.intent))) {
    throw new ApiError(502, '답변 내용을 확인하지 못했습니다. 다시 질문해 주세요.');
  }
  const answer = value.answer.trim();
  const intent = value.intent as IntentKey;
  const category = INTENT_META[intent].category;
  // Only exact current public-source excerpts can cross sessions; never original user text.
  const reusable = selectedSource(body.domain, value.reuse_source_id, intent);
  const topic = INTENTS.find(i=>i.key===intent)!;
  const id = await saveAnswerDraft(env, { domain: body.domain, question, answer, intent, category, reference_ids: [...new Set(value.reference_ids)], conversation_context: history, reuse_question: reusable ? `${category}: ${topic.business} — ${topic.meaning}`.slice(0,500) : '', reuse_answer: reusable }, request.signal);
  return Response.json({ answer, intent, category, feedback: await feedbackReceipt(env, id) });
}
