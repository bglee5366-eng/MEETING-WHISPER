const OPENAI_TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions";
const TRANSCRIPTION_TIMEOUT_MS = 30_000;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set(["audio/webm", "audio/ogg", "audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/flac"]);

type Provider = "openai" | "gemini";
type ErrorCode = "no_api_key" | "no_audio" | "invalid_audio_format" | "auth_error" | "api_error" | "network_error" | "unsupported_provider";

function errorResponse(code: ErrorCode, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("no_audio", "마이크 데이터가 전달되지 않았습니다.", 400);
  }

  const provider = formData.get("provider") === "gemini" ? "gemini" : "openai" as Provider;
  const apiKey = provider === "gemini" ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY;
  if (!apiKey) return errorResponse("no_api_key", provider === "gemini" ? "서버에 GEMINI_API_KEY가 설정되지 않았습니다." : "서버에 OPENAI_API_KEY가 설정되지 않았습니다.", 503);

  const audio = formData.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return errorResponse("no_audio", "전사할 마이크 데이터가 없습니다.", 400);
  if (audio.size > MAX_AUDIO_BYTES) return errorResponse("invalid_audio_format", "음성 파일이 너무 큽니다. 최근 10분 음성만 다시 시도해 주세요.", 413);
  if (audio.type && !ALLOWED_AUDIO_TYPES.has(audio.type.split(";")[0])) return errorResponse("invalid_audio_format", "지원하지 않는 음성 파일 형식입니다.", 415);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSCRIPTION_TIMEOUT_MS);
  try {
    let response: Response;
    let payload: { text?: unknown } | { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | null;
    if (provider === "gemini") {
      const base64Audio = Buffer.from(await audio.arrayBuffer()).toString("base64");
      response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: "회의 음성을 한국어 원문 그대로 정확하게 전사해 주세요. 설명이나 요약 없이 말한 내용만 반환하세요." }, { inlineData: { mimeType: audio.type || "audio/webm", data: base64Audio } }] }] }),
        signal: controller.signal,
      });
      payload = await response.json().catch(() => null);
    } else {
      const openAiForm = new FormData();
      openAiForm.append("file", audio, audio.name || "meeting.webm");
      openAiForm.append("model", "gpt-transcribe");
      openAiForm.append("language", "ko");
      openAiForm.append("response_format", "json");
      response = await fetch(OPENAI_TRANSCRIPTION_URL, { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: openAiForm, signal: controller.signal });
      payload = await response.json().catch(() => null);
    }
    if (response.status === 401 || response.status === 403) return errorResponse("auth_error", `${provider === "gemini" ? "Gemini" : "OpenAI"} API 인증에 실패했습니다. API 키를 확인해 주세요.`, 502);
    if (!response.ok) return errorResponse("api_error", `${provider === "gemini" ? "Gemini" : "OpenAI"} 음성 전사 요청에 실패했습니다.`, 502);
    const text = provider === "gemini" ? ((payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join(" ").trim() || "") : (typeof (payload as { text?: unknown } | null)?.text === "string" ? ((payload as { text: string }).text).trim() : "");
    return Response.json({ text });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") return errorResponse("network_error", "음성 전사 요청 시간이 초과되었습니다. 다시 시도해 주세요.", 504);
    return errorResponse("network_error", `${provider === "gemini" ? "Gemini" : "OpenAI"} 서버와 통신할 수 없습니다. 서버 실행 환경의 외부 네트워크와 API 키를 확인해 주세요.`, 502);
  } finally {
    clearTimeout(timeout);
  }
}
