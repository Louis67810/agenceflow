import { NextRequest, NextResponse } from "next/server";

interface TransformTextRequest {
  text: string;
  fullText?: string;
  instruction: string;
  contextLabel?: string;
  openrouterApiKey?: string;
  model?: string;
  prompt?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TransformTextRequest;
    const {
      text,
      fullText,
      instruction,
      contextLabel = "texte LinkedIn",
      openrouterApiKey,
      model = "google/gemini-2.0-flash-001",
      prompt,
    } = body;

    if (!text?.trim()) {
      return NextResponse.json({ error: "Aucun texte à transformer." }, { status: 400 });
    }

    const apiKey = openrouterApiKey?.trim() || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Clé OpenRouter manquante." }, { status: 500 });
    }

    const systemPrompt =
      prompt?.trim() ||
      `Tu es un excellent éditeur de texte. Tu modifies un extrait de ${contextLabel} sans casser le sens, le ton, ni la cohérence. Tu retournes uniquement la nouvelle version du passage, sans guillemets ni commentaire.`;

    const userPrompt = [
      `Contexte global : ${contextLabel}`,
      instruction ? `Instruction : ${instruction}` : "",
      fullText?.trim() ? `Texte complet pour contexte :\n${fullText}` : "",
      `Passage à transformer :\n${text}`,
      "Retourne uniquement le passage transformé, prêt à remplacer la sélection.",
    ].filter(Boolean).join("\n\n");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://agenceflow.app",
        "X-Title": "AgenceFlow Smart Text Transform",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `OpenRouter: ${err}` }, { status: 500 });
    }

    const data = await response.json();
    const transformed = data.choices?.[0]?.message?.content?.trim();
    if (!transformed) {
      return NextResponse.json({ error: "Aucune réponse générée." }, { status: 500 });
    }

    return NextResponse.json({ text: transformed });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
