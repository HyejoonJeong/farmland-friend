import { ApiError, requireEnv, textField, type Env } from './openai.ts';

export async function sameSecret(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([a, b].map(value => crypto.subtle.digest('SHA-256', encoder.encode(value))));
  const aa = new Uint8Array(left), bb = new Uint8Array(right);
  let different = 0;
  for (let i = 0; i < aa.length; i++) different |= aa[i] ^ bb[i];
  return different === 0;
}

export async function adminLogs(request: Request, env: Env): Promise<Response> {
  const body = await request.json();
  const key = textField(body.key, '관리자 인증', 500);
  if (!await sameSecret(key, requireEnv(env, 'ADMIN_ACCESS_KEY'))) {
    return Response.json({ authorized: false, logs: [], voices: [], stats: null });
  }
  const root = requireEnv(env, 'SUPABASE_URL');
  const serviceKey = requireEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const query = async (table: string, select: string) => {
    const params = new URLSearchParams({ select, order: 'created_at.desc', limit: '500' });
    const response = await fetch(`${root}/rest/v1/${table}?${params}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]),
    });
    if (!response.ok) { await response.body?.cancel(); throw new ApiError(502, '운영 데이터를 불러오지 못했습니다.'); }
    return response.json() as Promise<Record<string, unknown>[]>;
  };
  const [logs, voices] = await Promise.all([
    query('usage_logs', 'id,created_at,transcript,clarification,summary,intent,intent_label,confidence,region,branch,department,phone,source,category,candidates,classification_status,clarify_trail'),
    query('farmer_voices', 'id,created_at,content,age_group,farming_years,gender,region,source'),
  ]);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' });
  const todayKey = today.format(new Date());
  const count = (field: string) => {
    const map = new Map<string, number>();
    for (const row of logs) { const label = String(row[field] || '미상'); map.set(label, (map.get(label) ?? 0) + 1); }
    return [...map].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  };
  const confidence = logs.filter(row => row.confidence != null).map(row => Number(row.confidence)).filter(Number.isFinite);
  return Response.json({ authorized: true, logs, voices, stats: {
    total: logs.length,
    today: logs.filter(row => today.format(new Date(String(row.created_at))) === todayKey).length,
    lowConfidence: confidence.filter(value => value < 0.7).length,
    avgConfidence: confidence.length ? confidence.reduce((a, b) => a + b, 0) / confidence.length : null,
    byIntent: count('intent_label'), byRegion: count('region'),
  } });
}
