import { NextRequest, NextResponse } from "next/server";

interface ViralityRequest {
  text: string;
  imageUrl?: string;
  imageDescription?: string;
  openAiApiKey?: string;
  analyzerModel?: string;
  openrouterApiKey?: string;
  imageModel?: string;
  systemPrompt?: string;
}

function extractJson(raw: string) {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(start >= 0 && end >= start ? cleaned.slice(start, end + 1) : cleaned);
}

function fallbackAnalysis(text: string, imageDescription: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const hasQuestion = /\?/.test(text);
  const hasImage = Boolean(imageDescription.trim());
  const score = Math.max(18, Math.min(82, 30 + Math.round(words / 9) + (hasQuestion ? 8 : 0) + (hasImage ? 9 : 0)));
  return {
    likes: Math.round(score * 4.2),
    comments: Math.round(score * (hasQuestion ? 0.75 : 0.38)),
    shares: Math.round(score * 0.22),
    ratio: `${Math.max(1, Math.round(score / 12))}%`,
    viralityLevel: score >= 72 ? "fort" : score >= 48 ? "moyen" : "faible",
    viralityScore: score,
    boostingFactors: [
      hasQuestion ? "Le post invite a repondre" : "Le sujet est clair",
      hasImage ? "Un visuel peut renforcer l'arret du scroll" : "Le texte est analysable seul",
    ],
    limitingFactors: [
      words < 70 ? "Le post manque peut-etre de contexte" : "Le post peut etre resserre",
      hasQuestion ? "La question doit rester tres simple" : "Ajoute une question finale pour augmenter les commentaires",
    ],
  };
}

async function describeImage(input: ViralityRequest) {
  if (input.imageDescription?.trim()) return input.imageDescription.trim();
  if (!input.imageUrl || !input.openrouterApiKey?.trim()) return "";

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.openrouterApiKey.trim()}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://agenceflow.app",
      "X-Title": "AgenceFlow LinkedIn Image Description",
    },
    body: JSON.stringify({
      model: input.imageModel || "qwen/qwen2.5-vl-72b-instruct",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Decris cette image pour predire la performance d'un post LinkedIn. Sois precis, concret, 4 phrases maximum." },
            { type: "image_url", image_url: { url: input.imageUrl } },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 350,
    }),
  });

  if (!response.ok) return "";
  const data = await response.json();
  return String(data.choices?.[0]?.message?.content ?? "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ViralityRequest;
    if (!body.text?.trim()) return NextResponse.json({ error: "Aucun post a analyser." }, { status: 400 });

    const imageDescription = await describeImage(body);
    const apiKey = body.openAiApiKey?.trim() || process.env.OPENAI_API_KEY;
    const model = body.analyzerModel?.trim();

    if (!apiKey || !model) {
      return NextResponse.json({
        configured: false,
        imageDescription,
        analysis: fallbackAnalysis(body.text, imageDescription),
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: body.systemPrompt || "Analyse la viralite d'un post LinkedIn et reponds uniquement en JSON." },
          {
            role: "user",
            content: [
              `POST LINKEDIN:\n${body.text}`,
              imageDescription ? `DESCRIPTION IMAGE:\n${imageDescription}` : "Aucune image.",
              "Retourne uniquement le JSON demande.",
            ].join("\n\n"),
          },
        ],
        temperature: 0.2,
        max_tokens: 900,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error: `OpenAI: ${error}` }, { status: 500 });
    }

    const data = await response.json();
    const content = String(data.choices?.[0]?.message?.content ?? "");
    return NextResponse.json({
      configured: true,
      imageDescription,
      analysis: extractJson(content),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
