"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus, Sparkles, RefreshCw, Copy, Check, ChevronDown, X,
  ExternalLink, TrendingUp, MessageSquare, ThumbsUp, Eye,
  PenLine, Bot, Send, User, ChevronRight, MessagesSquare,
} from "lucide-react";
import {
  LinkedInProspect, ConversationMessage, ACTION_LABELS, PROSPECT_STATUS_LABELS,
  PROSPECT_TO_LEAD_STATUS,
} from "@/types/linkedin";
import { loadLinkedInSettings } from "../layout";

const jk = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

const inp = {
  width: "100%", fontSize: 13, border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9,
  padding: "9px 12px", background: "#f6f6f6", color: "#121a2e", outline: "none",
  boxSizing: "border-box" as const, fontFamily: '"Plus Jakarta Sans", sans-serif',
};

const btnGrad = {
  background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
  border: "1px solid #2f4d9d", color: "#fff", cursor: "pointer", borderRadius: 9,
  fontFamily: '"Plus Jakarta Sans", sans-serif',
};

const ACTION_OPTIONS: { value: LinkedInProspect["actionType"]; label: string; icon: React.ReactNode }[] = [
  { value: "liked",           label: "A liké votre post",      icon: <ThumbsUp size={14} /> },
  { value: "commented",       label: "A commenté votre post",  icon: <MessageSquare size={14} /> },
  { value: "visited_profile", label: "A visité votre profil",  icon: <Eye size={14} /> },
];

const STATUS_VARIANTS: LinkedInProspect["status"][] = [
  "draft", "sent", "accepted", "rejected", "replied", "conversation", "deal_closed", "deal_lost",
];

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  draft:        { bg: "#f6f6f6",  color: "rgba(18,26,46,0.55)" },
  sent:         { bg: "#d5eeff",  color: "#073e63" },
  accepted:     { bg: "#d1fae5",  color: "#168b64" },
  rejected:     { bg: "#ffe4e4",  color: "#c53030" },
  replied:      { bg: "#ccfbf1",  color: "#0f766e" },
  conversation: { bg: "#e0e7ff",  color: "#3730a3" },
  deal_closed:  { bg: "#d1fae5",  color: "#0a5c40" },
  deal_lost:    { bg: "#f6f6f6",  color: "rgba(18,26,46,0.4)" },
};

