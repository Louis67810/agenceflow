import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRouteAuthenticatedUser } from "@/lib/supabase/route-client";
import { formatSupabaseError } from "@/lib/supabase/format-error";
import { syncLeadMagnetLeadsToAirtable } from "@/lib/airtable/lead-magnet";

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

      if (updateError) {
        throw updateError;
      }

      magnet.owner_user_id = user.id;
    }

    const { data: leads, error: leadsError } = await supabase
      .from("lead_magnet_leads")
      .select("data, email, email_sent, created_at")
      .eq("lead_magnet_id", id)
      .order("created_at", { ascending: false });

    if (leadsError) {
      throw leadsError;
    }

    const result = await syncLeadMagnetLeadsToAirtable({
      magnet,
      leads: (leads ?? []).map((lead) => ({
        data: (lead.data as Record<string, unknown>) ?? {},
        email: lead.email ?? "",
        email_sent: Boolean(lead.email_sent),
        created_at: lead.created_at,
      })),
    });

    if (!result.synced) {
      if (result.reason === "missing_settings") {
        return NextResponse.json(
          { error: "Configuration Airtable incomplete. Renseignez le token et la base ID." },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "L'auto sync Airtable n'est pas active pour ce lead magnet." },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500 });
  }
}
