import { NextRequest, NextResponse } from "next/server";
import {
  normalizeArticleConnection,
  normalizeArticleSettings,
} from "@/lib/articles/settings";
import { formatSupabaseError } from "@/lib/supabase/format-error";
import { getRouteAuthenticatedUser } from "@/lib/supabase/route-client";

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await getRouteAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("article_user_settings")
      .select("settings, connection")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      const settings = normalizeArticleSettings();
      const connection = normalizeArticleConnection();
      const { data: inserted, error: insertError } = await supabase
        .from("article_user_settings")
        .upsert(
          {
            user_id: user.id,
            settings,
            connection,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )
        .select("settings, connection")
        .single();

      if (insertError) throw insertError;
      return NextResponse.json({
        settings: normalizeArticleSettings(inserted?.settings ?? null),
        connection: normalizeArticleConnection(inserted?.connection ?? null),
        bootstrapped: true,
      });
    }

    return NextResponse.json({
      settings: normalizeArticleSettings(data.settings ?? null),
      connection: normalizeArticleConnection(data.connection ?? null),
    });
  } catch (error) {
    return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await getRouteAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const incomingSettings = body?.settings ? normalizeArticleSettings(body.settings) : undefined;
    const incomingConnection = body?.connection ? normalizeArticleConnection(body.connection) : undefined;

    const { data: existing, error: fetchError } = await supabase
      .from("article_user_settings")
      .select("settings, connection")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const settings = incomingSettings ?? normalizeArticleSettings(existing?.settings ?? null);
    const connection = incomingConnection ?? normalizeArticleConnection(existing?.connection ?? null);

    const { data, error } = await supabase
      .from("article_user_settings")
      .upsert(
        {
          user_id: user.id,
          settings,
          connection,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select("settings, connection")
      .single();

    if (error) throw error;

    return NextResponse.json({
      settings: normalizeArticleSettings(data?.settings ?? null),
      connection: normalizeArticleConnection(data?.connection ?? null),
    });
  } catch (error) {
    return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
  }
}
