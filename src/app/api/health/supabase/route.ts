import { NextResponse } from "next/server";
import { createServerSupabaseClient, getSupabaseEnvironmentStatus } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const environment = getSupabaseEnvironmentStatus();
  const supabase = createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ ok: false, code: "supabase_not_configured", environment }, { status: 503 });
  const { error } = await supabase.from("meetings").select("id").limit(1);
  if (error) return NextResponse.json({ ok: false, code: "supabase_query_failed", environment }, { status: 502 });
  return NextResponse.json({ ok: true, environment });
}
