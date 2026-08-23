import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
function unavailable() { return NextResponse.json({ error: { code: "supabase_not_configured", message: "Supabase 환경변수가 설정되지 않았습니다." } }, { status: 503 }); }

export async function GET(_request: Request, context: Context) {
  const supabase = createServerSupabaseClient(); if (!supabase) return unavailable();
  const { id } = await context.params;
  const [meeting, transcripts, summaries, responses, note] = await Promise.all([
    supabase.from("meetings").select("*").eq("id", id).single(),
    supabase.from("transcripts").select("*").eq("meeting_id", id).order("sequence", { ascending: true }),
    supabase.from("summaries").select("*").eq("meeting_id", id).order("created_at", { ascending: false }),
    supabase.from("responses").select("*").eq("meeting_id", id).order("created_at", { ascending: false }),
    supabase.from("meeting_notes").select("*").eq("meeting_id", id).maybeSingle(),
  ]);
  if (meeting.error) return NextResponse.json({ error: { code: "not_found", message: "회의를 찾을 수 없습니다." } }, { status: 404 });
  if (transcripts.error || summaries.error || responses.error || note.error) return NextResponse.json({ error: { code: "supabase_error", message: "회의 상세 내용을 불러오지 못했습니다." } }, { status: 502 });
  return NextResponse.json({ meeting: meeting.data, transcripts: transcripts.data || [], summaries: summaries.data || [], responses: responses.data || [], note: note.data || null });
}

export async function PATCH(request: Request, context: Context) {
  const supabase = createServerSupabaseClient(); if (!supabase) return unavailable();
  const { id } = await context.params; const body = await request.json().catch(() => ({}));
  if (body.project_id !== undefined) {
    const projectId = typeof body.project_id === "string" && body.project_id ? body.project_id : null;
    if (projectId) { const project = await supabase.from("projects").select("id").eq("id", projectId).maybeSingle(); if (project.error || !project.data) return NextResponse.json({ error: { code: "invalid_project", message: "선택한 프로젝트를 찾을 수 없습니다." } }, { status: 400 }); }
    const { data, error } = await supabase.from("meetings").update({ project_id: projectId }).eq("id", id).select("*").single();
    if (error) return NextResponse.json({ error: { code: "supabase_error", message: "회의 프로젝트를 변경하지 못했습니다." } }, { status: 502 });
    return NextResponse.json({ meeting: data });
  }
  if (typeof body.title === "string") {
    const title = body.title.trim().slice(0, 200);
    if (!title) return NextResponse.json({ error: { code: "invalid_request", message: "회의 제목을 입력해 주세요." } }, { status: 400 });
    const { data, error } = await supabase.from("meetings").update({ title }).eq("id", id).select("*").single();
    if (error) return NextResponse.json({ error: { code: "supabase_error", message: "회의 제목을 저장하지 못했습니다." } }, { status: 502 });
    return NextResponse.json({ meeting: data });
  }
  const endedAt = typeof body.ended_at === "string" ? body.ended_at : new Date().toISOString();
  const duration = Number.isFinite(body.duration_seconds) ? Math.max(0, Math.round(body.duration_seconds)) : null;
  const { data, error } = await supabase.from("meetings").update({ ended_at: endedAt, duration_seconds: duration, status: "completed" }).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: { code: "supabase_error", message: "회의 종료 상태를 저장하지 못했습니다." } }, { status: 502 });
  return NextResponse.json({ meeting: data });
}

export async function DELETE(_request: Request, context: Context) {
  const supabase = createServerSupabaseClient(); if (!supabase) return unavailable();
  const { id } = await context.params; const { error } = await supabase.from("meetings").delete().eq("id", id);
  if (error) return NextResponse.json({ error: { code: "supabase_error", message: "회의를 삭제하지 못했습니다." } }, { status: 502 });
  return NextResponse.json({ ok: true });
}
