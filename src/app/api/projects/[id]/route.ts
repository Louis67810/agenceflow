import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getMissingSchemaColumn } from "@/lib/supabase/postgrest";
import {
  addWasenderGroupParticipants,
  createWasenderGroup,
  getWasenderGroupInviteLink,
  normalizeWhatsappPhone,
} from "@/lib/whatsapp/wasender";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function selectProjectWithOptionalColumns(id: string, columns: string[]) {
  let currentColumns = [...columns];

  while (true) {
    if (currentColumns.length === 0) {
      return { data: {}, error: null, columns: currentColumns };
    }

    const { data, error } = await admin()
      .from("projects")
      .select(currentColumns.join(", "))
      .eq("id", id)
      .single();

    if (!error) return { data, error: null, columns: currentColumns };

    const missingColumn = getMissingSchemaColumn(error);
    if (!missingColumn || !currentColumns.includes(missingColumn)) {
      return { data: null, error, columns: currentColumns };
    }

    currentColumns = currentColumns.filter((column) => column !== missingColumn);
  }
}

async function updateProjectWithOptionalColumns(id: string, payload: Record<string, unknown>) {
  const updatePayload = { ...payload };

  while (true) {
    const { data, error } = await admin()
      .from("projects")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (!error) return { data, error: null };

    const missingColumn = getMissingSchemaColumn(error);
    if (!missingColumn || !(missingColumn in updatePayload)) {
      return { data: null, error };
    }

    delete updatePayload[missingColumn];
  }
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { data, error } = await admin()
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
    return NextResponse.json({ project: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // Handle stage advance: validate current stage and move to next
    if (body.action === "advance_stage") {
      const { data: project, error: fetchErr } = await admin()
        .from("projects")
        .select("stages, current_stage_index, status")
        .eq("id", id)
        .single();

      if (fetchErr || !project) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

      const stages = (project.stages ?? []) as { completed: boolean; completed_at: string | null }[];
      const idx = project.current_stage_index ?? 0;

      if (idx >= stages.length) return NextResponse.json({ error: "Toutes les étapes sont terminées" }, { status: 400 });

      // Mark current stage as completed
      stages[idx] = { ...stages[idx], completed: true, completed_at: new Date().toISOString() };
      const nextIdx = idx + 1;
      const isLast = nextIdx >= stages.length;

      const { data, error } = await admin()
        .from("projects")
        .update({
          stages,
          current_stage_index: nextIdx,
          status: isLast ? "completed" : "in_progress",
        })
        .eq("id", id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ project: data });
    }

    // WhatsApp activation: create or reuse the group only after the client submits a phone number.
    const { action: _action, ...updates } = body;

    if ("notif_whatsapp_phone" in updates && typeof updates.notif_whatsapp_phone === "string") {
      const phone = normalizeWhatsappPhone(updates.notif_whatsapp_phone);
      if (!phone) return NextResponse.json({ error: "Numero WhatsApp invalide" }, { status: 400 });

      const { data: project, error: projectError } = await selectProjectWithOptionalColumns(id, [
        "id",
        "name",
        "client_name",
        "whatsapp_group_jid",
        "whatsapp_group_name",
        "whatsapp_group_profile_url",
        "notif_whatsapp_group",
      ]);

      if (projectError || !project) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

      const projectRow = project as unknown as Record<string, unknown>;
      let groupJid = projectRow.whatsapp_group_jid as string | null;
      let inviteLink = projectRow.notif_whatsapp_group as string | null;
      let groupName = (projectRow.whatsapp_group_name as string | null) || (projectRow.name as string) || "Groupe projet";

      if (!groupJid) {
        const createdGroup = await createWasenderGroup({
          name: groupName,
          participants: [phone],
          profilePicUrl: projectRow.whatsapp_group_profile_url as string | null,
        });

        if (!createdGroup.ok) {
          return NextResponse.json({ error: createdGroup.error ?? "Creation du groupe WhatsApp impossible" }, { status: 502 });
        }
        if (!createdGroup.data?.id) {
          return NextResponse.json({ error: "Creation du groupe WhatsApp impossible" }, { status: 502 });
        }

        groupJid = createdGroup.data.id;
        groupName = createdGroup.data.subject ?? groupName;
        inviteLink = createdGroup.data.inviteLink ?? inviteLink;
      } else {
        const added = await addWasenderGroupParticipants(groupJid, [phone]);
        if (!added.ok) return NextResponse.json({ error: added.error ?? "Ajout WhatsApp impossible" }, { status: 502 });

        if (!inviteLink) {
          const invite = await getWasenderGroupInviteLink(groupJid);
          if (invite.ok) inviteLink = invite.inviteLink ?? inviteLink;
        }
      }

      const { data, error } = await updateProjectWithOptionalColumns(id, {
        notif_whatsapp_phone: phone,
        notif_whatsapp_enabled: true,
        notif_email_enabled: false,
        notif_slack_enabled: false,
        whatsapp_group_jid: groupJid,
        whatsapp_group_name: groupName,
        notif_whatsapp_group: inviteLink,
      });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ project: data });
    }

    const { data, error } = await admin()
      .from("projects")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ project: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
