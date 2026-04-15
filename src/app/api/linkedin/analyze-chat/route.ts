import { NextRequest, NextResponse } from "next/server";

interface ProspectStat {
  name: string;
  actionType: string;
  status: string;
  message: string;
  conversationLength?: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnalyzeChatRequest {
  userMessage: string;
  history: ChatMessage[];
  stats: {
    total: number;
    sent: number;
    accepted: number;
    replied: number;
    conversation: number;
    dealClosed: number;
    dealLost: number;
    rejected: number;
    conversionRate: string;
    byAction: Record<string, { total: number; positive: number }>;
  };
  prospects: ProspectStat[];
  openrouterApiKey?: string;
  model?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalyzeChatRequest;
    const {
      userMessage,
      history = [],
      stats,
      prospects = [],
      openrouterApiKey,
      model = "openai/gpt-4o-mini",
    } = body;

    const apiKey = openrouterApiKey?.trim() || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Clé OpenRouter manquante." }, { status: 500 });
    }

    // Build context from prospect data
    const positive = prospects.filter((p) =>
      ["accepted", "replied", "conversation", "deal_closed"].includes(p.status)
    );
    const negative = prospects.filter((p) =>
      ["rejected", "deal_lost"].includes(p.status)
    );

    const byActionLines = Object.entries(stats.byAction)
      .map(([action, data]) => {
        const rate = data.total > 0 ? Math.round((data.positive / data.total) * 100) : 0;
        const actionLabel =
          action === "liked" ? "Likes"
          : action === "commented" ? "Commentaires"
          : "Visites profil";
        return `  - ${actionLabel}: ${data.total} prospects → ${rate}% positifs`;
      })
      .join("\n");

    const positiveExamples = positive
      .slice(0, 3)
      .map((p) => `"${p.message.slice(0, 200)}" → ${p.status}`)
      .join("\n");

    const negativeExamples = negative
      .slice(0, 2)
      .map((p) => `"${p.message.slice(0, 150)}" → ${p.status}`)
      .join("\n");

    const systemPrompt = `Tu es un expert en prospection LinkedIn qui analyse les données de prospection d'un utilisateur.
Tu as accès à toutes leurs statistiques et peux répondre à des questions précises sur ce qui fonctionne ou non.

## Données de prospection actuelles :

### Vue d'ensemble :
- Total de prospects : ${stats.total}
- Messages envoyés : ${stats.sent}
- Acceptés : ${stats.accepted}
- Ont répondu : ${stats.replied}
- En conversation : ${stats.conversation}
- Deals conclus : ${stats.dealClosed}
- Refusés/perdus : ${stats.rejected + stats.dealLost}
- Taux de conversion global : ${stats.conversionRate}

### Résultats par type d'action :
${byActionLines || "  Pas encore de données par action"}

${positiveExamples ? `### Messages qui ont fonctionné (exemples) :\n${positiveExamples}` : ""}
${negativeExamples ? `\n### Messages qui n'ont PAS fonctionné :\n${negativeExamples}` : ""}

### Conversations actives :
${prospects.filter((p) => p.status === "conversation").length} prospects en conversation active.

---
Réponds de façon concise, précise et actionnable. Base tes réponses sur les vraies données ci-dessus.
Si les données sont insuffisantes pour tirer des conclusions, dis-le clairement et suggère quoi tracker en priorité.
Tu peux répondre en français.`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.slice(-10), // keep last 10 messages for context
      { role: "user" as const, content: userMessage },
    ];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://agenceflow.app",
        "X-Title": "AgenceFlow LinkedIn Analysis",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.5,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `OpenRouter: ${err}` }, { status: 500 });
    }

    const data = await response.json();
    const reply: string = data.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ reply: reply.trim() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
