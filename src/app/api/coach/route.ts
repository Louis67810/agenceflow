import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token ?? undefined);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { messages, model = "openai/gpt-4o-mini", business_context = "", conversation_id } = body;

    // Fetch business data for context
    const [projectsRes, leadsRes, statsRes] = await Promise.all([
      supabase.from("projects").select("name, status, deadline, current_stage").limit(10),
      supabase.from("leads").select("name, company, sector, status").limit(20),
      supabase.from("agenda_points_log").select("points").eq("user_id", user.id),
    ]);

    const projects = projectsRes.data ?? [];
    const leads = leadsRes.data ?? [];
    const totalPoints = (statsRes.data ?? []).reduce((s: number, p: { points: number }) => s + p.points, 0);

    const businessData = `
## Données actuelles de l'agence
- **Projets actifs** : ${projects.filter(p => p.status === "active").length} / ${projects.length} total
- **Leads en cours** : ${leads.filter(l => l.status === "active" || l.status === "new").length}
- **Secteurs leads** : ${[...new Set(leads.map(l => l.sector).filter(Boolean))].join(", ") || "Non définis"}
- **Points Habits** : ${totalPoints} points

${projects.length > 0 ? `### Projets\n${projects.map(p => `- ${p.name} (${p.status}, étape: ${p.current_stage ?? "N/A"})`).join("\n")}` : ""}
    `.trim();

    const systemPrompt = `Tu es un coach business IA pour une agence créative. Tu es direct, concret et orienté résultats.
Tu as accès aux données réelles de l'agence et tu les utilises pour donner des conseils personnalisés.
Tu parles en français sauf demande contraire.

${business_context ? `## Contexte business\n${business_context}\n` : ""}
${businessData}

Règles :
- Réponds de façon concise et actionnable
- Propose des actions concrètes, pas des généralités
- Si tu vois des problèmes dans les données, dis-le directement
- Tu peux suggérer des stratégies, des templates, des plans d'action`;

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENROUTER_API_KEY non configurée" }, { status: 500 });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://agenceflow.app",
        "X-Title": "AgenceFlow Coach IA",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `OpenRouter: ${errText}` }, { status: 500 });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content ?? "";

    // Persist conversation
    if (conversation_id) {
      const allMessages = [
        ...messages,
        { role: "assistant", content: reply },
      ];
      await supabase
        .from("coach_conversations")
        .update({
          messages: allMessages,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversation_id)
        .eq("user_id", user.id);
    }

    return NextResponse.json({ reply });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// List conversations
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token ?? undefined);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("coach_conversations")
      .select("id, title, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    return NextResponse.json({ conversations: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
