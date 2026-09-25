// Back-data extracted from 농지은행 러버블 백데이터.xlsx

export type IntentKey =
  | "farmland_rent_out"
  | "farmland_pension"
  | "retirement_subsidy"
  | "farmland_acquire"
  | "farmland_sell"
  | "farm_recovery"
  | "farming_tech"
  | "gap_certification"
  | "farmland_survey";

export interface IntentInfo {
  key: IntentKey;
  label: string;
  business: string;
  org: "farmland_bank" | "extension" | "naqs" | "municipal";
  examples: string[];
}

export const INTENTS: IntentInfo[] = [
  {
    key: "farmland_rent_out",
    label: "농지 내놓기 (임대·위탁)",
    business: "임대수탁",
    org: "farmland_bank",
    examples: [
      "농사를 못 짓게 돼서 땅을 맡기려고 합니다",
      "논을 빌려주고 싶어요",
      "농지를 대신 관리해주나요?",
      "땅 좀 맡기려고요",
      "휴경지인데 임대 가능한가요?",
    ],
  },
  {
    key: "farmland_pension",
    label: "농지연금 상담",
    business: "농지연금",
    org: "farmland_bank",
    examples: [
      "농지연금 상담받고 싶습니다",
      "농지로 연금 받을 수 있나요?",
      "매달 돈 나오는 사업 맞나요?",
      "노후연금 상담 좀요",
    ],
  },
  {
    key: "retirement_subsidy",
    label: "은퇴·경영이양 직불",
    business: "경영이양직불·농지이양은퇴직불",
    org: "farmland_bank",
    examples: [
      "은퇴직불 신청하려고 합니다",
      "농사 그만두려고 하는데 지원 있나요?",
      "농사 접으려고요",
      "농지를 넘기고 은퇴하려고 합니다",
    ],
  },
  {
    key: "farmland_acquire",
    label: "농지 구하기 (매입·임대)",
    business: "농지매매·맞춤형매매임대, 공공임대용 농지임대, 선임대후매도, 청년농 지원",
    org: "farmland_bank",
    examples: [
      "농지를 구하고 있습니다",
      "논을 사고 싶습니다",
      "청년농인데 농지 지원받을 수 있나요?",
      "빌릴 논 있나요?",
    ],
  },
  {
    key: "farmland_sell",
    label: "농지 팔기 (공사 매입)",
    business: "공공임대용 농지매입(매입비축)",
    org: "farmland_bank",
    examples: [
      "농지를 공사에 팔려고 합니다",
      "공사에서 농지를 사주나요?",
      "땅을 팔고 싶습니다",
      "매입 대상인지 알고 싶습니다",
    ],
  },
  {
    key: "farm_recovery",
    label: "경영회생 지원",
    business: "경영회생",
    org: "farmland_bank",
    examples: [
      "경영회생 신청하려고 합니다",
      "빚이 많아서 농지를 맡기려고 합니다",
      "농지를 팔고 다시 빌려 쓸 수 있나요?",
      "농사 빚 때문에 상담받고 싶습니다",
      "부채 때문에 농지를 활용하고 싶습니다",
    ],
  },
  {
    key: "farming_tech",
    label: "영농기술·교육·청년농",
    business: "영농기술 지도, 귀농귀촌, 청년농, 스마트팜, 병해충 상담",
    org: "extension",
    examples: [
      "농사 기술을 배우고 싶어요",
      "귀농 상담받고 싶습니다",
      "병해충 문의드립니다",
      "스마트팜 교육 있나요?",
    ],
  },
  {
    key: "gap_certification",
    label: "농업경영체·GAP·친환경 인증",
    business: "GAP·친환경인증, 원산지관리, 농업경영체 등록·변경, 직불제 확인",
    org: "naqs",
    examples: [
      "농업경영체 등록하려고요",
      "직불금 신청 확인하고 싶어요",
      "친환경 인증 받고 싶습니다",
      "GAP 인증 문의입니다",
    ],
  },
  {
    key: "farmland_survey",
    label: "농지전수조사 문의",
    business: "농지이용실태조사",
    org: "municipal",
    examples: [
      "농지전수조사가 뭔가요?",
      "전수조사는 언제 어떻게 하나요?",
      "우리 집 농지도 조사 대상인가요?",
      "조사받으면 처분되나요?",
      "농지이용실태조사 문의합니다",
    ],
  },
];

