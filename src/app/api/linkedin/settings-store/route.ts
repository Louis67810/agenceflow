import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatSupabaseError } from "@/lib/supabase/format-error";

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

async function getAuthenticatedUser(req: NextRequest) {
  const supabase = await createClient();
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");

  const { data: cookieAuth, error: cookieError } = await supabase.auth.getUser();
  if (!cookieError && cookieAuth.user) {
    return { supabase, user: cookieAuth.user };
  }

  if (token) {
    const { data: tokenAuth, error: tokenError } = await supabase.auth.getUser(token);
    if (!tokenError && tokenAuth.user) {
      return { supabase, user: tokenAuth.user };
    }
  }

  return { supabase, user: null };
}

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error: fetchError } = await supabase
      .from("linkedin_user_settings")
      .select("settings")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!data) {
      const bootstrappedSettings = { ...DEFAULT_SETTINGS };
      const { data: inserted, error: insertError } = await supabase
        .from("linkedin_user_settings")
        .upsert(
          {
            user_id: user.id,
            settings: bootstrappedSettings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )
        .select("settings")
        .single();

      if (insertError) throw insertError;
      return NextResponse.json({ settings: { ...DEFAULT_SETTINGS, ...(inserted?.settings ?? {}) } });
    }

    return NextResponse.json({ settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) } });
  } catch (e) {
    return NextResponse.json({ error: formatSupabaseError(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    return NextResponse.json({ error: formatSupabaseError(e) }, { status: 500 });
  }
}
