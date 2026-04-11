import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/leads/[id]/outreach
 *
 * Body:
 * {
 *   action: "generate" | "send"
 *   channel: "email" | "whatsapp" | "linkedin_dm"
 *   subject?: string            // pour email
 *   content?: string            // si action=send, le message final
 *   openrouterApiKey?: string   // clé client (sinon env)
 *   model?: string
 * }
 *
 * - action=generate : appelle OpenRouter, retourne { subject, content }
 * - action=send     : envoie via Resend (email) et stocke dans outreach_attempts
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action, channel = "email", subject, content, openrouterApiKey, model } = body;

    const supabase = await createClient();

    // Récupérer le lead
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead introuvable" }, { status: 404 });
    }

    // ── GENERATE ──────────────────────────────────────────────────────────────
    if (action === "generate") {
      const apiKey = openrouterApiKey || process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "Clé OpenRouter manquante" }, { status: 400 });
      }

      const usedModel = model || "openai/gpt-4o-mini";

      // Construire le contexte du lead
      const leadContext = [
        lead.name && `Nom : ${lead.name}`,
        lead.company && `Entreprise : ${lead.company}`,
        lead.sector && `Secteur : ${lead.sector}`,
        lead.email && `Email : ${lead.email}`,
        lead.phone && `Téléphone : ${lead.phone}`,
        lead.source && `Source : ${lead.source}`,
        lead.notes && `Notes : ${lead.notes}`,
        lead.metadata && Object.keys(lead.metadata).length > 0 &&
          `Données supplémentaires : ${JSON.stringify(lead.metadata)}`,
      ]
        .filter(Boolean)
        .join("\n");

      const channelInstructions: Record<string, string> = {
        email: "Rédige un email de prospection professionnel en français. Fournis OBJET: sur la première ligne, puis CORPS: suivi du corps de l'email.",
        whatsapp: "Rédige un message WhatsApp de prospection court et naturel en français (max 150 mots). Ton décontracté mais professionnel.",
        linkedin_dm: "Rédige un message de connexion LinkedIn en français (max 300 caractères). Très court, personnalisé, pas de blabla commercial.",
      };

      const systemPrompt = `Tu es un expert en prospection commerciale B2B pour une agence de marketing digital.
${channelInstructions[channel] || channelInstructions.email}

Personnalise le message en utilisant les informations du prospect. Sois concis, percutant et humain. Évite les formules génériques.
Termine toujours par une question ouverte ou un appel à l'action clair.`;

      const userPrompt = `Rédige un message de prospection pour ce prospect :\n\n${leadContext}`;

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://agenceflow.vercel.app",
        },
        body: JSON.stringify({
          model: usedModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 600,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        return NextResponse.json({ error: `OpenRouter: ${err}` }, { status: 500 });
      }

      const aiData = await response.json();
      const rawText: string = aiData.choices?.[0]?.message?.content ?? "";

      // Parser OBJET: / CORPS: pour les emails
      let parsedSubject = "";
      let parsedContent = rawText;

      if (channel === "email") {
        const subjectMatch = rawText.match(/OBJET\s*:\s*(.+)/i);
        const bodyMatch = rawText.match(/CORPS\s*:\s*([\s\S]+)/i);
        if (subjectMatch) parsedSubject = subjectMatch[1].trim();
        if (bodyMatch) parsedContent = bodyMatch[1].trim();
      }

      return NextResponse.json({
        subject: parsedSubject,
        content: parsedContent,
        model: usedModel,
      });
    }

    // ── SEND ──────────────────────────────────────────────────────────────────
    if (action === "send") {
      if (!content) {
        return NextResponse.json({ error: "Contenu manquant" }, { status: 400 });
      }

      let emailSent = false;
      let externalId: string | null = null;

      if (channel === "email" && lead.email) {
        const resendKey = process.env.RESEND_API_KEY;
        const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
        const fromName = "AgenceFlow";

        if (resendKey) {
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: `${fromName} <${fromEmail}>`,
              to: [lead.email],
              subject: subject || "Un message pour vous",
              text: content,
            }),
          });

          if (emailRes.ok) {
            const emailData = await emailRes.json();
            externalId = emailData.id ?? null;
            emailSent = true;
          }
        }
      }

      // Stocker dans outreach_attempts
      const { data: attempt, error: attemptError } = await supabase
        .from("outreach_attempts")
        .insert({
          lead_id: id,
          channel,
          subject: subject || null,
          content,
          status: emailSent ? "sent" : "pending",
          sent_at: emailSent ? new Date().toISOString() : null,
          external_id: externalId,
          model_used: body.model || null,
          prompt_context: {
            lead_source: lead.source,
            lead_sector: lead.sector,
            lead_company: lead.company,
          },
        })
        .select()
        .single();

      if (attemptError) throw attemptError;

      // Mettre à jour last_contact_at et statut du lead
      await supabase
        .from("leads")
        .update({
          last_contact_at: new Date().toISOString(),
          status: lead.status === "new" ? "contacted" : lead.status,
        })
        .eq("id", id);

      return NextResponse.json({
        attempt,
        emailSent,
        channel,
      });
    }

    return NextResponse.json({ error: "Action invalide (generate | send)" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
