import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const unavailable = () => NextResponse.json({ error: { code: "supabase_not_configured", message: "Supabase 환경변수가 설정되지 않았습니다." } }, { status: 503 });
const provider = (value: unknown) => value === "openai" || value === "gemini" || value === "anthropic" ? value : null;

export async function PATCH(request: Request, context: Context) {
  const supabase = createServerSupabaseClient(); if (!supabase) return unavailable();
  const { id } = await context.params; const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 100);
  if (typeof body.description === "string") patch.description = body.description.trim().slice(0, 500);
  if (typeof body.icon === "string") patch.icon = body.icon;
  if (typeof body.color === "string") patch.color = body.color;
  if (body.default_provider !== undefined) patch.default_provider = provider(body.default_provider);
  if (typeof body.archived === "boolean") patch.archived = body.archived;
  if (!Object.keys(patch).length) return NextResponse.json({ error: { code: "invalid_request", message: "변경할 항목이 없습니다." } }, { status: 400 });
  const { data, error } = await supabase.from("projects").update(patch).eq("id", id).neq("name", "미분류").select("*").single();
  if (error) return NextResponse.json({ error: { code: "supabase_error", message: "프로젝트를 수정하지 못했습니다." } }, { status: 502 });
  return NextResponse.json({ project: data });
}

export async function DELETE(_request: Request, context: Context) {
  const supabase = createServerSupabaseClient(); if (!supabase) return unavailable();
  const { id } = await context.params;
  const { data: fallback, error: fallbackError } = await supabase.from("projects").select("id").eq("name", "미분류").is("user_id", null).limit(1).maybeSingle();
  if (fallbackError || !fallback) return NextResponse.json({ error: { code: "unclassified_missing", message: "미분류 프로젝트를 찾을 수 없습니다." } }, { status: 409 });
  const { error: moveError } = await supabase.from("meetings").update({ project_id: fallback.id }).eq("project_id", id);
  if (moveError) return NextResponse.json({ error: { code: "supabase_error", message: "프로젝트의 회의를 미분류로 이동하지 못했습니다." } }, { status: 502 });
  const { error } = await supabase.from("projects").delete().eq("id", id).neq("name", "미분류");
  if (error) return NextResponse.json({ error: { code: "supabase_error", message: "프로젝트를 삭제하지 못했습니다." } }, { status: 502 });
  return NextResponse.json({ ok: true, movedTo: fallback.id });
}
