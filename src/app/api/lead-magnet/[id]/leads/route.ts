import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/lead-magnet/[id]/leads
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("lead_magnet_leads")
      .select("*")
      .eq("lead_magnet_id", id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ leads: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
