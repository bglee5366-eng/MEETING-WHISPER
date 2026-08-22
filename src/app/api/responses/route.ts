import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient(); if (!supabase) return NextResponse.json({ error: { code: "supabase_not_configured", message: "Supabase 환경변수가 설정되지 않았습니다." } }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.meeting_id !== "string" || typeof body.text !== "string" || !body.text.trim()) return NextResponse.json({ error: { code: "invalid_request", message: "답변 저장 요청이 올바르지 않습니다." } }, { status: 400 });
  const { data, error } = await supabase.from("responses").insert({ meeting_id: body.meeting_id, text: body.text.trim().slice(0, 2000) }).select("*").single();
  if (error) return NextResponse.json({ error: { code: "supabase_error", message: "한마디 답변을 저장하지 못했습니다." } }, { status: 502 });
  return NextResponse.json({ response: data });
}
