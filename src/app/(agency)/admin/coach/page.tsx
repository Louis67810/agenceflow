"use client";

import { useEffect, useRef, useState } from "react";
import { agendaFetch } from "@/lib/agenda/fetchWithAuth";
import { Send, Bot, User, Loader2, Plus, Trash2, ChevronDown } from "lucide-react";

const jakartaSans = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

const MODELS = [
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "anthropic/claude-opus-4", label: "Claude Opus 4" },
  { id: "anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
  { id: "anthropic/claude-haiku-4-5", label: "Claude Haiku 4.5" },
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
  { id: "google/gemini-pro-1.5", label: "Gemini Pro 1.5" },
  { id: "mistralai/mistral-large-2411", label: "Mistral Large" },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
];

const SUGGESTIONS = [
  "Analyse mes projets en cours et dis-moi quels risques tu vois.",
  "Comment optimiser ma prospection LinkedIn basée sur mes leads actuels ?",
  "Quelles habitudes devrais-je prendre pour scaler mon agence ?",
  "Aide-moi à rédiger une offre de service pour attirer plus de clients.",
  "Quelles sont les erreurs courantes des agences à mon stade ?",
];

export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [businessContext, setBusinessContext] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    agendaFetch("/api/coach").then(r => r.json()).then(d => setConversations(d.conversations ?? []));
    agendaFetch("/api/app-settings").then(r => r.json()).then(d => {
      setBusinessContext(d.settings?.business_context ?? "");
      const m = d.settings?.ai_models?.coach;
      if (m) setModel(m);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const newConversation = () => {
    setMessages([]);
    setConversationId(null);
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    const res = await agendaFetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: newMessages,
        model,
        business_context: businessContext,
        conversation_id: conversationId,
      }),
    }).then(r => r.json());

    setLoading(false);
    if (res.reply) {
      setMessages(prev => [...prev, { role: "assistant", content: res.reply }]);
    }
    if (res.conversation_id) {
      setConversationId(res.conversation_id);
      setConversations(prev => {
        const exists = prev.find(c => c.id === res.conversation_id);
        if (!exists && res.conversation_id) {
          return [{ id: res.conversation_id, title: content.slice(0, 40) + "...", updated_at: new Date().toISOString() }, ...prev];
        }
        return prev;
      });
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#fbfbfb", ...jakartaSans }}>
      {/* Sidebar conversations */}
      <div style={{ width: 240, background: "#fff", borderRight: "1px solid rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: 16, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "#E1D1FA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bot size={15} style={{ color: "#6236AA" }} />
              </div>
              <span style={{ fontWeight: 700, color: "#121a2e", fontSize: 14, letterSpacing: "-0.3px" }}>Coach IA</span>
            </div>
            <button onClick={newConversation} style={{
              width: 28, height: 28, borderRadius: 8,
              background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
              border: "1px solid #2f4d9d", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }} title="Nouvelle conversation">
              <Plus size={13} style={{ color: "#fff" }} />
            </button>
          </div>
        </div>

        {/* Model selector */}
        <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
          <label style={{ fontSize: 11, color: "rgba(18,26,46,0.45)", display: "block", marginBottom: 4 }}>Modèle</label>
          <div style={{ position: "relative" }}>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              style={{
                width: "100%", fontSize: 12, border: "1px solid rgba(0,0,0,0.09)", borderRadius: 8,
                padding: "6px 24px 6px 10px", background: "#f6f6f6", appearance: "none",
                color: "#121a2e", outline: "none", cursor: "pointer",
              }}
            >
              {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <ChevronDown size={11} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "rgba(18,26,46,0.4)", pointerEvents: "none" }} />
          </div>
        </div>

        {/* Conversations list */}
        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {conversations.length === 0 ? (
            <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", textAlign: "center", padding: 16 }}>Aucune conversation</p>
          ) : (
            conversations.map(c => (
              <div key={c.id} style={{
                padding: "10px 12px", borderRadius: 9, marginBottom: 2, cursor: "pointer", fontSize: 12,
                background: conversationId === c.id ? "#e8edff" : "transparent",
                color: conversationId === c.id ? "#0147ff" : "rgba(18,26,46,0.6)",
                fontWeight: conversationId === c.id ? 600 : 400,
              }}>
                <p style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</p>
                <p style={{ margin: "2px 0 0", color: "rgba(18,26,46,0.35)", fontSize: 11 }}>{new Date(c.updated_at).toLocaleDateString("fr-FR")}</p>
              </div>
            ))
          )}
        </div>

        {/* Business context */}
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: 12 }}>
          <button
            onClick={() => setShowSettings(s => !s)}
            style={{ width: "100%", fontSize: 12, color: "rgba(18,26,46,0.5)", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}
          >
            Contexte business <ChevronDown size={11} style={{ transform: showSettings ? "rotate(180deg)" : "none" }} />
          </button>
          {showSettings && (
            <div style={{ marginTop: 8 }}>
              <textarea
                value={businessContext}
                onChange={e => setBusinessContext(e.target.value)}
                onBlur={() => agendaFetch("/api/app-settings", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ business_context: businessContext }),
                })}
                placeholder="Décrivez votre agence, vos services, vos objectifs..."
                rows={5}
                style={{
                  width: "100%", fontSize: 12, border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9,
                  padding: "8px 10px", resize: "none", background: "#f6f6f6", color: "#121a2e",
                  outline: "none", boxSizing: "border-box",
                }}
              />
              <p style={{ fontSize: 11, color: "rgba(18,26,46,0.35)", marginTop: 4 }}>Sauvegarde automatique</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {messages.length === 0 && (
            <div style={{ maxWidth: 560, margin: "48px auto 0", textAlign: "center" }}>
              <div style={{ width: 64, height: 64, background: "#E1D1FA", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Bot size={30} style={{ color: "#6236AA" }} />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#121a2e", margin: "0 0 8px", letterSpacing: "-0.45px" }}>Coach Business IA</h2>
              <p style={{ color: "rgba(18,26,46,0.5)", fontSize: 14, margin: "0 0 32px", lineHeight: "1.5" }}>Je connais vos projets, leads et données. Posez-moi n'importe quelle question sur votre agence.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)} style={{
                    padding: "12px 16px", background: "#fff",
                    border: "1px solid rgba(0,0,0,0.1)", borderRadius: 11,
                    fontSize: 13, color: "#121a2e", cursor: "pointer", textAlign: "left",
                    letterSpacing: "-0.3px", lineHeight: "1.4",
                  }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", gap: 12, justifyContent: msg.role === "user" ? "flex-end" : "flex-start", maxWidth: "80%", alignSelf: msg.role === "user" ? "flex-end" : "flex-start" }}>
              {msg.role === "assistant" && (
                <div style={{ width: 32, height: 32, background: "#E1D1FA", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Bot size={15} style={{ color: "#6236AA" }} />
                </div>
              )}
              <div style={{
                borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                padding: "12px 16px", fontSize: 14, lineHeight: "1.6",
                background: msg.role === "user"
                  ? "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)"
                  : "#fff",
                color: msg.role === "user" ? "#fff" : "#121a2e",
                border: msg.role === "user" ? "1px solid #2f4d9d" : "1px solid rgba(0,0,0,0.1)",
                boxShadow: msg.role === "user" ? "0px 4px 12px rgba(1,71,255,0.2)" : "0px 2px 8px rgba(0,0,0,0.04)",
                whiteSpace: "pre-wrap",
              }}>
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div style={{ width: 32, height: 32, background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <User size={15} style={{ color: "#fff" }} />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-start", alignSelf: "flex-start" }}>
              <div style={{ width: 32, height: 32, background: "#E1D1FA", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Bot size={15} style={{ color: "#6236AA" }} />
              </div>
              <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "18px 18px 18px 4px", padding: "12px 16px" }}>
                <Loader2 size={16} style={{ color: "#0147ff", animation: "spin 1s linear infinite" }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)", background: "#fff", padding: 16 }}>
          <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", alignItems: "flex-end", gap: 12 }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Posez votre question... (Entrée pour envoyer, Shift+Entrée pour nouvelle ligne)"
              rows={2}
              style={{
                flex: 1, border: "1px solid rgba(0,0,0,0.09)", borderRadius: 11,
                padding: "12px 16px", fontSize: 14, resize: "none", background: "#f6f6f6",
                color: "#121a2e", outline: "none", lineHeight: "1.5", fontFamily: '"Plus Jakarta Sans", sans-serif',
              }}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              style={{
                width: 44, height: 44, borderRadius: 11, flexShrink: 0,
                background: loading || !input.trim()
                  ? "rgba(18,26,46,0.08)"
                  : "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
                border: loading || !input.trim() ? "1px solid rgba(0,0,0,0.08)" : "1px solid #2f4d9d",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Send size={17} style={{ color: loading || !input.trim() ? "rgba(18,26,46,0.3)" : "#fff" }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
