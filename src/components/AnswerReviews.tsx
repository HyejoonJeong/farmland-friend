import { useEffect, useState } from 'react';
import { backendFetch } from '@/lib/backend-fetch';

interface FeedbackRow {
  id: string; revision: number; domain: string; created_at: string; category: string;
  question: string; answer: string; status: string; knowledge_version: string;
  feedback_satisfaction: number | null; feedback_accuracy: string | null;
  feedback_contact_completed: boolean | null; feedback_reuse_consent: boolean | null;
  feedback_submitted_at: string | null; reuse_question: string | null; reuse_answer: string | null;
  reusable_eligible: boolean; reuse_valid_until: string | null;
}
const accuracyLabels: Record<string, string> = {
  accurate: '담당자 안내와 맞음', partly: '일부만 맞음', inaccurate: '맞지 않음', unsure: '판단 어려움',
};

export function AnswerReviews({ adminKey }: { adminKey: string }) {
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  async function call(body: object, signal?: AbortSignal) {
    const response = await backendFetch('/api/admin-feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, key: adminKey }), signal,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '만족도 평가를 불러오지 못했습니다.');
    return data;
  }
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setRows([]);
    call({ action: 'list', offset }, controller.signal).then(data => {
      setRows(data.rows); setHasMore(data.hasMore);
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [offset, refresh, adminKey]);

  async function exclude(row: FeedbackRow) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await call({ action: 'exclude', id: row.id, revision: row.revision });
      setNotice('이 답변을 이후 상담의 참고 대상에서 제외했습니다.');
      setRefresh(n => n + 1);
    } catch (e) { setError(e instanceof Error ? e.message : '사용 중지를 저장하지 못했습니다.'); }
    finally { setBusy(false); }
  }

  return <section className="mt-8 rounded-2xl border-2 border-border bg-card p-4" aria-labelledby="answer-feedback-admin-heading">
    <h2 id="answer-feedback-admin-heading" className="text-xl font-bold">상담 만족도·답변 활용</h2>
    <p className="mt-2 text-base">관리자의 개별 승인 없이 이용자 평가를 반영합니다. 담당자 상담 완료, 만족도 4~5점, ‘담당자 안내와 맞음’, 활용 동의 조건을 모두 만족한 답변 중 개인정보가 없는 업무자료 기반 안내만 참고합니다.</p>
    <p className="mt-2 text-sm text-muted-foreground">정확도와 상담 완료는 이용자의 자기 평가입니다. 통화 성공이나 사실 검증을 보장하지 않습니다. 최신 업무자료를 우선하며, 유효기한이 지나거나 업무자료 버전이 달라지면 활용하지 않습니다. 필요하면 관리자가 개별 답변을 사용 중지할 수 있습니다.</p>
    <button type="button" className="mt-4 min-h-11 rounded-lg border px-3 py-2 font-semibold" disabled={busy || loading} onClick={() => setRefresh(n => n + 1)}>평가 목록 새로고침</button>
    {error && <p role="alert" className="mt-3 text-destructive">{error}</p>}
    {notice && <p role="status" className="mt-3 font-semibold">{notice}</p>}
    {loading ? <p className="mt-4">불러오는 중…</p> : <>
      {!rows.length && <p className="mt-4 text-muted-foreground">아직 제출된 평가가 없습니다. 새 상담을 마친 이용자의 평가부터 쌓입니다.</p>}
      <ul className="mt-4 space-y-3">{rows.map(row => <li key={row.id} className="rounded-xl border p-4">
        <p className="text-sm text-muted-foreground">{row.domain === 'survey' ? '전수조사' : '농지은행'} · {row.category} · {new Date(row.feedback_submitted_at ?? row.created_at).toLocaleString('ko-KR')}</p>
        <p className="mt-2 font-bold">만족도 {row.feedback_satisfaction ?? '미평가'}{row.feedback_satisfaction !== null ? '/5점' : ''} · {accuracyLabels[row.feedback_accuracy ?? ''] ?? '정확도 미평가'}</p>
        <p className="mt-1 text-sm">담당자 상담 {row.feedback_contact_completed ? '완료(본인 확인)' : '미확인'} · 참고 활용 {row.feedback_reuse_consent ? '동의' : '미동의'}</p>
        <p className={`mt-2 font-semibold ${row.reusable_eligible ? 'text-primary' : 'text-muted-foreground'}`}>{row.status === 'retired' || row.status === 'rejected' ? '관리자 사용 중지' : row.reusable_eligible ? '다음 상담 참고 후보' : '참고 대상 아님'}{row.reusable_eligible && row.reuse_valid_until ? ` · ${new Date(row.reuse_valid_until).toLocaleDateString('ko-KR')}까지` : ''}</p>
        <details className="mt-3"><summary className="cursor-pointer font-semibold">질문·답변과 참고 안내 보기</summary>
          <p className="mt-2 whitespace-pre-wrap font-semibold">질문: {row.question}</p>
          <p className="mt-2 whitespace-pre-wrap">답변: {row.answer}</p>
          <div className="mt-3 rounded-lg bg-secondary p-3"><p className="font-bold">다른 상담에 참고할 업무자료 안내</p><p className="mt-1 whitespace-pre-wrap">{row.reuse_question || '참고 주제 없음'}</p><p className="mt-2 whitespace-pre-wrap">{row.reuse_answer || '공유할 업무자료 안내가 없어 활용하지 않습니다.'}</p></div>
        </details>
        {row.status !== 'retired' && row.status !== 'rejected' && <button type="button" disabled={busy} className="mt-3 min-h-11 rounded-lg border border-destructive px-3 py-2 font-bold text-destructive" onClick={() => void exclude(row)}>참고 대상에서 제외</button>}
      </li>)}</ul>
      <div className="mt-4 flex items-center gap-3"><button type="button" className="min-h-11 rounded border px-3" disabled={offset === 0 || busy} onClick={() => setOffset(n => Math.max(0, n - 20))}>이전 목록</button><span>{offset / 20 + 1}페이지</span><button type="button" className="min-h-11 rounded border px-3" disabled={!hasMore || busy} onClick={() => setOffset(n => n + 20)}>다음 목록</button></div>
    </>}
  </section>;
}
