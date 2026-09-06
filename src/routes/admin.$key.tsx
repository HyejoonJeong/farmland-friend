import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getUsageLogs, type UsageLogRow } from "@/lib/logs.functions";
import { BarChart3, Download, Loader2, RefreshCw, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/admin/$key")({
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

function AdminPage() {
  const { key } = Route.useParams();
  const fetchLogs = useServerFn(getUsageLogs);
  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ["usage-logs", key],
    queryFn: () => fetchLogs({ data: { key } }),
    retry: false,
  });

  if (isPending) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto grid min-h-screen max-w-md place-items-center p-6 text-center">
        <div>
          <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
          <p className="mt-3 text-[22px] font-black">접근 권한이 없습니다</p>
          <p className="mt-2 text-[17px] text-muted-foreground">
            주소가 올바른지 확인해 주세요.
          </p>
        </div>
      </div>
    );
  }

  const { logs, stats } = data;

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
          value={
            stats.avgConfidence === null
              ? "-"
              : `${Math.round(stats.avgConfidence * 100)}%`
          }
        />
        <Stat label="확신도 낮음(70% 미만)" value={`${stats.lowConfidence}건`} />
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Ranking title="업무별 문의" rows={stats.byIntent} total={stats.total} />
        <Ranking title="지역별 문의" rows={stats.byRegion} total={stats.total} />
      </div>

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
                    {r.clarification && (
                      <p className="mt-1 text-[14px] text-muted-foreground">
                        추가: {r.clarification}
                      </p>
                    )}
                    {r.summary && (
                      <p className="mt-1 text-[14px] text-muted-foreground">
                        요약: {r.summary}
                      </p>
                    )}
                  </td>
                  <td className="p-3 font-semibold">{r.intent_label ?? "-"}</td>
                  <td className="p-3">
                    {r.confidence === null
                      ? "-"
                      : `${Math.round(Number(r.confidence) * 100)}%`}
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
      {rows.length === 0 && (
        <p className="mt-2 text-[15px] text-muted-foreground">데이터 없음</p>
      )}
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
