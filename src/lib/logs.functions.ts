import { createServerFn } from "@tanstack/react-start";

export interface UsageLogRow {
  id: string;
  created_at: string;
  transcript: string;
  clarification: string | null;
  summary: string | null;
  intent: string | null;
  intent_label: string | null;
  confidence: number | null;
  region: string | null;
  branch: string | null;
  department: string | null;
  phone: string | null;
  source: string | null;
}

export interface UsageStats {
  total: number;
  today: number;
  lowConfidence: number;
  avgConfidence: number | null;
  byIntent: { label: string; count: number }[];
  byRegion: { label: string; count: number }[];
}

export const getUsageLogs = createServerFn({ method: "POST" })
  .inputValidator((input: { key: string }) => ({ key: String(input?.key ?? "") }))
  .handler(async ({ data }) => {
    const expected = process.env["ADMIN_ACCESS_KEY"];
    if (!expected || data.key !== expected) {
      return { authorized: false as const, logs: [] as UsageLogRow[], stats: null };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("usage_logs")
      .select(
        "id, created_at, transcript, clarification, summary, intent, intent_label, confidence, region, branch, department, phone, source",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const logs = (rows ?? []) as unknown as UsageLogRow[];
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const count = (pick: (r: UsageLogRow) => string | null) => {
      const map = new Map<string, number>();
      for (const r of logs) {
        const k = pick(r) || "미상";
        map.set(k, (map.get(k) ?? 0) + 1);
      }
      return [...map.entries()]
        .map(([label, c]) => ({ label, count: c }))
        .sort((a, b) => b.count - a.count);
    };

    const confidences = logs
      .map((r) => (typeof r.confidence === "number" ? r.confidence : Number(r.confidence)))
      .filter((n) => Number.isFinite(n)) as number[];

    const stats: UsageStats = {
      total: logs.length,
      today: logs.filter((r) => new Date(r.created_at) >= startOfToday).length,
      lowConfidence: confidences.filter((c) => c < 0.7).length,
      avgConfidence: confidences.length
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : null,
      byIntent: count((r) => r.intent_label),
      byRegion: count((r) => r.region),
    };

    return { authorized: true as const, logs, stats };
  });
