import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRouteAuthenticatedUser } from "@/lib/supabase/route-client";
import { formatSupabaseError } from "@/lib/supabase/format-error";
import {
  readLeadMagnetAirtableSettingsByUserId,
  validateLeadMagnetAirtableConfig,
} from "@/lib/airtable/lead-magnet";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user } = await getRouteAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();
    const { data: magnet, error: magnetError } = await supabase
      .from("lead_magnets")
      .select("id, title, airtable_table_name, owner_user_id")
      .eq("id", id)
      .single();

    if (magnetError || !magnet) {
      return NextResponse.json({ error: "Lead magnet introuvable." }, { status: 404 });
    }

    const ownerUserId = magnet.owner_user_id ?? user.id;
    if (!magnet.owner_user_id) {
      const { error: updateError } = await supabase
        .from("lead_magnets")
        .update({ owner_user_id: ownerUserId })
        .eq("id", id);

      if (updateError) {
        throw updateError;
      }
    }

    const settings = await readLeadMagnetAirtableSettingsByUserId(ownerUserId);
    const result = await validateLeadMagnetAirtableConfig({
      settings,
    });
    result.logs = [
      `Utilisateur authentifie: ${user.id}`,
      `Owner du lead magnet: ${ownerUserId}`,
      `Owner identique a l'utilisateur courant: ${ownerUserId === user.id ? "oui" : "non"}`,
      ...result.logs,
    ];

    if (!result.ok && result.reason === "missing_settings") {
      return NextResponse.json(result, { status: 400 });
    }

    if (!result.ok) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
  }
}
