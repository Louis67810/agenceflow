import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { sendWasenderGroupMessage } from "@/lib/whatsapp/wasender";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("project_id");
    if (!projectId) return NextResponse.json({ error: "project_id requis" }, { status: 400 });

    const { data, error } = await admin()
      .from("stage_reviews")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ reviews: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { project_id, stage_index, stage_label, message, link_url, thumbnail_url } = await request.json();
    if (!project_id || stage_index === undefined || !stage_label) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
    }

    const { data, error } = await admin()
      .from("stage_reviews")
      .insert({
        id: crypto.randomUUID(),
        project_id,
        stage_index,
        stage_label,
        message: message ?? null,
        link_url: link_url ?? null,
        thumbnail_url: thumbnail_url ?? null,
        status: "pending",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: project } = await admin()
      .from("projects")
      .select("name, notif_whatsapp_enabled, whatsapp_group_jid")
      .eq("id", project_id)
      .maybeSingle();

    let notification: { ok: boolean; error?: string } | null = null;
    if (project?.notif_whatsapp_enabled && project.whatsapp_group_jid) {
      const text = [
        `Nouvelle demande a valider sur ${project.name ?? "votre projet"}.`,
        `Etape : ${stage_label}`,
        message ? `Message : ${message}` : null,
        link_url ? `Lien : ${link_url}` : null,
      ].filter(Boolean).join("\n\n");

      const sent = await sendWasenderGroupMessage(project.whatsapp_group_jid, text);
      notification = sent.ok ? { ok: true } : { ok: false, error: sent.error };
    }

    return NextResponse.json({ review: data, notification });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
