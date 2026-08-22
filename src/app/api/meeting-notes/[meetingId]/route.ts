import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
type Context = { params: Promise<{ meetingId: string }> };

export async function PATCH(request: Request, context: Context) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: { code: "supabase_not_configured", message: "Supabase 환경변수가 설정되지 않았습니다." } }, { status: 503 });
  const { meetingId } = await context.params;
  const body = await request.json().catch(() => ({}));
  if (typeof body.content !== "string" || !body.content.trim()) return NextResponse.json({ error: { code: "invalid_request", message: "회의록 내용을 입력해 주세요." } }, { status: 400 });
  const { data: meeting } = await supabase.from("meetings").select("title").eq("id", meetingId).single();
  if (!meeting) return NextResponse.json({ error: { code: "not_found", message: "회의를 찾을 수 없습니다." } }, { status: 404 });
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 200) : meeting.title;
  const { data, error } = await supabase.from("meeting_notes").upsert({ meeting_id: meetingId, title, content: body.content.trim() }, { onConflict: "meeting_id" }).select("*").single();
  if (error) return NextResponse.json({ error: { code: "supabase_error", message: "회의록을 저장하지 못했습니다." } }, { status: 502 });
  return NextResponse.json({ note: data });
}
