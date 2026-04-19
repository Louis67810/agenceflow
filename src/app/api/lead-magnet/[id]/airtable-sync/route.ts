import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRouteAuthenticatedUser } from "@/lib/supabase/route-client";
import { formatSupabaseError } from "@/lib/supabase/format-error";
import {
  pullLeadMagnetAirtableSummary,
  readLeadMagnetAirtableSettingsByUserId,
  syncLeadMagnetLeadsToAirtable,
} from "@/lib/airtable/lead-magnet";

type AirtableSyncRequest = {
  mode?: "push" | "pull";
};

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

    const body = (await req.json().catch(() => ({}))) as AirtableSyncRequest;
    const mode = body.mode ?? "push";

    const supabase = await createClient();

    const { data: magnet, error: magnetError } = await supabase
      .from("lead_magnets")
      .select("*")
      .eq("id", id)
      .single();

    if (magnetError || !magnet) {
      return NextResponse.json({ error: "Lead magnet introuvable." }, { status: 404 });
    }

    if (!magnet.owner_user_id) {
      const { error: updateError } = await supabase
        .from("lead_magnets")
        .update({ owner_user_id: user.id })
        .eq("id", id);

      if (updateError) throw updateError;
      magnet.owner_user_id = user.id;
    }

    const settings = await readLeadMagnetAirtableSettingsByUserId(magnet.owner_user_id);
    if (!settings.airtableKey || !settings.airtableBaseId || !magnet.airtable_table_name?.trim()) {
      return NextResponse.json(
        { error: "Configuration Airtable incomplete (cle, Base ID, nom de table)." },
        { status: 400 }
      );
    }

    if (mode === "pull") {
      const summary = await pullLeadMagnetAirtableSummary({
        settings,
        magnet,
      });

      return NextResponse.json(summary);
    }

    const { data: leads, error: leadsError } = await supabase
      .from("lead_magnet_leads")
      .select("id, data, email, email_sent, created_at")
      .eq("lead_magnet_id", id)
      .order("created_at", { ascending: false });

    if (leadsError) throw leadsError;

    const result = await syncLeadMagnetLeadsToAirtable({
      magnet,
      leads: (leads ?? []).map((lead) => ({
        id: lead.id,
        data: (lead.data as Record<string, unknown>) ?? {},
        email: lead.email ?? "",
        email_sent: Boolean(lead.email_sent),
        created_at: lead.created_at,
      })),
    });

    if (!result.synced) {
      if (result.reason === "missing_settings") {
        return NextResponse.json(
          { error: "Configuration Airtable incomplete (cle, Base ID)." },
          { status: 400 }
        );
      }

      if (result.reason === "missing_table") {
        return NextResponse.json(
          { error: "Configuration Airtable incomplete (nom de table)." },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Synchronisation Airtable ignoree: l'auto sync n'est pas active pour ce lead magnet." },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
  }
}
