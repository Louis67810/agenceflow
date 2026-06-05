"use client";

import { useEffect, useRef, useState } from "react";
import { agendaFetch } from "@/lib/agenda/fetchWithAuth";
import { loadLinkedInSettings, OPENROUTER_MODELS } from "@/lib/linkedin/settings";
import {
  BarChart3,
  ChevronDown,
  Clock3,
  FileText,
  History,
  Images,
  Linkedin,
  ListTodo,
  Loader2,
  PanelLeftOpen,
  PencilLine,
  Plus,
  Search,
  Send,
  X,
} from "lucide-react";

const jakartaSans = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;
const cardShadow = "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)";
const composerShadow = "0px 23px 16px rgba(18,26,46,0.04), 0px 10px 11px rgba(18,26,46,0.04), 0px 2px 6px rgba(18,26,46,0.05)";
const selectedBg = "#f4f4f4";
const inactiveIconColor = "rgba(18,26,46,0.7)";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Conversation = {
  id: string;
  title: string;
  created_at?: string;
  updated_at: string;
  messages?: Message[];
};

type CoachTool = "article" | "task" | "linkedin_post" | "carousel" | "schedule_post" | "statistics";

const MODELS = [
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "anthropic/claude-opus-4", label: "Claude Opus 4" },
  { id: "anthropic/claude-sonnet-4-5", label: "Sonnet 4.6" },
  { id: "anthropic/claude-haiku-4-5", label: "Claude Haiku" },
  { id: "google/gemini-2.0-flash-001", label: "Gemini Flash" },
  { id: "mistralai/mistral-large-2411", label: "Mistral Large" },
];
const MODEL_OPTIONS = Array.from(
  new Map([...OPENROUTER_MODELS, ...MODELS].map((model) => [model.id, model])).values()
);

const SUGGESTIONS = [
  { label: "Creer un article", prompt: "Aide-moi a creer un article clair et actionnable pour mon audience.", tool: "article" as CoachTool, icon: FileText },
  { label: "Planifier mes taches", prompt: "Transforme mes priorites en taches concretes et ordonnees.", tool: "task" as CoachTool, icon: ListTodo },
  { label: "Lire mes statistiques", prompt: "Analyse mes statistiques et donne-moi les actions les plus importantes.", tool: "statistics" as CoachTool, icon: BarChart3 },
];

const TOOL_ACTIONS = [
  { label: "Creer un article", description: "Plan, titre, angle et brouillon", tool: "article" as CoachTool, prompt: "Cree un article complet a partir de mon idee.", icon: FileText },
  { label: "Creer une tache", description: "Action claire, priorite et prochaine etape", tool: "task" as CoachTool, prompt: "Cree une tache claire avec priorite, contexte et prochaine action.", icon: ListTodo },
  { label: "Creer un post LinkedIn", description: "Hook, contenu et CTA", tool: "linkedin_post" as CoachTool, prompt: "Cree un post LinkedIn pret a publier pour mon audience.", icon: Linkedin },
  { label: "Creer un carrousel", description: "Structure slide par slide", tool: "carousel" as CoachTool, prompt: "Cree un carrousel LinkedIn slide par slide.", icon: Images },
  { label: "Programmer un post", description: "Creneau, objectif et checklist", tool: "schedule_post" as CoachTool, prompt: "Aide-moi a programmer un post avec un bon timing et une checklist.", icon: Clock3 },
  { label: "Analyser les statistiques", description: "Lecture des chiffres et priorites", tool: "statistics" as CoachTool, prompt: "Analyse mes statistiques et dis-moi quoi ameliorer en priorite.", icon: BarChart3 },
];

function normalizeMessages(value: unknown): Message[] {
  if (!Array.isArray(value)) return [];
  return value.filter((message): message is Message => {
    if (!message || typeof message !== "object") return false;
    const candidate = message as Record<string, unknown>;
    return (candidate.role === "user" || candidate.role === "assistant") && typeof candidate.content === "string";
  });
}