// Documents required per intent (curated common docs)
export const REQUIRED_DOCS: Record<IntentKey, string[]> = {
  farmland_rent_out: ["신분증", "농지 등기부등본", "토지대장", "임대위탁 신청서"],
  farmland_pension: ["신분증", "농지 등기부등본", "주민등록등본", "가족관계증명서", "농업경영체 등록확인서"],
  retirement_subsidy: ["신분증", "농업경영체 등록확인서", "농지 등기부등본", "경영이양 신청서"],
  farmland_acquire: ["신분증", "농업경영체 등록확인서 (해당 시)", "농지구입 계획서"],
  farmland_sell: ["신분증", "농지 등기부등본", "토지대장", "매도 신청서"],
  farm_recovery: ["신분증", "농지 등기부등본", "토지대장", "부채 증빙서류", "농업경영체 등록확인서", "경영회생 신청서"],
  farming_tech: ["신분증"],
  gap_certification: ["신분증", "농업경영체 등록증", "농지 관련 서류", "인증 신청서"],
  farmland_survey: ["신분증", "농지 등기부등본 (해당 시)", "토지대장 (해당 시)"],
};

// Region list (전북 지역 우선)
export const REGIONS = [
  "전주시",
  "군산시",
  "익산시",
  "정읍시",
  "김제시",
  "남원시",
  "완주군",
  "진안군",
  "무주군",
  "장수군",
  "임실군",
  "순창군",
  "고창군",
  "부안군",
  "기타 지역",
];

// Farmland Bank (KRC) 지사 담당
interface FarmlandContact {
  branch: string;
  phone: string;
  duty: string;
}

