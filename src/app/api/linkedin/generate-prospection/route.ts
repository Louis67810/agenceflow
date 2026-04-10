import { NextRequest, NextResponse } from "next/server";

interface ProspectData {
  message: string;
  status: string;
  actionType: string;
}

interface GenerateProspectionRequest {
  name: string;
  actionType: "liked" | "commented" | "visited_profile";
  context?: string;
  learningData?: ProspectData[];
  language?: string;
  openrouterApiKey?: string;
  model?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateProspectionRequest;
    const { name, actionType, context, learningData = [], language = "fr", openrouterApiKey, model = "openai/gpt-4o-mini" } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Nom du prospect requis" }, { status: 400 });
    }

    const apiKey = openrouterApiKey?.trim() || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Clé OpenRouter manquante. Configurez-la dans les paramètres LinkedIn." }, { status: 500 });
    }

    const langLabel = language === "en" ? "English" : "French";

    // Analyze learning data for patterns
    const positive = learningData.filter((d) =>
      ["accepted", "replied", "conversation", "deal_closed"].includes(d.status)
    );
    const negative = learningData.filter((d) => d.status === "rejected");

    let learningContext = "";
    if (positive.length >= 2) {
      const posExamples = positive
        .slice(0, 2)
        .map((d) => `"${d.message.slice(0, 200)}"`)
        .join("\n");
      learningContext = `\n\n## Messages qui ont fonctionné par le passé (à utiliser comme référence de ton et structure) :\n${posExamples}`;
    }
    if (negative.length >= 2) {
      const negExamples = negative
        .slice(0, 2)
        .map((d) => `"${d.message.slice(0, 150)}"`)
        .join("\n");
      learningContext += `\n\n## Messages qui n'ont PAS fonctionné (à éviter) :\n${negExamples}`;
    }

    const actionContext = {
      liked: `${name} a liké un de vos posts LinkedIn. C'est un signal d'intérêt faible mais réel.`,
      commented: `${name} a commenté un de vos posts LinkedIn. C'est un signal d'engagement fort.`,
      visited_profile: `${name} a visité votre profil LinkedIn. C'est un signal d'intérêt potentiel.`,
    }[actionType];

    const systemPrompt = `You are an expert LinkedIn outreach specialist who writes personalized, authentic connection messages.
You understand that most LinkedIn DMs fail because they're too salesy, too long, or too generic.
A great LinkedIn message:
- References the SPECIFIC action they took (liked, commented, visited)
- Feels authentic and personal, not templated
- Is SHORT (3-5 sentences MAX)
- Does NOT pitch directly in the first message
- Ends with ONE simple question or clear next step
- Never uses "Bonjour" as opener — start with their first name
Always write in ${langLabel}.`;

    const userPrompt = `Write a LinkedIn prospection message for this situation:

## Context:
${actionContext}
${context ? `\nAdditional context: ${context}` : ""}${learningContext}

## Instructions:
- Message length: 3-5 sentences maximum
- Start with "${name}," (use first name)
- Reference the specific action they took (${actionType === "liked" ? "they liked your post" : actionType === "commented" ? "they commented on your post" : "they visited your profile"})
- Sound like a real human, not a sales template
- End with a simple, open question
- No emojis unless necessary
- No pitch, no CTA to buy anything in first message

Write the message directly, ready to send.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://agenceflow.app",
        "X-Title": "AgenceFlow LinkedIn Prospection",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `OpenRouter: ${err}` }, { status: 500 });
    }

    const data = await response.json();
    const message: string = data.choices?.[0]?.message?.content ?? "";

    // Generate explanation
    const explanation = `Message basé sur : ${actionType === "liked" ? "like" : actionType === "commented" ? "commentaire" : "visite profil"}${positive.length > 0 ? ` · Optimisé d'après ${positive.length} message(s) performant(s)` : ""}`;

    return NextResponse.json({ message: message.trim(), explanation });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
