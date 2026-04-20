import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncLeadMagnetLeadToAirtable } from "@/lib/airtable/lead-magnet";

const EMAIL_KEYS = ["email", "mail", "e-mail", "courriel"];
const NAME_KEYS = ["firstname", "prenom", "prénom", "nom", "name", "first_name", "full_name"];
const PHONE_KEYS = ["phone", "telephone", "téléphone", "tel", "mobile", "phone_number"];
const COMPANY_KEYS = ["company", "entreprise", "societe", "société", "organization", "organisation"];
const SECTOR_KEYS = ["sector", "secteur", "industry", "industrie", "activite", "activité", "domaine"];

type LeadMagnetField = {
  id: string;
  type?: string;
  label?: string;
  placeholder?: string;
  key?: string;
};

type LeadMagnetStep = {
  id: string;
  fields?: LeadMagnetField[];
};

function findField(data: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const val = data[key] ?? data[key.toLowerCase()] ?? data[key.toUpperCase()];
    if (val && typeof val === "string") return val;
  }

  for (const [k, v] of Object.entries(data)) {
    if (keys.some((key) => k.toLowerCase().includes(key.toLowerCase())) && v && typeof v === "string") return v;
  }

  return "";
}

function flattenFields(steps: unknown): LeadMagnetField[] {
  if (!Array.isArray(steps)) return [];
  return (steps as LeadMagnetStep[]).flatMap((step) => (Array.isArray(step.fields) ? step.fields : []));
}

function getFieldValueFromDefinition(
  data: Record<string, unknown>,
  field?: LeadMagnetField | null
): string {
  if (!field?.key) return "";
  const value = data[field.key];
  return typeof value === "string" ? value : "";
}

function findFieldByType(data: Record<string, unknown>, steps: unknown, targetType: string): string {
  const field = flattenFields(steps).find((candidate) => candidate.type === targetType);
  return getFieldValueFromDefinition(data, field);
}

function findFieldByHints(data: Record<string, unknown>, steps: unknown, keys: string[]): string {
  const field = flattenFields(steps).find((candidate) => {
    const haystack = `${candidate.key || ""} ${candidate.label || ""} ${candidate.placeholder || ""}`.toLowerCase();
    return keys.some((key) => haystack.includes(key.toLowerCase()));
  });
  return getFieldValueFromDefinition(data, field);
}

export async function POST(req: NextRequest) {
  try {
    const { leadMagnetId, data: rawData } = await req.json();
    const data: Record<string, unknown> = rawData ?? {};
    const submittedAt = new Date().toISOString();

    if (!leadMagnetId || !data) {
      return NextResponse.json({ error: "leadMagnetId et data requis" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: magnet, error: fetchError } = await supabase
      .from("lead_magnets")
      .select("*")
      .eq("id", leadMagnetId)
      .single();

    if (fetchError || !magnet) {
      return NextResponse.json({ error: "Lead magnet introuvable" }, { status: 404 });
    }

    const email =
      findFieldByType(data, magnet.steps, "email")
      || findFieldByHints(data, magnet.steps, EMAIL_KEYS)
      || findField(data, EMAIL_KEYS);
    const name =
      findFieldByHints(data, magnet.steps, NAME_KEYS)
      || findField(data, NAME_KEYS);
    const phone =
      findFieldByType(data, magnet.steps, "phone")
      || findFieldByHints(data, magnet.steps, PHONE_KEYS)
      || findField(data, PHONE_KEYS);
    const company =
      findFieldByHints(data, magnet.steps, COMPANY_KEYS)
      || findField(data, COMPANY_KEYS);
    const sector =
      findFieldByHints(data, magnet.steps, SECTOR_KEYS)
      || findField(data, SECTOR_KEYS);

    const knownKeys = new Set([...EMAIL_KEYS, ...NAME_KEYS, ...PHONE_KEYS, ...COMPANY_KEYS, ...SECTOR_KEYS]);
    const extraFields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (!knownKeys.has(k.toLowerCase()) && v) {
        extraFields[k] = v;
      }
    }

    const { error: insertError } = await supabase
      .from("lead_magnet_leads")
      .insert({
        lead_magnet_id: leadMagnetId,
        data,
        email: email || null,
        created_at: submittedAt,
      });

    if (insertError) {
      console.error("Insert lead_magnet_lead error:", insertError);
    }

    let leadId: string | null = null;

    if (email) {
      const { data: existing } = await supabase
        .from("leads")
        .select("id, metadata")
        .eq("email", email)
        .maybeSingle();

      if (existing) {
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

    if (leadId) {
      triggerAutoAnalysis(supabase).catch(() => {});
    }

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

    try {
      await syncLeadMagnetLeadToAirtable({
        magnet,
        data,
        email,
        emailSent,
        createdAt: submittedAt,
      });
    } catch (airtableError) {
      console.error("Lead Magnet Airtable sync failed:", airtableError);
    }

    return NextResponse.json({
      success: true,
      emailSent,
      resourceUrl: magnet.resource_url,
      senderEmail: (process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev") && email
        ? (process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev")
        : null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function triggerAutoAnalysis(supabase: any) {
  try {
    const { data: configs } = await supabase
      .from("leads_config")
      .select("key, value")
      .in("key", ["analysis_threshold", "auto_analysis_enabled"]);

    const configMap: Record<string, string> = {};
    (configs ?? []).forEach((c: { key: string; value: string }) => {
      configMap[c.key] = c.value;
    });

    if (configMap["auto_analysis_enabled"] === "false") return;

    const threshold = parseInt(configMap["analysis_threshold"] ?? "10");

    const { data: lastRun } = await supabase
      .from("ai_analysis_runs")
      .select("triggered_at, total_leads")
      .order("triggered_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let query = supabase.from("leads").select("id", { count: "exact", head: true });
    if (lastRun?.triggered_at) {
      query = query.gt("created_at", lastRun.triggered_at);
    }
    const { count } = await query;

    if ((count ?? 0) >= threshold) {
      fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/leads/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto: true }),
      }).catch(() => {});
    }
  } catch {}
}
