import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/leads/sync
 * Importe tous les lead_magnet_leads existants dans la table leads centrale.
 * Déduplication par email — ne recrée pas les leads déjà présents.
 * Retourne { imported, skipped }.
 */
export async function POST() {
  try {
    const supabase = await createClient();

    // Récupérer tous les lead_magnet_leads avec les infos du magnet
    const { data: lmLeads, error } = await supabase
      .from("lead_magnet_leads")
      .select("*, lead_magnets(id, title, slug)")
      .order("created_at", { ascending: true });

    if (error) throw error;

    if (!lmLeads || lmLeads.length === 0) {
      return NextResponse.json({ imported: 0, skipped: 0, message: "Aucun lead magnet lead trouvé" });
    }

    // Récupérer les emails déjà dans leads
    const { data: existingLeads } = await supabase
      .from("leads")
      .select("email, source_ref");

    const existingEmails = new Set(
      (existingLeads ?? []).filter((l) => l.email).map((l) => l.email as string)
    );

    const toInsert = [];

    for (const lml of lmLeads) {
      const data = lml.data ?? {};
      const email: string = lml.email || data.email || data.mail || "";
      const name: string = data.firstname || data.prenom || data.nom || data.name || "";
      const phone: string = data.phone || data.telephone || data.tel || "";

      // Skip si email déjà connu
      if (email && existingEmails.has(email)) continue;
      if (email) existingEmails.add(email);

      const magnet = lml.lead_magnets as { id: string; title: string; slug: string } | null;

      toInsert.push({
        email: email || null,
        name: name || null,
        phone: phone || null,
        source: "lead_magnet",
        source_ref: lml.lead_magnet_id,
        channel_preference: "email",
        metadata: {
          ...data,
          lead_magnet_id: lml.lead_magnet_id,
          lead_magnet_title: magnet?.title ?? null,
          lead_magnet_slug: magnet?.slug ?? null,
          original_id: lml.id,
        },
        status: "new",
        created_at: lml.created_at,
      });
    }

    let imported = 0;
    if (toInsert.length > 0) {
      const { data: inserted, error: insertErr } = await supabase
        .from("leads")
        .insert(toInsert)
        .select("id");
      if (insertErr) throw insertErr;
      imported = inserted?.length ?? 0;
    }

    return NextResponse.json({
      imported,
      skipped: lmLeads.length - imported,
      total: lmLeads.length,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
