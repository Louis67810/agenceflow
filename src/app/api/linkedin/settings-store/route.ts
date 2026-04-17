import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_SETTINGS = {
  openrouterApiKey: "",
  model: "anthropic/claude-sonnet-4-6",
  carouselTemplate: "",
  language: "fr",
  prospectionBigModel: "anthropic/claude-sonnet-4-6",
  prospectionSmallModel: "google/gemini-2.0-flash-001",
  prospectionBigPrompt: "",
  prospectionSmallPrompt: "",
  prospectionAutoAnalysis: false,
  prospectionAutoAnalysisEvery: 10,
  airtableKey: "",
  airtableBaseId: "",
  airtableTableName: "Prospects LinkedIn",
  airtableAutoSync: false,
};

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error: fetchError } = await supabase
      .from("linkedin_user_settings")
      .select("settings")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    return NextResponse.json({ settings: { ...DEFAULT_SETTINGS, ...(data?.settings ?? {}) } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const settings = { ...DEFAULT_SETTINGS, ...(body?.settings ?? {}) };

    const { data, error: upsertError } = await supabase
      .from("linkedin_user_settings")
      .upsert(
        {
          user_id: user.id,
          settings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select("settings")
      .single();

    if (upsertError) throw upsertError;

    return NextResponse.json({ settings: data.settings });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
