import { useEffect, useState } from 'react';
import { backendFetch } from '@/lib/backend-fetch';
import { INTENTS, type IntentKey } from '@/lib/data';
import { INTENT_META } from '@/lib/clarify-flow';

interface Review {
  id: string; revision: number; domain: string; created_at: string;
  intent: IntentKey; category: string; original_question: string; original_answer: string;
  question: string; answer: string; status: string; source_reference: string; reviewer: string;
  valid_until: string | null; reviewed_at: string | null; knowledge_version: string;
  conversation_context?: {role: string; content: string}[];
}
const statuses: Record<string, string> = { pending: '검토 대기', approved: '승인됨', rejected: '반려', retired: '사용 중지' };

export function AnswerReviews({ adminKey }: { adminKey: string }) {
  const [status, setStatus] = useState('pending');
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<Review[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [version, setVersion] = useState('');
  const [selected, setSelected] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [checked, setChecked] = useState(false);
  const [refresh, setRefresh] = useState(0);
  async function call(body: object, signal?: AbortSignal) {
    const response = await backendFetch('/api/admin-reviews', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, key: adminKey }), signal,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '답변 검토 요청을 처리하지 못했습니다.');
    return data;
  }
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setRows([]); setSelected(null);
    call({ action: 'list', status, offset }, controller.signal).then(data => {
      setRows(data.rows); setHasMore(data.hasMore); setVersion(data.knowledgeVersion);
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [status, offset, refresh, adminKey]);

  const choose = (row: Review) => {
    setSelected({ ...row, valid_until: row.valid_until ?? new Date(Date.now() + 90 * 86400000).toISOString() });
    setChecked(false); setError(''); setNotice('');
  };
  const update = (patch: Partial<Review>) => { setSelected(row => row ? { ...row, ...patch } : null); setChecked(false); };
  async function save(nextStatus: string) {
    if (!selected || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await call({ ...selected, action: 'update', status: nextStatus, privacy_checked: checked });
      setNotice(nextStatus === 'approved' ? '승인했습니다. 유효한 관련 답변을 다음 상담에서 참고합니다.' : nextStatus === 'pending' ? '검토 대기로 저장했습니다. 재승인 전까지 상담에 활용되지 않습니다.' : '사용 대상에서 제외했습니다.');
      setSelected(null); setRefresh(n => n + 1);
    } catch (e) { setError(e instanceof Error ? e.message : '저장하지 못했습니다.'); }
    finally { setBusy(false); }
  }
  const field = 'mt-1 w-full rounded-lg border border-border bg-background p-2 text-base';
  return <section className="mt-8 rounded-2xl border-2 border-border bg-card p-4" aria-labelledby="answer-reviews-heading">
    <h2 id="answer-reviews-heading" className="text-xl font-bold">AI 답변 검토·승인</h2>
    <p className="mt-2 text-sm text-muted-foreground">새 상담 답변은 검토 대기로 쌓입니다. 개인정보를 제거하고 근거를 확인해 승인하면 관련 질문에 참고합니다. 승인 취소·만료·기준자료 변경 시에는 활용하지 않습니다.</p>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <label>검토 상태 <select aria-label="검토 상태" className="rounded border p-2" value={status} disabled={busy} onChange={e => { setStatus(e.target.value); setOffset(0); setNotice(''); }}>
        {Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <button type="button" className="rounded border px-3 py-2" disabled={busy || loading} onClick={() => setRefresh(n => n + 1)}>검토 목록 새로고침</button>
    </div>
    {error && <p role="alert" className="mt-3 text-destructive">{error}</p>}
    {notice && <p role="status" className="mt-3 font-semibold">{notice}</p>}
    {loading ? <p className="mt-4">불러오는 중…</p> : <>
      {!rows.length && <p className="mt-4 text-muted-foreground">이 상태의 답변이 없습니다. 새 상담부터 답변이 저장됩니다.</p>}
      <ul className="mt-4 space-y-2">{rows.map(row => <li key={row.id} className="rounded-xl border p-3">
        <p className="text-sm text-muted-foreground">{row.domain === 'survey' ? '전수조사' : '농지은행'} · {row.category} · {new Date(row.created_at).toLocaleString('ko-KR')}</p>
        <p className="mt-1 whitespace-pre-wrap font-semibold">{row.question}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm">{row.answer.slice(0, 140)}{row.answer.length > 140 ? '…' : ''}</p>
        {row.status === 'approved' && <p className="mt-1 text-sm">{row.knowledge_version !== version ? '기준자료 변경 — 재검토 필요' : Date.parse(row.valid_until ?? '') <= Date.now() ? '유효기간 만료 — 재검토 필요' : `활용 가능 · ${new Date(row.valid_until!).toLocaleDateString('ko-KR')}까지`} · 검토자 {row.reviewer}</p>}
        <button type="button" disabled={busy} className="mt-2 rounded-lg border px-3 py-2 font-bold" onClick={() => choose(row)}>답변 검토</button>
      </li>)}</ul>
      <div className="mt-3 flex items-center gap-3"><button type="button" disabled={offset === 0 || busy} onClick={() => setOffset(n => Math.max(0, n - 20))}>이전 목록</button><span>{offset / 20 + 1}페이지</span><button type="button" disabled={!hasMore || busy} onClick={() => setOffset(n => n + 20)}>다음 목록</button></div>
    </>}
    {selected && <form className="mt-5 space-y-4 rounded-xl border-2 border-primary p-4" onSubmit={e => { e.preventDefault(); void save('approved'); }}>
      <h3 className="text-lg font-bold">답변 수정 및 승인</h3>
      <details><summary className="cursor-pointer">이전 대화·최초 질문·AI 답변 보기</summary>
        {selected.conversation_context?.map((turn, i) => <p key={i} className="mt-2 whitespace-pre-wrap text-sm">{turn.role === 'user' ? '이전 질문' : '이전 답변'}: {turn.content}</p>)}
        <p className="mt-2 whitespace-pre-wrap">현재 질문: {selected.original_question}</p><p className="mt-2 whitespace-pre-wrap">최초 답변: {selected.original_answer}</p></details>
      <label className="block">담당 업무<select className={field} value={selected.intent} disabled={busy} onChange={e => update({ intent: e.target.value as IntentKey })}>{INTENTS.map(i => <option key={i.key} value={i.key}>{INTENT_META[i.key].category} · {i.label}</option>)}</select></label>
      <label className="block">다음 상담에 참고할 질문<textarea required className={field} rows={2} maxLength={2000} value={selected.question} disabled={busy} onChange={e => update({ question: e.target.value })}/></label>
      <label className="block">검토한 답변 (승인 시 1,200자 이내)<textarea required className={field} rows={7} maxLength={6000} value={selected.answer} disabled={busy} onChange={e => update({ answer: e.target.value })}/><span className="text-sm">{selected.answer.length}자</span></label>
      <label className="block">확인한 근거 자료·버전<input required className={field} maxLength={500} placeholder="예: 농지은행 업무안내 2026년판, 해당 항목" value={selected.source_reference} disabled={busy} onChange={e => update({ source_reference: e.target.value })}/></label>
      <div className="grid gap-3 md:grid-cols-2"><label>검토자<input required className={field} maxLength={100} value={selected.reviewer} disabled={busy} onChange={e => update({ reviewer: e.target.value })}/></label>
        <label>유효기한<input required type="date" className={field} value={selected.valid_until?.slice(0, 10) ?? ''} disabled={busy} onChange={e => update({ valid_until: e.target.value ? `${e.target.value}T23:59:59+09:00` : null })}/></label></div>
      <label className="flex items-start gap-2"><input type="checkbox" checked={checked} disabled={busy} onChange={e => setChecked(e.target.checked)}/><span>개인정보·개별 심사 결과를 제거했고, 다른 상담에도 안내할 수 있도록 내용과 근거를 확인했습니다.</span></label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 font-bold text-primary-foreground disabled:opacity-50" disabled={busy || !checked || selected.answer.length > 1200}>승인하고 활용</button>
        <button type="button" className="rounded-lg border px-3 py-2" disabled={busy} onClick={() => void save('pending')}>검토 대기로 저장</button>
        <button type="button" className="rounded-lg border px-3 py-2" disabled={busy} onClick={() => void save(selected.status === 'approved' ? 'retired' : 'rejected')}>{selected.status === 'approved' ? '승인 취소·사용 중지' : '반려'}</button>
        <button type="button" className="rounded-lg border px-3 py-2" disabled={busy} onClick={() => setSelected(null)}>닫기</button>
      </div>
    </form>}
  </section>;
}
