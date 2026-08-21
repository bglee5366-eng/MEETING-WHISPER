const TIMEOUT_MS = 30_000;
const OPENAI_URL = "https://api.openai.com/v1/responses";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const schema = { type: "object", additionalProperties: false, properties: { core: { type: "string" }, issues: { type: "string" }, speakingPoint: { type: "string" }, question: { type: "string" }, decision: { type: "string" }, numbers: { type: "array", items: { type: "string" } } }, required: ["core", "issues", "speakingPoint", "question", "decision", "numbers"] };
const fallback = { core: "현재 대화만으로는 판단하기 어렵습니다.", issues: "현재 대화만으로는 판단하기 어렵습니다.", speakingPoint: "현재 대화만으로는 판단하기 어렵습니다.", question: "", decision: "", numbers: [] as string[] };

function errorResponse(code: string, message: string, status: number) { return Response.json({ error: { code, message } }, { status }); }
function promptFor(transcript: string) { return `너는 회의에 참석했지만 잠시 집중하지 못한 사람을 위한 "회의 멍때리기 방지 요약기"다. 사용자는 지금 갑자기 "OO님 의견은요?"라는 질문을 받을 수 있다. 일반적인 회의록을 작성하지 말고 직전 2분간의 대화를 빠르게 따라잡을 수 있는 3줄 컨닝페이퍼를 만들어라.

반드시 JSON 객체만 반환하라. 스키마는 다음과 같다:
{"core":"지금 논의한 핵심","issues":"주요 쟁점","speakingPoint":"내가 말할 때 참고할 포인트","question":"현재 나에게 직접 질문된 내용이 있다면 질문","decision":"방금 논의에서 결정된 내용","numbers":["중요 숫자 또는 일정"]}

규칙:
- core, issues, speakingPoint는 각각 최대 2문장, 전체는 3줄 수준으로 간결하게 작성한다.
- 핵심 숫자, 일정, 기관명, 사업명은 가능한 경우 유지한다.
- 인사말, 잡담, 반복 발언은 제거한다.
- 확실하지 않은 내용은 추측하지 않는다.
- 회의 원문에 없는 의견을 만들지 않는다.
- 회의 내용이 불충분한 항목은 정확히 "현재 대화만으로는 판단하기 어렵습니다."라고 쓴다.
- speakingPoint는 사용자의 의견을 임의로 만들지 말고, 회의에서 실제 언급된 객관적인 포인트만 제시한다.

회의 원문:
${transcript}`; }

function normalize(value: unknown) {
  if (!value || typeof value !== "object") return fallback;
  const item = value as Record<string, unknown>;
  return { core: typeof item.core === "string" && item.core.trim() ? item.core.trim() : fallback.core, issues: typeof item.issues === "string" && item.issues.trim() ? item.issues.trim() : fallback.issues, speakingPoint: typeof item.speakingPoint === "string" && item.speakingPoint.trim() ? item.speakingPoint.trim() : fallback.speakingPoint, question: typeof item.question === "string" ? item.question.trim() : "", decision: typeof item.decision === "string" ? item.decision.trim() : "", numbers: Array.isArray(item.numbers) ? item.numbers.filter((item): item is string => typeof item === "string").slice(0, 10) : [] };
}
function parseJson(text: string) { try { return normalize(JSON.parse(text)); } catch { const start = text.indexOf("{"); const end = text.lastIndexOf("}"); return start >= 0 && end > start ? normalize(JSON.parse(text.slice(start, end + 1))) : fallback; } }

export async function POST(request: Request) {
  let body: { transcript?: unknown; provider?: unknown };
  try { body = await request.json(); } catch { return errorResponse("invalid_request", "요약할 회의 원문이 없습니다.", 400); }
  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  const provider = body.provider === "gemini" || body.provider === "anthropic" ? body.provider : "openai";
  if (!transcript) return errorResponse("no_transcript", "요약할 회의 원문이 없습니다.", 400);
  if (transcript.length > 20_000) return errorResponse("invalid_request", "회의 원문이 너무 깁니다.", 413);
  const apiKey = provider === "gemini" ? process.env.GEMINI_API_KEY : provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
  if (!apiKey) return errorResponse("no_api_key", `서버에 ${provider === "gemini" ? "GEMINI_API_KEY" : provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY"}가 설정되지 않았습니다.`, 503);
  const prompt = promptFor(transcript);
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let response: Response;
    let text = "";
    if (provider === "openai") {
      response = await fetch(OPENAI_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: process.env.OPENAI_SUMMARY_MODEL || "gpt-4o", input: prompt, text: { format: { type: "json_schema", name: "meeting_cheat_sheet", strict: true, schema } }, store: false }), signal: controller.signal });
      const payload = await response.json().catch(() => null) as { output_text?: string } | null;
      if (response.status === 401 || response.status === 403) return errorResponse("auth_error", "OpenAI API 인증에 실패했습니다.", 502);
      if (!response.ok) { console.warn("[summarize] OpenAI upstream status", response.status); return errorResponse("api_error", "OpenAI 요약 요청에 실패했습니다.", 502); }
      text = payload?.output_text || "";
    } else if (provider === "gemini") {
      response = await fetch(GEMINI_URL, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseFormat: { text: { mimeType: "APPLICATION_JSON", schema } } } }), signal: controller.signal });
      const payload = await response.json().catch(() => null) as { error?: { message?: string }; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | null;
      if (response.status === 401 || response.status === 403) return errorResponse("auth_error", "Gemini API 인증에 실패했습니다.", 502);
      if (!response.ok) { console.warn("[summarize] Gemini upstream status", response.status, payload?.error?.message || "unknown error"); return errorResponse("api_error", "Gemini 요약 요청에 실패했습니다.", 502); }
      text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
    } else {
      response = await fetch(ANTHROPIC_URL, { method: "POST", headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514", max_tokens: 700, messages: [{ role: "user", content: prompt }] }), signal: controller.signal });
      const payload = await response.json().catch(() => null) as { content?: Array<{ text?: string }> } | null;
      if (response.status === 401 || response.status === 403) return errorResponse("auth_error", "Claude API 인증에 실패했습니다.", 502);
      if (!response.ok) { console.warn("[summarize] Claude upstream status", response.status); return errorResponse("api_error", "Claude 요약 요청에 실패했습니다.", 502); }
      text = payload?.content?.map((item) => item.text || "").join("") || "";
    }
    return Response.json({ summary: parseJson(text) });
  } catch (cause) {
    return errorResponse("network_error", cause instanceof DOMException && cause.name === "AbortError" ? "AI 요약 요청 시간이 초과되었습니다." : "AI provider와 통신할 수 없습니다.", 504);
  } finally { clearTimeout(timeout); }
}
