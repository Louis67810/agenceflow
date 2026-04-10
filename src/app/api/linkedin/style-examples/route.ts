import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/linkedin/style-examples?styleId=xxx
export async function GET(req: NextRequest) {
  try {
    const styleId = req.nextUrl.searchParams.get("styleId");
    const supabase = await createClient();

    let query = supabase
      .from("linkedin_style_examples")
      .select("*")
      .order("created_at", { ascending: false });

    if (styleId) {
      query = query.eq("style_id", styleId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ examples: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/linkedin/style-examples
// Body: { styleId, content }
export async function POST(req: NextRequest) {
  try {
    const { styleId, content } = await req.json();

    if (!styleId?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: "styleId et content requis" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("linkedin_style_examples")
      .insert({ style_id: styleId, content: content.trim() })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ example: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/linkedin/style-examples?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id requis" }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("linkedin_style_examples")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