export const FARMLAND_BANK: FarmlandContact[] = [
  { branch: "남원", phone: "063-620-2031", duty: "지사 농지사업" },
  { branch: "남원", phone: "063-620-2032", duty: "맞춤형 농지지원 사업" },
  { branch: "남원", phone: "063-620-2022", duty: "임대수탁" },
  { branch: "남원", phone: "063-620-2014", duty: "경영이양직불, 과원규모화" },
  { branch: "남원", phone: "063-620-2030", duty: "경영회생지원사업, 농지연금" },
  { branch: "순창", phone: "063-650-7031", duty: "농지&과원 규모화, 사용허가" },
  { branch: "순창", phone: "063-650-7023", duty: "공공임대용 농지매입사업 (햇빛소득마을)" },
  { branch: "순창", phone: "063-650-7010", duty: "지사 농지사업(책임)" },
  { branch: "순창", phone: "063-650-7032", duty: "지사 농지사업(실무)" },
  { branch: "순창", phone: "063-650-7034", duty: "농지사업(연금, 직불, 채권)" },
  { branch: "김제", phone: "063-540-1184", duty: "공공임대매입, 스마트팜사업" },
  { branch: "김제", phone: "063-540-1145", duty: "맞춤형매매임대, 선임대후매도" },
  { branch: "김제", phone: "063-540-1186", duty: "경영회생사업, 과원규모화사업" },
  { branch: "김제", phone: "063-540-1141", duty: "임대수탁사업, 농지보전전용부담금" },
  { branch: "김제", phone: "063-540-1149", duty: "농지연금, 농지이양은퇴, 경영이양직불사업" },
  { branch: "김제", phone: "063-540-1142", duty: "공공임대매입(임대), 훼손농지복구사업" },
  { branch: "김제", phone: "063-540-1183", duty: "임대수탁사업, 채권 및 사후관리" },
  { branch: "김제", phone: "063-540-1143", duty: "규모화 채권 및 사후관리" },
  { branch: "무주진안장수", phone: "063-350-3052", duty: "농지파트장, 매입비축" },
  { branch: "무주진안장수", phone: "063-350-7034", duty: "경영회생, 은퇴직불" },
  { branch: "무주진안장수", phone: "063-350-7026", duty: "농지은행(매매, 임대, 결산)" },
  { branch: "무주진안장수", phone: "063-350-7031", duty: "지사 농지사업(임대수탁)" },
  { branch: "무주진안장수", phone: "063-350-7030", duty: "농지은행(과원, 연금)" },
  { branch: "부안", phone: "063-580-1015", duty: "공공임대용 농지매입" },
  { branch: "부안", phone: "063-580-1011", duty: "농지매매, 임차임대" },
  { branch: "부안", phone: "063-580-1017", duty: "공공임대용 농지매입" },
  { branch: "부안", phone: "063-580-1016", duty: "경영회생, 과원규모화" },
  { branch: "부안", phone: "063-580-1043", duty: "농지연금, 채권, 사후관리" },
  { branch: "부안", phone: "063-580-1013", duty: "은퇴직불제, 농지보전부담금" },
  { branch: "부안", phone: "063-580-1014", duty: "농지임대수탁" },
  { branch: "군산", phone: "063-440-5613", duty: "매입비축(매입)" },
  { branch: "군산", phone: "063-440-5614", duty: "매입비축(임대, 매각)" },
  { branch: "군산", phone: "063-440-5617", duty: "경영회생, 은퇴이양직불" },
  { branch: "군산", phone: "063-440-5618", duty: "농지매매, 과원규모화, 선임대후매도사업" },
  { branch: "군산", phone: "063-440-5612", duty: "임대수탁" },
  { branch: "군산", phone: "063-440-5616", duty: "농지연금, 농지임대, 부담금" },
  { branch: "군산", phone: "063-440-5615", duty: "채권, 사후관리" },
  { branch: "익산", phone: "063-860-0032", duty: "공공임대용 비축(매입)" },
  { branch: "익산", phone: "063-860-0045", duty: "공공임대용 비축(임대)" },
  { branch: "익산", phone: "063-860-0033", duty: "농지연금, 은퇴, 농지전용부담" },
  { branch: "익산", phone: "063-860-0036", duty: "임대수탁" },
  { branch: "익산", phone: "063-860-0035", duty: "경영회생, 과원, 선임대후매도" },
  { branch: "익산", phone: "063-860-0042", duty: "채권 사후관리" },
  { branch: "익산", phone: "063-860-0087", duty: "농지임대수탁사업" },
  { branch: "익산", phone: "063-860-0087", duty: "지사 농지사업" },
  { branch: "전완임", phone: "063-270-0520", duty: "공공임대용농지매입사업, 선임대후매도" },
  { branch: "전완임", phone: "063-270-0525", duty: "농지연금, 맞춤형매매임대" },
  { branch: "전완임", phone: "063-270-0521", duty: "경영회생, 과원규모화, 농지이양" },
  { branch: "전완임", phone: "063-270-0522", duty: "농지임대수탁" },
  { branch: "전완임", phone: "063-270-0526", duty: "농지보전부담금관리, 규모화채권관리" },
  { branch: "고창", phone: "063-560-0000", duty: "지사 농지사업" },
  { branch: "고창", phone: "063-560-1004", duty: "공공임대용 농지매입, 농지연금" },
  { branch: "고창", phone: "063-560-1556", duty: "공공임대용 농지 임대, 과원규모화" },
  { branch: "고창", phone: "063-560-1555", duty: "농지총괄, 공공임대" },
  { branch: "고창", phone: "063-560-1510", duty: "선임대후매도, 농지연금, 농지전용부담금" },
  { branch: "고창", phone: "063-560-1513", duty: "맞춤형농지지원, 과원규모화, 청년농" },
  { branch: "고창", phone: "063-560-1509", duty: "경영회생, 경영이양은퇴지불" },
  { branch: "고창", phone: "063-560-1560", duty: "농지임대수탁" },
  { branch: "정읍", phone: "063-530-0323", duty: "농지사업(경영회생지원사업)" },
  { branch: "정읍", phone: "063-530-0000", duty: "농지사업(공공임대용농지매입)" },
  { branch: "정읍", phone: "063-530-0303", duty: "농지사업(공공임대용농지매입)" },
  { branch: "정읍", phone: "063-530-0365", duty: "농지사업(공공임대용농지임대)" },
  { branch: "정읍", phone: "063-534-6819", duty: "농지사업(채권, 농지보전부담금)" },
  { branch: "정읍", phone: "063-530-0324", duty: "농지사업(임대수탁)" },
  { branch: "정읍", phone: "063-530-0326", duty: "농지사업(규모화, 연금)" },
  { branch: "정읍", phone: "063-530-0322", duty: "농지사업(경영이양은퇴직불, 임대수탁)" },
];

