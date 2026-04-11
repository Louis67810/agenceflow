import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("leads_config").select("key, value");
    const cfg: Record<string, string> = {};
    (data ?? []).forEach((c: { key: string; value: string }) => { cfg[c.key] = c.value; });
    return NextResponse.json(cfg);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = await createClient();

    const upserts = Object.entries(body).map(([key, value]) => ({
      key,
      value: String(value),
      updated_at: new Date().toISOString(),
    }));

    await supabase.from("leads_config").upsert(upserts, { onConflict: "key" });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
