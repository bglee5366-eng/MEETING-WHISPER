const TIMEOUT_MS = 30_000;
const OPENAI_URL = "https://api.openai.com/v1/responses";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function errorResponse(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

function promptFor(transcript: string, summary: { core: string; issues: string; speakingPoint: string }) {
  return `너는 회의 중 갑자기 발언을 요청받은 사람을 돕는 회의 귓속말 도우미다.
회의 원문과 3줄 요약을 바탕으로 사용자가 바로 말할 수 있는 중립적인 한마디 답변을 작성하라.

규칙:
- 1~2문장, 자연스러운 한국어로 작성한다.
- 회의 원문에 실제로 나온 사실과 요약 내용만 사용한다.
- 사용자의 실제 의견을 임의로 만들지 않는다.
- 확실하지 않거나 논점이 확인되지 않으면 정확히 "회의 내용이 충분하지 않아 답변을 추천하기 어렵습니다."라고 답한다.
- 설명, 따옴표, 접두어 없이 답변 문장만 반환한다.

[지금 논의한 핵심]
${summary.core}
[주요 쟁점]
${summary.issues}
[내가 말할 때 참고할 포인트]
${summary.speakingPoint}
[회의 원문]
${transcript}`;
}

export async function POST(request: Request) {
  let body: { provider?: unknown; transcript?: unknown; summary?: { core?: unknown; issues?: unknown; speakingPoint?: unknown } };
  try { body = await request.json(); } catch { return errorResponse("invalid_request", "답변을 만들 회의 내용이 없습니다.", 400); }
  const provider = body.provider === "gemini" || body.provider === "anthropic" ? body.provider : "openai";
  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  const summary = body.summary;
  if (transcript.length < 20 || !summary || typeof summary.core !== "string" || typeof summary.issues !== "string" || typeof summary.speakingPoint !== "string") {
    return errorResponse("insufficient_context", "회의 내용이 충분하지 않아 답변을 추천하기 어렵습니다.", 422);
  }
  if ([summary.core, summary.issues, summary.speakingPoint].some((item) => item.includes("현재 대화만으로는 판단하기 어렵습니다."))) {
    return errorResponse("unclear_context", "회의 내용이 충분하지 않아 답변을 추천하기 어렵습니다.", 422);
  }
  const apiKey = provider === "gemini" ? process.env.GEMINI_API_KEY : provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
  if (!apiKey) return errorResponse("no_api_key", "선택한 provider의 서버 API 키가 설정되지 않았습니다.", 503);
  const prompt = promptFor(transcript, { core: summary.core, issues: summary.issues, speakingPoint: summary.speakingPoint });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let response: Response;
    let text = "";
    if (provider === "openai") {
      response = await fetch(OPENAI_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: process.env.OPENAI_SUMMARY_MODEL || "gpt-4o", input: prompt, store: false }), signal: controller.signal });
      const payload = await response.json().catch(() => null) as { output_text?: string } | null;
      if (response.status === 401 || response.status === 403) return errorResponse("auth_error", "OpenAI API 인증에 실패했습니다.", 502);
      if (!response.ok) return errorResponse("api_error", "한마디 답변 요청에 실패했습니다.", 502);
      text = payload?.output_text || "";
    } else if (provider === "gemini") {
      response = await fetch(GEMINI_URL, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }), signal: controller.signal });
      const payload = await response.json().catch(() => null) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | null;
      if (response.status === 401 || response.status === 403) return errorResponse("auth_error", "Gemini API 인증에 실패했습니다.", 502);
      if (!response.ok) return errorResponse("api_error", "한마디 답변 요청에 실패했습니다.", 502);
      text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
    } else {
      response = await fetch(ANTHROPIC_URL, { method: "POST", headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514", max_tokens: 250, messages: [{ role: "user", content: prompt }] }), signal: controller.signal });
      const payload = await response.json().catch(() => null) as { content?: Array<{ text?: string }> } | null;
      if (response.status === 401 || response.status === 403) return errorResponse("auth_error", "Claude API 인증에 실패했습니다.", 502);
      if (!response.ok) return errorResponse("api_error", "한마디 답변 요청에 실패했습니다.", 502);
      text = payload?.content?.map((item) => item.text || "").join("") || "";
    }
    const reply = text.trim().replace(/^['"“”]+|['"“”]+$/g, "");
    return reply ? Response.json({ reply }) : errorResponse("empty_result", "회의 내용이 충분하지 않아 답변을 추천하기 어렵습니다.", 422);
  } catch (cause) {
    return errorResponse("network_error", cause instanceof DOMException && cause.name === "AbortError" ? "한마디 답변 요청 시간이 초과되었습니다." : "AI provider와 통신할 수 없습니다.", 504);
  } finally { clearTimeout(timeout); }
}