function formatDate(value?: string) {
  if (!value) return "Aujourd'hui";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Aujourd'hui";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("anthropic/claude-sonnet-4-5");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [businessContext, setBusinessContext] = useState("");
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<CoachTool | null>(null);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [plusHovered, setPlusHovered] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [viewportWidth, setViewportWidth] = useState(1280);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const selectedModel = MODEL_OPTIONS.find((entry) => entry.id === model) ?? MODEL_OPTIONS[0];
  const filteredModels = MODEL_OPTIONS.filter((entry) => `${entry.label} ${entry.id}`.toLowerCase().includes(modelSearch.toLowerCase()));
  const selectedToolEntry = TOOL_ACTIONS.find((entry) => entry.tool === selectedTool);
  const coachComposerRows = Math.min(7, Math.max(1, input.split("\n").length));
  const coachComposerExpanded = coachComposerRows > 1 || input.length > 96;
  const isMobile = viewportWidth < 768;
  const isTablet = viewportWidth >= 768 && viewportWidth < 1100;
  const contentLeft = isMobile ? 0 : chatPanelOpen ? 380 : 60;
  const filteredConversations = (() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) => conversation.title.toLowerCase().includes(query));
  })();

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    function updateViewportWidth() {
      setViewportWidth(window.innerWidth);
    }

    updateViewportWidth();
    window.addEventListener("resize", updateViewportWidth);
    return () => window.removeEventListener("resize", updateViewportWidth);
  }, []);


  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function loadInitialData() {
    const [conversationsRes, settingsRes] = await Promise.allSettled([
      agendaFetch("/api/coach").then((response) => response.json()),
      agendaFetch("/api/app-settings").then((response) => response.json()),
    ]);

    if (conversationsRes.status === "fulfilled") {
      setConversations(conversationsRes.value.conversations ?? []);
    }

    if (settingsRes.status === "fulfilled") {
      setBusinessContext(settingsRes.value.settings?.business_context ?? "");
      const savedModel = settingsRes.value.settings?.ai_models?.coach;
      if (savedModel) setModel(savedModel);
    }

    const linkedInSettings = loadLinkedInSettings();
    if (!settingsRes || settingsRes.status !== "fulfilled" || !settingsRes.value.settings?.ai_models?.coach) {
      setModel(linkedInSettings.model);
    }
  }

  function startNewConversation() {
    setChatPanelOpen(false);
    setToolMenuOpen(false);
    setError("");
    if (messages.length === 0 && !input.trim()) {
      window.setTimeout(() => inputRef.current?.focus(), 40);
      return;
    }
    setMessages([]);
    setConversationId(null);
    setInput("");
    window.setTimeout(() => inputRef.current?.focus(), 40);
  }

  async function openConversation(id: string) {
    setError("");
    const response = await agendaFetch(`/api/coach?id=${encodeURIComponent(id)}`);
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Impossible d'ouvrir cette conversation.");
      return;
    }
    setConversationId(data.conversation.id);
    setMessages(normalizeMessages(data.conversation.messages));
    setChatPanelOpen(false);
  }

  async function refreshConversations(nextConversation?: Conversation) {
    if (nextConversation?.id) {
      setConversations((current) => {
        const rest = current.filter((conversation) => conversation.id !== nextConversation.id);
        return [nextConversation, ...rest];
      });
      return;
    }

    const response = await agendaFetch("/api/coach");
    const data = await response.json();
    if (response.ok) setConversations(data.conversations ?? []);
  }

  function chooseTool(tool: CoachTool, _prompt: string) {
    setSelectedTool(tool);
    setToolMenuOpen(false);
    window.setTimeout(() => inputRef.current?.focus(), 40);
  }

  async function send(text?: string, forcedTool?: CoachTool) {
    const content = (text ?? input).trim();
    const tool = forcedTool ?? selectedTool;
    if (!content || loading) return;

    setInput("");
    setError("");
    setToolMenuOpen(false);
    const nextMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const response = await agendaFetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          model,
          business_context: businessContext,
          conversation_id: conversationId,
          tool,
          openrouter_api_key: loadLinkedInSettings().openrouterApiKey || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.reply) {
        throw new Error(data.error ?? "Reponse impossible pour le moment.");
      }

      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
      if (data.conversation_id) setConversationId(data.conversation_id);
      await refreshConversations(data.conversation);
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "Le Coach IA n'a pas pu repondre.";
      setError(message);
      setMessages([...nextMessages, { role: "assistant", content: "Je n'ai pas pu repondre correctement. Verifie la configuration IA, puis relance ta demande." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ height: "100dvh", minHeight: isMobile ? 0 : 720, background: "#fbfbfb", color: "#121a2e", overflow: "hidden", position: "relative", ...jakartaSans }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: "-28%", background: "linear-gradient(180deg, rgba(225,238,255,0.98) 0%, rgba(241,248,255,0.9) 34%, rgba(251,251,251,0.86) 62%, rgba(251,251,251,0.98) 100%), radial-gradient(ellipse at 50% 0%, rgba(1,71,255,0.26) 0%, rgba(84,200,255,0.18) 34%, rgba(255,255,255,0.46) 68%, rgba(255,255,255,0) 94%), radial-gradient(circle at 8% 4%, rgba(1,71,255,0.18), rgba(255,255,255,0) 34%), radial-gradient(circle at 96% 6%, rgba(1,71,255,0.2), rgba(255,255,255,0) 38%)", filter: "blur(8px)", pointerEvents: "none", opacity: loading ? 1 : 0.96, animation: "coachLoaderPulse 2.4s ease-in-out infinite alternate", zIndex: 1 }} />

      <aside style={{ position: "absolute", left: 0, top: 0, bottom: isMobile ? "auto" : 0, right: isMobile ? 0 : "auto", width: isMobile ? "100%" : 60, minHeight: isMobile ? 58 : "auto", background: "#fff", borderRight: isMobile ? 0 : "1px solid rgba(18,26,46,0.1)", borderBottom: isMobile ? "1px solid rgba(18,26,46,0.1)" : 0, zIndex: 20, display: "flex", flexDirection: isMobile ? "row" : "column", alignItems: "center", justifyContent: isMobile ? "center" : "flex-start", gap: isMobile ? 10 : 16, paddingTop: isMobile ? 10 : 26, paddingBottom: isMobile ? 10 : 0, boxShadow: isMobile ? "0 10px 26px rgba(18,26,46,0.06)" : "none" }}>
        {[
          { id: "chats", title: "Chats recents", active: chatPanelOpen, onClick: () => setChatPanelOpen((value) => !value), icon: <PanelLeftOpen size={20} /> },
          { id: "new", title: "Nouveau chat", active: !conversationId && messages.length === 0 && !chatPanelOpen, onClick: startNewConversation, icon: <PencilLine size={20} /> },
          { id: "search", title: "Rechercher un chat", active: false, onClick: () => setChatPanelOpen(true), icon: <Search size={20} /> },
        ].map((item) => (
          <button key={item.id} type="button" onClick={item.onClick} title={item.title} style={{ width: 36, height: 36, borderRadius: 9, border: 0, background: item.active ? selectedBg : "transparent", color: item.active ? "#000" : inactiveIconColor, opacity: item.active ? 1 : 0.7, display: "grid", placeItems: "center", cursor: "pointer" }}>{item.icon}</button>
        ))}
      </aside>

      <aside style={{ position: "absolute", top: isMobile ? 58 : 0, left: chatPanelOpen ? (isMobile ? 0 : 60) : (isMobile ? "-100%" : -320), bottom: 0, width: isMobile ? "min(100%, 360px)" : 320, maxWidth: "100vw", background: "#fff", borderRight: "1px solid rgba(18,26,46,0.1)", boxShadow: "20px 0 42px rgba(18,26,46,0.06)", zIndex: 18, transition: "left 0.22s ease", display: "flex", flexDirection: "column" }}>
        <div style={{ minHeight: 70, padding: "0 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(18,26,46,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 34, height: 34, borderRadius: 11, background: selectedBg, color: "#000", display: "grid", placeItems: "center" }}><History size={17} /></span>
            <strong style={{ fontSize: 15 }}>Chats recents</strong>
          </div>
          <button type="button" onClick={() => setChatPanelOpen(false)} style={{ width: 32, height: 32, borderRadius: 999, border: 0, background: "transparent", cursor: "pointer", color: "rgba(18,26,46,0.58)", display: "grid", placeItems: "center" }}><X size={18} /></button>
        </div>

        <div style={{ padding: 14, borderBottom: "1px solid rgba(18,26,46,0.08)" }}>
          <div style={{ minHeight: 42, borderRadius: 13, background: "#f7f8fb", border: "1px solid rgba(18,26,46,0.08)", display: "flex", alignItems: "center", gap: 9, padding: "0 12px" }}>
            <Search size={15} style={{ color: "rgba(18,26,46,0.42)" }} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un chat" style={{ flex: 1, border: 0, outline: "none", background: "transparent", color: "#121a2e", fontSize: 13 }} />
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 10 }}>
          {filteredConversations.length === 0 ? (
            <div style={{ height: "100%", display: "grid", placeItems: "center", textAlign: "center", color: "rgba(18,26,46,0.42)", fontSize: 13, lineHeight: "20px", padding: 24 }}>
              Aucun chat recent pour le moment.
            </div>
          ) : filteredConversations.map((conversation) => {
            const active = conversation.id === conversationId;
            return (
              <button key={conversation.id} type="button" onClick={() => void openConversation(conversation.id)} style={{ width: "100%", border: 0, borderRadius: 13, background: active ? selectedBg : "transparent", padding: "12px 11px", display: "grid", gap: 6, textAlign: "left", cursor: "pointer", color: "#121a2e" }}>
                <span style={{ fontSize: 13, fontWeight: 760, lineHeight: "18px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{conversation.title}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "rgba(18,26,46,0.42)", fontWeight: 650 }}><Clock3 size={12} />{formatDate(conversation.updated_at)}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <section style={{ position: "relative", zIndex: 3, height: "100%", minHeight: 0, paddingLeft: contentLeft, display: "flex", flexDirection: "column", transition: "padding-left 0.22s ease", overflow: "hidden" }}>
        <div style={{ height: isMobile ? 58 : 64 }} />

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", padding: isMobile ? "22px 16px 176px" : isTablet ? "28px 32px 164px" : "34px 72px 164px", scrollBehavior: "smooth" }}>
          {messages.length === 0 ? (
            <div style={{ maxWidth: 1120, width: "100%", margin: "0 auto" }}>
              <h1 style={{ margin: isMobile ? "28px 0 24px" : isTablet ? "48px 0 32px" : "74px 0 38px", textAlign: "center", fontSize: isMobile ? 34 : isTablet ? 42 : 48, lineHeight: isMobile ? "40px" : isTablet ? "48px" : "56px", fontWeight: 760, letterSpacing: 0, color: "#121a2e" }}>Bonjour Louis</h1>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))", gap: isMobile ? 10 : 13 }}>
                {SUGGESTIONS.map((suggestion) => {
                  const Icon = suggestion.icon;
                  const active = selectedTool === suggestion.tool;
                  return (
                    <button key={suggestion.label} type="button" onClick={() => void send(suggestion.prompt, suggestion.tool)} style={{ minHeight: isMobile ? 82 : 106, borderRadius: isMobile ? 16 : 20, border: "1px solid rgba(18,26,46,0.16)", background: active ? selectedBg : "#fff", boxShadow: cardShadow, padding: isMobile ? "14px 16px" : "20px 22px", boxSizing: "border-box", display: "flex", flexDirection: isMobile ? "row" : "column", alignItems: isMobile ? "center" : "flex-start", justifyContent: isMobile ? "flex-start" : "space-between", gap: isMobile ? 12 : 0, textAlign: "left", cursor: "pointer", color: "#121a2e" }}>
                      <span style={{ width: 38, height: 38, borderRadius: 8, background: active ? selectedBg : "#ececec", color: active ? "#000" : inactiveIconColor, opacity: active ? 1 : 0.7, display: "grid", placeItems: "center", marginBottom: 13 }}><Icon size={17} /></span>
                      <strong style={{ fontSize: 14, lineHeight: "19px", fontWeight: 650, letterSpacing: 0 }}>{suggestion.label}</strong>
                    </button>
                  );
                })}
              </div>

              <div style={{ maxWidth: 920, margin: isMobile ? "30px auto 0" : "54px auto 0" }}>
                <p style={{ margin: "0 0 20px", fontSize: 14, color: "rgba(18,26,46,0.58)", fontWeight: 650 }}>Recents :</p>
                {(conversations.length ? conversations.slice(0, 4) : [{ id: "empty-1", title: "Aucune conversation recente", updated_at: new Date().toISOString() }]).map((conversation) => (
                  <button key={conversation.id} type="button" disabled={conversation.id.startsWith("empty")} onClick={() => void openConversation(conversation.id)} style={{ width: "100%", minHeight: 58, border: 0, borderTop: "1px solid rgba(18,26,46,0.08)", background: "transparent", display: "flex", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 4 : 12, textAlign: "left", padding: isMobile ? "10px 0" : 0, cursor: conversation.id.startsWith("empty") ? "default" : "pointer", color: conversation.id.startsWith("empty") ? "rgba(18,26,46,0.34)" : "#121a2e" }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{conversation.title}</span>
                    {!conversation.id.startsWith("empty") ? <span style={{ fontSize: 12, color: "rgba(18,26,46,0.42)" }}>{formatDate(conversation.updated_at)}</span> : null}
                  </button>
                ))}
                <div style={{ borderTop: "1px solid rgba(18,26,46,0.08)" }} />
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: 920, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: isMobile ? 16 : 21 }}>
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  style={{
                    width: "fit-content",
                    maxWidth: isMobile ? "92%" : "75%",
                    alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                    borderRadius: 20,
                    background: message.role === "user" ? "#F4F4F4" : "transparent",
                    padding: message.role === "user" ? "14px 16px" : 0,
                  }}
                >
                  <div style={{ margin: 0, fontSize: isMobile ? 14 : 13, lineHeight: 1.6, color: "rgba(18,26,46,0.82)", whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word", fontFamily: "Inter, sans-serif" }}>
                    {message.content}
                  </div>
                </div>
              ))}
              {loading ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, color: "rgba(18,26,46,0.54)", fontSize: 13, fontWeight: 700 }}>
                  <span style={{ width: 34, height: 34, borderRadius: 999, background: "#fff", border: "1px solid rgba(18,26,46,0.1)", display: "grid", placeItems: "center", boxShadow: "0 10px 22px rgba(18,26,46,0.06)" }}><Loader2 size={16} style={{ animation: "spin 1s linear infinite", color: "#0147ff" }} /></span>
                  Coach IA travaille...
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {error ? <div style={{ position: "absolute", left: isMobile ? 12 : "50%", right: isMobile ? 12 : "auto", bottom: isMobile ? 116 : 126, transform: isMobile ? "none" : "translateX(-50%)", maxWidth: isMobile ? "none" : 620, borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "10px 14px", fontSize: 13, fontWeight: 650, zIndex: 8 }}>{error}</div> : null}

        <div style={{ position: "absolute", left: contentLeft, right: 0, bottom: 0, zIndex: 7, padding: isMobile ? "0 12px 12px" : isTablet ? "0 24px 28px" : "0 48px 34px", transition: "left 0.22s ease" }}>
          <div style={{ maxWidth: 860, width: "100%", minHeight: 66, margin: "0 auto", borderRadius: isMobile ? 24 : 34, border: "1px solid rgba(18,26,46,0.18)", background: "rgba(255,255,255,0.96)", boxShadow: composerShadow, display: "flex", flexDirection: "column", gap: 10, padding: isMobile ? 10 : 12, backdropFilter: "blur(10px)", position: "relative", boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: isMobile || coachComposerExpanded ? "wrap" : "nowrap", gap: isMobile || coachComposerExpanded ? "10px 10px" : 12, width: "100%", minWidth: 0 }}>
              <button type="button" onClick={() => setToolMenuOpen((value) => !value)} onMouseEnter={() => setPlusHovered(true)} onMouseLeave={() => setPlusHovered(false)} title="Actions IA" style={{ width: 40, height: 40, borderRadius: 34, border: 0, background: plusHovered || toolMenuOpen ? "#F6F6F6" : "transparent", display: "grid", placeItems: "center", color: "#121a2e", cursor: "pointer", flexShrink: 0 }}><Plus size={18} /></button>
              {selectedToolEntry ? (
                <button type="button" onClick={() => setSelectedTool(null)} style={{ border: 0, borderRadius: 999, background: "#0147ff14", color: "#0147ff", minHeight: 24, padding: "0 9px", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, fontWeight: 800, fontFamily: '"Plus Jakarta Sans", sans-serif', flexShrink: 0 }}>
                  <selectedToolEntry.icon size={12} />
                  {selectedToolEntry.label}
                </button>
              ) : null}
              <textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Taper un texte ici" rows={coachComposerRows} style={{ order: isMobile || coachComposerExpanded ? -1 : 0, flex: isMobile || coachComposerExpanded ? "0 0 100%" : 1, width: isMobile || coachComposerExpanded ? "100%" : "auto", minWidth: 0, minHeight: 24, maxHeight: 168, border: 0, outline: "none", resize: "none", background: "transparent", color: "rgba(18,26,46,0.7)", fontSize: 16, fontWeight: 500, lineHeight: isMobile || coachComposerExpanded ? "22px" : "24px", letterSpacing: "-0.2px", fontFamily: "Inter, sans-serif", padding: 0, overflowY: input.split("\n").length > 7 || input.length > 238 ? "auto" : "hidden", opacity: loading ? 0.55 : 1, whiteSpace: "pre-wrap", overflowWrap: "break-word", wordBreak: "break-word" }} />
              <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: selectedToolEntry ? 10 : 16, flex: isMobile ? "1 1 auto" : "0 0 auto", minWidth: 0, marginLeft: "auto" }}>
                <button type="button" onClick={() => setModelPickerOpen((value) => !value)} style={{ border: 0, background: "transparent", padding: 0, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "rgba(18,26,46,0.7)", fontSize: isMobile ? 12 : 14, fontWeight: 500, lineHeight: "18px", fontFamily: "Inter, sans-serif", minWidth: 0, maxWidth: isMobile ? 150 : "none" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedModel.label}</span>
                  <ChevronDown size={14} style={{ color: "rgba(18,26,46,0.52)" }} />
                </button>
                <button type="button" onClick={() => void send()} disabled={loading || !input.trim()} style={{ width: 46, height: 46, borderRadius: 34, background: "#121a2e", color: "#fff", border: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: loading || !input.trim() ? "not-allowed" : "pointer", flexShrink: 0, opacity: loading || !input.trim() ? 0.72 : 1 }}>
                  {loading ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={18} />}
                </button>
              </div>
            </div>

            {toolMenuOpen ? (
              <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(100% + 10px)", borderRadius: 18, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", boxShadow: composerShadow, padding: 10, display: "grid", gap: 6, maxHeight: 280, overflowY: "auto", zIndex: 12 }}>
                {TOOL_ACTIONS.map((entry) => {
                  const Icon = entry.icon;
                  const active = selectedTool === entry.tool;
                  return (
                    <button key={entry.tool} type="button" onClick={() => chooseTool(entry.tool, entry.prompt)} style={{ border: 0, borderRadius: 12, background: active ? "#FBFBFB" : "transparent", padding: "9px 10px", display: "flex", alignItems: "center", gap: 9, textAlign: "left", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                      <span style={{ width: 24, height: 24, borderRadius: 999, background: "#0147ff18", color: "#0147ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={13} /></span>
                      <span style={{ minWidth: 0 }}>
                        <strong style={{ display: "block", fontSize: 12, lineHeight: "17px" }}>{entry.label}</strong>
                        <span style={{ display: "block", marginTop: 2, fontSize: 11, color: "rgba(18,26,46,0.48)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {modelPickerOpen ? (
              <div style={{ position: "absolute", right: isMobile ? 0 : 58, bottom: 66, width: isMobile ? "calc(100vw - 44px)" : 300, maxWidth: 360, borderRadius: 18, border: "1px solid rgba(18,26,46,0.12)", background: "rgba(255,255,255,0.96)", boxShadow: composerShadow, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40, borderRadius: 12, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", padding: "0 12px" }}>
                  <Search size={14} style={{ color: "#6f7887" }} />
                  <input value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} placeholder="Rechercher un modele..." style={{ flex: 1, border: 0, outline: "none", background: "transparent", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#121a2e" }} autoFocus />
                </div>
                <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                  {filteredModels.map((entry) => (
                    <button key={entry.id} type="button" onClick={() => { setModel(entry.id); setModelPickerOpen(false); setModelSearch(""); }} style={{ width: "100%", border: 0, borderRadius: 10, background: model === entry.id ? "rgba(0,0,0,0.04)" : "transparent", padding: "10px 11px", textAlign: "left", fontSize: 13, fontWeight: 500, color: "#121a2e", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes coachLoaderPulse { from { opacity: 0.92; } to { opacity: 0.46; } }`}</style>
    </main>
  );
}
