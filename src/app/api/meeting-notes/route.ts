import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: { code: "supabase_not_configured", message: "Supabase 환경변수가 설정되지 않았습니다." } }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.meeting_id !== "string") return NextResponse.json({ error: { code: "invalid_request", message: "회의 ID가 필요합니다." } }, { status: 400 });
  const { data: meeting } = await supabase.from("meetings").select("id,title").eq("id", body.meeting_id).single();
  const { data: transcripts, error: transcriptError } = await supabase.from("transcripts").select("text,sequence").eq("meeting_id", body.meeting_id).eq("is_final", true).order("sequence", { ascending: true });
  if (!meeting || transcriptError) return NextResponse.json({ error: { code: "not_found", message: "회의 전사를 찾을 수 없습니다." } }, { status: 404 });
  const transcript = (transcripts || []).map((item) => item.text).join("\n").trim();
  if (!transcript) return NextResponse.json({ error: { code: "insufficient_context", message: "저장된 확정 전사가 없습니다." } }, { status: 422 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: { code: "no_api_key", message: "OPENAI_API_KEY가 설정되지 않았습니다." } }, { status: 503 });
  const prompt = `너는 전문 회의록 작성자다. 아래 회의 전사만 근거로 업무용 회의록을 한국어로 작성하라. 추측하거나 언급되지 않은 내용을 추가하지 말고, 불확실한 내용은 확인 필요로 표시하라. 다음 구조를 지켜라: 1. 회의 핵심 요약 2. 주요 논의사항 3. 주요 의견 4. 결정사항 5. 미결사항 6. 향후 조치사항 7. 주요 일정 및 숫자\n\n회의 제목: ${meeting.title}\n회의 전사:\n${transcript}`;
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-4o-mini", input: prompt }), signal: controller.signal });
    const payload = await response.json().catch(() => null) as { output?: Array<{ content?: Array<{ text?: string }> }>; } | null;
    if (!response.ok) return NextResponse.json({ error: { code: response.status === 401 ? "auth_error" : "api_error", message: "회의록 AI 요청에 실패했습니다." } }, { status: response.status === 401 ? 401 : 502 });
    const content = payload?.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("\n").trim();
    if (!content) return NextResponse.json({ error: { code: "api_error", message: "회의록 결과가 비어 있습니다." } }, { status: 502 });
    const { data: note, error } = await supabase.from("meeting_notes").upsert({ meeting_id: meeting.id, title: meeting.title, content }, { onConflict: "meeting_id" }).select("*").single();
    if (error) return NextResponse.json({ error: { code: "supabase_error", message: "회의록을 저장하지 못했습니다." } }, { status: 502 });
    return NextResponse.json({ note });
  } catch (cause) {
    const code = cause instanceof DOMException && cause.name === "AbortError" ? "timeout" : "network_error";
    return NextResponse.json({ error: { code, message: code === "timeout" ? "회의록 생성 시간이 초과되었습니다." : "AI 서버에 연결하지 못했습니다." } }, { status: 502 });
  } finally { clearTimeout(timeout); }
}
