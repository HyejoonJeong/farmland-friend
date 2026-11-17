export interface BackendConfig { provider: string; url?: string; key?: string }

export function createBackendFetch(config: BackendConfig, request: typeof fetch = fetch) {
  return async (path: string, init: RequestInit = {}): Promise<Response> => {
    if (config.provider !== 'supabase') return request(path, init);
    if (!config.url || !config.key) throw new Error('Supabase 연결 설정이 필요합니다.');
    const action = path.replace(/^\/api\//, '');
    const routes: Record<string, string> = { ask: 'consult', 'survey-ask': 'consult', intent: 'intent', stt: 'stt', tts: 'tts', 'admin-logs': 'admin-logs', 'admin-reviews': 'admin-reviews', 'answer-feedback': 'answer-feedback', 'admin-feedback': 'admin-feedback' };
    if (!routes[action]) throw new Error('지원하지 않는 API 경로입니다.');
    const headers = new Headers(init.headers);
    headers.set('apikey', config.key);
    let body = init.body;
    if (action === 'ask' || action === 'survey-ask') {
      if (typeof body !== 'string') throw new Error('상담 요청 형식이 올바르지 않습니다.');
      body = JSON.stringify({ ...JSON.parse(body), domain: action === 'ask' ? 'farmland' : 'survey' });
      headers.set('Content-Type', 'application/json');
    }
    return request(`${config.url.replace(/\/$/, '')}/functions/v1/malhaenong-api/${routes[action]}`, { ...init, body, headers });
  };
}
