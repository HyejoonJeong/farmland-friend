/**
 * Representative numbers supplied in 농지 소재지별 대표번호.xlsx,
 * sheet 농지은행 업무구분, A1:K2. These are separate from the existing
 * business-specific contact matrix used by the AI consultation flow.
 */
export const REGIONAL_REPRESENTATIVES = [
  { office: "남원", phone: "063-620-2032", sourceCell: "A2" },
  { office: "순창", phone: "063-650-7031", sourceCell: "B2" },
  { office: "동진", phone: "063-540-1145", sourceCell: "C2" },
  { office: "부안", phone: "063-580-1011", sourceCell: "D2" },
  { office: "군산", phone: "063-440-5616", sourceCell: "E2" },
  { office: "익산", phone: "063-860-0043", sourceCell: "F2" },
  { office: "전주완주임실", phone: "063-270-0525", sourceCell: "G2" },
  { office: "고창", phone: "063-560-1513", sourceCell: "H2" },
  { office: "정읍", phone: "063-530-0365", sourceCell: "I2" },
  { office: "무진장", phone: "063-350-7026", sourceCell: "J2" },
  { office: "임실", phone: null, sourceCell: "K2" },
] as const;

// Show the municipality names familiar to users; preserve shared branch
// numbers for 전주·완주 and 무주·진안·장수. The user confirmed that 임실군
// also uses the 전주완주임실 representative number, 063-270-0525.
const REGION_TO_REPRESENTATIVE = [
  { region: "전주시", office: "전주완주임실" },
  { region: "군산시", office: "군산" },
  { region: "익산시", office: "익산" },
  { region: "정읍시", office: "정읍" },
  { region: "김제시", office: "동진" },
  { region: "남원시", office: "남원" },
  { region: "완주군", office: "전주완주임실" },
  { region: "진안군", office: "무진장" },
  { region: "무주군", office: "무진장" },
  { region: "장수군", office: "무진장" },
  { region: "임실군", office: "전주완주임실" },
  { region: "순창군", office: "순창" },
  { region: "고창군", office: "고창" },
  { region: "부안군", office: "부안" },
] as const;

export const REGIONAL_CONTACTS = REGION_TO_REPRESENTATIVE.map(({ region, office }) => {
  const contact = REGIONAL_REPRESENTATIVES.find((entry) => entry.office === office);
  if (!contact) throw new Error(`Missing representative for ${region}`);
  return { region, ...contact };
});
