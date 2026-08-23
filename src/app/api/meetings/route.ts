import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function unavailable() { return NextResponse.json({ error: { code: "supabase_not_configured", message: "Supabase 환경변수가 설정되지 않았습니다." } }, { status: 503 }); }

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return unavailable();
  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 200) : `${new Date().toISOString().slice(0, 10)} 회의`;
  const startedAt = typeof body.started_at === "string" ? body.started_at : new Date().toISOString();
  const projectId = typeof body.project_id === "string" && body.project_id ? body.project_id : null;
  if (projectId) { const project = await supabase.from("projects").select("id").eq("id", projectId).maybeSingle(); if (project.error || !project.data) return NextResponse.json({ error: { code: "invalid_project", message: "선택한 프로젝트를 찾을 수 없습니다." } }, { status: 400 }); }
  const { data, error } = await supabase.from("meetings").insert({ title, started_at: startedAt, status: "active", project_id: projectId }).select("*").single();
  if (error) return NextResponse.json({ error: { code: "supabase_error", message: "회의 세션을 저장하지 못했습니다." } }, { status: 502 });
  return NextResponse.json({ meeting: data });
}

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return unavailable();
  const query = new URL(request.url).searchParams.get("q")?.trim();
  const projectId = new URL(request.url).searchParams.get("project_id")?.trim();
  let requestBuilder = supabase.from("meetings").select("id,title,started_at,ended_at,duration_seconds,status,created_at,project_id").neq("status", "deleted").order("started_at", { ascending: false }).limit(100);
  if (query) requestBuilder = requestBuilder.ilike("title", `%${query}%`);
  if (projectId) requestBuilder = requestBuilder.eq("project_id", projectId);
  const { data, error } = await requestBuilder;
  if (error) return NextResponse.json({ error: { code: "supabase_error", message: "지난 회의를 불러오지 못했습니다." } }, { status: 502 });
  return NextResponse.json({ meetings: data || [] });
}
