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
  const { data, error } = await supabase.from("meetings").insert({ title, started_at: startedAt, status: "active" }).select("*").single();
  if (error) return NextResponse.json({ error: { code: "supabase_error", message: "회의 세션을 저장하지 못했습니다." } }, { status: 502 });
  return NextResponse.json({ meeting: data });
}

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return unavailable();
  const query = new URL(request.url).searchParams.get("q")?.trim();
  let requestBuilder = supabase.from("meetings").select("id,title,started_at,ended_at,duration_seconds,status,created_at").neq("status", "deleted").order("started_at", { ascending: false }).limit(100);
  if (query) requestBuilder = requestBuilder.ilike("title", `%${query}%`);
  const { data, error } = await requestBuilder;
  if (error) return NextResponse.json({ error: { code: "supabase_error", message: "지난 회의를 불러오지 못했습니다." } }, { status: 502 });
  return NextResponse.json({ meetings: data || [] });
}