// Map region → farmland bank branch
export const REGION_TO_FB_BRANCH: Record<string, string> = {
  전주시: "전완임",
  완주군: "전완임",
  임실군: "전완임",
  군산시: "군산",
  익산시: "익산",
  정읍시: "정읍",
  김제시: "김제",
  남원시: "남원",
  진안군: "무주진안장수",
  무주군: "무주진안장수",
  장수군: "무주진안장수",
  순창군: "순창",
  고창군: "고창",
  부안군: "부안",
};

// 농업기술센터 (전북)
export interface ExtensionOffice {
  region: string;
  name: string;
  duty: string;
  phone: string;
}
export const EXTENSION_OFFICES: ExtensionOffice[] = [
  { region: "전북(도)", name: "전북특별자치도농업기술원", duty: "청년농, 귀농·귀촌, 스마트팜, 영농교육, 병해충 상담", phone: "063-290-6000" },
  { region: "전주시", name: "전주시 농업기술센터", duty: "영농기술 지도, 귀농귀촌, 청년농 지원", phone: "063-281-6702" },
  { region: "군산시", name: "군산시 농업기술센터", duty: "영농기술 지도, 청년농, 귀농귀촌", phone: "063-454-2830" },
  { region: "익산시", name: "익산시농업기술센터", duty: "영농기술, 청년농, 스마트농업", phone: "063-859-4313" },
  { region: "정읍시", name: "정읍시농업기술센터", duty: "영농교육, 귀농귀촌, 품목기술", phone: "063-539-6251" },
  { region: "김제시", name: "김제시농업기술센터", duty: "영농기술, 스마트농업, 청년농", phone: "063-540-4500" },
  { region: "남원시", name: "남원시농업기술센터", duty: "영농교육, 귀농귀촌, 청년농", phone: "063-620-8013" },
  { region: "완주군", name: "완주군 농업기술센터", duty: "귀농귀촌, 영농기술, 스마트팜", phone: "063-290-3301" },
  { region: "진안군", name: "진안군 농업기술센터", duty: "영농기술, 청년농 지원", phone: "063-430-8615" },
  { region: "무주군", name: "무주군농업기술센터", duty: "귀농귀촌, 영농교육", phone: "063-320-2114" },
  { region: "장수군", name: "장수군농업기술센터", duty: "영농기술, 청년농, 품목기술", phone: "063-350-2821" },
  { region: "임실군", name: "임실군농업기술센터", duty: "귀농귀촌, 영농교육", phone: "063-640-4666" },
  { region: "순창군", name: "순창군농업기술센터", duty: "영농기술, 청년농 지원", phone: "063-650-5100" },
  { region: "고창군", name: "고창군농업기술센터", duty: "영농교육, 귀농귀촌", phone: "063-560-8812" },
  { region: "부안군", name: "부안군농업기술센터", duty: "영농기술, 귀농귀촌, 청년농", phone: "063-580-3823" },
];

// 국립농산물품질관리원 (전북지원)
export interface NaqsOffice {
  name: string;
  region: string;
  phone: string;
  duty: string;
}
export const NAQS_OFFICES: NaqsOffice[] = [
  { name: "전북지원", region: "전주·완주", phone: "063-214-2160", duty: "GAP·친환경인증, 원산지관리, 농업경영체" },
  { name: "김제사무소", region: "김제시", phone: "063-548-6060", duty: "농업경영체 등록·변경, 직불제 확인" },
  { name: "부안사무소", region: "부안군", phone: "063-582-6060", duty: "농업경영체 등록·변경, 직불제 확인" },
  { name: "고창사무소", region: "고창군", phone: "063-563-6060", duty: "농업경영체 등록·변경, 직불제 확인" },
  { name: "정읍사무소", region: "정읍시", phone: "063-533-6060", duty: "농업경영체 등록·변경, 직불제 확인" },
  { name: "군산사무소", region: "군산시", phone: "063-452-6399", duty: "농업경영체 등록·변경, 직불제 확인" },
  { name: "익산사무소", region: "익산시", phone: "063-841-6060", duty: "농업경영체 등록·변경, 직불제 확인" },
  { name: "남원사무소", region: "남원시", phone: "063-635-6060", duty: "농업경영체 등록·변경, 직불제 확인" },
  { name: "임실사무소", region: "임실군", phone: "063-643-6061", duty: "농업경영체 등록·변경, 직불제 확인" },
  { name: "진안사무소", region: "진안군", phone: "063-432-6060", duty: "농업경영체 등록·변경, 직불제 확인" },
  { name: "장수사무소", region: "장수군", phone: "063-351-6061", duty: "농업경영체 등록·변경, 직불제 확인" },
  { name: "순창사무소", region: "순창군", phone: "063-653-6060", duty: "농업경영체 등록·변경, 직불제 확인" },
  { name: "무주사무소", region: "무주군", phone: "063-324-6060", duty: "농업경영체 등록·변경, 직불제 확인" },
];

