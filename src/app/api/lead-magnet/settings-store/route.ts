import { NextRequest, NextResponse } from "next/server";
import { getRouteAuthenticatedUser } from "@/lib/supabase/route-client";
import { formatSupabaseError } from "@/lib/supabase/format-error";

const DEFAULT_SETTINGS = {
  airtableKey: "",
  airtableBaseId: "",
};

function formatLeadMagnetSettingsError(error: unknown) {
  const formatted = formatSupabaseError(error);

  if (
    formatted.includes("lead_magnet_user_settings")
    && (formatted.includes("PGRST205") || formatted.includes("does not exist"))
  ) {
    return `Table Supabase manquante: lead_magnet_user_settings. SQL requis: oui. Execute src/lib/supabase/lead-magnet-airtable.sql dans le SQL Editor. Detail: ${formatted}`;
  }

  if (
    formatted.includes("lead_magnet_user_settings")
    && (formatted.includes("42501") || formatted.toLowerCase().includes("row-level security"))
  ) {
    return `Politique RLS invalide sur lead_magnet_user_settings. SQL requis: oui. Reexecute src/lib/supabase/lead-magnet-airtable.sql pour recreer la policy. Detail: ${formatted}`;
  }

  return formatted;
}

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await getRouteAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("lead_magnet_user_settings")
      .select("settings")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      const { data: inserted, error: insertError } = await supabase
        .from("lead_magnet_user_settings")
        .upsert(
          {
            user_id: user.id,
            settings: DEFAULT_SETTINGS,
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
  } catch (error) {
    return NextResponse.json({ error: formatLeadMagnetSettingsError(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await getRouteAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const settings = { ...DEFAULT_SETTINGS, ...(body?.settings ?? {}) };

    const { data, error } = await supabase
      .from("lead_magnet_user_settings")
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

    if (error) throw error;

    return NextResponse.json({ settings: data.settings });
  } catch (error) {
    return NextResponse.json({ error: formatLeadMagnetSettingsError(error) }, { status: 500 });
  }
}
