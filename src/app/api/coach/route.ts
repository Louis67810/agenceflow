import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CoachMessage = {
  role: "user" | "assistant";
  content: string;
};

function normalizeMessages(value: unknown): CoachMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((message): message is CoachMessage => {
      if (!message || typeof message !== "object") return false;
      const candidate = message as Record<string, unknown>;
      return (candidate.role === "user" || candidate.role === "assistant") && typeof candidate.content === "string";
    })
    .map((message) => ({ role: message.role, content: message.content.slice(0, 12000) }))
    .slice(-20);
}

function buildTitle(messages: CoachMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === "user")?.content.trim();
  if (!firstUserMessage) return "Nouvelle conversation";
  return firstUserMessage.length > 64 ? `${firstUserMessage.slice(0, 61)}...` : firstUserMessage;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token ?? undefined);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const messages = normalizeMessages(body.messages);
    const model = typeof body.model === "string" ? body.model : "openai/gpt-4o-mini";
    const businessContext = typeof body.business_context === "string" ? body.business_context : "";
    const conversationId = typeof body.conversation_id === "string" && body.conversation_id.trim() ? body.conversation_id.trim() : null;

    if (messages.length === 0) {
      return NextResponse.json({ error: "Message manquant." }, { status: 400 });
    }

    const [projectsRes, leadsRes, statsRes] = await Promise.all([
      supabase.from("projects").select("name, status, deadline, current_stage").limit(10),
      supabase.from("leads").select("name, company, sector, status").limit(20),
      supabase.from("agenda_points_log").select("points").eq("user_id", user.id),
    ]);

    const projects = projectsRes.data ?? [];
    const leads = leadsRes.data ?? [];
    const totalPoints = (statsRes.data ?? []).reduce((sum: number, entry: { points: number | null }) => sum + (entry.points ?? 0), 0);

    const businessData = `
## Donnees actuelles de l'agence
- Projets actifs : ${projects.filter((project) => project.status === "active").length} / ${projects.length} total
- Leads en cours : ${leads.filter((lead) => lead.status === "active" || lead.status === "new").length}
- Secteurs leads : ${[...new Set(leads.map((lead) => lead.sector).filter(Boolean))].join(", ") || "Non definis"}
- Points Habits : ${totalPoints} points

${projects.length > 0 ? `### Projets\n${projects.map((project) => `- ${project.name} (${project.status}, etape: ${project.current_stage ?? "N/A"})`).join("\n")}` : ""}
    `.trim();

    const systemPrompt = `Tu es le Coach IA business de Louis dans AgenceFlow. Tu aides a prendre de meilleures decisions sur l'agence, les projets, les leads, la prospection, l'organisation et les offres.
Tu reponds en francais, avec un ton direct, clair et actionnable.

${businessContext ? `## Contexte business\n${businessContext}\n` : ""}
${businessData}

Regles :
- Reponds avec des recommandations concretes et priorisees.
- Si une information manque, propose une hypothese prudente et dis ce qu'il faudrait verifier.
- Ne parle pas comme un assistant LinkedIn posts : tu es un coach business general.
- Reste concis sauf si Louis demande un plan detaille.`;

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENROUTER_API_KEY non configuree" }, { status: 500 });
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
      const errorText = await response.text();
      return NextResponse.json({ error: `OpenRouter: ${errorText}` }, { status: 500 });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content ?? "";
    const allMessages: CoachMessage[] = [...messages, { role: "assistant", content: reply }];
    const now = new Date().toISOString();

    if (conversationId) {
      const { data: updatedConversation, error } = await supabase
        .from("coach_conversations")
        .update({ messages: allMessages, updated_at: now })
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .select("id, title, updated_at")
        .maybeSingle();

      if (error) throw error;
      return NextResponse.json({
        reply,
        conversation_id: updatedConversation?.id ?? conversationId,
        conversation: updatedConversation,
      });
    }

    const { data: createdConversation, error } = await supabase
      .from("coach_conversations")
      .insert({
        user_id: user.id,
        title: buildTitle(messages),
        messages: allMessages,
        updated_at: now,
      })
      .select("id, title, updated_at")
      .single();

    if (error) throw error;

    return NextResponse.json({
      reply,
      conversation_id: createdConversation.id,
      conversation: createdConversation,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token ?? undefined);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const conversationId = req.nextUrl.searchParams.get("id");
    if (conversationId) {
      const { data, error } = await supabase
        .from("coach_conversations")
        .select("id, title, messages, created_at, updated_at")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });
      return NextResponse.json({ conversation: data });
    }

    const { data, error } = await supabase
      .from("coach_conversations")
      .select("id, title, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(30);

    if (error) throw error;
    return NextResponse.json({ conversations: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
