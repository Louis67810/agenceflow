import { NextRequest, NextResponse } from "next/server";
import type { ProspectionSkeleton } from "@/types/linkedin";

interface ProspectData {
  message: string;
  status: string;
  actionType: string;
}

interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

interface GenerateProspectionRequest {
  name: string;
  actionType: "liked" | "commented" | "visited_profile";
  context?: string;
  siteUrl?: string;
  skeleton?: ProspectionSkeleton;
  learningData?: ProspectData[];
  conversationHistory?: ConversationTurn[];
  mode?: "initial" | "reply";
  language?: string;
  openrouterApiKey?: string;
  model?: string;
  smallPrompt?: string;
}

const DEFAULT_SMALL_PROMPT = `You are an expert LinkedIn outreach specialist who writes personalized, authentic messages.
A great LinkedIn message:
- References the SPECIFIC action they took
- Feels authentic and personal, not templated
- Is SHORT (3-5 sentences MAX)
- Does NOT pitch directly in the first message
- Ends with ONE simple question or clear next step
- Never uses "Bonjour" as opener — start with their first name`;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateProspectionRequest;
    const {
      name, actionType, context, siteUrl, skeleton,
      learningData = [], conversationHistory = [],
      mode = "initial", language = "fr",
      openrouterApiKey, model = "google/gemini-2.0-flash-001",
      smallPrompt,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Nom du prospect requis" }, { status: 400 });
    }

    const apiKey = openrouterApiKey?.trim() || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Clé OpenRouter manquante. Configurez-la dans les paramètres LinkedIn." }, { status: 500 });
    }

    const langLabel = language === "en" ? "English" : "French";

    // Build learning context from past data
    const positive = learningData.filter((d) =>
      ["accepted", "replied", "conversation", "deal_closed"].includes(d.status)
    );
    const negative = learningData.filter((d) => d.status === "rejected");
    let learningContext = "";
    if (positive.length >= 2) {
      const posExamples = positive.slice(0, 2).map((d) => `"${d.message.slice(0, 200)}"`).join("\n");
      learningContext = `\n\n## Messages qui ont fonctionné (référence de ton) :\n${posExamples}`;
    }
    if (negative.length >= 2) {
      const negExamples = negative.slice(0, 2).map((d) => `"${d.message.slice(0, 150)}"`).join("\n");
      learningContext += `\n\n## Messages qui n'ont PAS fonctionné (à éviter) :\n${negExamples}`;
    }

    // Build skeleton section
    const skeletonSection = skeleton
      ? `\n\n## Message structure to follow (skeleton: "${skeleton.name}") :\n${skeleton.promptFragment}\n\nStructure guide :\n${skeleton.structure}`
      : "";

    // Build site URL section
    const siteSection = siteUrl?.trim()
      ? `\n\n## Prospect's website/URL : ${siteUrl} — use this for authentic personalization if relevant.`
      : "";

    // Build system prompt
    const basePrompt = smallPrompt?.trim() || DEFAULT_SMALL_PROMPT;
    const systemPrompt = `${basePrompt}${skeletonSection}${siteSection}
Always write in ${langLabel}.`;

    let messages: { role: "system" | "user" | "assistant"; content: string }[];

    if (mode === "reply" && conversationHistory.length > 0) {
      // Generate the next message in an ongoing conversation
      const actionContext = {
        liked: `${name} liked one of your LinkedIn posts`,
        commented: `${name} commented on one of your LinkedIn posts`,
        visited_profile: `${name} visited your LinkedIn profile`,
      }[actionType];

      messages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Generate the NEXT message to send in this ongoing LinkedIn conversation.

## Context :
${actionContext}
${context ? `Additional context: ${context}` : ""}

## Conversation history (oldest first) :
${conversationHistory.map((m) => `${m.role === "assistant" ? "Me" : name}: "${m.content}"`).join("\n")}

Write my NEXT message. Keep it natural, short (2-4 sentences), and continue the conversation smoothly.
Do NOT start a new topic. Build on what has been said. End with a question or a clear next step.`,
        },
      ];
    } else {
      // Generate initial message
      const actionContext = {
        liked: `${name} a liké un de vos posts LinkedIn. Signal d'intérêt faible mais réel.`,
        commented: `${name} a commenté un de vos posts LinkedIn. Signal d'engagement fort.`,
        visited_profile: `${name} a visité votre profil LinkedIn. Signal d'intérêt potentiel.`,
      }[actionType];

      const userPrompt = `Write a LinkedIn prospection message for this situation:

## Context :
${actionContext}
${context ? `\nAdditional context: ${context}` : ""}${learningContext}

## Instructions :
- Message length: 3-5 sentences maximum
- Start with "${name}," (use first name)
- Reference the specific action they took
- Sound like a real human, not a sales template
- End with a simple, open question
- No emojis unless necessary
- No pitch, no CTA to buy anything

${skeleton ? "- Follow the skeleton structure provided in the system prompt as a guide, not a rigid template" : ""}

Write the message directly, ready to send.`;

      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];
    }

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
        messages,
        temperature: 0.8,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `OpenRouter: ${err}` }, { status: 500 });
    }

    const data = await response.json();
    const message: string = data.choices?.[0]?.message?.content ?? "";

    const explanation = mode === "reply"
      ? `Réponse de suivi basée sur ${conversationHistory.length} échanges`
      : `Message basé sur : ${actionType === "liked" ? "like" : actionType === "commented" ? "commentaire" : "visite profil"}${skeleton ? ` · Squelette: ${skeleton.name}` : ""}${positive.length > 0 ? ` · Optimisé d'après ${positive.length} message(s) performant(s)` : ""}`;

    return NextResponse.json({ message: message.trim(), explanation });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
