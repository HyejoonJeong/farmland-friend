import { createServerFn } from "@tanstack/react-start";

export interface UsageLogRow {
  id: string;
  created_at: string;
  transcript: string;
  clarification: string | null;
  category: string | null;
  candidates: string[] | null;
  classification_status: string | null;
  clarify_trail: { question: string; answer: string }[] | null;
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

export interface VoiceRow {
  id: string;
  created_at: string;
  content: string;
  age_group: string | null;
  farming_years: string | null;
  gender: string | null;
  region: string | null;
  source: string | null;
}

// Legacy server function is retired; the current admin UI calls Supabase directly.
export const getUsageLogs = createServerFn({ method: "POST" })
  .inputValidator((input: { key: string }) => ({ key: String(input?.key ?? "") }))
  .handler(async (): Promise<{
    authorized: boolean; logs: UsageLogRow[]; voices: VoiceRow[]; stats: UsageStats | null;
  }> => ({ authorized: false, logs: [], voices: [], stats: null }));
