import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ai_analysis_runs")
      .select("*")
      .order("triggered_at", { ascending: false })
      .limit(10);
    if (error) throw error;
    return NextResponse.json({ runs: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
