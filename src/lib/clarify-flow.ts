// Multi-step intent clarification: categories, intent display metadata and
// button-based clarification cases (max 2 questions per consultation).
import type { IntentKey } from "./data";

export const CATEGORIES = [
  "농지 팔기",
  "농지 빌려주기",
  "농지 구매하기",
  "농지 빌리기",
  "과원 관련",
  "농지 바꾸기·모으기",
  "농업경영 위기·부채",
  "고령농 은퇴·농지이양",
  "스마트팜",
  "기타 / 분류 불확실",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface IntentMeta {
  category: Category;
  displayName: string;
  description: string;
}

export const INTENT_META: Partial<Record<IntentKey, IntentMeta>> = {
  farmland_trade_sell: { category: "농지 팔기", displayName: "농지은행에 농지 팔기", description: "가지고 계신 농지를 농지은행(한국농어촌공사)에 직접 파는 사업입니다." },
  public_reserve_purchase: { category: "농지 팔기", displayName: "공공임대용으로 농지 팔기", description: "농지은행이 농지를 사들여 청년농 등에게 빌려주는 데 쓰는 사업입니다." },
  farmland_sale_trust: { category: "농지 팔기", displayName: "살 사람 찾아 주기 (매도수탁)", description: "농지은행이 대신 농지를 살 사람을 찾아 팔아 드리는 사업입니다." },
  long_term_lease_out: { category: "농지 빌려주기", displayName: "농지 오래 빌려주기", description: "농지를 5년 이상 장기간 농업인에게 빌려주고 임대료를 받는 사업입니다." },
  farmland_lease_trust_out: { category: "농지 빌려주기", displayName: "농지은행에 맡겨 빌려주기", description: "농지를 농지은행에 맡기면 알맞은 임차인을 찾아 대신 관리해 드리는 사업입니다." },
  farmland_trade_buy: { category: "농지 구매하기", displayName: "농지 사기", description: "농지은행을 통해 농사지을 농지를 구입할 수 있도록 지원하는 사업입니다." },
  lease_then_sale: { category: "농지 구매하기", displayName: "먼저 빌리고 나중에 농지 구매", description: "청년농이 농지를 먼저 빌려 농사를 짓고, 일정 기간 대금을 납부한 뒤 농지를 소유할 수 있도록 지원하는 사업입니다." },
  reserve_farmland_lease: { category: "농지 빌리기", displayName: "농지은행 농지 빌리기 (비축농지)", description: "농지은행이 사 둔 농지를 농업인에게 빌려주는 사업입니다." },
  long_term_lease_in: { category: "농지 빌리기", displayName: "농지 오래 빌리기", description: "농지를 5년 이상 장기간 빌려 안정적으로 농사지을 수 있게 지원합니다." },
  farmland_lease_trust_in: { category: "농지 빌리기", displayName: "맡겨진 농지 빌리기", description: "농지은행에 맡겨진 농지를 빌려 농사지을 수 있게 연결해 드립니다." },
  orchard_trade_sell: { category: "과원 관련", displayName: "과수원 팔기", description: "과수원을 농지은행에 팔아 과원 규모화에 활용하는 사업입니다." },
  orchard_trade_buy: { category: "과원 관련", displayName: "과수원 사기", description: "과수원을 구입할 수 있도록 지원하는 사업입니다." },
  orchard_lease_out: { category: "과원 관련", displayName: "과수원 빌려주기", description: "과수원을 농지은행을 통해 장기간 빌려주는 사업입니다." },
  orchard_lease_in: { category: "과원 관련", displayName: "과수원 빌리기", description: "과수원을 장기간 빌려 농사지을 수 있게 지원하는 사업입니다." },
  management_recovery: { category: "농업경영 위기·부채", displayName: "빚 걱정 덜기 (경영회생 지원)", description: "빚으로 어려운 농가의 농지를 농지은행이 사들여 빚을 갚게 하고, 그 농지를 다시 빌려 계속 농사짓게 해 드립니다." },
  reserve_smartfarm: { category: "스마트팜", displayName: "스마트팜 시설 빌리기", description: "청년농에게 농지은행 비축농지에 지은 스마트팜을 빌려주는 사업입니다." },
  land_exchange: { category: "농지 바꾸기·모으기", displayName: "농지 바꾸기·모으기 (교환분합)", description: "흩어진 농지를 서로 바꾸거나 합쳐 농사짓기 편하게 만드는 사업입니다." },
  retirement_direct_payment: { category: "고령농 은퇴·농지이양", displayName: "은퇴하며 농지 넘기기 (이양은퇴직불)", description: "고령 농업인이 농지를 넘기고 은퇴하면 매달 직불금을 받을 수 있는 사업입니다." },
  farmland_pension: { category: "고령농 은퇴·농지이양", displayName: "농지연금", description: "농지를 담보로 매달 연금을 받는 제도입니다." },
  general_consult: { category: "기타 / 분류 불확실", displayName: "농지은행 일반 상담", description: "정확한 안내를 위해 농지은행 담당자가 직접 상담해 드립니다." },
};

export type ClarifyTarget =
  | { intent: IntentKey }
  | { next: ClarifyCaseId }
  | { fallback: true };

export interface ClarifyOption { emoji: string; label: string; target: ClarifyTarget; }
export interface ClarifyCase { question: string; options: ClarifyOption[]; }

export type ClarifyCaseId =
  | "sell" | "lease_out" | "lease_out_term" | "find_land" | "lease_in"
  | "orchard" | "orchard_owner" | "cant_farm" | "debt" | "general";

export const CLARIFY_CASES: Record<ClarifyCaseId, ClarifyCase> = {
  sell: {
    question: "농지를 어떤 방식으로 처분하고 싶으신가요?",
    options: [
      { emoji: "🏦", label: "농지은행에 팔고 싶어요", target: { intent: "farmland_trade_sell" } },
      { emoji: "🤝", label: "팔 사람을 찾아줬으면 좋겠어요", target: { intent: "farmland_sale_trust" } },
      { emoji: "👴", label: "은퇴하면서 농지를 넘기고 싶어요", target: { intent: "retirement_direct_payment" } },
      { emoji: "💸", label: "빚 때문에 농지를 처분해야 해요", target: { intent: "management_recovery" } },
    ],
  },
  lease_out: {
    question: "어떤 도움이 필요하신가요?",
    options: [
      { emoji: "📅", label: "농지를 장기간 빌려주고 싶어요", target: { intent: "long_term_lease_out" } },
      { emoji: "🏦", label: "농지은행에 맡겨 임차인을 찾고 싶어요", target: { intent: "farmland_lease_trust_out" } },
      { emoji: "❓", label: "잘 모르겠어요", target: { next: "lease_out_term" } },
    ],
  },
  lease_out_term: {
    question: "얼마나 오래 빌려주실 생각이세요?",
    options: [
      { emoji: "📅", label: "5년 이상 오래 빌려줄래요", target: { intent: "long_term_lease_out" } },
      { emoji: "🏦", label: "기간은 상관없이 맡기고 싶어요", target: { intent: "farmland_lease_trust_out" } },
      { emoji: "❓", label: "아직 잘 모르겠어요", target: { fallback: true } },
    ],
  },
  find_land: {
    question: "어떤 방식으로 농지를 구하고 싶으신가요?",
    options: [
      { emoji: "🌱", label: "농지를 사고 싶어요", target: { intent: "farmland_trade_buy" } },
      { emoji: "🚜", label: "농지를 빌리고 싶어요", target: { next: "lease_in" } },
      { emoji: "🌾", label: "먼저 빌리고 나중에 사고 싶어요", target: { intent: "lease_then_sale" } },
    ],
  },
  lease_in: {
    question: "어떤 농지를 빌리고 싶으신가요?",
    options: [
      { emoji: "🏦", label: "농지은행이 가진 농지를 빌리고 싶어요", target: { intent: "reserve_farmland_lease" } },
      { emoji: "📅", label: "5년 이상 오래 빌리고 싶어요", target: { intent: "long_term_lease_in" } },
      { emoji: "🤝", label: "농지은행에 맡겨진 농지를 빌리고 싶어요", target: { intent: "farmland_lease_trust_in" } },
      { emoji: "❓", label: "잘 모르겠어요", target: { fallback: true } },
    ],
  },
  orchard: {
    question: "과수원을 어떻게 이용하고 싶으신가요?",
    options: [
      { emoji: "🍎", label: "사고 싶어요", target: { intent: "orchard_trade_buy" } },
      { emoji: "🍐", label: "빌리고 싶어요", target: { intent: "orchard_lease_in" } },
      { emoji: "🏡", label: "가진 과수원을 팔거나 빌려주고 싶어요", target: { next: "orchard_owner" } },
    ],
  },
  orchard_owner: {
    question: "가지고 계신 과수원을 어떻게 하고 싶으신가요?",
    options: [
      { emoji: "💰", label: "팔고 싶어요", target: { intent: "orchard_trade_sell" } },
      { emoji: "📅", label: "빌려주고 싶어요", target: { intent: "orchard_lease_out" } },
    ],
  },
  cant_farm: {
    question: "가지고 계신 농지를 어떻게 하고 싶으신가요?",
    options: [
      { emoji: "💰", label: "팔고 싶어요", target: { next: "sell" } },
      { emoji: "📅", label: "빌려주고 싶어요", target: { next: "lease_out" } },
      { emoji: "👴", label: "은퇴 관련 지원을 받고 싶어요", target: { intent: "retirement_direct_payment" } },
      { emoji: "❓", label: "아직 잘 모르겠어요", target: { fallback: true } },
    ],
  },
  debt: {
    question: "농지를 처분한 뒤에도 해당 농지에서 계속 농사를 짓고 싶으신가요?",
    options: [
      { emoji: "🌾", label: "네, 계속 농사짓고 싶어요", target: { intent: "management_recovery" } },
      { emoji: "💰", label: "아니요, 농지를 처분하고 싶어요", target: { next: "sell" } },
    ],
  },
  general: {
    question: "어떤 일로 도움이 필요하신가요?",
    options: [
      { emoji: "💰", label: "농지를 팔고 싶어요", target: { next: "sell" } },
      { emoji: "📅", label: "농지를 빌려주고 싶어요", target: { next: "lease_out" } },
      { emoji: "🌱", label: "농사지을 땅을 구하고 싶어요", target: { next: "find_land" } },
      { emoji: "❓", label: "잘 모르겠어요", target: { fallback: true } },
    ],
  },
};

export const CLARIFY_CASE_IDS = Object.keys(CLARIFY_CASES) as ClarifyCaseId[];

/** Case used when the model is unsure but gave no case id. */
export const CATEGORY_DEFAULT_CASE: Partial<Record<Category, ClarifyCaseId>> = {
  "농지 팔기": "sell",
  "농지 빌려주기": "lease_out",
  "농지 구매하기": "find_land",
  "농지 빌리기": "lease_in",
  "과원 관련": "orchard",
  "농업경영 위기·부채": "debt",
  "고령농 은퇴·농지이양": "cant_farm",
  "기타 / 분류 불확실": "general",
};

export const MAX_CLARIFY_ROUNDS = 2;
export const FALLBACK_MESSAGE = "정확한 안내를 위해 농지은행 담당자에게 연결해드릴게요.";
