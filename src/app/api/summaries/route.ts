import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient(); if (!supabase) return NextResponse.json({ error: { code: "supabase_not_configured", message: "Supabase 환경변수가 설정되지 않았습니다." } }, { status: 503 });
  const body = await request.json().catch(() => ({})); const summary = body.summary;
  if (typeof body.meeting_id !== "string" || !summary || typeof summary.core !== "string" || typeof summary.issues !== "string" || typeof summary.speakingPoint !== "string") return NextResponse.json({ error: { code: "invalid_request", message: "요약 저장 요청이 올바르지 않습니다." } }, { status: 400 });
  const { data, error } = await supabase.from("summaries").insert({ meeting_id: body.meeting_id, core: summary.core, issues: summary.issues, speaking_point: summary.speakingPoint, question: typeof summary.question === "string" ? summary.question : null, decision: typeof summary.decision === "string" ? summary.decision : null, numbers: Array.isArray(summary.numbers) ? summary.numbers : [] }).select("*").single();
  if (error) return NextResponse.json({ error: { code: "supabase_error", message: "요약 결과를 저장하지 못했습니다." } }, { status: 502 });
  return NextResponse.json({ summary: data });
}
