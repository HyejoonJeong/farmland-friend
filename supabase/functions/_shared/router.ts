import { answerFeedback, adminFeedback } from './feedback.ts';
import { adminReviews } from './reviews.ts';
import { adminLogs, sameSecret } from './admin.ts';
import { synthesize, transcribe, type ConnectSocket } from './audio.ts';
import { classify, consult } from './text.ts';
import { ApiError, requireEnv, type Env } from './openai.ts';

export type RateLimit = (request: Request, action: string) => Promise<boolean>;
const DEFAULT_ORIGINS = [
  'https://farmland-friend.lovable.app', 'https://preview--farmland-friend.lovable.app',
  'https://id-preview--295ae513-f336-46d2-b05c-32cecd1dafe1.lovable.app',
];

async function boundedRequest(request: Request, maxBytes: number): Promise<Request> {
  if (!request.body) return request;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new ApiError(413, '요청 크기가 너무 큽니다.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new Request(request.url, { method: request.method, headers: request.headers, body, signal: request.signal });
}

async function validApiKey(request: Request, env: Env) {
  const provided = request.headers.get('apikey');
  if (!provided) return false;
  const accepted = [env('SUPABASE_ANON_KEY'), env('APP_PUBLISHABLE_KEY')].filter(Boolean) as string[];
  const map = env('SUPABASE_PUBLISHABLE_KEYS');
  if (map) { try { accepted.push(...Object.values(JSON.parse(map)).filter(v => typeof v === 'string') as string[]); } catch { /* Legacy keys can still be used. */ } }
  for (const key of accepted) if (await sameSecret(provided, key)) return true;
  return false;
}

export function makeHandler(env: Env, connect: ConnectSocket, limit: RateLimit) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('Origin');
    const allowed = (env('ALLOWED_ORIGINS')?.split(',').map(value => value.trim()).filter(Boolean) ?? DEFAULT_ORIGINS);
    const headers = new Headers({
      Vary: 'Origin', 'Cache-Control': 'no-store',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
      'X-Content-Type-Options': 'nosniff',
    });
    if (origin && allowed.includes(origin)) headers.set('Access-Control-Allow-Origin', origin);
    const finish = (response: Response) => {
      const merged = new Headers(response.headers);
      headers.forEach((value, key) => merged.set(key, value));
      return new Response(response.body, { status: response.status, headers: merged });
    };
    try {
      if (origin && !allowed.includes(origin)) throw new ApiError(403, '허용되지 않은 앱 주소입니다.');
      if (request.method === 'OPTIONS') return finish(new Response(null, { status: 204 }));
      if (request.method !== 'POST') return finish(new Response('POST 요청만 가능합니다.', { status: 405, headers: { Allow: 'POST, OPTIONS' } }));
      const segments = new URL(request.url).pathname.split('/').filter(Boolean);
      const action = segments.at(-1) ?? '';
      if (!['intent', 'consult', 'stt', 'tts', 'admin-logs', 'admin-reviews', 'answer-feedback', 'admin-feedback', 'health'].includes(action)) throw new ApiError(404, 'API 경로를 찾을 수 없습니다.');
      if (!await validApiKey(request, env)) throw new ApiError(401, '앱 API 키가 올바르지 않습니다.');
      const length = Number(request.headers.get('content-length') ?? 0);
      if (length > (action === 'stt' ? 11 * 1024 * 1024 : 64 * 1024)) throw new ApiError(413, '요청 크기가 너무 큽니다.');
      if (action === 'health') return finish(Response.json({ ok: true }));
      if (!await limit(request, action)) throw new ApiError(429, '요청이 많습니다. 잠시 후 다시 이용해 주세요.');
      const input = await boundedRequest(request, action === 'stt' ? 11 * 1024 * 1024 : 64 * 1024);
      const response = action === 'consult' ? await consult(input, env) :
        action === 'intent' ? await classify(input, env) :
        action === 'stt' ? await transcribe(input, env) :
        action === 'answer-feedback' ? await answerFeedback(input, env) :
        action === 'admin-feedback' ? await adminFeedback(input, env) :
        action === 'admin-reviews' ? await adminReviews(input, env) :
        action === 'tts' ? await synthesize(input, env, connect) : await adminLogs(input, env);
      return finish(response);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : error instanceof SyntaxError || error instanceof TypeError ? 400 : 500;
      const message = error instanceof ApiError ? error.message : status === 400 ? '요청 형식이 올바르지 않습니다.' : '서버 요청을 처리하지 못했습니다.';
      // Never log request bodies, audio, transcripts, admin credentials, or provider errors.
      return finish(Response.json({ error: message }, { status, headers: status === 429 ? { 'Retry-After': '60' } : {} }));
    }
  };
}

export function createDatabaseLimiter(env: Env): RateLimit {
  return async (request, action) => {
    const secret = requireEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const hmac = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', hmac, new TextEncoder().encode(ip));
    const fingerprint = [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    const positive = (name: string, fallback: number) => { const n = Number(env(name)); return Number.isInteger(n) && n > 0 ? n : fallback; };
    const response = await fetch(`${requireEnv(env, 'SUPABASE_URL')}/rest/v1/rpc/consume_ai_request`, {
      method: 'POST', headers: { apikey: secret, Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_hash: fingerprint, per_minute: action.startsWith('admin-') ? 10 : positive('API_REQUESTS_PER_MINUTE', 30), per_day: positive('API_REQUESTS_PER_DAY', 10000) }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]),
    });
    if (!response.ok) { await response.body?.cancel(); throw new ApiError(503, '요청 한도 설정을 확인해 주세요.'); }
    return await response.json() === true;
  };
}
