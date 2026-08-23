import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const unavailable = () => NextResponse.json({ error: { code: "supabase_not_configured", message: "Supabase 환경변수가 설정되지 않았습니다." } }, { status: 503 });
const provider = (value: unknown) => value === "openai" || value === "gemini" || value === "anthropic" ? value : null;

export async function GET() {
  const supabase = createServerSupabaseClient(); if (!supabase) return unavailable();
  const { data, error } = await supabase.from("projects").select("id,user_id,name,description,icon,color,default_provider,created_at,updated_at,sort_order,archived").order("sort_order", { ascending: true }).order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: { code: "supabase_error", message: "프로젝트를 불러오지 못했습니다." } }, { status: 502 });
  return NextResponse.json({ projects: data || [] });
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient(); if (!supabase) return unavailable();
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  if (!name) return NextResponse.json({ error: { code: "invalid_request", message: "프로젝트 이름을 입력해 주세요." } }, { status: 400 });
  const { data, error } = await supabase.from("projects").insert({ name, description: typeof body.description === "string" ? body.description.trim().slice(0, 500) : null, icon: typeof body.icon === "string" ? body.icon : "folder", color: typeof body.color === "string" ? body.color : "gray", default_provider: provider(body.default_provider) }).select("*").single();
  if (error) return NextResponse.json({ error: { code: "supabase_error", message: "프로젝트를 만들지 못했습니다." } }, { status: 502 });
  const contextResult = await supabase.from("project_contexts").insert({ project_id: data.id });
  if (contextResult.error) { await supabase.from("projects").delete().eq("id", data.id); return NextResponse.json({ error: { code: "supabase_error", message: "프로젝트 정보를 초기화하지 못했습니다." } }, { status: 502 }); }
  return NextResponse.json({ project: data }, { status: 201 });
}