export interface ContactMatch {
  orgName: string;
  department: string;
  phone: string;
  address?: string;
  duty: string;
}

function scoreDutyMatch(duty: string, business: string): number {
  const tokens = business.split(/[,·\s()]+/).filter((t) => t.length >= 2);
  let score = 0;
  for (const t of tokens) if (duty.includes(t)) score += 1;
  return score;
}

export function matchContact(intent: IntentKey, region: string): ContactMatch {
  const info = INTENTS.find((i) => i.key === intent)!;

  if (info.org === "farmland_bank") {
    const branch = REGION_TO_FB_BRANCH[region] ?? "전완임";
    const candidates = FARMLAND_BANK.filter((c) => c.branch === branch);
    const best = candidates
      .map((c) => ({ c, s: scoreDutyMatch(c.duty, info.business) }))
      .sort((a, b) => b.s - a.s)[0];
    const pick = best?.c ?? candidates[0];
    return {
      orgName: `한국농어촌공사 ${pick.branch}지사 (농지은행)`,
      department: pick.duty,
      phone: pick.phone,
      duty: info.business,
    };
  }

  if (info.org === "municipal") {
    const office =
      MUNICIPAL_OFFICES.find((o) => o.region === region) ?? MUNICIPAL_FALLBACK;
    return {
      orgName: office.name,
      department: "농지이용실태조사 담당 (농업정책과)",
      phone: office.phone,
      duty: info.business,
    };
  }

  if (info.org === "extension") {
    const office =
      EXTENSION_OFFICES.find((o) => o.region === region) ??
      EXTENSION_OFFICES[0];
    return {
      orgName: office.name,
      department: "영농기술·교육 담당",
      phone: office.phone,
      duty: office.duty,
    };
  }

  // naqs
  const office =
    NAQS_OFFICES.find((o) => o.region.includes(region.replace(/[시군]$/, ""))) ??
    NAQS_OFFICES.find((o) => o.region.includes(region)) ??
    NAQS_OFFICES[0];
  return {
    orgName: `국립농산물품질관리원 ${office.name}`,
    department: "농업경영체·인증 담당",
    phone: office.phone,
    duty: office.duty,
  };
}

export const HUMAN_SUPPORT_PHONE = "1577-7770"; // 농지은행 대표번호

// 농지전수조사 지자체 문의처 — 각 시·군 농업정책과 담당 직통번호
export interface MunicipalOffice {
  region: string;
  name: string;
  phone: string;
}
export const MUNICIPAL_OFFICES: MunicipalOffice[] = [
  { region: "전주시", name: "전주시 농업정책과", phone: "063-281-5089" },
  { region: "군산시", name: "군산시 농업정책과", phone: "063-454-4732" },
  { region: "익산시", name: "익산시 농업정책과", phone: "063-589-5752" },
  { region: "정읍시", name: "정읍시 농업정책과", phone: "063-539-6152" },
  { region: "김제시", name: "김제시 농업정책과", phone: "063-540-3373" },
  { region: "남원시", name: "남원시 농업정책과", phone: "063-620-6385" },
  { region: "완주군", name: "완주군 농업정책과", phone: "063-290-3218" },
  { region: "진안군", name: "진안군 농업정책과", phone: "063-430-2852" },
  { region: "무주군", name: "무주군 농업정책과", phone: "063-320-2812" },
  { region: "장수군", name: "장수군 농업정책과", phone: "063-350-2362" },
  { region: "임실군", name: "임실군 농업정책과", phone: "063-640-2411" },
  { region: "순창군", name: "순창군 농업정책과", phone: "063-650-5185" },
  { region: "고창군", name: "고창군 농업정책과", phone: "063-560-2466" },
  { region: "부안군", name: "부안군 농업정책과", phone: "063-580-4304" },
];


// 기타 지역 농지전수조사 문의 — 전북특별자치도청 대표번호
export const MUNICIPAL_FALLBACK: MunicipalOffice = {
  region: "기타 지역",
  name: "전북특별자치도청",
  phone: "063-280-2114",
};