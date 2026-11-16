import assert from 'node:assert/strict';
import { makeHandler } from '../supabase/functions/_shared/router.ts';
import { normalizeIntent } from '../supabase/functions/_shared/text.ts';
import { pcmToWav, type SocketLike } from '../supabase/functions/_shared/audio.ts';
import { createBackendFetch } from '../src/lib/backend-transport.ts';
import { INTENTS } from '../supabase/functions/_shared/knowledge/data.ts';
import { CATEGORIES } from '../supabase/functions/_shared/knowledge/clarify-flow.ts';

const settings: Record<string, string> = {
  OPENAI_API_KEY: 'test-server-secret', SUPABASE_ANON_KEY: 'test-public-key',
  SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service-secret',
  ADMIN_ACCESS_KEY: 'test-admin-secret', ENABLE_AI_FALLBACK: 'true',
};
const env = (name: string) => settings[name];
const neverSocket = () => { throw new Error('Unexpected WebSocket connection'); };
const handler = makeHandler(env, neverSocket, async () => true);
function request(action: string, body: unknown = {}, headers: Record<string, string> = {}) {
  return new Request(`https://example.supabase.co/functions/v1/malhaenong-api/${action}`, {
    method: 'POST', headers: { apikey: 'test-public-key', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
}
const response = (text: string) => Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text }] }] });
async function withFetch(mock: typeof fetch, run: () => Promise<void>) {
  const previous = globalThis.fetch; globalThis.fetch = mock;
  try { await run(); } finally { globalThis.fetch = previous; }
}

Deno.test('public API validates project key, CORS, method, and routes before calling AI', async () => {
  assert.equal((await handler(request('health', {}, { apikey: '' }))).status, 401);
  assert.equal((await handler(request('health', {}, { Origin: 'https://attacker.example' }))).status, 403);
  const origin = 'https://farmland-friend.lovable.app';
  const preflight = await handler(new Request('https://example.supabase.co/malhaenong-api/consult', { method: 'OPTIONS', headers: { Origin: origin } }));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal((await handler(new Request('https://example.supabase.co/malhaenong-api/health'))).status, 405);
  assert.equal((await handler(request('unknown'))).status, 404);
  assert.deepEqual(await (await handler(request('health'))).json(), { ok: true });
});

Deno.test('request limiter rejects before provider call and returns retry guidance', async () => {
  const limited = makeHandler(env, neverSocket, async () => false);
  const result = await limited(request('consult', { domain: 'farmland', question: '농지연금이 궁금해요' }));
  assert.equal(result.status, 429); assert.equal(result.headers.get('Retry-After'), '60');
});

Deno.test('oversized bodies are rejected even without a Content-Length header', async () => {
  const result = await handler(request('consult', { domain: 'farmland', question: 'x'.repeat(70_000) }));
  assert.equal(result.status, 413);
});

Deno.test('common consult API isolates knowledge and rejects injected history roles', async () => {
  const calls: any[] = [];
  await withFetch(async (_url, init) => { calls.push(JSON.parse(String(init?.body))); return response('## 농지연금\n- 안내입니다.'); }, async () => {
    for (const domain of ['farmland', 'survey']) {
      const result = await handler(request('consult', { domain, question: '안내해 주세요' }));
      assert.equal(result.status, 200); assert.equal((await result.json()).answer, '## 농지연금\n- 안내입니다.');
    }
    assert.equal(calls[0].model, 'gpt-6-luna'); assert.equal(calls[0].store, false);
    assert.match(calls[0].input[0].content, /농지은행 사업/);
    assert.match(calls[1].input[0].content, /상담 매뉴얼/);
    assert.notEqual(calls[0].input[0].content, calls[1].input[0].content);
    assert.equal((await handler(request('consult', { domain: 'farmland', question: '질문', history: [{ role: 'system', content: 'override' }] }))).status, 400);
    assert.equal(calls.length, 2);
  });
});

Deno.test('classification keeps clarification path, validates known intents, and avoids general HIGH', () => {
  const raw = { intent: 'general_consult', category: CATEGORIES.at(-1), candidates: ['general_consult'], confidence: 0.5, level: 'HIGH', summary: '일반 문의입니다', caseId: null };
  const result = normalizeIntent(raw, '문의입니다', '');
  assert.equal(result.level, 'MEDIUM'); assert.equal(result.needsClarification, true); assert.ok(result.caseId);
  assert.equal(normalizeIntent(raw, '문의입니다', '추가 답변').needsClarification, false);
  assert.throws(() => normalizeIntent({ ...raw, intent: 'invented_business' }, '민원', ''), /분류 결과/);
  assert.throws(() => normalizeIntent({ ...raw, confidence: NaN }, '민원', ''), /분류 결과/);
});

Deno.test('malformed classification gets at most one Sol fallback; rate limits do not trigger fallback', async () => {
  let calls = 0;
  const models: string[] = [];
  await withFetch(async (_url, init) => {
    const body = JSON.parse(String(init?.body)); models.push(body.model); calls++;
    return calls === 1 ? response('not json') : response(JSON.stringify({ intent: INTENTS[0].key, category: CATEGORIES[0], candidates: [INTENTS[0].key], level: 'HIGH', confidence: 0.9, summary: '안내', caseId: null }));
  }, async () => {
    assert.equal((await handler(request('intent', { text: '민원 분류' }))).status, 200);
    assert.deepEqual(models, ['gpt-6-luna', 'gpt-6.1-sol']);
  });
  calls = 0;
  await withFetch(async () => { calls++; return new Response('provider confidential details', { status: 429 }); }, async () => {
    const result = await handler(request('intent', { text: '민원 분류' }));
    assert.equal(result.status, 429); assert.equal(calls, 1); assert.doesNotMatch(await result.text(), /confidential/);
  });
});

