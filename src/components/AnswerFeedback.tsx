import { useEffect, useRef, useState } from 'react';
import { backendFetch } from '@/lib/backend-fetch';
import { FEEDBACK_CHANGED, readFeedback, updateFeedback, type PendingFeedback } from '@/lib/answer-feedback';
import { BusinessAnswer } from './BusinessAnswer';

const accuracyOptions = [
  ['accurate', '담당자 안내와 맞았어요'], ['partly', '일부만 맞았어요'],
  ['inaccurate', '맞지 않았어요'], ['unsure', '판단하기 어려워요'],
] as const;
type Accuracy = typeof accuracyOptions[number][0];

export function AnswerFeedback() {
  const [receipt, setReceipt] = useState<PendingFeedback | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const refresh = () => setReceipt(readFeedback());
    refresh();
    window.addEventListener(FEEDBACK_CHANGED, refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener(FEEDBACK_CHANGED, refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  useEffect(() => {
    if (receipt?.contactAttempted && !receipt.dismissed && !receipt.submitted) panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [receipt?.answerId, receipt?.contactAttempted, receipt?.dismissed, receipt?.submitted]);
  if (!receipt) return null;
  if (!receipt.contactAttempted) return <button type="button" className="my-3 min-h-12 rounded-xl border border-primary/40 px-3 py-3 text-base font-semibold" onClick={() => updateFeedback(receipt.answerId, { contactAttempted: true, dismissed: false })}>탭하여 만족도 평가</button>;
  if (receipt.submitted) return receipt.dismissed ? null : <section className="my-5 rounded-2xl border-2 border-primary bg-secondary p-5" aria-label="만족도 평가 완료">
    <p role="status" className="text-xl font-bold">평가를 남겨 주셔서 감사합니다.</p>
    <p className="mt-2 text-lg">더 나은 상담 안내에 반영하겠습니다.</p>
    <button type="button" className="mt-3 min-h-12 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground" onClick={() => updateFeedback(receipt.answerId, { dismissed: true })}>확인</button>
  </section>;
  if (receipt.dismissed) return <button type="button" className="my-4 min-h-12 rounded-xl border-2 border-primary px-4 py-3 text-lg font-bold" onClick={() => updateFeedback(receipt.answerId, { dismissed: false })}>상담 후 만족도 평가하기</button>;
  return <div ref={panel} className="scroll-mt-20"><FeedbackForm key={receipt.answerId} receipt={receipt} /></div>;
}

function FeedbackForm({ receipt }: { receipt: PendingFeedback }) {
  const [completed, setCompleted] = useState<boolean | null>(receipt.submission ? true : null);
  const [satisfaction, setSatisfaction] = useState<number | null>(receipt.submission?.satisfaction ?? null);
  const [accuracy, setAccuracy] = useState<Accuracy | ''>(receipt.submission?.accuracy ?? '');
  const [reuseConsent, setReuseConsent] = useState(receipt.submission?.reuseConsent ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const choice = 'flex min-h-12 items-center gap-3 rounded-xl border-2 border-border bg-background px-3 py-3 text-lg';
  async function submit() {
    if (busy || completed !== true || satisfaction === null || !accuracy) return;
    setBusy(true); setError('');
    const submission = receipt.submission ?? { contactCompleted: true as const, satisfaction, accuracy, reuseConsent };
    // A lost HTTP response may already have saved the rating. Keep the exact payload for an idempotent retry.
    updateFeedback(receipt.answerId, { submission });
    try {
      const response = await backendFetch('/api/answer-feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answerId: receipt.answerId, token: receipt.token, ...submission }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '평가를 저장하지 못했어요. 다시 시도해 주세요.');
      updateFeedback(receipt.answerId, { submitted: true, dismissed: false });
    } catch (e) { setError(e instanceof Error ? e.message : '평가를 저장하지 못했어요. 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }
  return <section className="my-5 rounded-2xl border-2 border-primary bg-secondary/60 p-4" aria-labelledby="answer-feedback-heading">
    <h2 id="answer-feedback-heading" className="text-2xl font-black">상담 후, 이용 경험을 알려주세요</h2>
    <p className="mt-2 text-lg">담당자와 통화를 마친 뒤 아래 AI 답변이 도움이 되었는지 평가해 주세요. 참여는 선택입니다.</p>
    <details className="mt-3 rounded-xl bg-background p-3"><summary className="cursor-pointer text-lg font-bold">평가할 질문과 AI 답변 보기</summary><p className="my-3 whitespace-pre-wrap font-bold">{receipt.question}</p><BusinessAnswer text={receipt.answer} /></details>
    <form className="mt-4 space-y-5" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <fieldset disabled={busy || !!receipt.submission}><legend className="mb-2 text-xl font-bold">담당자와 상담을 마쳤나요?</legend>
        <div className="space-y-2"><label className={choice}><input type="radio" name="contact-completed" checked={completed === true} onChange={() => setCompleted(true)} />네, 상담을 마쳤어요</label>
          <label className={choice}><input type="radio" name="contact-completed" checked={completed === false} onChange={() => setCompleted(false)} />아직 상담하지 못했어요</label></div>
      </fieldset>
      {completed === false && <p role="status" className="text-lg">상담을 마친 뒤 이 화면에서 평가해 주세요. 전화 버튼을 누른 것만으로 상담 완료로 기록하지 않습니다.</p>}
      {completed === true && <>
        <fieldset disabled={busy || !!receipt.submission}><legend className="mb-2 text-xl font-bold">말해농 이용에 얼마나 만족하셨나요?</legend>
          <div className="grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map(value => <label key={value} className={`flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-xl border-2 text-xl font-bold ${satisfaction === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background'}`}><input className="mb-1" type="radio" name="satisfaction" value={value} checked={satisfaction === value} onChange={() => setSatisfaction(value)} aria-label={`${value}점`} />{value}점</label>)}</div>
          <p className="mt-2 flex justify-between text-sm"><span>1점: 매우 불만족</span><span>5점: 매우 만족</span></p>
        </fieldset>
        <fieldset disabled={busy || !!receipt.submission}><legend className="mb-2 text-xl font-bold">AI 답변이 담당자 안내와 맞았나요?</legend><div className="space-y-2">{accuracyOptions.map(([value, label]) => <label key={value} className={choice}><input type="radio" name="answer-accuracy" checked={accuracy === value} onChange={() => setAccuracy(value)} />{label}</label>)}</div></fieldset>
        <label className="flex items-start gap-3 text-base leading-relaxed"><input className="mt-1 h-5 w-5 shrink-0" type="checkbox" checked={reuseConsent} disabled={busy || !!receipt.submission} onChange={e => setReuseConsent(e.target.checked)} /><span>(선택) 답변에 활용한 업무자료의 일반 안내 문구를 다른 이용자의 상담 참고에 활용하는 데 동의합니다. 내 질문·개별 상황·대화 이력·AI 답변 원문은 다른 이용자에게 전달하지 않습니다. 동의하지 않아도 평가할 수 있습니다.</span></label>
        <p className="text-sm text-muted-foreground">만족도 4~5점이고 담당자 안내와 맞았다고 평가한 답변 중, 활용에 동의한 일반 안내만 참고 후보가 됩니다. 만족도는 사실 검증을 대신하지 않으며 최신 업무자료를 우선합니다.</p>
        {error && <p role="alert" className="font-bold text-destructive">{error}</p>}
        {receipt.submission && !busy && <p className="text-sm">저장 여부를 확인하지 못했다면 같은 평가 내용으로 다시 시도해 주세요.</p>}
        <button type="submit" disabled={busy || satisfaction === null || !accuracy} className="min-h-14 w-full rounded-xl bg-primary px-4 py-3 text-xl font-bold text-primary-foreground disabled:opacity-50">{busy ? '저장 중…' : receipt.submission ? '같은 평가 다시 보내기' : '평가 보내기'}</button>
      </>}
      <button type="button" disabled={busy} onClick={() => updateFeedback(receipt.answerId, { dismissed: true })} className="min-h-12 w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-lg font-bold">나중에 평가하기</button>
    </form>
  </section>;
}
