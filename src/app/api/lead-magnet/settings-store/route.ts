import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getRouteAuthenticatedUser } from "@/lib/supabase/route-client";
import { formatSupabaseError } from "@/lib/supabase/format-error";

const DEFAULT_SETTINGS = {
  airtableKey: "",
  airtableBaseId: "",
};

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await getRouteAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await admin()
      .from("lead_magnet_user_settings")
      .select("settings")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      const { data: inserted, error: insertError } = await admin()
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
    return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await getRouteAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const settings = { ...DEFAULT_SETTINGS, ...(body?.settings ?? {}) };

    const { data, error } = await admin()
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
    return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
  }
}
