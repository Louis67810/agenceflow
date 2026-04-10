import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/lead-magnet/[id]
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("lead_magnets")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ magnet: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PUT /api/lead-magnet/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("lead_magnets")
      .update(body)
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ magnet: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/lead-magnet/[id]
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("lead_magnets")
      .delete()
      .eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
