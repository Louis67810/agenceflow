"use client";

import { useEffect, useRef, useState } from "react";
import { agendaFetch } from "@/lib/agenda/fetchWithAuth";
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
  const [plusHovered, setPlusHovered] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const selectedModel = MODELS.find((entry) => entry.id === model) ?? MODELS[0];
  const selectedToolEntry = TOOL_ACTIONS.find((entry) => entry.tool === selectedTool);
  const contentLeft = chatPanelOpen ? 380 : 60;
  const filteredConversations = (() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) => conversation.title.toLowerCase().includes(query));
  })();

  useEffect(() => {
    void loadInitialData();
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

  function chooseTool(tool: CoachTool, prompt: string) {
    setSelectedTool(tool);
    setToolMenuOpen(false);
    setInput(prompt);
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
    <main style={{ height: "100vh", minHeight: 720, background: "#fbfbfb", color: "#121a2e", overflow: "hidden", position: "relative", ...jakartaSans }}>
      <img src="/linkedin-chat-loader.svg" alt="" aria-hidden="true" style={{ position: "absolute", top: -1080, left: "50%", width: "231%", height: 2340, transform: "translateX(-50%)", objectFit: "fill", pointerEvents: "none", opacity: loading ? 1 : 0.46, animation: "coachLoaderPulse 2s ease-in-out infinite alternate", zIndex: 1 }} />

      <aside style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 60, background: "#fff", borderRight: "1px solid rgba(18,26,46,0.1)", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, paddingTop: 26 }}>
        {[
          { id: "chats", title: "Chats recents", active: chatPanelOpen, onClick: () => setChatPanelOpen((value) => !value), icon: <PanelLeftOpen size={20} /> },
          { id: "new", title: "Nouveau chat", active: !conversationId && messages.length === 0 && !chatPanelOpen, onClick: startNewConversation, icon: <PencilLine size={20} /> },
          { id: "search", title: "Rechercher un chat", active: false, onClick: () => setChatPanelOpen(true), icon: <Search size={20} /> },
        ].map((item) => (
          <button key={item.id} type="button" onClick={item.onClick} title={item.title} style={{ width: 36, height: 36, borderRadius: 9, border: 0, background: item.active ? selectedBg : "transparent", color: item.active ? "#000" : inactiveIconColor, opacity: item.active ? 1 : 0.7, display: "grid", placeItems: "center", cursor: "pointer" }}>{item.icon}</button>
        ))}
      </aside>

      <aside style={{ position: "absolute", top: 0, left: chatPanelOpen ? 60 : -320, bottom: 0, width: 320, background: "#fff", borderRight: "1px solid rgba(18,26,46,0.1)", boxShadow: "20px 0 42px rgba(18,26,46,0.06)", zIndex: 8, transition: "left 0.22s ease", display: "flex", flexDirection: "column" }}>
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

      <section style={{ position: "relative", zIndex: 3, height: "100%", paddingLeft: contentLeft, display: "flex", flexDirection: "column", transition: "padding-left 0.22s ease" }}>
        <div style={{ height: 64 }} />

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "34px 72px 150px" }}>
          {messages.length === 0 ? (
            <div style={{ maxWidth: 1120, margin: "0 auto" }}>
              <h1 style={{ margin: "74px 0 38px", textAlign: "center", fontSize: 48, lineHeight: "56px", fontWeight: 760, letterSpacing: 0, color: "#121a2e" }}>Bonjour Louis</h1>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 13 }}>
                {SUGGESTIONS.map((suggestion) => {
                  const Icon = suggestion.icon;
                  const active = selectedTool === suggestion.tool;
                  return (
                    <button key={suggestion.label} type="button" onClick={() => void send(suggestion.prompt, suggestion.tool)} style={{ minHeight: 106, borderRadius: 20, border: "1px solid rgba(18,26,46,0.16)", background: active ? selectedBg : "#fff", boxShadow: cardShadow, padding: "20px 22px", boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "space-between", textAlign: "left", cursor: "pointer", color: "#121a2e" }}>
                      <span style={{ width: 38, height: 38, borderRadius: 8, background: active ? selectedBg : "#ececec", color: active ? "#000" : inactiveIconColor, opacity: active ? 1 : 0.7, display: "grid", placeItems: "center", marginBottom: 13 }}><Icon size={17} /></span>
                      <strong style={{ fontSize: 14, lineHeight: "19px", fontWeight: 650, letterSpacing: 0 }}>{suggestion.label}</strong>
                    </button>
                  );
                })}
              </div>

              <div style={{ maxWidth: 920, margin: "54px auto 0" }}>
                <p style={{ margin: "0 0 20px", fontSize: 14, color: "rgba(18,26,46,0.58)", fontWeight: 650 }}>Recents :</p>
                {(conversations.length ? conversations.slice(0, 4) : [{ id: "empty-1", title: "Aucune conversation recente", updated_at: new Date().toISOString() }]).map((conversation) => (
                  <button key={conversation.id} type="button" disabled={conversation.id.startsWith("empty")} onClick={() => void openConversation(conversation.id)} style={{ width: "100%", minHeight: 58, border: 0, borderTop: "1px solid rgba(18,26,46,0.08)", background: "transparent", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left", padding: 0, cursor: conversation.id.startsWith("empty") ? "default" : "pointer", color: conversation.id.startsWith("empty") ? "rgba(18,26,46,0.34)" : "#121a2e" }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{conversation.title}</span>
                    {!conversation.id.startsWith("empty") ? <span style={{ fontSize: 12, color: "rgba(18,26,46,0.42)" }}>{formatDate(conversation.updated_at)}</span> : null}
                  </button>
                ))}
                <div style={{ borderTop: "1px solid rgba(18,26,46,0.08)" }} />
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: 920, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} style={{ display: "flex", justifyContent: message.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "78%", borderRadius: message.role === "user" ? "22px 22px 6px 22px" : "22px 22px 22px 6px", background: message.role === "user" ? "#121a2e" : "#fff", color: message.role === "user" ? "#fff" : "#121a2e", border: message.role === "user" ? "1px solid #121a2e" : "1px solid rgba(18,26,46,0.1)", boxShadow: message.role === "user" ? "none" : "0 14px 34px rgba(18,26,46,0.06)", padding: "15px 18px", fontSize: 15, lineHeight: "25px", whiteSpace: "pre-wrap", fontFamily: "Inter, sans-serif" }}>
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

        {error ? <div style={{ position: "absolute", left: "50%", bottom: 126, transform: "translateX(-50%)", maxWidth: 620, borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "10px 14px", fontSize: 13, fontWeight: 650, zIndex: 8 }}>{error}</div> : null}

        <div style={{ position: "absolute", left: contentLeft, right: 0, bottom: 0, zIndex: 7, padding: "0 48px 34px", transition: "left 0.22s ease" }}>
          <div style={{ maxWidth: 860, minHeight: selectedToolEntry ? 104 : 70, margin: "0 auto", borderRadius: selectedToolEntry ? 30 : 999, border: "1px solid rgba(18,26,46,0.12)", background: "rgba(255,255,255,0.96)", boxShadow: composerShadow, display: "flex", flexDirection: selectedToolEntry ? "column" : "row", alignItems: selectedToolEntry ? "stretch" : "center", gap: selectedToolEntry ? 8 : 16, padding: selectedToolEntry ? "13px 14px 12px 20px" : "9px 10px 9px 22px", backdropFilter: "blur(10px)", position: "relative" }}>
            {selectedToolEntry ? (
              <textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={`${selectedToolEntry.label}...`} rows={1} style={{ width: "100%", minHeight: 28, maxHeight: 96, border: 0, outline: "none", resize: "none", background: "transparent", color: "#121a2e", fontSize: 16, lineHeight: "24px", fontFamily: "Inter, sans-serif", padding: "3px 4px 0" }} />
            ) : null}

            <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
              <button type="button" onClick={() => setToolMenuOpen((value) => !value)} onMouseEnter={() => setPlusHovered(true)} onMouseLeave={() => setPlusHovered(false)} title="Actions IA" style={{ width: 34, height: 34, borderRadius: 999, border: 0, background: selectedTool || plusHovered ? selectedBg : "transparent", display: "grid", placeItems: "center", color: selectedTool ? "#000" : "#121a2e", cursor: "pointer", flexShrink: 0 }}><Plus size={22} /></button>
              {selectedToolEntry ? (
                <span style={{ minHeight: 34, borderRadius: 999, background: selectedBg, color: "#0147ff", display: "inline-flex", alignItems: "center", gap: 8, padding: "0 10px", fontSize: 14, fontWeight: 650, flexShrink: 0 }}>
                  <selectedToolEntry.icon size={16} /> {selectedToolEntry.label}
                  <button type="button" onClick={() => setSelectedTool(null)} title="Retirer l'action" style={{ width: 18, height: 18, borderRadius: 999, border: 0, background: "transparent", color: "#0147ff", display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}><X size={14} /></button>
                </span>
              ) : null}
              {!selectedToolEntry ? (
                <textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Demande au Coach IA..." rows={1} style={{ flex: 1, maxHeight: 96, border: 0, outline: "none", resize: "none", background: "transparent", color: "#121a2e", fontSize: 16, lineHeight: "24px", fontFamily: "Inter, sans-serif", paddingTop: 7 }} />
              ) : <div style={{ flex: 1 }} />}
              <button type="button" onClick={() => setModelPickerOpen((value) => !value)} style={{ minHeight: 36, border: 0, background: selectedToolEntry ? selectedBg : "transparent", borderRadius: 999, color: "rgba(18,26,46,0.82)", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0, padding: selectedToolEntry ? "0 12px" : 0 }}>
                {selectedToolEntry ? "Automatique" : selectedModel.label} <ChevronDown size={15} />
              </button>
              <button type="button" onClick={() => void send()} disabled={loading || !input.trim()} style={{ width: 48, height: 48, borderRadius: 999, border: 0, background: "#121a2e", color: "#fff", display: "grid", placeItems: "center", cursor: loading || !input.trim() ? "not-allowed" : "pointer", opacity: loading || !input.trim() ? 0.55 : 1, flexShrink: 0 }}>
                {loading ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={19} />}
              </button>
            </div>

            {toolMenuOpen ? (
              <div style={{ position: "absolute", left: 16, bottom: selectedToolEntry ? 110 : 74, width: 324, borderRadius: 18, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", boxShadow: "0 26px 58px rgba(18,26,46,0.16)", padding: 8, display: "grid", gap: 4 }}>
                {TOOL_ACTIONS.map((entry) => {
                  const Icon = entry.icon;
                  const active = selectedTool === entry.tool;
                  return (
                    <button key={entry.tool} type="button" onClick={() => chooseTool(entry.tool, entry.prompt)} style={{ minHeight: 54, borderRadius: 12, border: 0, background: active ? selectedBg : "transparent", color: "#121a2e", padding: "0 12px", textAlign: "left", display: "grid", gridTemplateColumns: "32px 1fr", alignItems: "center", columnGap: 10, cursor: "pointer" }}>
                      <span style={{ width: 32, height: 32, borderRadius: 9, background: active ? selectedBg : "#ececec", color: active ? "#000" : inactiveIconColor, opacity: active ? 1 : 0.7, display: "grid", placeItems: "center" }}><Icon size={16} /></span>
                      <span style={{ minWidth: 0 }}>
                        <strong style={{ display: "block", fontSize: 13, lineHeight: "17px" }}>{entry.label}</strong>
                        <span style={{ display: "block", marginTop: 2, fontSize: 11, color: "rgba(18,26,46,0.48)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {modelPickerOpen ? (
              <div style={{ position: "absolute", right: 64, bottom: selectedToolEntry ? 104 : 66, width: 260, borderRadius: 18, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", boxShadow: "0 26px 58px rgba(18,26,46,0.16)", padding: 8, display: "grid", gap: 4 }}>
                {MODELS.map((entry) => (
                  <button key={entry.id} type="button" onClick={() => { setModel(entry.id); setModelPickerOpen(false); }} style={{ minHeight: 38, borderRadius: 11, border: 0, background: model === entry.id ? selectedBg : "transparent", color: model === entry.id ? "#000" : "#121a2e", padding: "0 12px", textAlign: "left", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{entry.label}</button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes coachLoaderPulse { from { opacity: 0.92; } to { opacity: 0.46; } }`}</style>
    </main>
  );
}
