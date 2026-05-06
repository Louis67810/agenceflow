import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CoachMessage = {
  role: "user" | "assistant";
  content: string;
};

type CoachTool = "article" | "task" | "linkedin_post" | "carousel" | "schedule_post" | "statistics";

const COACH_TOOLS = new Set<CoachTool>(["article", "task", "linkedin_post", "carousel", "schedule_post", "statistics"]);

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

function normalizeTool(value: unknown): CoachTool | null {
  if (typeof value !== "string") return null;
  return COACH_TOOLS.has(value as CoachTool) ? (value as CoachTool) : null;
}

function buildTitle(messages: CoachMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === "user")?.content.trim();
  if (!firstUserMessage) return "Nouvelle conversation";
  return firstUserMessage.length > 64 ? `${firstUserMessage.slice(0, 61)}...` : firstUserMessage;
}

function buildToolPrompt(tool: CoachTool | null) {
  if (!tool) return "";

  const prompts: Record<CoachTool, string> = {
    article: `## Outil actif : creation d'article
Tu dois produire un article exploitable. Structure la reponse avec : angle, titre SEO, plan H2/H3, brouillon, meta description, mots-cles et prochaines actions. Si l'utilisateur donne peu de contexte, propose une version prudente et liste les elements a confirmer.`,
    task: `## Outil actif : creation de tache
Tu dois transformer la demande en tache actionnable. Structure la reponse avec : titre, objectif, priorite, checklist, deadline conseillee, dependances et critere de validation.`,
    linkedin_post: `## Outil actif : creation de post LinkedIn
Tu dois produire un post pret a retravailler. Structure la reponse avec : hook, post complet, CTA, variantes de hook et conseil de publication. Garde un ton professionnel, direct et naturel.`,
    carousel: `## Outil actif : creation de carrousel
Tu dois produire un carrousel slide par slide. Structure la reponse avec : promesse, nombre de slides, contenu de chaque slide, design note courte, CTA final et texte de post associe.`,
    schedule_post: `## Outil actif : programmation de post
Tu dois aider a planifier une publication. Structure la reponse avec : objectif, meilleure fenetre de publication, checklist avant publication, texte a programmer et rappel des assets necessaires.`,
    statistics: `## Outil actif : analyse des statistiques
Tu dois analyser les donnees disponibles et en deduire des priorites. Structure la reponse avec : lecture des chiffres, signaux forts, risques, 3 actions prioritaires et prochaine mesure a suivre. Ne fabrique pas de chiffres absents.`,
  };

  return prompts[tool];
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
    const tool = normalizeTool(body.tool);

    if (messages.length === 0) {
      return NextResponse.json({ error: "Message manquant." }, { status: 400 });
    }

    const [projectsRes, leadsRes, statsRes, articlesCountRes, tasksCountRes, postsCountRes, carouselsCountRes] = await Promise.all([
      supabase.from("projects").select("name, status, deadline, current_stage").limit(10),
      supabase.from("leads").select("name, company, sector, status").limit(20),
      supabase.from("agenda_points_log").select("points").eq("user_id", user.id),
      supabase.from("articles").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("linkedin_posts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("carousels").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]);

    const projects = projectsRes.data ?? [];
    const leads = leadsRes.data ?? [];
    const totalPoints = (statsRes.data ?? []).reduce((sum: number, entry: { points: number | null }) => sum + (entry.points ?? 0), 0);
    const activeProjects = projects.filter((project) => project.status === "active").length;
    const activeLeads = leads.filter((lead) => lead.status === "active" || lead.status === "new").length;

    const businessData = `
## Donnees actuelles de l'agence
- Projets actifs : ${activeProjects} / ${projects.length} total
- Leads en cours : ${activeLeads}
- Secteurs leads : ${[...new Set(leads.map((lead) => lead.sector).filter(Boolean))].join(", ") || "Non definis"}
- Points Habits : ${totalPoints} points
- Articles en base : ${articlesCountRes.count ?? "Non connecte"}
- Taches en base : ${tasksCountRes.count ?? "Non connecte"}
- Posts LinkedIn en base : ${postsCountRes.count ?? "Non connecte"}
- Carrousels en base : ${carouselsCountRes.count ?? "Non connecte"}

${projects.length > 0 ? `### Projets\n${projects.map((project) => `- ${project.name} (${project.status}, etape: ${project.current_stage ?? "N/A"})`).join("\n")}` : ""}
    `.trim();

    const systemPrompt = `Tu es le Coach IA business de Louis dans AgenceFlow. Tu aides a prendre de meilleures decisions sur l'agence, les projets, les leads, la prospection, l'organisation, le contenu et les offres.
Tu reponds en francais, avec un ton direct, clair et actionnable.

${businessContext ? `## Contexte business\n${businessContext}\n` : ""}
${businessData}
${buildToolPrompt(tool)}

Regles :
- Reponds avec des recommandations concretes et priorisees.
- Si une information manque, propose une hypothese prudente et dis ce qu'il faudrait verifier.
- Quand un outil est actif, respecte strictement sa structure.
- Ne dis jamais que tu as cree un element en base si tu as seulement prepare le contenu.
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
        temperature: tool ? 0.55 : 0.7,
        max_tokens: tool ? 2200 : 1500,
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
        tool,
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
      tool,
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
