export interface ClassificationRecord {
  classification_status?: string | null;
  intent?: string | null;
  confidence?: number | null;
}
export const CLASSIFICATION_PATHS = {
  AI_DIRECT: 'AI 바로 분류',
  CLARIFIED: '추가 질문으로 확정',
  GENERAL: '일반 상담 연결',
  UNKNOWN: '경로 기록 없음·확인 필요',
} as const;
export function classificationPath(row: ClassificationRecord): keyof typeof CLASSIFICATION_PATHS {
  if (row.classification_status === 'FALLBACK' || row.intent === 'general_consult') return 'GENERAL';
  if (row.classification_status === 'CLARIFIED') return 'CLARIFIED';
  if (row.classification_status === 'AI_DIRECT') return 'AI_DIRECT';
  // Old SUCCESS rows do not prove whether clarification happened. Do not infer it from a high score.
  return 'UNKNOWN';
}
export function classificationMetrics(rows: ClassificationRecord[]) {
  const paths = { AI_DIRECT: 0, CLARIFIED: 0, GENERAL: 0, UNKNOWN: 0 };
  for (const row of rows) paths[classificationPath(row)]++;
  return paths;
}
