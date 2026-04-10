import { NextRequest, NextResponse } from "next/server";

interface TopPost {
  content: string;
  likes: number;
  comments: number;
  impressions: number;
  styleName?: string;
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
  type: "post" | "carousel";
  carouselSlides?: number;
  topPosts?: TopPost[];
  language?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GeneratePostRequest;
    const {
      sourceType,
      sourceContent,
      sourceTitle,
      style,
      type,
      carouselSlides = 5,
      topPosts = [],
      language = "fr",
    } = body;

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENROUTER_API_KEY non configurée" }, { status: 500 });
    }

    if (!sourceContent?.trim()) {
      return NextResponse.json({ error: "Contenu source requis" }, { status: 400 });
    }

    const langLabel = language === "en" ? "English" : "French";

    // Build performance context
    let performanceContext = "";
    if (topPosts.length > 0) {
      const topExamples = topPosts
        .slice(0, 3)
        .map(
          (p, i) =>
            `Top post ${i + 1} (${p.likes} likes, ${p.comments} commentaires):\n"${p.content.slice(0, 300)}..."`
        )
        .join("\n\n");
      performanceContext = `\n\n## Vos meilleurs posts (à utiliser comme référence de style et ton) :\n${topExamples}`;
    }

    // Source context
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

    let userPrompt: string;

    if (type === "carousel") {
      userPrompt = `Create a LinkedIn carousel with exactly ${carouselSlides} slides based on this content.

## Source (${sourceLabel}):
${sourceContent}${styleInstruction}${performanceContext}

## Instructions for carousel:
- Slide 1: Hook slide — powerful statement or question that makes people want to swipe
- Slides 2 to ${carouselSlides - 1}: One key point per slide, with title and 2-3 lines of explanation
- Last slide: Summary/CTA — encourage to save, share or follow

Format your response with exactly ${carouselSlides} slides, each separated by:
---SLIDE---

Each slide content: write the full text for that slide (title + body if needed).`;
    } else {
      userPrompt = `Create a LinkedIn post based on this content.

## Source (${sourceLabel}):
${sourceContent}${styleInstruction}${performanceContext}

## Instructions:
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
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.85,
        max_tokens: type === "carousel" ? carouselSlides * 200 : 800,
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
