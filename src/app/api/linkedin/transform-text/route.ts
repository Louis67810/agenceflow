import { NextRequest, NextResponse } from "next/server";

interface TransformTextRequest {
  text: string;
  fullText?: string;
  instruction: string;
  contextLabel?: string;
  openrouterApiKey?: string;
  model?: string;
  prompt?: string;
  responseMode?: "text" | "editWithMessage" | "chatWithOptionalTextEdit" | "carouselChat";
  chatContext?: string;
}

function parseJsonResponse(raw: string) {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned) as { message?: string; text?: string | null; edits?: Array<{ slideIndex?: number; field?: string; value?: unknown }> };
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
      responseMode = "text",
      chatContext,
    } = body;

    if (!text?.trim()) {
      return NextResponse.json({ error: "Aucun texte a transformer." }, { status: 400 });
    }

    const apiKey = openrouterApiKey?.trim() || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Cle OpenRouter manquante." }, { status: 500 });
    }

    const systemPrompt =
      prompt?.trim() ||
      (responseMode === "carouselChat"
        ? `Tu es un assistant expert pour editer des carrousels LinkedIn. Tu peux soit repondre normalement dans le chat, soit proposer des modifications structurees. Par defaut, tu ne modifies rien. Tu modifies uniquement si l'utilisateur demande explicitement de changer, reecrire, corriger, raccourcir, allonger, reformuler, remplacer ou appliquer une commande. Reponds uniquement en JSON valide: {"message":"reponse courte pour le chat","edits":[{"slideIndex":0,"field":"subtitle","value":"nouvelle valeur"}]}. Le champ edits peut etre vide. N'invente jamais de champ: utilise seulement les champs fournis dans le contexte. Respecte toujours les contraintes de caracteres indiquees dans les fields. Le message est uniquement conversationnel: explique les changements point par point, ne recopie jamais les valeurs completes des champs comme si c'etait le texte final. Les modifications a appliquer vont uniquement dans edits.`
        : responseMode === "chatWithOptionalTextEdit"
        ? `Tu es un assistant LinkedIn. Tu peux soit repondre normalement dans le chat, soit modifier le post. Par defaut, tu ne modifies rien. Tu modifies uniquement si l'utilisateur demande explicitement de changer, reecrire, corriger, raccourcir, allonger, reformuler, remplacer ou appliquer une commande. Reponds uniquement en JSON valide: {"message":"reponse courte pour le chat","text":null}. Si tu modifies, "text" contient la nouvelle version complete ou le passage modifie selon l'instruction.`
        : responseMode === "editWithMessage"
        ? `Tu es un excellent editeur de texte LinkedIn. Tu modifies le texte demande sans casser le sens, le ton, ni la coherence. Tu dois repondre uniquement en JSON valide avec deux champs: "message" et "text". Le champ "message" est une courte reponse conversationnelle en francais, 1 phrase maximum, qui explique ce que tu viens de faire. Il ne doit jamais recopier le post ni le passage modifie. Le champ "text" contient uniquement la nouvelle version du passage a appliquer.`
        : `Tu es un excellent editeur de texte. Tu modifies un extrait de ${contextLabel} sans casser le sens, le ton, ni la coherence. Tu retournes uniquement la nouvelle version du passage, sans guillemets ni commentaire.`);

    const userPrompt = [
      `Contexte global : ${contextLabel}`,
      instruction ? `Instruction : ${instruction}` : "",
      chatContext?.trim() ? `Historique recent de la conversation :\n${chatContext}` : "",
      fullText?.trim() ? `Texte complet pour contexte :\n${fullText}` : "",
      `Passage a transformer :\n${text}`,
      responseMode === "carouselChat"
        ? `Retourne uniquement un JSON valide au format {"message":"message pour la conversation avec les modifications listees point par point","edits":[{"slideIndex":0,"field":"nom_du_champ","value":"nouvelle valeur"}]}. Si aucune modification explicite n'est demandee, mets edits: []. Le message ne doit pas contenir le contenu brut des champs a appliquer.`
        : responseMode === "chatWithOptionalTextEdit"
        ? `Retourne uniquement un JSON valide au format {"message":"message pour la conversation","text":null}. Si une modification explicite est demandee, text contient le texte a appliquer.`
        : responseMode === "editWithMessage"
        ? `Retourne uniquement un JSON valide au format {"message":"message court pour le chat, sans recopier le post","text":"texte modifie pret a appliquer"}.`
        : "Retourne uniquement le passage transforme, pret a remplacer la selection.",
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
        max_tokens: responseMode === "carouselChat" ? 2600 : responseMode === "editWithMessage" || responseMode === "chatWithOptionalTextEdit" ? 1600 : 500,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `OpenRouter: ${err}` }, { status: 500 });
    }

    const data = await response.json();
    const transformed = data.choices?.[0]?.message?.content?.trim();
    if (!transformed) {
      return NextResponse.json({ error: "Aucune reponse generee." }, { status: 500 });
    }

    if (responseMode === "carouselChat") {
      try {
        const parsed = parseJsonResponse(transformed);
        return NextResponse.json({
          message: parsed.message?.trim() || "C'est note.",
          edits: Array.isArray(parsed.edits) ? parsed.edits : [],
        });
      } catch {}

      return NextResponse.json({ message: transformed, edits: [] });
    }

    if (responseMode === "chatWithOptionalTextEdit") {
      try {
        const parsed = parseJsonResponse(transformed);
        return NextResponse.json({
          message: parsed.message?.trim() || "C'est note.",
          text: typeof parsed.text === "string" && parsed.text.trim() ? parsed.text.trim() : null,
        });
      } catch {}

      return NextResponse.json({ message: transformed, text: null });
    }

    if (responseMode === "editWithMessage") {
      try {
        const parsed = parseJsonResponse(transformed);
        if (parsed.text?.trim()) {
          return NextResponse.json({
            text: parsed.text.trim(),
            message: parsed.message?.trim() || "Modification appliquee.",
          });
        }
      } catch {}

      return NextResponse.json({ text: transformed, message: "Modification appliquee." });
    }

    return NextResponse.json({ text: transformed });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
