import { AnswerReviews } from "@/components/AnswerReviews";
import { backendFetch, backendConfig } from "@/lib/backend-fetch";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getUsageLogs, type UsageLogRow, type VoiceRow } from "@/lib/logs.functions";
import { BarChart3, Download, Loader2, Lock, RefreshCw } from "lucide-react";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "운영 데이터 · 말해농 관리자" },
      {
        name: "description",
        content: "말해농 이용 기록과 AI 분류 정확도를 확인하는 관리자 화면입니다.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
  errorComponent: () => (
    <div className="mx-auto max-w-md p-8 text-center">
      <BackButton />
      <p className="text-[20px] font-bold">데이터를 불러올 수 없습니다.</p>
    </div>
  ),
});

function toCsv(rows: UsageLogRow[]) {
  const head = [
    "시각",
    "발화",
    "추가답변",
    "요약",
    "분류업무",
    "확신도",
    "지역",
    "지사",
    "담당부서",
    "전화",
    "입력방식",
  ];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = rows.map((r) =>
    [
      new Date(r.created_at).toLocaleString("ko-KR"),
      r.transcript,
      r.clarification,
      r.summary,
      r.intent_label,
      r.confidence,
      r.region,
      r.branch,
      r.department,
      r.phone,
      r.source,
    ]
      .map(esc)
      .join(","),
  );
  return "\uFEFF" + [head.join(","), ...body].join("\n");
}

