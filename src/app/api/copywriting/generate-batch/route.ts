import { NextRequest, NextResponse } from "next/server";

interface SectionRequest {
  id: string;
  type: string;
  notes?: string;
  element_count?: number;
  ai_instruction?: string;
  existing_content?: string;
}

interface BatchRequest {
  sections: SectionRequest[];
  language: string;
  form_data?: Record<string, unknown> | null;
  custom_prompts?: Record<string, string>;
}

const DEFAULT_PROMPTS: Record<string, string> = {
  Hero: "Écris un titre accrocheur et un sous-titre percutant pour la section Hero du site. Inclus un appel à l'action principal.",
  "À propos": "Rédige un texte de présentation de l'entreprise, ses valeurs et sa mission.",
  Services: "Décris les services proposés avec leurs bénéfices clés pour le client.",
  Réalisations: "Rédige des descriptions courtes pour les projets/réalisations mis en avant.",
  Cible: "Décris le profil du client idéal et ses problématiques principales.",
  Processus: "Explique le processus de travail étape par étape, de façon claire et rassurante.",
  FAQ: "Génère les questions fréquentes avec leurs réponses.",
  Équipe: "Présente les membres de l'équipe avec leurs rôles et expertises.",
  Fonctionnalités: "Liste les fonctionnalités principales du produit/service avec leurs bénéfices.",
  Problématiques: "Identifie et décris les problèmes que rencontrent les clients cibles.",
  Témoignages: "Génère des témoignages clients réalistes et convaincants.",
  Avantages: "Mets en avant les avantages concurrentiels et différenciateurs.",
  Tarifs: "Rédige les descriptions et argumentaires pour chaque offre tarifaire.",
  "CTA Principal": "Crée un call-to-action percutant avec titre, sous-titre et bouton.",
  "Chiffres clés": "Génère des chiffres clés et statistiques impactantes avec leurs libellés.",
  Comparatif: "Crée un comparatif clair entre les différentes offres ou par rapport à la concurrence.",
  Contact: "Rédige le texte d'invitation au contact avec les informations clés.",
};

