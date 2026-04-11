import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/leads/template?leadId=xxx&channel=email
 *
 * Sélectionne le meilleur template pour un lead donné via ε-greedy :
 * - 80% exploitation : meilleur score pour ce segment
 * - 20% exploration : template peu testé (< minSamples)
 *
 * Puis reformule légèrement le contenu avec les variables du lead.
 *
 * Returns: { template, adapted: { subject, content } }
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get("leadId");
    const channel = searchParams.get("channel") ?? "email";
    const openrouterApiKey = searchParams.get("openrouterApiKey") || process.env.OPENROUTER_API_KEY;
    const model = searchParams.get("model") || "openai/gpt-4o-mini";

    if (!leadId) {
      return NextResponse.json({ error: "leadId requis" }, { status: 400 });
    }

    const supabase = await createClient();

    // ── Récupérer le lead ─────────────────────────────────────────────────────
    const { data: lead } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (!lead) {
      return NextResponse.json({ error: "Lead introuvable" }, { status: 404 });
    }

    // ── Récupérer la config ───────────────────────────────────────────────────
    const { data: configs } = await supabase
      .from("leads_config")
      .select("key, value");
    const cfg: Record<string, string> = {};
    (configs ?? []).forEach((c: { key: string; value: string }) => { cfg[c.key] = c.value; });

    const minSamples = parseInt(cfg["min_sample_size"] ?? "5");
    const explorationRate = parseFloat(cfg["exploration_rate"] ?? "0.20");

    // ── Trouver les templates compatibles ─────────────────────────────────────
    // Ordre de préférence des segments : source+secteur > source only > secteur only > global
    const { data: allTemplates } = await supabase
      .from("message_templates")
      .select("*")
      .eq("channel", channel)
      .eq("active", true)
      .eq("deprecated", false);

    if (!allTemplates || allTemplates.length === 0) {
      return NextResponse.json({ error: "Aucun template disponible. Lancez d'abord une analyse IA.", noTemplates: true });
    }

    const leadSource = lead.source ?? "all";
    const leadSector = (lead.sector ?? "").toLowerCase();

    // Score de matching : plus c'est spécifique, plus c'est pertinent
    function matchScore(t: Record<string, string | null>): number {
      let score = 0;
      const srcMatch = !t.source_filter || t.source_filter === leadSource;
      const sectorMatch = !t.sector_filter || t.sector_filter.toLowerCase() === leadSector;
      if (!srcMatch || !sectorMatch) return -1; // incompatible
      if (t.source_filter) score += 2;
      if (t.sector_filter) score += 2;
      return score;
    }

    const compatible = allTemplates
      .map((t) => ({ ...t, _matchScore: matchScore(t) }))
      .filter((t) => t._matchScore >= 0)
      .sort((a, b) => b._matchScore - a._matchScore);

    if (compatible.length === 0) {
      return NextResponse.json({ error: "Aucun template compatible pour ce lead.", noTemplates: true });
    }

    // ── Sélection ε-greedy ────────────────────────────────────────────────────
    const reliable = compatible.filter((t) => t.sent_count >= minSamples);
    const fresh = compatible.filter((t) => t.sent_count < minSamples);

    let selectedTemplate: typeof compatible[0];

    const rand = Math.random();

    if (fresh.length > 0 && (rand < explorationRate || reliable.length === 0)) {
      // Exploration : template peu testé, préférer les plus récents
      selectedTemplate = fresh.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
    } else {
      // Exploitation : meilleur score parmi les fiables (ou fallback sur compatible)
      const pool = reliable.length > 0 ? reliable : compatible;
      selectedTemplate = pool.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    }

    // ── Remplacer les variables simples ───────────────────────────────────────
    function replaceVars(text: string): string {
      return text
        .replace(/\{\{name\}\}/gi, lead.name || "")
        .replace(/\{\{company\}\}/gi, lead.company || "")
        .replace(/\{\{sector\}\}/gi, lead.sector || "")
        .replace(/\{\{source\}\}/gi, lead.source || "")
        .replace(/\{\{email\}\}/gi, lead.email || "");
    }

    const baseSubject = selectedTemplate.subject ? replaceVars(selectedTemplate.subject) : null;
    const baseContent = replaceVars(selectedTemplate.content);

    // ── Reformulation légère si des infos lead sont disponibles ──────────────
    // (seulement si on a des infos spécifiques au lead, sinon on retourne le template brut)
    const hasSpecificInfo = lead.name || lead.company || lead.sector;
    let adaptedSubject = baseSubject;
    let adaptedContent = baseContent;

    if (hasSpecificInfo && openrouterApiKey) {
      const leadContext = [
        lead.name && `Prénom/Nom : ${lead.name}`,
        lead.company && `Entreprise : ${lead.company}`,
        lead.sector && `Secteur : ${lead.sector}`,
        lead.notes && `Notes : ${lead.notes}`,
      ].filter(Boolean).join("\n");

      const reformulationPrompt = `Tu es un expert en prospection. Adapte légèrement ce message de base pour le rendre plus naturel et personnalisé pour ce prospect spécifique.

RÈGLES STRICTES :
- Change SEULEMENT les détails pour les rendre plus naturels (ex: si secteur = "tech", écris "dans le secteur tech" de façon naturelle)
- Garde la même structure et le même ton
- MAX 10% de modification — c'est une adaptation mineure, pas une réécriture
- Si le message est déjà bien personnalisé, retourne-le tel quel
- Retourne uniquement le message final, sans commentaire

PROSPECT :
${leadContext}

MESSAGE À ADAPTER :
${baseContent}`;

      try {
        const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openrouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://agenceflow.vercel.app",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: reformulationPrompt }],
            temperature: 0.3,
            max_tokens: 400,
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          adaptedContent = aiData.choices?.[0]?.message?.content?.trim() ?? baseContent;
        }
      } catch {
        // Fallback silencieux sur le template brut
      }
    }

    return NextResponse.json({
      template: {
        id: selectedTemplate.id,
        variant_label: selectedTemplate.variant_label,
        sent_count: selectedTemplate.sent_count,
        score: selectedTemplate.score,
        is_exploration: selectedTemplate.sent_count < minSamples,
        ai_hypothesis: selectedTemplate.ai_hypothesis,
      },
      adapted: {
        subject: adaptedSubject,
        content: adaptedContent,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * POST /api/leads/template/[templateId]/track
 * Incrémenter sent_count, open_count ou reply_count sur un template
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { templateId, event } = body; // event: 'sent' | 'opened' | 'replied'

    if (!templateId || !event) {
      return NextResponse.json({ error: "templateId et event requis" }, { status: 400 });
    }

    const supabase = await createClient();

    const field = event === "sent" ? "sent_count" : event === "opened" ? "open_count" : "reply_count";

    // Incrémenter atomiquement via RPC ou update
    const { data: current } = await supabase
      .from("message_templates")
      .select("sent_count, open_count, reply_count")
      .eq("id", templateId)
      .single();

    if (!current) return NextResponse.json({ error: "Template introuvable" }, { status: 404 });

    await supabase.from("message_templates").update({
      [field]: (current[field as keyof typeof current] as number) + 1,
    }).eq("id", templateId);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