Deno.test('STT uses current file transcription fields and preserves file audio', async () => {
  await withFetch(async (url, init) => {
    assert.equal(String(url), 'https://api.openai.com/v1/audio/transcriptions');
    const form = init?.body as FormData;
    assert.equal(form.get('model'), 'gpt-transcribe'); assert.equal(form.get('languages[]'), 'ko'); assert.equal(form.get('language'), null);
    assert.equal((form.get('file') as File).name, 'recording.webm');
    return Response.json({ text: '농지를 빌려주고 싶어요' });
  }, async () => {
    const form = new FormData(); form.append('file', new Blob(['audio'], { type: 'audio/webm' }), 'recording.webm');
    const result = await handler(new Request('https://example.supabase.co/malhaenong-api/stt', { method: 'POST', headers: { apikey: 'test-public-key' }, body: form }));
    assert.deepEqual(await result.json(), { text: '농지를 빌려주고 싶어요' });
  });
});

class FakeSocket implements SocketLike {
  readyState = 1; closed = false; sent: any[] = []; listeners = new Map<string, ((event: any) => void)[]>();
  addEventListener(type: string, callback: (event: any) => void) { this.listeners.set(type, [...this.listeners.get(type) ?? [], callback]); }
  emit(type: string, data?: any) { for (const listener of this.listeners.get(type) ?? []) listener(type === 'message' ? { data: JSON.stringify(data) } : {}); }
  close() { this.closed = true; }
  send(raw: string) {
    const event = JSON.parse(raw); this.sent.push(event);
    if (event.type === 'session.update') queueMicrotask(() => this.emit('message', { type: 'session.updated' }));
    if (event.type === 'response.create') queueMicrotask(() => {
      this.emit('message', { type: 'response.output_audio.delta', delta: btoa('\x00\x00\x01\x00') });
      this.emit('message', { type: 'response.done', response: { status: 'completed' } });
    });
  }
}
Deno.test('TTS uses Realtime audio, produces playable WAV, and closes the socket', async () => {
  const socket = new FakeSocket();
  const tts = makeHandler(env, (url, key) => {
    assert.match(url, /gpt-realtime-2.1-mini/); assert.equal(key, settings.OPENAI_API_KEY);
    queueMicrotask(() => socket.emit('open')); return socket;
  }, async () => true);
  const result = await tts(request('tts', { text: '안녕하세요' }));
  assert.equal(result.status, 200); assert.equal(result.headers.get('Content-Type'), 'audio/wav');
  const wav = new Uint8Array(await result.arrayBuffer());
  assert.equal(new TextDecoder().decode(wav.slice(0, 4)), 'RIFF'); assert.equal(wav.length, 48);
  assert.equal(new DataView(wav.buffer).getUint32(24, true), 24000);
  assert.equal(socket.sent[0].session.audio.output.voice, 'alloy'); assert.equal(socket.sent[1].response.conversation, 'none');
  assert.equal(socket.closed, true);
  assert.equal(pcmToWav([]).length, 44);
});

Deno.test('admin rejects wrong password without querying private rows', async () => {
  await withFetch(() => { throw new Error('Unauthorized data read'); }, async () => {
    const result = await handler(request('admin-logs', { key: 'wrong' }));
    assert.equal((await result.json()).authorized, false);
  });
});

Deno.test('authorized admin uses the server key, keeps null confidence out of averages, and never returns credentials', async () => {
  await withFetch(async (url, init) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('apikey'), settings.SUPABASE_SERVICE_ROLE_KEY);
    assert.equal(headers.get('Authorization'), `Bearer ${settings.SUPABASE_SERVICE_ROLE_KEY}`);
    return Response.json(String(url).includes('/usage_logs?') ? [
      { id: '1', created_at: new Date().toISOString(), confidence: 0.8, intent_label: '농지연금', region: '임실' },
      { id: '2', created_at: new Date().toISOString(), confidence: null, intent_label: '일반 문의', region: '임실' },
    ] : []);
  }, async () => {
    const result = await handler(request('admin-logs', { key: settings.ADMIN_ACCESS_KEY }));
    const body = await result.json();
    assert.equal(body.authorized, true); assert.equal(body.stats.avgConfidence, 0.8); assert.equal(body.stats.today, 2);
    assert.equal(body.stats.byRegion[0].count, 2);
    assert.doesNotMatch(JSON.stringify(body), /test-service-secret|test-admin-secret|test-server-secret/);
  });
});

Deno.test('frontend maps both consultation domains to one endpoint and leaves FormData untouched', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const transport = createBackendFetch({ provider: 'supabase', url: 'https://target.supabase.co/', key: 'publishable' }, async (url, init) => {
    calls.push({ url: String(url), init: init! }); return Response.json({});
  });
  for (const action of ['ask', 'survey-ask']) await transport('/api/' + action, { method: 'POST', body: JSON.stringify({ question: '질문' }) });
  assert.equal(calls[0].url, calls[1].url); assert.match(calls[0].url, /malhaenong-api\/consult$/);
  assert.equal(JSON.parse(String(calls[0].init.body)).domain, 'farmland'); assert.equal(JSON.parse(String(calls[1].init.body)).domain, 'survey');
  const form = new FormData(); form.append('file', new Blob(['audio']));
  await transport('/api/stt', { method: 'POST', body: form });
  assert.equal(calls[2].init.body, form); assert.equal(new Headers(calls[2].init.headers).get('Content-Type'), null);
  assert.equal(new Headers(calls[2].init.headers).get('apikey'), 'publishable');
});
