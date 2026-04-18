import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_LINKEDIN_WORKSPACE,
  type LinkedInWorkspacePatch,
  normalizeLinkedInWorkspaceData,
} from "@/lib/linkedin/workspace";
import type { LinkedInWorkspaceData } from "@/types/linkedin";

async function getAuthenticatedUser() {
  return getAuthenticatedUserFromRequest();
}

async function getAuthenticatedUserFromRequest(req?: Request) {
  const supabase = await createClient();
  const token = req?.headers.get("Authorization")?.replace("Bearer ", "");
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token ?? undefined);
  if (error || !user) return { supabase, user: null };
  return { supabase, user };
}

export async function GET(req: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("linkedin_user_workspace")
      .select("data")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      workspace: normalizeLinkedInWorkspaceData(
        (data?.data as Partial<LinkedInWorkspaceData> | null) ?? DEFAULT_LINKEDIN_WORKSPACE
      ),
      hasStoredData: Boolean(data?.data),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { supabase, user } = await getAuthenticatedUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as { patch?: LinkedInWorkspacePatch };

    const { data: existing, error: fetchError } = await supabase
      .from("linkedin_user_workspace")
      .select("data")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const current = normalizeLinkedInWorkspaceData(
      (existing?.data as Partial<LinkedInWorkspaceData> | null) ?? DEFAULT_LINKEDIN_WORKSPACE
    );

    const workspace = normalizeLinkedInWorkspaceData({
      ...current,
      ...(body.patch ?? {}),
      preferences: {
        ...current.preferences,
        ...(body.patch?.preferences ?? {}),
      },
    });

    const { data, error } = await supabase
      .from("linkedin_user_workspace")
      .upsert(
        {
          user_id: user.id,
          data: workspace,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select("data")
      .single();

    if (error) throw error;

    return NextResponse.json({
      workspace: normalizeLinkedInWorkspaceData(data.data as Partial<LinkedInWorkspaceData>),
      hasStoredData: true,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