function buildSectionPromptFormat(type: string): string {
  switch (type) {
    case "Hero":
      return "Keys: TITLE, SUBTITLE, BODY (1-2 lines), BUTTON_TEXT";
    case "À propos":
      return "Keys: TITLE, BODY (3-4 lines of presentation text)";
    case "Services":
    case "Fonctionnalités":
    case "Avantages":
    case "Problématiques":
      return "Keys: TITLE, ITEM_1_TITLE, ITEM_1_DESC, ITEM_2_TITLE, ITEM_2_DESC, ... (repeat for each item)";
    case "Réalisations":
      return "Keys: TITLE, ITEM_1_TITLE, ITEM_1_DESC, ITEM_2_TITLE, ITEM_2_DESC, ... (repeat for each item)";
    case "Processus":
      return "Keys: TITLE, ITEM_1_TITLE, ITEM_1_DESC, ITEM_2_TITLE, ITEM_2_DESC, ... (steps in order)";
    case "FAQ":
      return "Keys: TITLE, ITEM_1_QUESTION, ITEM_1_ANSWER, ITEM_2_QUESTION, ITEM_2_ANSWER, ... (repeat for each Q&A)";
    case "Équipe":
      return "Keys: TITLE, ITEM_1_NAME, ITEM_1_ROLE, ITEM_1_BIO, ITEM_2_NAME, ITEM_2_ROLE, ITEM_2_BIO, ... (repeat per member)";
    case "Témoignages":
      return "Keys: TITLE, ITEM_1_QUOTE, ITEM_1_NAME, ITEM_1_ROLE, ITEM_2_QUOTE, ITEM_2_NAME, ITEM_2_ROLE, ... (repeat per testimonial)";
    case "Tarifs":
      return "Keys: TITLE, ITEM_1_NAME, ITEM_1_PRICE, ITEM_1_FEATURES (semicolon-separated list), ITEM_1_CTA, ITEM_2_NAME, ... (repeat per plan)";
    case "CTA Principal":
      return "Keys: TITLE, SUBTITLE, BUTTON_TEXT";
    case "Chiffres clés":
      return "Keys: TITLE, ITEM_1_NUMBER, ITEM_1_LABEL, ITEM_2_NUMBER, ITEM_2_LABEL, ... (repeat per stat)";
    case "Comparatif":
      return "Keys: TITLE, ITEM_1_FEATURE, ITEM_1_COL1 (✓ or ✗ or text), ITEM_1_COL2, ITEM_2_FEATURE, ... (repeat per row)";
    case "Cible":
      return "Keys: TITLE, SUBTITLE, ITEM_1_TITLE, ITEM_1_DESC, ITEM_2_TITLE, ITEM_2_DESC, ... (pain points or characteristics)";
    case "Contact":
      return "Keys: TITLE, SUBTITLE, BODY, BUTTON_TEXT";
    default:
      return "Keys: TITLE, SUBTITLE, BODY, ITEM_1_TITLE, ITEM_1_DESC, ...";
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BatchRequest;
    const { sections, language, form_data, custom_prompts } = body;

    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json({ error: "Sections requises" }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENROUTER_API_KEY non configurée" }, { status: 500 });
    }

    const langLabel = language === "en" ? "English" : language === "es" ? "Spanish" : "French";

    const systemPrompt = `You are an expert web copywriter generating structured content for multiple website sections.
Always respond in ${langLabel}. Return ONLY the section blocks, no commentary.

For each section, output content using KEY: value format on separate lines.
Wrap each section with ===SECTION:{id}=== and ===END=== markers.

Key format rules:
- One value per line: KEY: value text here
- For multi-line values (like BODY), continue on next lines without a new KEY prefix
- Use the exact keys specified for each section type
- Write compelling, professional web copy`;

    const contextFromForm = form_data
      ? `\n\nClient & Project Context:\n${JSON.stringify(form_data, null, 2)}`
      : "";

    const sectionsText = sections
      .map((s) => {
        const prompt =
          (custom_prompts?.[s.type] ?? DEFAULT_PROMPTS[s.type] ?? `Write content for ${s.type} section`);
        const format = buildSectionPromptFormat(s.type);

        let text = `Section ID: ${s.id}
Type: ${s.type}
Task: ${prompt}
Format: ${format}
Number of items/elements: ${s.element_count ?? 3}`;

        if (s.notes) text += `\nAdditional notes: ${s.notes}`;

        if (s.ai_instruction && s.existing_content) {
          text += `\nModification instruction: ${s.ai_instruction}`;
          text += `\nExisting content to modify:\n${s.existing_content}`;
        }

        return text;
      })
      .join("\n\n---\n\n");

    const userPrompt = `Generate copywriting for the following ${sections.length} website section(s).${contextFromForm}

SECTIONS:
${sectionsText}`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://agenceflow.app",
        "X-Title": "AgenceFlow Copywriting",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.75,
        max_tokens: Math.min(8000, sections.length * 800 + 500),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `OpenRouter error: ${errText}` }, { status: 500 });
    }

    const data = await response.json();
    const rawContent: string = data.choices?.[0]?.message?.content ?? "";

    // Parse ===SECTION:{id}=== ... ===END=== blocks
    const results: { id: string; content: string }[] = [];
    const regex = /===SECTION:([a-zA-Z0-9_-]+)===([\s\S]*?)===END===/g;
    let match;
    while ((match = regex.exec(rawContent)) !== null) {
      results.push({ id: match[1], content: match[2].trim() });
    }

    // Fallback: if parsing failed, try to match sections by order
    if (results.length === 0 && sections.length === 1) {
      results.push({ id: sections[0].id, content: rawContent.trim() });
    }

    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
