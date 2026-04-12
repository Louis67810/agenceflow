import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token ?? undefined);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data } = await supabase
      .from("app_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const defaults = {
      business_context: "",
      ai_models: {
        copywriting: "openai/gpt-4o-mini",
        linkedin_posts: "openai/gpt-4o-mini",
        linkedin_ideas: "openai/gpt-4o-mini",
        leads: "openai/gpt-4o-mini",
        coach: "openai/gpt-4o-mini",
      },
      openrouter_api_key: "",
    };

    return NextResponse.json({ settings: data ?? defaults });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token ?? undefined);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { data, error } = await supabase
      .from("app_settings")
      .upsert(
        { ...body, user_id: user.id, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ settings: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
