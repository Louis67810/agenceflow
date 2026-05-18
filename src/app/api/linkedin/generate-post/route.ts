import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_LINKEDIN_GLOBAL_SYSTEM_PROMPT } from "@/lib/linkedin/post-style-prompts";

interface TopPost {
  content: string;
  likes: number;
  comments: number;
  impressions: number;
  styleName?: string;
}

interface StyleExample {
  content: string;
}

interface GeneratePostRequest {
  sourceType: "manual" | "url" | "youtube" | "idea";
  sourceContent: string;
  sourceTitle?: string;
  style?: {
    name: string;
    prompt: string;
    category: string;
  };
  styleExamples?: StyleExample[];
  type: "post" | "carousel";
  carouselSlides?: number;
  carouselTemplate?: string;
  topPosts?: TopPost[];
  language?: string;
  // Settings from client
  openrouterApiKey?: string;
  model?: string;
  businessContext?: string;
  postSystemPrompt?: string;
  userWritingStylePrompt?: string;
  carouselLongFormatPrompt?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GeneratePostRequest;
    const {
      sourceType,
      sourceContent,
      sourceTitle,
      style,
      styleExamples = [],
      type,
      carouselSlides = 5,
      carouselTemplate,
      topPosts = [],
      language = "fr",
      openrouterApiKey,
      model = "openai/gpt-4o-mini",
      businessContext,
      postSystemPrompt,
      userWritingStylePrompt,
      carouselLongFormatPrompt,
    } = body;

    // Prefer client-provided key, fallback to server env
    const apiKey = openrouterApiKey?.trim() || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Clé OpenRouter manquante. Configurez-la dans les paramètres LinkedIn." },
        { status: 500 }
      );
    }

    if (!sourceContent?.trim()) {
      return NextResponse.json({ error: "Contenu source requis" }, { status: 400 });
    }

    const langLabel = language === "en" ? "English" : "French";

    // Build performance context from top posts
    let performanceContext = "";
    if (topPosts.length > 0) {
      const topExamples = topPosts
        .slice(0, 3)
        .map(
          (p, i) =>
            `Top post ${i + 1} (${p.likes} likes, ${p.comments} commentaires):\n"${p.content.slice(0, 300)}..."`
        )
        .join("\n\n");
      performanceContext = `\n\n## Vos meilleurs posts (référence de style et ton) :\n${topExamples}`;
    }

    // Build style examples context
    let styleExamplesContext = "";
    if (styleExamples.length > 0) {
      const exs = styleExamples
        .slice(0, 3)
        .map((e, i) => `Exemple ${i + 1}:\n"${e.content.slice(0, 400)}"`)
        .join("\n\n");
      styleExamplesContext = `\n\n## Exemples de posts avec ce style (respectez rigoureusement ce format et ce ton) :\n${exs}`;
    }

    // Source label
    const sourceLabel =
      sourceType === "url"
        ? `Article web${sourceTitle ? ` "${sourceTitle}"` : ""}`
        : sourceType === "youtube"
        ? `Vidéo YouTube${sourceTitle ? ` "${sourceTitle}"` : ""}`
        : sourceType === "idea"
        ? "Idée de post"
        : "Texte libre";

    const styleInstruction = style
      ? `\n\n## Style à appliquer : ${style.name}\n${style.prompt}`
      : "\n\nStyle : Professionnel, authentique, engageant. Phrases courtes. Sauts de ligne fréquents.";

    const systemPrompt = `You are an expert LinkedIn content creator who writes viral, authentic posts in ${langLabel}.
You understand LinkedIn algorithms and what drives engagement: saves, comments, shares.
You always write in first person, authentic voice. No corporate speak.
Key rules:
- First line is EVERYTHING — it must hook immediately
- Short sentences, frequent line breaks
- No more than 5 hashtags, placed at the end
- Always end with a question or call to action
- Never use clichés like "Dans un monde où..." or "La résilience..."`;

    void systemPrompt;

    const linkedInSystemPrompt = `${postSystemPrompt?.trim() || DEFAULT_LINKEDIN_GLOBAL_SYSTEM_PROMPT}

Langue de generation : ${langLabel}.
${businessContext?.trim() ? `\n## Contexte business par defaut\n${businessContext.trim()}` : ""}`;
    const writingStyleInstruction = userWritingStylePrompt?.trim()
      ? `\n\n## Style d'ecriture utilisateur a respecter\n${userWritingStylePrompt.trim()}`
      : "";
    const longFormatInstruction = carouselLongFormatPrompt?.trim()
      ? `\n\n## Prompt specifique format long\n${carouselLongFormatPrompt.trim()}`
      : "";

    let userPrompt: string;

    if (type === "carousel") {
      const template = carouselTemplate?.trim()
        ? carouselTemplate
        : `Pour chaque slide, génère exactement ce format :

TITRE: [3-5 mots — accroche courte et percutante]
SOUS-TITRE: [8-12 mots — développe et complète le titre]
TEXTE: [2-4 phrases — contenu principal du slide, concret et actionnable]
VISUEL: [1 phrase — description précise du visuel ou image idéale pour ce slide]`;

      userPrompt = `Create a LinkedIn carousel with exactly ${carouselSlides} slides based on this content.

## Source (${sourceLabel}):
${sourceContent}${styleInstruction}${writingStyleInstruction}${styleExamplesContext}${performanceContext}

## Template obligatoire pour chaque slide :
${template}

## Structure narrative :
- Slide 1 : Accroche / problématique principale — fait stopper le scroll
- Slides 2 à ${carouselSlides - 1} : Une idée clé par slide, concrète et actionnable
- Slide ${carouselSlides} : Résumé + CTA fort (suivre, sauvegarder, commenter)

Sépare chaque slide par exactement :
---SLIDE---

Génère les ${carouselSlides} slides en ${langLabel}, prêts à utiliser dans Figma.`;
    } else {
      userPrompt = `Create a LinkedIn post based on this content.

## Source (${sourceLabel}):
${sourceContent}${styleInstruction}${writingStyleInstruction}${styleExamplesContext}${performanceContext}

## Instructions:
${longFormatInstruction}
- Treat the source as a brief/instruction, not as the final post.
- Never copy the source verbatim as the post, especially when the source is "Texte libre".
- Length: 150-300 words ideal
- Hook first line: must make people stop scrolling
- Body: develop the idea with concrete examples or personal experience
- End: question or CTA that invites comments
- 3-5 relevant hashtags at the very end
- Write directly in ${langLabel}, ready to post`;
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://agenceflow.app",
        "X-Title": "AgenceFlow LinkedIn",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: linkedInSystemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.85,
        max_tokens: type === "carousel" ? carouselSlides * 300 : 800,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `OpenRouter: ${err}` }, { status: 500 });
    }

    const data = await response.json();
    const rawContent: string = data.choices?.[0]?.message?.content ?? "";

    if (type === "carousel") {
      const slides = rawContent
        .split(/---SLIDE---/i)
        .map((s) => s.trim())
        .filter(Boolean);
      return NextResponse.json({ type: "carousel", slides, content: rawContent });
    }

    return NextResponse.json({ type: "post", content: rawContent });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
