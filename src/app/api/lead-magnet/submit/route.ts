import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Champs connus pour normalisation (insensible à la casse + variantes FR/EN)
const EMAIL_KEYS = ["email", "mail", "e-mail", "courriel"];
const NAME_KEYS = ["firstname", "prenom", "prénom", "nom", "name", "first_name", "full_name"];
const PHONE_KEYS = ["phone", "telephone", "téléphone", "tel", "mobile", "phone_number"];
const COMPANY_KEYS = ["company", "entreprise", "societe", "société", "organization", "organisation"];
const SECTOR_KEYS = ["sector", "secteur", "industry", "industrie", "activite", "activité", "domaine"];

function findField(data: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const val = data[key] ?? data[key.toLowerCase()] ?? data[key.toUpperCase()];
    if (val && typeof val === "string") return val;
  }
  // Recherche partielle (ex: "secteur_activite" contient "secteur")
  for (const [k, v] of Object.entries(data)) {
    if (keys.some((key) => k.toLowerCase().includes(key.toLowerCase())) && v && typeof v === "string") return v;
  }
  return "";
}

function buildSegmentKey(source: string, channel: string, sector: string): string {
  return [source, channel, sector || "all"].join("|").toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const { leadMagnetId, data: rawData } = await req.json();
    const data: Record<string, unknown> = rawData ?? {};

    if (!leadMagnetId || !data) {
      return NextResponse.json({ error: "leadMagnetId et data requis" }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch lead magnet
    const { data: magnet, error: fetchError } = await supabase
      .from("lead_magnets")
      .select("*")
      .eq("id", leadMagnetId)
      .single();

    if (fetchError || !magnet) {
      return NextResponse.json({ error: "Lead magnet introuvable" }, { status: 404 });
    }

    // Normalisation des champs connus
    const email = findField(data, EMAIL_KEYS);
    const name = findField(data, NAME_KEYS);
    const phone = findField(data, PHONE_KEYS);
    const company = findField(data, COMPANY_KEYS);
    const sector = findField(data, SECTOR_KEYS);

    // Champs "extras" : tout ce qui n'est pas un champ connu
    const knownKeys = new Set([...EMAIL_KEYS, ...NAME_KEYS, ...PHONE_KEYS, ...COMPANY_KEYS, ...SECTOR_KEYS]);
    const extraFields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (!knownKeys.has(k.toLowerCase()) && v) {
        extraFields[k] = v;
      }
    }

    // Store lead in lead_magnet_leads
    const { error: insertError } = await supabase
      .from("lead_magnet_leads")
      .insert({
        lead_magnet_id: leadMagnetId,
        data,
        email: email || null,
      });

    if (insertError) {
      console.error("Insert lead_magnet_lead error:", insertError);
    }

    // Upsert dans la table centrale leads
    let leadId: string | null = null;

    if (email) {
      // Vérifier si ce lead existe déjà
      const { data: existing } = await supabase
        .from("leads")
        .select("id, metadata")
        .eq("email", email)
        .maybeSingle();

      if (existing) {
        // Mettre à jour les données manquantes
        const updatedMeta = {
          ...(existing.metadata ?? {}),
          ...extraFields,
          lead_magnet_title: magnet.title,
          lead_magnet_id: leadMagnetId,
        };
        await supabase.from("leads").update({
          name: name || undefined,
          phone: phone || undefined,
          company: company || undefined,
          sector: sector || undefined,
          metadata: updatedMeta,
        }).eq("id", existing.id);
        leadId = existing.id;
      } else {
        const { data: newLead } = await supabase.from("leads").insert({
          email,
          name: name || null,
          phone: phone || null,
          company: company || null,
          sector: sector || null,
          source: "lead_magnet",
          source_ref: leadMagnetId,
          channel_preference: "email",
          metadata: {
            lead_magnet_title: magnet.title,
            lead_magnet_id: leadMagnetId,
            ...extraFields,
          },
          status: "new",
        }).select("id").single();
        leadId = newLead?.id ?? null;
      }
    } else {
      // Pas d'email → on crée quand même avec les données disponibles
      const { data: newLead } = await supabase.from("leads").insert({
        name: name || null,
        phone: phone || null,
        company: company || null,
        sector: sector || null,
        source: "lead_magnet",
        source_ref: leadMagnetId,
        channel_preference: "email",
        metadata: {
          lead_magnet_title: magnet.title,
          lead_magnet_id: leadMagnetId,
          ...extraFields,
        },
        status: "new",
      }).select("id").single();
      leadId = newLead?.id ?? null;
    }

    // Vérifier si on doit déclencher une analyse IA automatique
    if (leadId) {
      triggerAutoAnalysis(supabase).catch(() => {});
    }

    // Send email via Resend
    let emailSent = false;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (resendApiKey && email) {
      const rawBody: string = magnet.email_body || "";
      const htmlBody = rawBody
        .replace(/\{\{firstname\}\}/g, name || "vous")
        .replace(/\{\{resource_link\}\}/g, magnet.resource_url || "");

      const rawSubject: string = magnet.email_subject || "Votre ressource";
      const subject = rawSubject.replace(/\{\{firstname\}\}/g, name || "vous");

      const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
      const fromName = magnet.from_name || "AgenceFlow";

      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${fromName} <${fromEmail}>`,
            to: email,
            subject,
            html: htmlBody,
          }),
        });

        if (emailRes.ok) {
          emailSent = true;
          await supabase
            .from("lead_magnet_leads")
            .update({ email_sent: true })
            .eq("lead_magnet_id", leadMagnetId)
            .eq("email", email)
            .order("created_at", { ascending: false })
            .limit(1);
        } else {
          console.error("Resend error:", await emailRes.text());
        }
      } catch (emailErr) {
        console.error("Email send failed:", emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      emailSent,
      resourceUrl: magnet.resource_url,
      senderEmail: resendApiKey && email ? (process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev") : null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Vérifie si le seuil est atteint et déclenche une analyse en arrière-plan
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function triggerAutoAnalysis(supabase: any) {
  try {
    // Récupérer la config
    const { data: configs } = await supabase
      .from("leads_config")
      .select("key, value")
      .in("key", ["analysis_threshold", "auto_analysis_enabled"]);

    const configMap: Record<string, string> = {};
    (configs ?? []).forEach((c: { key: string; value: string }) => { configMap[c.key] = c.value; });

    if (configMap["auto_analysis_enabled"] === "false") return;

    const threshold = parseInt(configMap["analysis_threshold"] ?? "10");

    // Dernier run
    const { data: lastRun } = await supabase
      .from("ai_analysis_runs")
      .select("triggered_at, total_leads")
      .order("triggered_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Compter les leads depuis le dernier run
    let query = supabase.from("leads").select("id", { count: "exact", head: true });
    if (lastRun?.triggered_at) {
      query = query.gt("created_at", lastRun.triggered_at);
    }
    const { count } = await query;

    if ((count ?? 0) >= threshold) {
      // Déclencher l'analyse sans attendre (fire and forget)
      fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/leads/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto: true }),
      }).catch(() => {});
    }
  } catch {}
}
