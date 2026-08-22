import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient(); if (!supabase) return NextResponse.json({ error: { code: "supabase_not_configured", message: "Supabase 환경변수가 설정되지 않았습니다." } }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.meeting_id !== "string" || typeof body.text !== "string" || !body.text.trim() || !Number.isInteger(body.sequence)) return NextResponse.json({ error: { code: "invalid_request", message: "전사 저장 요청이 올바르지 않습니다." } }, { status: 400 });
  const row = { meeting_id: body.meeting_id, text: body.text.trim().slice(0, 10000), started_at: typeof body.started_at === "string" ? body.started_at : new Date().toISOString(), ended_at: typeof body.ended_at === "string" ? body.ended_at : null, is_final: true, sequence: body.sequence, client_id: typeof body.client_id === "string" ? body.client_id.slice(0, 120) : null };
  const { data, error } = await supabase.from("transcripts").upsert(row, { onConflict: "meeting_id,sequence", ignoreDuplicates: true }).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: { code: "supabase_error", message: "전사를 저장하지 못했습니다." } }, { status: 502 });
  return NextResponse.json({ transcript: data || row });
}
