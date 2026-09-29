import { createFileRoute } from "@tanstack/react-router";
import { INTENTS, type IntentKey } from "@/lib/data";
import {
  CATEGORIES,
  CATEGORY_DEFAULT_CASE,
  CLARIFY_CASES,
  CLARIFY_CASE_IDS,
  INTENT_META,
  type Category,
  type ClarifyCaseId,
} from "@/lib/clarify-flow";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["category", "candidates", "intent", "level", "confidence", "summary", "caseId"],
  properties: {
    category: { type: "string", enum: [...CATEGORIES] },
    candidates: { type: "array", items: { type: "string" } },
    intent: { type: "string" },
    level: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
    confidence: { type: "number" },
    summary: { type: "string" },
    caseId: { type: ["string", "null"] },
  },
};

async function readStreamText(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let out = "";
  let finalText = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const ev = JSON.parse(payload);
          if (ev.type === "response.output_text.delta") out += ev.delta ?? "";
          else if (ev.type === "response.output_text.done") finalText = ev.text ?? "";
          else if (ev.type === "response.failed" || ev.type === "error") {
            throw new Error(ev.error?.message ?? ev.response?.error?.message ?? "failed");
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }
  }
  return finalText || out;
}

export const Route = createFileRoute("/api/intent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const body = (await request.json().catch(() => ({}))) as {
          text?: string;
          region?: string;
          clarification?: string;
        };
        const text = (body.text ?? "").trim();
        if (!text) return new Response("Missing text", { status: 400 });

        const catalogue = INTENTS.map((i) => {
          const m = INTENT_META[i.key];
          return `- ${i.key} [${m?.category ?? "기타"}]: ${i.business} — ${i.meaning}. 예: ${i.examples.slice(0, 6).join(" / ")}`;
        }).join("\n");
        const cases = CLARIFY_CASE_IDS.map(
          (id) => `- ${id}: "${CLARIFY_CASES[id].question}" 선택지: ${CLARIFY_CASES[id].options.map((o) => o.label).join(" / ")}`,
        ).join("\n");

        const system = `당신은 전북 농업인의 농지은행 민원 발화를 분석해 업무를 분류하는 도우미입니다.
사용자는 사업명을 모른다고 가정하고, 사업명보다 상황과 목적을 중요하게 판단하세요.
구어체·방언·음성인식 오류를 의미 중심으로 이해하세요 (논/답, 밭/전, 땅/농사땅, 빌리다/임차/세내다, 빌려주다/임대/맡기다, 팔다/처분/넘기다, 사다/구입/매입, 과수원/과원/사과밭/배밭, 은퇴/농사 그만, 빚/부채/대출/농협빚/경영난).
지역: ${body.region ?? "미상"}.

1) category: 대분류 중 하나 (${CATEGORIES.join(", ")})
2) candidates: 가능성 있는 세부 업무 key 1~5개 (가능성 높은 순)
3) intent: 가장 유력한 key 하나
4) level:
 - HIGH: 특정 사업으로 판단할 근거가 충분 (사업명을 직접 말함, 또는 상황이 명확함. 예: "청년농인데 먼저 빌렸다가 나중에 사고 싶어요" → lease_then_sale HIGH, "빚 때문에 땅을 팔아야 하는데 농사는 계속 짓고 싶어요" → management_recovery HIGH)
 - MEDIUM: 2개 이상 가능하나 하나가 유력
 - LOW: 너무 짧거나 여러 업무로 해석 가능
 불확실한데 임의로 HIGH를 주지 마세요. 단, 명확하면 HIGH로 하여 불필요한 질문을 피하세요.
 반드시 추가 질문이 필요한 예: "농지를 팔고 싶어요"(sell), "농지를 빌려주고 싶어요"(lease_out), "농사지을 땅을 구하고 싶어요"·"청년농인데 땅이 필요해요"(find_land), "과수원이 필요해요"(orchard), "농사를 못 짓게 됐어요"(cant_farm), "빚 때문에 농지가 걱정이에요"(debt).
5) confidence: 0~1
6) summary: 고객님 상황을 쉬운 존댓말 한 문장으로
7) caseId: level이 HIGH가 아니면 아래 추가 질문 중 가장 알맞은 id, HIGH면 null
${cases}

세부 업무 key 목록:
${catalogue}
general_consult는 다른 어떤 업무도 맞지 않을 때만 쓰세요.`;

        const userMsg = body.clarification
          ? `최초 발화: "${text}"\n추가 답변: "${body.clarification}" (두 내용을 함께 분석)`
          : `발화: "${text}"`;

        const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Lovable-API-Key": key,
            "X-Lovable-AIG-SDK": "fetch",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-6-astra",
            stream: true,
            store: false,
            reasoning: { effort: "low" },
            instructions: system,
            input: [{ role: "user", content: userMsg }],
            text: { format: { type: "json_schema", name: "intent", strict: true, schema: SCHEMA } },
          }),
        });

        if (!res.ok || !res.body) {
          const t = await res.text().catch(() => "");
          return new Response(t || "Intent failed", { status: res.status || 502 });
        }

        let parsed: {
          category?: string;
          candidates?: string[];
          intent?: string;
          level?: string;
          confidence?: number;
          summary?: string;
          caseId?: string | null;
        } = {};
        try {
          parsed = JSON.parse(await readStreamText(res));
        } catch (e) {
          console.error("[intent] parse failed", e);
          return new Response("Unable to classify intent", { status: 422 });
        }

        const validKeys = INTENTS.map((i) => i.key) as string[];
        if (!validKeys.includes(parsed.intent ?? "")) {
          return new Response("Unable to classify intent", { status: 422 });
        }
        const intent = parsed.intent as IntentKey;
        const candidates = (parsed.candidates ?? []).filter((c) => validKeys.includes(c)) as IntentKey[];
        const confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0.5));
        const category = (CATEGORIES as readonly string[]).includes(parsed.category ?? "")
          ? (parsed.category as Category)
          : "기타 / 분류 불확실";
        let level = (["HIGH", "MEDIUM", "LOW"].includes(parsed.level ?? "") ? parsed.level : "LOW") as
          | "HIGH" | "MEDIUM" | "LOW";
        if (intent === "general_consult" && level === "HIGH") level = "MEDIUM";

        let caseId: ClarifyCaseId | null = null;
        if (level !== "HIGH") {
          caseId = (CLARIFY_CASE_IDS as string[]).includes(parsed.caseId ?? "")
            ? (parsed.caseId as ClarifyCaseId)
            : (CATEGORY_DEFAULT_CASE[category] ?? "general");
        }

        return Response.json({
          intent,
          confidence,
          summary: parsed.summary ?? text,
          category,
          candidates,
          level,
          caseId,
          needsClarification: level !== "HIGH" && !body.clarification,
        });
      },
    },
  },
});
