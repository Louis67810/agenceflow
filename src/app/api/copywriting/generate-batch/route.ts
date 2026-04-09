import { NextRequest, NextResponse } from "next/server";

type ElementType = "title" | "subtitle" | "body" | "cta" | "items" | "image";

interface ElementRequest {
  id: string;
  type: ElementType;
  note?: string;
  count?: number;
}

interface ExistingElement {
  type: string;
  content: string;
}

interface SectionRequest {
  id: string;
  type: string;
  notes?: string;
  elements: ElementRequest[];
  ai_instruction?: string;
  existing_elements?: ExistingElement[];
}

interface BatchRequestBody {
  sections: SectionRequest[];
  language: string;
  form_data?: Record<string, unknown> | null;
  custom_prompts?: Record<string, string>;
}

const DEFAULT_PROMPTS: Record<string, string> = {
  Hero: "Écris le contenu pour la section Hero du site. Titre accrocheur, sous-titre percutant.",
  "À propos": "Rédige le contenu de présentation de l'entreprise, ses valeurs et sa mission.",
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

function getItemFormat(sectionType: string): string {
  switch (sectionType) {
    case "FAQ":
      return "ITEM_{n}_QUESTION and ITEM_{n}_ANSWER";
    case "Équipe":
      return "ITEM_{n}_NAME, ITEM_{n}_ROLE, ITEM_{n}_BIO";
    case "Témoignages":
      return "ITEM_{n}_QUOTE, ITEM_{n}_NAME, ITEM_{n}_ROLE";
    case "Tarifs":
      return "ITEM_{n}_NAME, ITEM_{n}_PRICE, ITEM_{n}_FEATURES (semicolon-separated list), ITEM_{n}_CTA";
    case "Chiffres clés":
      return "ITEM_{n}_NUMBER, ITEM_{n}_LABEL";
    case "Comparatif":
      return "ITEM_{n}_FEATURE, ITEM_{n}_COL1, ITEM_{n}_COL2";
    default:
      return "ITEM_{n}_TITLE, ITEM_{n}_DESC";
  }
}

function buildElementInstructions(elements: ElementRequest[], sectionType: string): string {
  const lines: string[] = [];
  for (const el of elements) {
    if (el.type === "image") continue;
    const note = el.note ? ` (note: ${el.note})` : "";
    switch (el.type) {
      case "title":
        lines.push(`- TITLE: Compelling main heading${note}`);
        break;
      case "subtitle":
        lines.push(`- SUBTITLE: Supporting subtitle, 1 short line${note}`);
        break;
      case "body":
        lines.push(`- BODY: 2-3 sentences of engaging body text${note}`);
        break;
      case "cta":
        lines.push(`- CTA: 3-6 word button/call-to-action text, action-oriented${note}`);
        break;
      case "items": {
        const n = el.count ?? 3;
        const fmt = getItemFormat(sectionType).replace(/{n}/g, "n");
        lines.push(
          `- Items (${n} items): For each item index n from 1 to ${n}, generate: ${fmt}${note}`
        );
        break;
      }
    }
  }
  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BatchRequestBody;
    const { sections, language, form_data, custom_prompts } = body;

    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json({ error: "Sections requises" }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENROUTER_API_KEY non configurée" }, { status: 500 });
    }

    const langLabel =
      language === "en" ? "English" : language === "es" ? "Spanish" : "French";

    const systemPrompt = `You are an expert web copywriter generating structured content for website sections.
Always respond in ${langLabel}. Return ONLY the section blocks, no commentary outside them.

For each section, output key-value pairs using this exact format:
KEY: value text here

Wrap each section with:
===SECTION:{id}===
... key: value pairs ...
===END===

Key format rules:
- One value per line: KEY: value
- For BODY that spans multiple lines: start with BODY: first line, then continue on next lines
- Use TITLE, SUBTITLE, BODY, CTA as keys for those element types
- For items, use ITEM_1_TITLE, ITEM_1_DESC, ITEM_2_TITLE, ITEM_2_DESC etc. (or the specific keys requested)
- Write compelling, professional, conversion-focused copy`;

    const contextFromForm = form_data
      ? `\n\nClient & Project Context:\n${JSON.stringify(form_data, null, 2)}`
      : "";

    // Filter out sections with no generatable elements
    const generatableSections = sections.filter(
      (s) => s.elements.some((e) => e.type !== "image")
    );

    if (generatableSections.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const sectionsText = generatableSections
      .map((s) => {
        const basePrompt =
          custom_prompts?.[s.type] ?? DEFAULT_PROMPTS[s.type] ?? `Generate content for ${s.type}`;
        const elementInstructions = buildElementInstructions(s.elements, s.type);

        let text = `Section ID: ${s.id}
Section type: ${s.type}
Task: ${basePrompt}
${s.notes ? `Additional notes: ${s.notes}` : ""}

Elements to generate:
${elementInstructions}`;

        if (s.ai_instruction && s.existing_elements && s.existing_elements.length > 0) {
          const existingStr = s.existing_elements
            .filter((e) => e.content)
            .map((e) => `${e.type.toUpperCase()}: ${e.content}`)
            .join("\n");
          text += `\n\nModification instruction: ${s.ai_instruction}`;
          if (existingStr) text += `\n\nExisting content to modify:\n${existingStr}`;
        }

        return text;
      })
      .join("\n\n---\n\n");

    const userPrompt = `Generate copywriting for the following ${generatableSections.length} website section(s).${contextFromForm}

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
        max_tokens: Math.min(8000, generatableSections.length * 1000 + 500),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `OpenRouter error: ${errText}` }, { status: 500 });
    }

    const data = await response.json();
    const rawContent: string = data.choices?.[0]?.message?.content ?? "";

    // Parse ===SECTION:{id}===...===END=== blocks
    const results: { id: string; content: string }[] = [];
    const regex = /===SECTION:([a-zA-Z0-9_-]+)===([\s\S]*?)===END===/g;
    let match;
    while ((match = regex.exec(rawContent)) !== null) {
      results.push({ id: match[1], content: match[2].trim() });
    }

    // Fallback for single section without delimiters
    if (results.length === 0 && generatableSections.length === 1) {
      results.push({ id: generatableSections[0].id, content: rawContent.trim() });
    }

    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