function getStats(prospects: LinkedInProspect[]) {
  const sent = prospects.filter((p) => p.status !== "draft").length;
  const positive = prospects.filter((p) => ["accepted", "replied", "conversation", "deal_closed"].includes(p.status)).length;
  const byAction: Record<string, { total: number; positive: number }> = {};
  for (const p of prospects) {
    if (p.status === "draft") continue;
    if (!byAction[p.actionType]) byAction[p.actionType] = { total: 0, positive: 0 };
    byAction[p.actionType].total++;
    if (["accepted", "replied", "conversation", "deal_closed"].includes(p.status))
      byAction[p.actionType].positive++;
  }
  return {
    total: prospects.length,
    sent,
    accepted: prospects.filter((p) => p.status === "accepted").length,
    replied: prospects.filter((p) => p.status === "replied").length,
    conversation: prospects.filter((p) => p.status === "conversation").length,
    dealClosed: prospects.filter((p) => p.status === "deal_closed").length,
    dealLost: prospects.filter((p) => p.status === "deal_lost").length,
    rejected: prospects.filter((p) => p.status === "rejected").length,
    positive,
    conversionRate: sent === 0 ? "—" : `${Math.round((positive / sent) * 100)}%`,
    byAction,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Left Panel
// ─────────────────────────────────────────────────────────────────────────────
function LeftPanel({
  language,
  onLanguageChange,
  onSave,
}: {
  language: "fr" | "en";
  onLanguageChange: (l: "fr" | "en") => void;
  onSave: (p: LinkedInProspect) => void;
}) {
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    name: "", profileUrl: "",
    actionType: "liked" as LinkedInProspect["actionType"],
    context: "",
  });
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [manualMessage, setManualMessage] = useState("");
  const [explanation, setExplanation] = useState("");

  const getLearningData = () => {
    try {
      const saved = localStorage.getItem("linkedin_prospects");
      if (!saved) return [];
      const prospects: LinkedInProspect[] = JSON.parse(saved);
      return prospects
        .filter((p) => p.status !== "draft")
        .map((p) => ({ message: p.customMessage || p.generatedMessage, status: p.status, actionType: p.actionType }));
    } catch { return []; }
  };

  const handleGenerate = async () => {
    if (!form.name.trim()) return;
    setGenerating(true);
    try {
      const s = loadLinkedInSettings();
      const res = await fetch("/api/linkedin/generate-prospection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, actionType: form.actionType, context: form.context,
          learningData: getLearningData(), language,
          openrouterApiKey: s.openrouterApiKey || undefined, model: s.model,
        }),
      });
      const data = await res.json();
      setGeneratedMessage(data.message || "");
      setExplanation(data.explanation || "");
    } catch (e) { console.error(e); }
    finally { setGenerating(false); }
  };

  const buildProspect = (message: string, isManual: boolean): LinkedInProspect | null => {
    if (!message.trim() || !form.name.trim()) return null;
    return {
      id: `prospect_${Date.now()}`,
      name: form.name,
      profileUrl: form.profileUrl || undefined,
      actionType: form.actionType,
      context: form.context || undefined,
      generatedMessage: message,
      isManual,
      status: "draft",
      createdAt: new Date().toISOString(),
    };
  };

  const handleSaveAI = async () => {
    const prospect = buildProspect(generatedMessage, false);
    if (!prospect) return;

    // Sync with CRM
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, source: "linkedin", source_ref: form.profileUrl || null, channel_preference: "linkedin_dm", metadata: { action_type: form.actionType, context: form.context || null }, status: "new" }),
      });
      const data = await res.json();
      if (data.lead?.id) {
        prospect.leadId = data.lead.id;
        await fetch(`/api/leads/${data.lead.id}/outreach`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "send", channel: "linkedin_dm", content: generatedMessage }),
        }).catch(() => {});
      }
    } catch {}

    onSave(prospect);
    setForm({ name: "", profileUrl: "", actionType: "liked", context: "" });
    setGeneratedMessage("");
    setExplanation("");
  };

  const handleSaveManual = () => {
    const prospect = buildProspect(manualMessage, true);
    if (!prospect) return;
    onSave(prospect);
    setForm({ name: "", profileUrl: "", actionType: "liked", context: "" });
    setManualMessage("");
  };

  const copyMsg = (msg: string) => {
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canSaveManual = form.name.trim().length > 0 && manualMessage.trim().length > 0;

  return (
    <div style={{ width: 384, background: "#fff", borderRight: "1px solid rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
      {/* Header */}
      <div style={{ padding: "14px 20px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontWeight: 700, color: "#121a2e", fontSize: 15, margin: 0, letterSpacing: "-0.3px" }}>Nouveau prospect</h2>
          <select
            value={language}
            onChange={(e) => { onLanguageChange(e.target.value as "fr" | "en"); localStorage.setItem("linkedin_prospection_language", e.target.value); }}
            style={{ border: "1px solid rgba(0,0,0,0.09)", borderRadius: 8, padding: "4px 8px", fontSize: 12, color: "#121a2e", background: "#f6f6f6", outline: "none", ...jk }}
          >
            <option value="fr">FR</option>
            <option value="en">EN</option>
          </select>
        </div>

        {/* Mode tabs */}
        <div style={{ display: "flex", background: "#f2f2f2", borderRadius: 10, padding: 3, gap: 3, marginBottom: 0 }}>
          {([["ai", Bot, "Générer avec l'IA"], ["manual", PenLine, "Message manuel"]] as const).map(([m, Icon, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "7px 8px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", ...jk,
                ...(mode === m
                  ? { background: "#fff", border: "none", color: "#121a2e", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }
                  : { background: "none", border: "none", color: "rgba(18,26,46,0.45)" }),
              }}
            >
              <Icon size={13} />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Common fields */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)", marginBottom: 6 }}>Prénom du prospect *</label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Marie" style={inp} />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)", marginBottom: 6 }}>Action effectuée</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ACTION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setForm({ ...form, actionType: opt.value })}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9,
                  fontSize: 13, textAlign: "left", cursor: "pointer", ...jk,
                  ...(form.actionType === opt.value
                    ? { border: "1px solid #0147ff", background: "#e8edff", color: "#0147ff" }
                    : { border: "1px solid rgba(0,0,0,0.09)", background: "#f6f6f6", color: "rgba(18,26,46,0.7)" }),
                }}
              >
                {opt.icon}{opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)", marginBottom: 6 }}>URL profil LinkedIn <span style={{ fontWeight: 400, opacity: 0.7 }}>(optionnel)</span></label>
          <input type="text" value={form.profileUrl} onChange={(e) => setForm({ ...form, profileUrl: e.target.value })} placeholder="https://linkedin.com/in/..." style={inp} />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)", marginBottom: 6 }}>Contexte <span style={{ fontWeight: 400, opacity: 0.7 }}>(optionnel)</span></label>
          <textarea value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} placeholder="Ex: Directrice marketing, startup SaaS B2B..." rows={2} style={{ ...inp, resize: "none" }} />
        </div>

        {/* AI mode */}
        {mode === "ai" && (
          <>
            <button
              onClick={handleGenerate}
              disabled={generating || !form.name.trim()}
              style={{ ...btnGrad, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, opacity: generating || !form.name.trim() ? 0.5 : 1 }}
            >
              {generating ? <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={15} />}
              {generating ? "Génération..." : "Générer le message"}
            </button>

            {generatedMessage && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {explanation && <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", margin: 0 }}>{explanation}</p>}
                <textarea value={generatedMessage} onChange={(e) => setGeneratedMessage(e.target.value)} rows={6} style={{ ...inp, resize: "none" }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => copyMsg(generatedMessage)}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, border: "1px solid rgba(0,0,0,0.09)", color: "rgba(18,26,46,0.6)", padding: "8px", borderRadius: 9, background: "#f6f6f6", cursor: "pointer", ...jk }}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? "Copié !" : "Copier"}
                  </button>
                  <button
                    onClick={handleSaveAI}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, fontWeight: 600, background: "#121a2e", border: "1px solid rgba(0,0,0,0.2)", color: "#fff", padding: "8px", borderRadius: 9, cursor: "pointer", ...jk }}
                  >
                    <Plus size={13} />Sauvegarder
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Manual mode */}
        {mode === "manual" && (
          <>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)", marginBottom: 6 }}>Votre message *</label>
              <textarea
                value={manualMessage}
                onChange={(e) => setManualMessage(e.target.value)}
                placeholder={`Ex: ${form.name || "Marie"}, j'ai remarqué que tu as liké mon post sur le growth hacking — ton profil m'a intrigué. Tu travailles sur quoi en ce moment ?`}
                rows={6}
                style={{ ...inp, resize: "none", lineHeight: 1.6 }}
              />
              <p style={{ fontSize: 11, color: "rgba(18,26,46,0.35)", marginTop: 6, marginBottom: 0 }}>
                {manualMessage.length} caractères · {manualMessage.split(/\s+/).filter(Boolean).length} mots
              </p>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { if (manualMessage) copyMsg(manualMessage); }}
                disabled={!manualMessage}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, border: "1px solid rgba(0,0,0,0.09)", color: "rgba(18,26,46,0.6)", padding: "9px", borderRadius: 9, background: "#f6f6f6", cursor: manualMessage ? "pointer" : "not-allowed", opacity: manualMessage ? 1 : 0.5, ...jk }}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copié !" : "Copier"}
              </button>
              <button
                onClick={handleSaveManual}
                disabled={!canSaveManual}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, fontWeight: 600, ...btnGrad, padding: "9px", opacity: canSaveManual ? 1 : 0.5, cursor: canSaveManual ? "pointer" : "not-allowed" }}
              >
                <Plus size={13} />Sauvegarder
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Chat Panel
// ─────────────────────────────────────────────────────────────────────────────
function AIChatPanel({ prospects }: { prospects: LinkedInProspect[] }) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const stats = getStats(prospects);

  const SUGGESTIONS = [
    "Quel type d'action génère le plus de réponses ?",
    "Qu'est-ce qui différencie mes messages qui ont fonctionné ?",
    "Quel est mon taux de conversion par statut ?",
    "Comment améliorer mes messages de prospection ?",
  ];

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const newMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const s = loadLinkedInSettings();
      const res = await fetch("/api/linkedin/analyze-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: text,
          history: messages,
          stats,
          prospects: prospects.map((p) => ({
            name: p.name,
            actionType: p.actionType,
            status: p.status,
            message: p.customMessage || p.generatedMessage,
            conversationLength: p.conversation?.length,
          })),
          openrouterApiKey: s.openrouterApiKey || undefined,
          model: s.model,
        }),
      });
      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.reply || data.error || "Erreur." }]);
    } catch (e) {
      setMessages([...newMessages, { role: "assistant", content: "Erreur de connexion." }]);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#fbfbfb" }}>
      {/* Context bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "10px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12, color: "rgba(18,26,46,0.5)" }}>
          <span style={{ fontWeight: 700, color: "#121a2e", fontSize: 13 }}>Contexte IA</span>
          <span>{stats.total} prospects</span>
          <span>·</span>
          <span>{stats.sent} envoyés</span>
          <span>·</span>
          <span style={{ color: "#168b64", fontWeight: 600 }}>{stats.conversionRate} conversion</span>
          <span>·</span>
          <span>{stats.dealClosed} deals</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 40, gap: 20 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: "#e8edff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bot size={24} style={{ color: "#0147ff" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontWeight: 700, color: "#121a2e", fontSize: 15, margin: 0 }}>Analyste IA — LinkedIn Prospection</p>
              <p style={{ fontSize: 13, color: "rgba(18,26,46,0.45)", marginTop: 6 }}>Posez des questions sur vos données de prospection</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 440 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, background: "#fff", border: "1px solid rgba(0,0,0,0.09)", fontSize: 13, color: "#121a2e", cursor: "pointer", textAlign: "left", ...jk }}
                >
                  <ChevronRight size={14} style={{ color: "rgba(18,26,46,0.3)", flexShrink: 0 }} />
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
              {msg.role === "assistant" && (
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "#e8edff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                  <Bot size={14} style={{ color: "#0147ff" }} />
                </div>
              )}
              <div style={{
                maxWidth: "75%", padding: "10px 14px", borderRadius: msg.role === "user" ? "13px 13px 4px 13px" : "13px 13px 13px 4px",
                fontSize: 13, lineHeight: 1.6, ...jk,
                background: msg.role === "user" ? "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)" : "#fff",
                color: msg.role === "user" ? "#fff" : "#121a2e",
                border: msg.role === "user" ? "none" : "1px solid rgba(0,0,0,0.08)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                whiteSpace: "pre-wrap",
              }}>
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "#121a2e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                  <User size={14} style={{ color: "#fff" }} />
                </div>
              )}
            </div>
          ))
        )}
        {loading && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "#e8edff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bot size={14} style={{ color: "#0147ff" }} />
            </div>
            <div style={{ padding: "10px 14px", background: "#fff", borderRadius: "13px 13px 13px 4px", border: "1px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ display: "flex", gap: 4 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#0147ff", opacity: 0.6, animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "12px 20px", background: "#fff", borderTop: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="Posez une question sur vos données de prospection..."
            rows={1}
            style={{ ...inp, flex: 1, resize: "none", padding: "10px 14px", lineHeight: 1.5 }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{ ...btnGrad, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "center", opacity: !input.trim() || loading ? 0.5 : 1, flexShrink: 0 }}
          >
            <Send size={15} />
          </button>
        </div>
        <p style={{ fontSize: 11, color: "rgba(18,26,46,0.3)", marginTop: 6, marginBottom: 0 }}>Entrée pour envoyer · Maj+Entrée pour sauter une ligne</p>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Prospect Card
// ─────────────────────────────────────────────────────────────────────────────
function ProspectCard({
  prospect, expanded, onToggle, onStatusChange, onMessageChange, onDelete, onCopy, copied,
  showStatusDropdown, onToggleDropdown, onUpdateConversation,
}: {
  prospect: LinkedInProspect;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (s: LinkedInProspect["status"]) => void;
  onMessageChange: (msg: string) => void;
  onDelete: () => void;
  onCopy: (msg: string) => void;
  copied: boolean;
  showStatusDropdown: boolean;
  onToggleDropdown: () => void;
  onUpdateConversation: (msgs: ConversationMessage[]) => void;
}) {
  const [cardTab, setCardTab] = useState<"message" | "conversation">("message");
  const [convInput, setConvInput] = useState("");
  const [convSender, setConvSender] = useState<"me" | "them">("them");

  const displayMessage = prospect.customMessage || prospect.generatedMessage;
  const ss = STATUS_STYLES[prospect.status] ?? STATUS_STYLES.draft;
  const convLen = prospect.conversation?.length ?? 0;

  const addConvMessage = () => {
    if (!convInput.trim()) return;
    const msg: ConversationMessage = {
      id: `msg_${Date.now()}`,
      sender: convSender,
      content: convInput.trim(),
      sentAt: new Date().toISOString(),
    };
    onUpdateConversation([...(prospect.conversation ?? []), msg]);
    setConvInput("");
  };

  return (
    <div style={{ background: "#fff", borderRadius: 13, border: "1px solid rgba(0,0,0,0.09)", overflow: "hidden", ...jk }}>
      {/* Row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer" }} onClick={onToggle}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e8edff", display: "flex", alignItems: "center", justifyContent: "center", color: "#0147ff", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
          {prospect.name[0]?.toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 600, color: "#121a2e", fontSize: 14 }}>{prospect.name}</span>
            <span style={{ fontSize: 12, color: "rgba(18,26,46,0.4)" }}>{ACTION_LABELS[prospect.actionType]}</span>
            {prospect.isManual && (
              <span style={{ fontSize: 10, background: "#f6f6f6", color: "rgba(18,26,46,0.4)", padding: "1px 6px", borderRadius: 20, border: "1px solid rgba(0,0,0,0.08)" }}>Manuel</span>
            )}
            {prospect.profileUrl && (
              <a href={prospect.profileUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "rgba(18,26,46,0.3)", display: "flex" }}>
                <ExternalLink size={12} />
              </a>
            )}
            {convLen > 0 && (
              <span style={{ fontSize: 11, background: "#e0e7ff", color: "#3730a3", padding: "1px 7px", borderRadius: 20, fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
                <MessagesSquare size={10} />{convLen}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: "2px 0 0" }}>
            {displayMessage.slice(0, 65)}{displayMessage.length > 65 ? "..." : ""}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ position: "relative" }}>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleDropdown(); }}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, padding: "4px 10px", borderRadius: 20, fontWeight: 600, cursor: "pointer", ...jk, background: ss.bg, color: ss.color, border: "none" }}
            >
              {PROSPECT_STATUS_LABELS[prospect.status]}
              <ChevronDown size={11} />
            </button>
            {showStatusDropdown && (
              <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 12, boxShadow: "0px 8px 24px rgba(0,0,0,0.12)", zIndex: 10, padding: 4, width: 180 }}>
                {STATUS_VARIANTS.map((s) => {
                  const sss = STATUS_STYLES[s] ?? STATUS_STYLES.draft;
                  return (
                    <button
                      key={s}
                      onClick={(e) => { e.stopPropagation(); onStatusChange(s); }}
                      style={{
                        width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 12, cursor: "pointer", ...jk,
                        background: s === prospect.status ? "#f6f6f6" : "none", border: "none", borderRadius: 8,
                        color: "#121a2e", fontWeight: s === prospect.status ? 600 : 400,
                        display: "flex", alignItems: "center", gap: 8,
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: sss.color, flexShrink: 0 }} />
                      {PROSPECT_STATUS_LABELS[s]}
                      {s === prospect.status && <Check size={11} style={{ marginLeft: "auto" }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <ChevronDown size={16} style={{ color: "rgba(18,26,46,0.4)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
            {([["message", "Message initial"], ["conversation", `Conversation${convLen > 0 ? ` (${convLen})` : ""}`]] as const).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setCardTab(t)}
                style={{
                  flex: 1, padding: "10px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", ...jk,
                  background: "none", borderBottom: cardTab === t ? "2px solid #0147ff" : "2px solid transparent",
                  borderLeft: "none", borderRight: "none", borderTop: "none",
                  color: cardTab === t ? "#0147ff" : "rgba(18,26,46,0.4)",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Message tab */}
          {cardTab === "message" && (
            <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
              {prospect.context && (
                <p style={{ fontSize: 12, color: "rgba(18,26,46,0.55)", background: "#f6f6f6", padding: "8px 12px", borderRadius: 9, margin: 0 }}>
                  <span style={{ fontWeight: 600 }}>Contexte :</span> {prospect.context}
                </p>
              )}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)", marginBottom: 6 }}>
                  Message{prospect.customMessage ? " (modifié)" : ""}
                </label>
                <textarea
                  value={displayMessage}
                  onChange={(e) => onMessageChange(e.target.value)}
                  rows={5}
                  style={{ ...inp, resize: "none" }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => onCopy(displayMessage)}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, border: "1px solid rgba(0,0,0,0.09)", color: "rgba(18,26,46,0.6)", padding: "7px 12px", borderRadius: 9, background: "#f6f6f6", cursor: "pointer", ...jk }}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Copié !" : "Copier"}
                </button>
                {prospect.status === "draft" && (
                  <button
                    onClick={() => onStatusChange("sent")}
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, ...btnGrad, padding: "7px 12px" }}
                  >
                    <Check size={13} />Marquer comme envoyé
                  </button>
                )}
                <button
                  onClick={onDelete}
                  style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#ef4444", padding: "7px 12px", borderRadius: 9, background: "none", border: "none", cursor: "pointer", ...jk }}
                >
                  <X size={13} />Supprimer
                </button>
              </div>
              {prospect.sentAt && (
                <p style={{ fontSize: 12, color: "rgba(18,26,46,0.35)", margin: 0 }}>
                  Envoyé le {new Date(prospect.sentAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              )}
            </div>
          )}

          {/* Conversation tab */}
          {cardTab === "conversation" && (
            <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Thread */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
                {(prospect.conversation ?? []).length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 0" }}>
                    <MessagesSquare size={24} style={{ color: "rgba(18,26,46,0.2)", margin: "0 auto 8px" }} />
                    <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", margin: 0 }}>Aucun message dans la conversation</p>
                    <p style={{ fontSize: 11, color: "rgba(18,26,46,0.3)", marginTop: 4 }}>Collez les messages échangés pour garder un historique</p>
                  </div>
                ) : (
                  (prospect.conversation ?? []).map((msg) => (
                    <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: msg.sender === "me" ? "flex-end" : "flex-start" }}>
                      <div style={{ fontSize: 10, color: "rgba(18,26,46,0.35)", marginBottom: 3, paddingLeft: msg.sender === "them" ? 6 : 0, paddingRight: msg.sender === "me" ? 6 : 0 }}>
                        {msg.sender === "me" ? "Moi" : prospect.name} · {new Date(msg.sentAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </div>
                      <div style={{
                        maxWidth: "80%", padding: "8px 12px", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", ...jk,
                        borderRadius: msg.sender === "me" ? "13px 13px 4px 13px" : "13px 13px 13px 4px",
                        background: msg.sender === "me" ? "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)" : "#f6f6f6",
                        color: msg.sender === "me" ? "#fff" : "#121a2e",
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add message */}
              <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["them", "me"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setConvSender(s)}
                      style={{
                        flex: 1, padding: "6px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", ...jk,
                        ...(convSender === s
                          ? { background: s === "me" ? "#e8edff" : "#f6f6f6", border: s === "me" ? "1px solid #c7d3ff" : "1px solid rgba(0,0,0,0.12)", color: s === "me" ? "#0147ff" : "#121a2e" }
                          : { background: "none", border: "1px solid rgba(0,0,0,0.07)", color: "rgba(18,26,46,0.4)" }),
                      }}
                    >
                      {s === "me" ? "Moi" : prospect.name}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <textarea
                    value={convInput}
                    onChange={(e) => setConvInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addConvMessage(); } }}
                    placeholder="Collez ou tapez le message..."
                    rows={2}
                    style={{ ...inp, flex: 1, resize: "none" }}
                  />
                  <button
                    onClick={addConvMessage}
                    disabled={!convInput.trim()}
                    style={{ ...btnGrad, padding: "9px 12px", display: "flex", alignItems: "center", justifyContent: "center", opacity: convInput.trim() ? 1 : 0.5, flexShrink: 0 }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page principale
// ─────────────────────────────────────────────────────────────────────────────
export default function LinkedInProspectionPage() {
  const [prospects, setProspects] = useState<LinkedInProspect[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null);
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [rightView, setRightView] = useState<"prospects" | "chat">("prospects");

  useEffect(() => {
    const saved = localStorage.getItem("linkedin_prospects");
    const savedLang = localStorage.getItem("linkedin_prospection_language");
    if (saved) { try { setProspects(JSON.parse(saved)); } catch { setProspects([]); } }
    if (savedLang) setLanguage(savedLang as "fr" | "en");
  }, []);

  const saveProspects = (updated: LinkedInProspect[]) => {
    setProspects(updated);
    localStorage.setItem("linkedin_prospects", JSON.stringify(updated));
  };

  const handleSave = (p: LinkedInProspect) => saveProspects([p, ...prospects]);

  const updateStatus = async (id: string, status: LinkedInProspect["status"]) => {
    const prospect = prospects.find((p) => p.id === id);
    saveProspects(prospects.map((p) => {
      if (p.id !== id) return p;
      return { ...p, status, sentAt: status === "sent" && !p.sentAt ? new Date().toISOString() : p.sentAt };
    }));
    setStatusDropdown(null);
    if (prospect?.leadId) {
      const leadStatus = PROSPECT_TO_LEAD_STATUS[status] ?? "contacted";
      try {
        await fetch(`/api/leads/${prospect.leadId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: leadStatus, last_contact_at: new Date().toISOString() }),
        });
      } catch {}
    }
  };

  const updateMessage = (id: string, msg: string) =>
    saveProspects(prospects.map((p) => p.id === id ? { ...p, customMessage: msg } : p));

  const updateConversation = (id: string, msgs: ConversationMessage[]) =>
    saveProspects(prospects.map((p) => p.id === id ? { ...p, conversation: msgs } : p));

  const deleteProspect = (id: string) => saveProspects(prospects.filter((p) => p.id !== id));

  const copyMessage = (id: string, msg: string) => {
    navigator.clipboard.writeText(msg);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const filtered = filterStatus === "all" ? prospects : prospects.filter((p) => p.status === filterStatus);
  const stats = getStats(prospects);

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", background: "#fbfbfb", ...jk }}>
      <LeftPanel language={language} onLanguageChange={setLanguage} onSave={handleSave} />

      {/* Right area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Stats + view toggle */}
        <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.07)", padding: "12px 24px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {[
              { val: prospects.length, label: "Total", color: "#121a2e" },
              { val: stats.sent, label: "Envoyés", color: "#0147ff" },
              { val: stats.positive, label: "Positifs", color: "#168b64" },
              { val: stats.dealClosed, label: "Deals", color: "#168b64" },
              { val: stats.conversionRate, label: "Conversion", color: "#0147ff" },
            ].map((stat, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 20 }}>
                {i > 0 && <div style={{ width: 1, height: 32, background: "rgba(0,0,0,0.08)" }} />}
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 20, fontWeight: 700, color: stat.color, margin: 0, letterSpacing: "-0.5px" }}>{stat.val}</p>
                  <p style={{ fontSize: 11, color: "rgba(18,26,46,0.4)", margin: 0 }}>{stat.label}</p>
                </div>
              </div>
            ))}

            {/* View toggle */}
            <div style={{ marginLeft: "auto", display: "flex", background: "#f2f2f2", borderRadius: 10, padding: 3, gap: 3 }}>
              <button
                onClick={() => setRightView("prospects")}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", ...jk,
                  ...(rightView === "prospects"
                    ? { background: "#fff", border: "none", color: "#121a2e", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }
                    : { background: "none", border: "none", color: "rgba(18,26,46,0.45)" }),
                }}
              >
                <MessageSquare size={13} />Prospects ({prospects.length})
              </button>
              <button
                onClick={() => setRightView("chat")}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", ...jk,
                  ...(rightView === "chat"
                    ? { background: "#fff", border: "none", color: "#0147ff", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }
                    : { background: "none", border: "none", color: "rgba(18,26,46,0.45)" }),
                }}
              >
                <Bot size={13} />Analyser avec l&apos;IA
              </button>
            </div>

            {stats.positive >= 3 && rightView === "prospects" && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#168b64", background: "#d1fae5", padding: "6px 12px", borderRadius: 9, border: "1px solid #86efac" }}>
                <TrendingUp size={13} />
                L&apos;IA apprend de vos {stats.sent} messages
              </div>
            )}
          </div>
        </div>

        {/* Prospects view */}
        {rightView === "prospects" && (
          <>
            <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "8px 24px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <button
                  onClick={() => setFilterStatus("all")}
                  style={{
                    padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", ...jk,
                    ...(filterStatus === "all"
                      ? { background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)", border: "1px solid #2f4d9d", color: "#fff" }
                      : { background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", color: "rgba(18,26,46,0.6)" }),
                  }}
                >
                  Tous ({prospects.length})
                </button>
                {STATUS_VARIANTS.map((s) => {
                  const count = prospects.filter((p) => p.status === s).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(s)}
                      style={{
                        padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", ...jk,
                        ...(filterStatus === s
                          ? { background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)", border: "1px solid #2f4d9d", color: "#fff" }
                          : { background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", color: "rgba(18,26,46,0.6)" }),
                      }}
                    >
                      {PROSPECT_STATUS_LABELS[s]} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 256, textAlign: "center" }}>
                  <MessageSquare size={24} style={{ color: "rgba(18,26,46,0.2)", marginBottom: 12 }} />
                  <p style={{ fontWeight: 600, color: "rgba(18,26,46,0.5)", fontSize: 14, margin: 0 }}>
                    {prospects.length === 0 ? "Aucun prospect enregistré" : "Aucun prospect dans cette catégorie"}
                  </p>
                  <p style={{ fontSize: 12, color: "rgba(18,26,46,0.35)", marginTop: 4 }}>
                    {prospects.length === 0 ? "Ajoutez votre premier prospect depuis le panneau de gauche" : ""}
                  </p>
                </div>
              ) : (
                filtered.map((prospect) => (
                  <ProspectCard
                    key={prospect.id}
                    prospect={prospect}
                    expanded={expandedId === prospect.id}
                    onToggle={() => setExpandedId(expandedId === prospect.id ? null : prospect.id)}
                    onStatusChange={(s) => updateStatus(prospect.id, s)}
                    onMessageChange={(msg) => updateMessage(prospect.id, msg)}
                    onDelete={() => deleteProspect(prospect.id)}
                    onCopy={(msg) => copyMessage(prospect.id, msg)}
                    copied={copied === prospect.id}
                    showStatusDropdown={statusDropdown === prospect.id}
                    onToggleDropdown={() => setStatusDropdown(statusDropdown === prospect.id ? null : prospect.id)}
                    onUpdateConversation={(msgs) => updateConversation(prospect.id, msgs)}
                  />
                ))
              )}
            </div>
          </>
        )}

        {/* AI chat view */}
        {rightView === "chat" && <AIChatPanel prospects={prospects} />}
      </div>
    </div>
  );
}
