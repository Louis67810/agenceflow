import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/leads/analyze
 * Lance une analyse IA des leads et génère des templates de messages A/B.
 *
 * Body (optionnel):
 * {
 *   openrouterApiKey?: string,
 *   model?: string,
 *   auto?: boolean  (true si déclenché automatiquement)
 * }
 */
export async function POST(req: NextRequest) {
  let runId: string | null = null;
  const supabase = await createClient();

  try {
    const body = await req.json().catch(() => ({}));
    const { openrouterApiKey, model, auto = false } = body;

    const apiKey = openrouterApiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Clé OpenRouter manquante" }, { status: 400 });
    }

    const usedModel = model || "openai/gpt-4o-mini";

    // ── Récupérer la config ───────────────────────────────────────────────────
    const { data: configs } = await supabase
      .from("leads_config")
      .select("key, value");
    const cfg: Record<string, string> = {};
    (configs ?? []).forEach((c: { key: string; value: string }) => { cfg[c.key] = c.value; });

    const threshold = parseInt(cfg["analysis_threshold"] ?? "10");
    const minSamples = parseInt(cfg["min_sample_size"] ?? "5");

    // ── Créer le run en cours ─────────────────────────────────────────────────
    const { data: run } = await supabase
      .from("ai_analysis_runs")
      .insert({ status: "running", threshold_config: threshold, model_used: usedModel })
      .select("id")
      .single();
    runId = run?.id ?? null;

    // ── Collecter les données ─────────────────────────────────────────────────
    const [{ data: leads, count: leadCount }, { data: attempts, count: attemptCount }] = await Promise.all([
      supabase.from("leads").select("id, source, sector, status, channel_preference, created_at", { count: "exact" }),
      supabase.from("outreach_attempts").select("id, lead_id, channel, status, created_at", { count: "exact" }),
    ]);

    const allLeads = leads ?? [];
    const allAttempts = attempts ?? [];

    // ── Calculer les perfs actuelles par segment ──────────────────────────────
    type SegmentPerf = { sent: number; opened: number; replied: number };
    const segmentPerf: Record<string, SegmentPerf> = {};

    for (const attempt of allAttempts) {
      const lead = allLeads.find((l) => l.id === attempt.lead_id);
      const source = lead?.source ?? "unknown";
      const sector = lead?.sector ?? "all";
      const key = `${source}|${attempt.channel}|${sector.toLowerCase()}`;

      if (!segmentPerf[key]) segmentPerf[key] = { sent: 0, opened: 0, replied: 0 };
      if (attempt.status !== "pending") segmentPerf[key].sent++;
      if (["opened", "clicked", "responded"].includes(attempt.status)) segmentPerf[key].opened++;
      if (attempt.status === "responded") segmentPerf[key].replied++;
    }

    // ── Récupérer les templates existants et leurs perfs ─────────────────────
    const { data: existingTemplates } = await supabase
      .from("message_templates")
      .select("*")
      .eq("active", true)
      .eq("deprecated", false);

    // ── Contexte pour l'IA ────────────────────────────────────────────────────
    const statusSummary: Record<string, number> = {};
    const sourceSummary: Record<string, number> = {};
    const sectorSummary: Record<string, number> = {};

    for (const l of allLeads) {
      statusSummary[l.status] = (statusSummary[l.status] ?? 0) + 1;
      sourceSummary[l.source] = (sourceSummary[l.source] ?? 0) + 1;
      const s = l.sector || "Non renseigné";
      sectorSummary[s] = (sectorSummary[s] ?? 0) + 1;
    }

    const topSegments = Object.entries(segmentPerf)
      .filter(([, p]) => p.sent >= minSamples)
      .sort((a, b) => (b[1].replied / b[1].sent) - (a[1].replied / a[1].sent))
      .slice(0, 5)
      .map(([key, p]) => ({
        segment: key,
        sent: p.sent,
        replyRate: p.sent > 0 ? Math.round((p.replied / p.sent) * 100) : 0,
      }));

    const worstSegments = Object.entries(segmentPerf)
      .filter(([, p]) => p.sent >= minSamples)
      .sort((a, b) => (a[1].replied / a[1].sent) - (b[1].replied / b[1].sent))
      .slice(0, 3)
      .map(([key, p]) => ({
        segment: key,
        sent: p.sent,
        replyRate: p.sent > 0 ? Math.round((p.replied / p.sent) * 100) : 0,
      }));

    const existingTemplatesSummary = (existingTemplates ?? []).slice(0, 10).map((t) => ({
      segment: t.segment_key,
      channel: t.channel,
      sent: t.sent_count,
      score: t.score,
      variant: t.variant_label,
      subject: t.subject?.slice(0, 60),
      content_preview: t.content?.slice(0, 100),
    }));

    // Secteurs uniques pour générer des templates ciblés
    const uniqueSectors = Object.keys(sectorSummary).filter((s) => s !== "Non renseigné").slice(0, 5);
    const uniqueSources = Object.keys(sourceSummary);

    // ── Prompt IA ──────────────────────────────────────────────────────────────
    const systemPrompt = `Tu es un expert en prospection commerciale B2B et en optimisation de taux de réponse.
Tu analyses les données CRM d'une agence de marketing digital et génères des templates de messages de prospection.

Règles importantes :
- Génère des messages COURTS, personnalisés, humains (pas de blabla commercial)
- Utilise les variables : {{name}}, {{company}}, {{sector}}, {{source}} dans les messages
- Pour chaque segment prioritaire, génère 2-3 variantes (A/B/C) avec des approches différentes
- Formule des HYPOTHÈSES claires sur pourquoi certains messages fonctionnent mieux
- Concentre-toi sur les segments avec le plus de leads (ROI maximal)
- Pour les emails : max 120 mots. Pour LinkedIn DM : max 300 caractères. Pour WhatsApp : max 80 mots.

Format de réponse JSON strict :
{
  "insights": "3-4 phrases résumant ce que tu observes dans les données",
  "hypotheses": "2-3 hypothèses sur ce qui pourrait améliorer les taux",
  "templates": [
    {
      "source_filter": "lead_magnet|linkedin|google_maps|null",
      "channel": "email|whatsapp|linkedin_dm",
      "sector_filter": "Marketing|Tech|null",
      "variant_label": "A",
      "subject": "Objet email (null pour DM)",
      "content": "Corps du message avec {{name}}, {{company}}, {{sector}}",
      "hypothesis": "Pourquoi cette approche devrait fonctionner"
    }
  ]
}`;

    const userPrompt = `Données CRM actuelles :

RÉSUMÉ :
- ${leadCount} leads au total
- ${attemptCount} messages envoyés

RÉPARTITION STATUTS : ${JSON.stringify(statusSummary)}
RÉPARTITION SOURCES : ${JSON.stringify(sourceSummary)}
RÉPARTITION SECTEURS : ${JSON.stringify(sectorSummary)}

TOP SEGMENTS (meilleur taux de réponse, min ${minSamples} envois) :
${JSON.stringify(topSegments, null, 2)}

SEGMENTS LES PLUS FAIBLES :
${JSON.stringify(worstSegments, null, 2)}

TEMPLATES EXISTANTS (performance actuelle) :
${JSON.stringify(existingTemplatesSummary, null, 2)}

SECTEURS PRINCIPAUX : ${uniqueSectors.join(", ") || "Non encore renseignés"}
SOURCES ACTIVES : ${uniqueSources.join(", ")}

Génère des templates optimisés. Priorité :
1. Segments avec beaucoup de leads mais peu de messages envoyés (opportunités)
2. Segments avec faible taux de réponse (à améliorer)
3. Nouvelles variantes pour les segments qui fonctionnent (capitaliser)

Génère minimum 4 et maximum 8 templates au total.`;

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      throw new Error(`OpenRouter error: ${await aiRes.text()}`);
    }

    const aiData = await aiRes.json();
    const rawText: string = aiData.choices?.[0]?.message?.content ?? "{}";

    let parsed: {
      insights?: string;
      hypotheses?: string;
      templates?: {
        source_filter?: string;
        channel: string;
        sector_filter?: string;
        variant_label?: string;
        subject?: string;
        content: string;
        hypothesis?: string;
      }[];
    } = {};

    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error("L'IA n'a pas retourné un JSON valide");
    }

    // ── Insérer les templates ─────────────────────────────────────────────────
    const variantGroup = crypto.randomUUID();
    const templatesToInsert = (parsed.templates ?? []).map((t) => ({
      source_filter: t.source_filter && t.source_filter !== "null" ? t.source_filter : null,
      channel: t.channel ?? "email",
      sector_filter: t.sector_filter && t.sector_filter !== "null" ? t.sector_filter : null,
      status_filter: null,
      segment_key: [
        t.source_filter && t.source_filter !== "null" ? t.source_filter : "all",
        t.channel ?? "email",
        t.sector_filter && t.sector_filter !== "null" ? t.sector_filter.toLowerCase() : "all",
      ].join("|"),
      subject: t.subject ?? null,
      content: t.content,
      variant_group: variantGroup,
      variant_label: t.variant_label ?? "A",
      ai_hypothesis: t.hypothesis ?? null,
      created_by_run: runId,
      active: true,
      deprecated: false,
    }));

    let templatesCreated = 0;
    if (templatesToInsert.length > 0) {
      const { data: inserted } = await supabase
        .from("message_templates")
        .insert(templatesToInsert)
        .select("id");
      templatesCreated = inserted?.length ?? 0;
    }

    // ── Marquer les anciens templates du même segment comme deprecated si peu performants ──
    // (garder les templates avec score > 0.3 ou < minSamples envois)
    if (existingTemplates && existingTemplates.length > 0) {
      const toDeprecate = existingTemplates
        .filter((t) => t.sent_count >= minSamples * 3 && t.score < 0.1)
        .map((t) => t.id);

      if (toDeprecate.length > 0) {
        await supabase
          .from("message_templates")
          .update({ deprecated: true, active: false })
          .in("id", toDeprecate);
      }
    }

    // ── Mettre à jour le run ──────────────────────────────────────────────────
    await supabase.from("ai_analysis_runs").update({
      status: "completed",
      total_leads: leadCount ?? 0,
      total_attempts: attemptCount ?? 0,
      new_data_since_last: leadCount ?? 0,
      insights: parsed.insights ?? null,
      hypotheses: parsed.hypotheses ?? null,
      templates_created: templatesCreated,
    }).eq("id", runId);

    return NextResponse.json({
      success: true,
      runId,
      insights: parsed.insights,
      hypotheses: parsed.hypotheses,
      templatesCreated,
      auto,
    });
  } catch (e) {
    if (runId) {
      const supabase2 = await createClient();
      await supabase2.from("ai_analysis_runs").update({
        status: "failed",
        error: String(e),
      }).eq("id", runId);
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
