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

function extractJsonArray(text: string): unknown[] {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function shouldCreateAgendaTasks(tool: CoachTool | null, messages: CoachMessage[]) {
  const last = messages[messages.length - 1]?.content.toLowerCase() ?? "";
  const asksForTasks = /\b(cr[eé]e|créer|ajoute|ajouter|planifie|organise|g[eé]n[eè]re|génère)\b/.test(last) && /\b(t[aâ]che|taches|todo|journ[eé]e|planning)\b/.test(last);
  return tool === "task" || asksForTasks;
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
    const bodyOpenRouterApiKey = typeof body.openrouter_api_key === "string" ? body.openrouter_api_key.trim() : "";
    const conversationId = typeof body.conversation_id === "string" && body.conversation_id.trim() ? body.conversation_id.trim() : null;
    const tool = normalizeTool(body.tool);

    if (messages.length === 0) {
      return NextResponse.json({ error: "Message manquant." }, { status: 400 });
    }

    const [projectsRes, leadsRes, statsRes, articlesCountRes, tasksCountRes, postsCountRes, carouselsCountRes, agendaTasksRes, habitsRes, objectivesRes, recapRes, appSettingsRes, linkedinSettingsRes] = await Promise.all([
      supabase.from("projects").select("name, status, deadline, current_stage").limit(10),
      supabase.from("leads").select("name, company, sector, status").limit(20),
      supabase.from("agenda_points_log").select("points").eq("user_id", user.id),
      supabase.from("articles").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("linkedin_posts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("carousels").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("agenda_tasks").select("title, date, start_time, status, importance").eq("user_id", user.id).order("date", { ascending: true }).limit(30),
      supabase.from("agenda_habits").select("title, frequency, active, streak_current").eq("user_id", user.id).eq("active", true).limit(30),
      supabase.from("agenda_objectives").select("title, progress, status, target_date").eq("user_id", user.id).eq("status", "active").limit(20),
      supabase.from("agenda_daily_recap").select("recap_date, tasks_completed, tasks_planned, habits_done, habits_total, day_score, mood").eq("user_id", user.id).order("recap_date", { ascending: false }).limit(14),
      supabase.from("app_settings").select("openrouter_api_key, ai_models").eq("user_id", user.id).maybeSingle(),
      supabase.from("linkedin_user_settings").select("settings").eq("user_id", user.id).maybeSingle(),
    ]);

    const projects = projectsRes.data ?? [];
    const leads = leadsRes.data ?? [];
    const totalPoints = (statsRes.data ?? []).reduce((sum: number, entry: { points: number | null }) => sum + (entry.points ?? 0), 0);
    const activeProjects = projects.filter((project) => project.status === "active").length;
    const activeLeads = leads.filter((lead) => lead.status === "active" || lead.status === "new").length;

    const agendaTasks = agendaTasksRes.data ?? [];
    const habits = habitsRes.data ?? [];
    const objectives = objectivesRes.data ?? [];
    const recaps = recapRes.data ?? [];
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
- Taches agenda recentes/a venir : ${agendaTasks.length}
- Habitudes actives : ${habits.map((habit) => `${habit.title} (${habit.frequency}, streak ${habit.streak_current ?? 0})`).join(", ") || "Aucune"}
- Objectifs actifs : ${objectives.map((objective) => `${objective.title} (${objective.progress ?? 0}%)`).join(", ") || "Aucun"}
- Recaps recents : ${recaps.map((recap) => `${recap.recap_date}: score ${recap.day_score ?? 0}/10, humeur ${recap.mood ?? "N/A"}, taches ${recap.tasks_completed ?? 0}/${recap.tasks_planned ?? 0}`).join(" | ") || "Aucun"}

${projects.length > 0 ? `### Projets\n${projects.map((project) => `- ${project.name} (${project.status}, etape: ${project.current_stage ?? "N/A"})`).join("\n")}` : ""}
${agendaTasks.length > 0 ? `\n### Agenda\n${agendaTasks.map((task) => `- ${task.title} (${task.status}, ${task.date ?? "sans date"} ${task.start_time ?? ""}, importance ${task.importance ?? 3})`).join("\n")}` : ""}
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
- Ne dis jamais que tu as cree un element en base si tu as seulement prepare le contenu. Si l'API confirme une creation, tu peux le dire.
- Reste concis sauf si Louis demande un plan detaille.`;

    const linkedinSettings = linkedinSettingsRes.data?.settings as Record<string, unknown> | null | undefined;
    const appSettings = appSettingsRes.data as { openrouter_api_key?: string | null; ai_models?: Record<string, string> | null } | null;
    const apiKey =
      bodyOpenRouterApiKey ||
      (typeof appSettings?.openrouter_api_key === "string" && appSettings.openrouter_api_key.trim()) ||
      (typeof linkedinSettings?.openrouterApiKey === "string" && linkedinSettings.openrouterApiKey.trim()) ||
      process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Cle OpenRouter non configuree. Ajoute-la dans les parametres LinkedIn ou dans les parametres IA." }, { status: 500 });
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
    let reply = data.choices?.[0]?.message?.content ?? "";
    let createdTasks: Array<{ id: string; title: string }> = [];

    if (shouldCreateAgendaTasks(tool, messages)) {
      const today = new Date().toISOString().slice(0, 10);
      const taskResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://agenceflow.app",
          "X-Title": "AgenceFlow Coach IA Tasks",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: `Transforme la demande utilisateur en taches agenda concretes. Reponds UNIQUEMENT avec un tableau JSON valide. Champs: title, description, date (YYYY-MM-DD ou null), start_time (HH:mm ou null), duration_minutes (nombre), importance (1-5), tags (tableau). Date du jour: ${today}. Ne cree que les taches vraiment demandees.`,
            },
            ...messages,
          ],
          temperature: 0.25,
          max_tokens: 1300,
        }),
      });
      if (taskResponse.ok) {
        const taskData = await taskResponse.json();
        const rawTasks = extractJsonArray(taskData.choices?.[0]?.message?.content ?? "");
        const rows = rawTasks
          .map((item) => item && typeof item === "object" ? item as Record<string, unknown> : null)
          .filter((item): item is Record<string, unknown> => Boolean(item?.title))
          .slice(0, 20)
          .map((item) => ({
            user_id: user.id,
            title: String(item.title).slice(0, 180),
            description: typeof item.description === "string" ? item.description.slice(0, 2000) : null,
            date: typeof item.date === "string" && item.date ? item.date : today,
            start_time: typeof item.start_time === "string" && item.start_time ? item.start_time : null,
            duration_minutes: typeof item.duration_minutes === "number" ? item.duration_minutes : 45,
            importance: typeof item.importance === "number" ? Math.min(5, Math.max(1, Math.round(item.importance))) : 3,
            status: "todo",
            tags: Array.isArray(item.tags) ? item.tags.map(String).slice(0, 6) : ["coach-ia"],
          }));
        if (rows.length > 0) {
          const { data: insertedTasks, error: insertTasksError } = await supabase
            .from("agenda_tasks")
            .insert(rows)
            .select("id, title");
          if (!insertTasksError) {
            createdTasks = insertedTasks ?? [];
            reply = `${reply}\n\n---\nJ'ai cree ${createdTasks.length} tache${createdTasks.length > 1 ? "s" : ""} dans ton agenda :\n${createdTasks.map((task) => `- ${task.title}`).join("\n")}`;
          }
        }
      }
    }
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
        created_tasks: createdTasks,
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
      created_tasks: createdTasks,
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
