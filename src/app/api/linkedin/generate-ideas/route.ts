import { NextRequest, NextResponse } from "next/server";

interface PostSummary {
  content: string;
  likes: number;
  comments: number;
  impressions: number;
  styleName?: string;
  reach?: number;
  profileViews?: number;
  followersGained?: number;
  reposts?: number;
  saves?: number;
  sends?: number;
  linkClicks?: number;
  engagementRate?: number;
}

interface StyleSummary {
  name: string;
  category: string;
}

interface GenerateIdeasRequest {
  count?: number;
  topPosts?: PostSummary[];
  styles?: StyleSummary[];
  language?: string;
  openrouterApiKey?: string;
  model?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateIdeasRequest;
    const { count = 9, topPosts = [], styles = [], language = "fr", openrouterApiKey, model = "openai/gpt-4o-mini" } = body;

    const apiKey = openrouterApiKey?.trim() || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Clé OpenRouter manquante. Configurez-la dans les paramètres LinkedIn." }, { status: 500 });
    }

    const langLabel = language === "en" ? "English" : "French";

    // Build context from past performance
    let performanceContext = "";
    if (topPosts.length > 0) {
      const topThree = topPosts
        .slice(0, 5)
        .map(
          (p, i) =>
            `Post ${i + 1} (${p.likes} réactions, ${p.comments} commentaires, ${p.impressions} impressions${p.reach ? `, ${p.reach} touchés` : ""}${p.profileViews ? `, ${p.profileViews} vues profil` : ""}${p.followersGained ? `, ${p.followersGained} abonnés` : ""}${p.linkClicks ? `, ${p.linkClicks} clics lien` : ""}${p.saves ? `, ${p.saves} enregistrements` : ""}${p.styleName ? `, style: ${p.styleName}` : ""}${p.engagementRate ? `, taux d'engagement: ${p.engagementRate}%` : ""}): "${p.content.slice(0, 150)}..."`
        )
        .join("\n");
      performanceContext = `\n\nTop posts performants (pour comprendre ce qui marche):\n${topThree}`;
    }

    const stylesContext =
      styles.length > 0
        ? `\n\nStyles disponibles: ${styles.map((s) => s.name).join(", ")}`
        : "";

    const systemPrompt = `You are a LinkedIn content strategist who generates content ideas that go viral.
You understand what topics resonate with entrepreneurs, founders, managers, and professionals on LinkedIn.
Generate ideas that are specific, actionable, and have high engagement potential.
Always respond in ${langLabel}.`;

    const userPrompt = `Generate exactly ${count} LinkedIn post ideas. Each idea should be different in angle and format.

Mix the types:
- 2 storytelling ideas (personal stories)
- 2 value/list ideas (actionable tips)
- 2 educational ideas (how-to, explainers)
- 1 controversial/opinion idea
- 1 question/engagement idea
- 1 data/statistics idea${performanceContext}${stylesContext}

For each idea, provide:
- A compelling title (max 10 words) that could be the hook
- A 2-sentence description of what the post would cover
- The best style type for it (storytelling/valeur/educatif/viral/engagement/data)

Format as JSON array:
[
  {
    "title": "...",
    "description": "...",
    "styleCategory": "storytelling"
  }
]

Return ONLY the JSON array, no markdown, no explanation.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://agenceflow.app",
        "X-Title": "AgenceFlow LinkedIn Ideas",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.9,
        max_tokens: count * 150,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `OpenRouter: ${err}` }, { status: 500 });
    }

    const data = await response.json();
    let raw: string = data.choices?.[0]?.message?.content ?? "[]";
    raw = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let ideas: { title: string; description: string; styleCategory: string }[];
    try {
      ideas = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Erreur parsing réponse IA", raw }, { status: 500 });
    }

    return NextResponse.json({ ideas });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