function voicesToCsv(rows: VoiceRow[]) {
  const head = ["시각", "의견 내용", "연령", "영농경력", "성별", "지역", "입력방식"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = rows.map((r) =>
    [
      new Date(r.created_at).toLocaleString("ko-KR"),
      r.content,
      r.age_group,
      r.farming_years,
      r.gender,
      r.region,
      r.source,
    ]
      .map(esc)
      .join(","),
  );
  return "\uFEFF" + [head.join(","), ...body].join("\n");
}

function downloadCsv(csv: string, name: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function AdminPage() {
  const fetchLogs = useServerFn(getUsageLogs);
  const [password, setPassword] = useState("");
  const [denied, setDenied] = useState(false);

  const login = useMutation({
    mutationFn: async (key: string): Promise<Awaited<ReturnType<typeof getUsageLogs>>> => {
      if (backendConfig.provider !== 'supabase') return fetchLogs({ data: { key } });
      const response = await backendFetch('/api/admin-logs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }),
      });
      if (!response.ok) throw new Error('운영 데이터를 불러오지 못했습니다.');
      return response.json();
    },
    onSuccess: (res) => setDenied(!res.authorized),
  });

  const data = login.data?.authorized ? login.data : null;

  if (!data || !data.stats) {
    return (
      <div className="relative mx-auto grid min-h-screen max-w-md place-items-center p-6">
        <div className="absolute top-4 left-4">
          <BackButton />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setDenied(false);
            login.mutate(password);
          }}
          className="w-full text-center"
        >
          <Lock className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-3 text-[24px] font-black">관리자 페이지</h1>
          <p className="mt-2 text-[16px] text-muted-foreground">비밀번호를 입력해 주세요.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="mt-5 w-full rounded-2xl border-2 border-border bg-card px-4 py-4 text-center text-[20px] font-bold outline-none focus:border-primary"
            placeholder="비밀번호"
          />
          {(denied || login.isError) && (
            <p className="mt-3 text-[16px] font-semibold text-destructive">
              비밀번호가 올바르지 않습니다.
            </p>
          )}
          <button
            type="submit"
            disabled={login.isPending || password.length === 0}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-[20px] font-bold text-primary-foreground disabled:opacity-50"
          >
            {login.isPending && <Loader2 className="h-5 w-5 animate-spin" />}
            들어가기
          </button>
          <Link
            to="/"
            className="mt-5 inline-block text-[16px] font-semibold text-muted-foreground underline"
          >
            처음 화면으로
          </Link>
        </form>
      </div>
    );
  }

  const refetch = () => login.mutate(password);
  const isFetching = login.isPending;

  const { logs, voices, stats } = data;

  const download = () => {
    const blob = new Blob([toCsv(logs)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `malhaenong-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <BackButton />
        <div className="flex items-center gap-2 text-primary">
          <BarChart3 className="h-7 w-7" />
          <h1 className="text-[26px] font-black text-foreground">말해농 운영 데이터</h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-border bg-card px-4 py-2 text-[16px] font-bold"
          >
            <RefreshCw className={`h-5 w-5 ${isFetching ? "animate-spin" : ""}`} />
            새로고침
          </button>
          <button
            type="button"
            onClick={download}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-[16px] font-bold text-primary-foreground"
          >
            <Download className="h-5 w-5" />
            CSV 내려받기
          </button>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="누적 상담" value={`${stats.total}건`} />
        <Stat label="오늘" value={`${stats.today}건`} />
        <Stat
          label="평균 확신도"
          value={stats.avgConfidence === null ? "-" : `${Math.round(stats.avgConfidence * 100)}%`}
        />
        <Stat label="확신도 낮음(70% 미만)" value={`${stats.lowConfidence}건`} />
      </section>

      <AnswerReviews adminKey={password} />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Ranking title="업무별 문의" rows={stats.byIntent} total={stats.total} />
        <Ranking title="지역별 문의" rows={stats.byRegion} total={stats.total} />
      </div>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[20px] font-bold">농업인 Voice · 수집된 의견 ({voices.length}건)</h2>
          <button
            type="button"
            onClick={() => downloadCsv(voicesToCsv(voices), "malhaenong-voices")}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-border bg-card px-4 py-2 text-[15px] font-bold"
          >
            <Download className="h-5 w-5" />
            의견 CSV
          </button>
        </div>
        <div className="mt-3 overflow-x-auto rounded-2xl border-2 border-border">
          <table className="w-full min-w-[800px] text-left text-[15px]">
            <thead className="bg-secondary/60 text-[14px] font-bold">
              <tr>
                <th className="p-3">시각</th>
                <th className="p-3">의견 내용</th>
                <th className="p-3">연령</th>
                <th className="p-3">영농경력</th>
                <th className="p-3">성별</th>
                <th className="p-3">지역</th>
              </tr>
            </thead>
            <tbody>
              {voices.length === 0 && (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={6}>
                    아직 남겨진 의견이 없습니다.
                  </td>
                </tr>
              )}
              {voices.map((v) => (
                <tr key={v.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap p-3 text-muted-foreground">
                    {new Date(v.created_at).toLocaleString("ko-KR")}
                  </td>
                  <td className="p-3 font-semibold">{v.content}</td>
                  <td className="whitespace-nowrap p-3">{v.age_group ?? "-"}</td>
                  <td className="whitespace-nowrap p-3">{v.farming_years ?? "-"}</td>
                  <td className="whitespace-nowrap p-3">{v.gender ?? "-"}</td>
                  <td className="whitespace-nowrap p-3">{v.region ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[20px] font-bold">최근 기록 (최대 500건)</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border-2 border-border">
          <table className="w-full min-w-[900px] text-left text-[15px]">
            <thead className="bg-secondary/60 text-[14px] font-bold">
              <tr>
                <th className="p-3">시각</th>
                <th className="p-3">말씀한 내용</th>
                <th className="p-3">AI 분류</th>
                <th className="p-3">확신도</th>
                <th className="p-3">지역</th>
                <th className="p-3">연결된 담당</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={6}>
                    아직 쌓인 기록이 없습니다.
                  </td>
                </tr>
              )}
              {logs.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap p-3 text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("ko-KR")}
                  </td>
                  <td className="p-3">
                    <p className="font-semibold">{r.transcript}</p>
                    {(r.category || r.classification_status) && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        대분류: {r.category ?? "-"} · 상태: {r.classification_status ?? "-"}
                        {r.candidates?.length ? ` · 후보: ${r.candidates.join(", ")}` : ""}
                      </p>
                    )}
                    {r.clarify_trail?.map((t, i) => (
                      <p key={i} className="mt-1 text-sm text-muted-foreground">
                        추가 질문 {i + 1}: {t.question} → {t.answer}
                      </p>
                    ))}
                    {r.clarification && (
                      <p className="mt-1 text-[14px] text-muted-foreground">
                        추가: {r.clarification}
                      </p>
                    )}
                    {r.summary && (
                      <p className="mt-1 text-[14px] text-muted-foreground">요약: {r.summary}</p>
                    )}
                  </td>
                  <td className="p-3 font-semibold">{r.intent_label ?? "-"}</td>
                  <td className="p-3">
                    {r.confidence === null ? "-" : `${Math.round(Number(r.confidence) * 100)}%`}
                  </td>
                  <td className="whitespace-nowrap p-3">{r.region ?? "-"}</td>
                  <td className="p-3">
                    <p className="font-semibold">{r.branch ?? "-"}</p>
                    <p className="text-[14px] text-muted-foreground">
                      {r.department ?? "-"} {r.phone ? `· ${r.phone}` : ""}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4">
      <p className="text-[14px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-[26px] font-black">{value}</p>
    </div>
  );
}

function Ranking({
  title,
  rows,
  total,
}: {
  title: string;
  rows: { label: string; count: number }[];
  total: number;
}) {
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4">
      <h2 className="text-[18px] font-bold">{title}</h2>
      {rows.length === 0 && <p className="mt-2 text-[15px] text-muted-foreground">데이터 없음</p>}
      <ul className="mt-3 space-y-2">
        {rows.slice(0, 8).map((r) => (
          <li key={r.label}>
            <div className="flex justify-between text-[15px] font-semibold">
              <span>{r.label}</span>
              <span>{r.count}건</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-secondary">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${total ? (r.count / total) * 100 : 0}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
