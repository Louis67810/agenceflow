import { NextRequest, NextResponse } from "next/server";
import { formatSupabaseError } from "@/lib/supabase/format-error";
import { getRouteAuthenticatedUser } from "@/lib/supabase/route-client";

type DiagnosticSection = {
  ok: boolean;
  error?: string;
  details?: Record<string, unknown>;
};

export async function GET(req: NextRequest) {
  try {
    const { supabase, user, authSource } = await getRouteAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          auth: {
            ok: false,
            error: "Unauthorized",
          },
          message: "Utilisateur non authentifie pour les routes LinkedIn.",
        },
        { status: 401 }
      );
    }

    const sections: Record<string, DiagnosticSection> = {};

    try {
      const { data, error } = await supabase
        .from("linkedin_user_settings")
        .select("updated_at, settings")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      sections.settings = {
        ok: Boolean(data),
        error: data ? undefined : "Aucune ligne linkedin_user_settings pour cet utilisateur.",
        details: {
          has_row: Boolean(data),
          updated_at: data?.updated_at ?? null,
          has_airtable_key: Boolean(data?.settings?.airtableKey),
          has_airtable_base: Boolean(data?.settings?.airtableBaseId),
          has_airtable_table: Boolean(data?.settings?.airtableTableName),
          airtable_auto_sync: Boolean(data?.settings?.airtableAutoSync),
        },
      };
    } catch (error) {
      sections.settings = {
        ok: false,
        error: formatSupabaseError(error),
      };
    }

    try {
      const { data, error } = await supabase
        .from("linkedin_user_workspace")
        .select("updated_at, data")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      const workspace = (data?.data ?? {}) as {
        prospects?: unknown[];
        skeletons?: unknown[];
        ideas?: unknown[];
        styles?: unknown[];
        preferences?: Record<string, unknown>;
      };

      sections.workspace = {
        ok: Boolean(data),
        error: data ? undefined : "Aucune ligne linkedin_user_workspace pour cet utilisateur.",
        details: {
          has_row: Boolean(data),
          updated_at: data?.updated_at ?? null,
          prospects_count: Array.isArray(workspace.prospects) ? workspace.prospects.length : 0,
          skeletons_count: Array.isArray(workspace.skeletons) ? workspace.skeletons.length : 0,
          ideas_count: Array.isArray(workspace.ideas) ? workspace.ideas.length : 0,
          styles_count: Array.isArray(workspace.styles) ? workspace.styles.length : 0,
          preferences: workspace.preferences ?? {},
        },
      };
    } catch (error) {
      sections.workspace = {
        ok: false,
        error: formatSupabaseError(error),
      };
    }

    try {
      const { count, error } = await supabase
        .from("linkedin_posts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (error) throw error;

      const { data: latestPosts, error: latestError } = await supabase
        .from("linkedin_posts")
        .select("client_post_id, status, updated_at, published_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(5);

      if (latestError) throw latestError;

      sections.posts = {
        ok: true,
        details: {
          posts_count: count ?? 0,
          latest_posts: latestPosts ?? [],
        },
      };
    } catch (error) {
      sections.posts = {
        ok: false,
        error: formatSupabaseError(error),
      };
    }

    try {
      const { count, error } = await supabase
        .from("linkedin_style_examples")
        .select("id", { count: "exact", head: true });

      if (error) throw error;

      sections.style_examples = {
        ok: true,
        details: {
          count: count ?? 0,
        },
      };
    } catch (error) {
      sections.style_examples = {
        ok: false,
        error: formatSupabaseError(error),
      };
    }

    return NextResponse.json({
      ok: Object.values(sections).every((section) => section.ok),
      auth: {
        ok: true,
        user_id: user.id,
        email: user.email ?? null,
        source: authSource,
      },
      prospection_ready: Boolean(sections.settings?.ok && sections.workspace?.ok),
      statistics_ready: Boolean(sections.posts?.ok),
      sections,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: formatSupabaseError(error),
      },
      { status: 500 }
    );
  }
}
