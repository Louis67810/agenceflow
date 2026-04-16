import { NextRequest, NextResponse } from "next/server";

interface RefineMessageRequest {
  message: string;
  name?: string;
  context?: string;
  openrouterApiKey?: string;
  model?: string;
  smallPrompt?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RefineMessageRequest;
    const { message, name, context, openrouterApiKey, model = "google/gemini-2.0-flash-001", smallPrompt } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message vide" }, { status: 400 });
    }

    const apiKey = openrouterApiKey?.trim() || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Clé OpenRouter manquante." }, { status: 500 });
    }

    const systemPrompt = smallPrompt?.trim() ||
      `Tu es un expert en copywriting LinkedIn. Tu reformules des messages de prospection pour les rendre plus naturels et percutants.`;

    const userPrompt = `Reformule ce message de prospection LinkedIn en gardant EXACTEMENT les mêmes idées et informations, mais en le rendant plus naturel, authentique et court.

${name ? `Prospect : ${name}` : ""}
${context ? `Contexte : ${context}` : ""}

Message brut à reformuler :
"${message}"

Règles :
- Garde TOUT le contenu et les idées originales
- Rends-le plus naturel et humain
- 3-5 phrases maximum
- Commence par le prénom si présent dans le message
- Pas de pitch direct
- Termine par une question simple
- Ne rajoute PAS de nouvelles informations

Retourne uniquement le message reformulé, prêt à envoyer.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://agenceflow.app",
        "X-Title": "AgenceFlow LinkedIn Refine",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `OpenRouter: ${err}` }, { status: 500 });
    }

    const data = await response.json();
    const refined: string = data.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ message: refined.trim() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
