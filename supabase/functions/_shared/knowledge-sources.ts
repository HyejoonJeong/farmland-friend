import { FBO_KNOWLEDGE } from './knowledge/fbo-knowledge.ts';
import SURVEY_MANUAL from './knowledge/survey-manual.ts';
import { INTENTS, type IntentKey } from './knowledge/data.ts';

export type ConsultationDomain = 'farmland' | 'survey';
export interface KnowledgeSource { id: string; text: string; allowedIntents: readonly IntentKey[] }
export interface SourceCatalogue { sources: KnowledgeSource[]; annotated: string }


// Exact source-section mapping: new/renamed farmland sections are not reusable
// until their intended business scope is declared here. Never use name similarity.
const farmlandBankIntents = INTENTS.filter(item => item.org === 'farmland_bank').map(item => item.key);
const sectionIntents: Record<string, readonly IntentKey[]> = {
  '[농지은행이란]': farmlandBankIntents,
  '[1. 농지 팔기]': ['public_reserve_purchase', 'management_recovery', 'retirement_direct_payment'],
  '[2. 농지 빌려주기 (임대수탁)]': ['farmland_lease_trust_out'],
  '[3. 농지 구매]': ['farmland_trade_buy', 'lease_then_sale', 'orchard_trade_buy', 'orchard_lease_in'],
  '[4. 농지 빌리기 (임차)]': ['reserve_farmland_lease', 'long_term_lease_in', 'farmland_lease_trust_in', 'orchard_lease_in', 'reserve_smartfarm'],
  '[5. 농지 바꾸기 (교환·분합)]': ['land_exchange'],
  '[6. 농지연금]': ['farmland_pension'],
  '[7. 생애주기별 지원]': farmlandBankIntents,
  '[8. 2026년도 농지전수조사]': ['farmland_survey'],
  '[공통 안내]': farmlandBankIntents,
};
function allowedIntents(domain: ConsultationDomain, text: string): readonly IntentKey[] {
  // Survey manual snippets remain survey guidance; brief mentions of bank
  // products must not become definitive instructions for those separate products.
  return domain === 'survey' ? ['farmland_survey', 'general_consult'] : sectionIntents[text.split('\n')[0].trim()] ?? [];
}

// Content-derived identifiers are only selectors, not credentials. Unchanged blocks
// retain their identifier even if another section is inserted before them.
function sourceId(domain: string, text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return `${domain}_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function buildSourceCatalogue(source: string, domain: ConsultationDomain): SourceCatalogue {
  const groups: string[] = [];
  let current = '';
  const flush = () => { if (current) groups.push(current); current = ''; };
  // Keep the entire question/section with its conditions and exception lines.
  // Oversized sections remain visible knowledge but cannot become reusable snippets.
  for (const line of source.split(/(?<=\n)/)) {
    const text = line.trim();
    const heading = /^(?:#{1,6}\s|(?:\*\*)?\d+\.\s|\[[^\]]+\]$)/.test(text);
    if (heading) flush();
    current += line;
    if (!text) flush();
  }
  flush();
  const sources: KnowledgeSource[] = [];
  const byId = new Map<string, string>();
  const annotated = groups.map(group => {
    const text = group.trim();
    if (text.length < 20 || text.length > 1200) return group;
    const stem = sourceId(domain, text);
    let id = stem;
    for (let n = 2; byId.has(id) && byId.get(id) !== text; n++) id = `${stem}_${n}`;
    if (!byId.has(id)) { byId.set(id, text); sources.push({ id, text, allowedIntents: allowedIntents(domain, text) }); }
    return `[자료 ID: ${id}; 적용 intent: ${allowedIntents(domain, text).join(",")}]\n${group}`;
  }).join('');
  return { sources, annotated };
}

const catalogues: Record<ConsultationDomain, SourceCatalogue> = {
  farmland: buildSourceCatalogue(FBO_KNOWLEDGE, 'farmland'),
  survey: buildSourceCatalogue(SURVEY_MANUAL, 'survey'),
};
export function knowledgeSources(domain: ConsultationDomain): SourceCatalogue { return catalogues[domain]; }
export function selectedSource(domain: ConsultationDomain, id: unknown, intent: IntentKey): string {
  if (typeof id !== 'string' || !id) return '';
  return knowledgeSources(domain).sources.find(item => item.id === id && item.allowedIntents.includes(intent))?.text ?? '';
}
