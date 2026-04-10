import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/lead-magnet — list all with lead counts
export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("lead_magnets")
      .select("*, lead_magnet_leads(count)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ magnets: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/lead-magnet — create new
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, slug, resourceUrl } = body;

    if (!title?.trim() || !slug?.trim()) {
      return NextResponse.json({ error: "Titre et slug requis" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("lead_magnets")
      .insert({
        title: title.trim(),
        slug: slug.trim(),
        resource_url: resourceUrl?.trim() || "",
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ magnet: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
