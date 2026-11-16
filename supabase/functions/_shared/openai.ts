export type Env = (name: string) => string | undefined;
export type Message = { role: 'system' | 'user' | 'assistant'; content: string };

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function requireEnv(env: Env, name: string): string {
  const value = env(name);
  if (!value) throw new ApiError(503, `서버 설정이 필요합니다: ${name}`);
  return value;
}

export async function openaiFetch(
  env: Env, endpoint: string, body: object | FormData, signal?: AbortSignal,
): Promise<Response> {
  const headers = new Headers({ Authorization: `Bearer ${requireEnv(env, 'OPENAI_API_KEY')}` });
  if (!(body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`https://api.openai.com/v1/${endpoint}`, {
    method: 'POST', headers, body: body instanceof FormData ? body : JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(55_000)]) : AbortSignal.timeout(55_000),
  });
  if (!response.ok) {
    // Do not return provider payloads, prompts, or credentials to the browser/logs.
    await response.body?.cancel();
    if (response.status === 429) throw new ApiError(429, 'AI 사용량 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.');
    throw new ApiError(502, 'AI 서비스 요청을 처리하지 못했습니다.');
  }
  return response;
}

export function responseText(data: Record<string, unknown>): string {
  if (data.status !== 'completed') throw new ApiError(502, 'AI 응답이 완료되지 않았습니다.');
  const output = data.output as { content?: { type: string; text?: string }[] }[] | undefined;
  const text = (output ?? []).flatMap(item => item.content ?? [])
    .filter(item => item.type === 'output_text').map(item => item.text ?? '').join('').trim();
  if (!text) throw new ApiError(422, '답변을 만들지 못했습니다. 질문을 다시 말씀해 주세요.');
  return text;
}

export async function generateText(
  env: Env, messages: Message[], schema?: object, model?: string, signal?: AbortSignal,
): Promise<string> {
  const response = await openaiFetch(env, 'responses', {
    model: model ?? env('AI_TEXT_MODEL') ?? 'gpt-6-luna',
    store: false, input: messages, reasoning: { effort: 'low' },
    max_output_tokens: schema ? 1200 : 1600,
    ...(schema ? { text: { format: { type: 'json_schema', name: 'intent', strict: true, schema } } } : {}),
  }, signal);
  return responseText(await response.json());
}

export function textField(value: unknown, name: string, max: number, required = true): string {
  if (value == null && !required) return '';
  if (typeof value !== 'string') throw new ApiError(400, `${name} 값이 올바르지 않습니다.`);
  const text = value.trim();
  if ((required && !text) || text.length > max) throw new ApiError(400, `${name} 길이를 확인해 주세요.`);
  return text;
}

export function historyMessages(value: unknown): Message[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 100) throw new ApiError(400, '대화 내역이 올바르지 않습니다.');
  return value.slice(-6).map(item => {
    if (!item || !['user', 'assistant'].includes(item.role)) throw new ApiError(400, '대화 역할이 올바르지 않습니다.');
    return { role: item.role, content: textField(item.content, '대화 내역', 4000) };
  });
}
