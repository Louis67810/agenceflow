"use client";

import { useState, useEffect } from "react";
import {
  Plus, Sparkles, RefreshCw, Copy, Check, ChevronDown, X,
  ExternalLink, TrendingUp, MessageSquare, ThumbsUp, Eye,
} from "lucide-react";
import {
  LinkedInProspect, ACTION_LABELS, PROSPECT_STATUS_LABELS,
  PROSPECT_STATUS_COLORS, PROSPECT_TO_LEAD_STATUS,
} from "@/types/linkedin";
import { loadLinkedInSettings } from "../layout";

const jakartaSans = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

const ACTION_OPTIONS: { value: LinkedInProspect["actionType"]; label: string; icon: React.ReactNode }[] = [
  { value: "liked",          label: "A liké votre post",       icon: <ThumbsUp size={14} /> },
  { value: "commented",      label: "A commenté votre post",   icon: <MessageSquare size={14} /> },
  { value: "visited_profile",label: "A visité votre profil",   icon: <Eye size={14} /> },
];

const STATUS_FLOW: LinkedInProspect["status"][] = [
  "draft", "sent", "accepted", "replied", "conversation", "deal_closed",
];

const STATUS_VARIANTS: LinkedInProspect["status"][] = [
  "draft", "sent", "accepted", "rejected", "replied", "conversation", "deal_closed", "deal_lost",
];

function getConversionRate(prospects: LinkedInProspect[]): string {
  const sent = prospects.filter((p) => p.status !== "draft").length;
  if (sent === 0) return "—";
  const positive = prospects.filter((p) => ["accepted", "replied", "conversation", "deal_closed"].includes(p.status)).length;
  return `${Math.round((positive / sent) * 100)}%`;
}

const inputStyle = {
  width: "100%", fontSize: 13, border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9,
  padding: "9px 12px", background: "#f6f6f6", color: "#121a2e", outline: "none",
  boxSizing: "border-box" as const, fontFamily: '"Plus Jakarta Sans", sans-serif',
};

const btnGradient = {
  background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
  border: "1px solid #2f4d9d",
  color: "#fff",
  cursor: "pointer",
  borderRadius: 9,
  fontFamily: '"Plus Jakarta Sans", sans-serif',
};

export default function LinkedInProspectionPage() {
  const [prospects, setProspects] = useState<LinkedInProspect[]>([]);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null);
  const [language, setLanguage] = useState<"fr" | "en">("fr");

  const [form, setForm] = useState({
    name: "",
    profileUrl: "",
    actionType: "liked" as LinkedInProspect["actionType"],
    context: "",
  });
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [explanation, setExplanation] = useState("");

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

  const getLearningData = () => prospects
    .filter((p) => p.status !== "draft" && p.generatedMessage)
    .map((p) => ({ message: p.customMessage || p.generatedMessage, status: p.status, actionType: p.actionType }));

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
      if (!res.ok) throw new Error("Erreur génération");
      const data = await res.json();
      setGeneratedMessage(data.message || "");
      setExplanation(data.explanation || "");
    } catch (err) { console.error(err); }
    finally { setGenerating(false); }
  };

  const handleSave = async () => {
    if (!generatedMessage.trim() || !form.name.trim()) return;

    let leadId: string | undefined;
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, source: "linkedin", source_ref: form.profileUrl || null, channel_preference: "linkedin_dm", metadata: { action_type: form.actionType, context: form.context || null, profile_url: form.profileUrl || null }, status: "new" }),
      });
      const data = await res.json();
      leadId = data.lead?.id;
    } catch {}

    if (leadId) {
      try {
        await fetch(`/api/leads/${leadId}/outreach`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "send", channel: "linkedin_dm", content: generatedMessage }),
        });
      } catch {}
    }

    const newProspect: LinkedInProspect = {
      id: `prospect_${Date.now()}`, leadId, name: form.name, profileUrl: form.profileUrl || undefined,
      actionType: form.actionType, context: form.context || undefined,
      generatedMessage, status: "draft", createdAt: new Date().toISOString(),
    };
    saveProspects([newProspect, ...prospects]);
    setForm({ name: "", profileUrl: "", actionType: "liked", context: "" });
    setGeneratedMessage("");
    setExplanation("");
  };

  const updateStatus = async (id: string, status: LinkedInProspect["status"]) => {
    const prospect = prospects.find((p) => p.id === id);
    const updated = prospects.map((p) => {
      if (p.id !== id) return p;
      return { ...p, status, sentAt: status === "sent" && !p.sentAt ? new Date().toISOString() : p.sentAt };
    });
    saveProspects(updated);
    setStatusDropdown(null);

    if (prospect?.leadId) {
      const leadStatus = PROSPECT_TO_LEAD_STATUS[status] ?? "contacted";
      try {
        await fetch(`/api/leads/${prospect.leadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: leadStatus, last_contact_at: new Date().toISOString() }),
        });
      } catch {}
    }
  };

  const updateMessage = (id: string, msg: string) => {
    saveProspects(prospects.map((p) => p.id === id ? { ...p, customMessage: msg } : p));
  };

  const deleteProspect = (id: string) => saveProspects(prospects.filter((p) => p.id !== id));

  const copyMessage = (id: string, msg: string) => {
    navigator.clipboard.writeText(msg);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const filtered = filterStatus === "all" ? prospects : prospects.filter((p) => p.status === filterStatus);
  const convRate = getConversionRate(prospects);
  const sentCount = prospects.filter((p) => p.status !== "draft").length;
  const dealCount = prospects.filter((p) => p.status === "deal_closed").length;
  const positiveCount = prospects.filter((p) => ["accepted", "replied", "conversation", "deal_closed"].includes(p.status)).length;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", background: "#fbfbfb", ...jakartaSans }}>
      {/* Left panel - Form */}
      <div style={{ width: 384, background: "#fff", borderRight: "1px solid rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontWeight: 700, color: "#121a2e", fontSize: 15, margin: 0, letterSpacing: "-0.3px" }}>Nouveau message</h2>
            <select
              value={language}
              onChange={(e) => { setLanguage(e.target.value as "fr" | "en"); localStorage.setItem("linkedin_prospection_language", e.target.value); }}
              style={{ border: "1px solid rgba(0,0,0,0.09)", borderRadius: 8, padding: "4px 8px", fontSize: 12, color: "#121a2e", background: "#f6f6f6", outline: "none", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
            >
              <option value="fr">FR</option>
              <option value="en">EN</option>
            </select>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Name */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)", marginBottom: 6 }}>Prénom du prospect *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Marie" style={inputStyle} />
          </div>

          {/* Action type */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)", marginBottom: 6 }}>Action effectuée</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ACTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setForm({ ...form, actionType: opt.value })}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9,
                    fontSize: 13, textAlign: "left", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif',
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

          {/* Profile URL */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)", marginBottom: 6 }}>URL du profil LinkedIn (optionnel)</label>
            <input type="text" value={form.profileUrl} onChange={(e) => setForm({ ...form, profileUrl: e.target.value })} placeholder="https://linkedin.com/in/..." style={inputStyle} />
          </div>

          {/* Context */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)", marginBottom: 6 }}>Contexte supplémentaire (optionnel)</label>
            <textarea value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} placeholder="Ex: Elle est directrice marketing dans une startup SaaS B2B..." rows={3} style={{ ...inputStyle, resize: "none" }} />
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !form.name.trim()}
            style={{ ...btnGradient, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, opacity: generating || !form.name.trim() ? 0.5 : 1 }}
          >
            {generating ? <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={16} />}
            {generating ? "Génération..." : "Générer le message"}
          </button>

          {/* Generated message */}
          {generatedMessage && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {explanation && <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", margin: 0 }}>{explanation}</p>}
              <textarea value={generatedMessage} onChange={(e) => setGeneratedMessage(e.target.value)} rows={6} style={{ ...inputStyle, resize: "none" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => copyMessage("form", generatedMessage)}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, border: "1px solid rgba(0,0,0,0.09)", color: "rgba(18,26,46,0.6)", padding: "8px 12px", borderRadius: 9, background: "#f6f6f6", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                >
                  {copied === "form" ? <Check size={13} /> : <Copy size={13} />}
                  {copied === "form" ? "Copié !" : "Copier"}
                </button>
                <button
                  onClick={handleSave}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, fontWeight: 600, background: "#121a2e", border: "1px solid rgba(0,0,0,0.2)", color: "#fff", padding: "8px 12px", borderRadius: 9, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                >
                  <Plus size={13} />Sauvegarder
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right panel - Prospects list */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Stats bar */}
        <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.07)", padding: "12px 24px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {[
              { val: prospects.length, label: "Total", color: "#121a2e" },
              { val: sentCount, label: "Envoyés", color: "#0147ff" },
              { val: positiveCount, label: "Positifs", color: "#168b64" },
              { val: dealCount, label: "Deals", color: "#168b64" },
              { val: convRate, label: "Conversion", color: "#0147ff" },
            ].map((stat, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                {i > 0 && <div style={{ width: 1, height: 32, background: "rgba(0,0,0,0.08)" }} />}
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 20, fontWeight: 700, color: stat.color, margin: 0, letterSpacing: "-0.5px" }}>{stat.val}</p>
                  <p style={{ fontSize: 11, color: "rgba(18,26,46,0.4)", margin: 0 }}>{stat.label}</p>
                </div>
              </div>
            ))}

            {prospects.filter((p) => ["accepted", "replied", "conversation", "deal_closed"].includes(p.status)).length >= 3 && (
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#168b64", background: "#d1fae5", padding: "6px 12px", borderRadius: 9, border: "1px solid #86efac" }}>
                <TrendingUp size={13} />
                L&apos;IA apprend de vos {sentCount} messages envoyés
              </div>
            )}
          </div>
        </div>

        {/* Filter */}
        <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "8px 24px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <button
              onClick={() => setFilterStatus("all")}
              style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer",
                ...(filterStatus === "all"
                  ? { background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)", border: "1px solid #2f4d9d", color: "#fff" }
                  : { background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", color: "rgba(18,26,46,0.6)" }),
                fontFamily: '"Plus Jakarta Sans", sans-serif',
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
                    padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer",
                    ...(filterStatus === s
                      ? { background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)", border: "1px solid #2f4d9d", color: "#fff" }
                      : { background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", color: "rgba(18,26,46,0.6)" }),
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                  }}
                >
                  {PROSPECT_STATUS_LABELS[s]} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 256, textAlign: "center" }}>
              <MessageSquare size={24} style={{ color: "rgba(18,26,46,0.2)", marginBottom: 12 }} />
              <p style={{ fontWeight: 600, color: "rgba(18,26,46,0.5)", fontSize: 14, margin: 0 }}>
                {prospects.length === 0 ? "Aucun message de prospection" : "Aucun message dans cette catégorie"}
              </p>
              <p style={{ fontSize: 12, color: "rgba(18,26,46,0.35)", marginTop: 4 }}>Générez un message avec le panneau de gauche</p>
            </div>
          ) : (
            filtered.map((prospect) => (
              <ProspectCard
                key={prospect.id}
                prospect={prospect}
                expanded={expandedId === prospect.id}
                onToggle={() => setExpandedId(expandedId === prospect.id ? null : prospect.id)}
                onStatusChange={(status) => updateStatus(prospect.id, status)}
                onMessageChange={(msg) => updateMessage(prospect.id, msg)}
                onDelete={() => deleteProspect(prospect.id)}
                onCopy={(msg) => copyMessage(prospect.id, msg)}
                copied={copied === prospect.id}
                showStatusDropdown={statusDropdown === prospect.id}
                onToggleDropdown={() => setStatusDropdown(statusDropdown === prospect.id ? null : prospect.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ProspectCard({
  prospect, expanded, onToggle, onStatusChange, onMessageChange,
  onDelete, onCopy, copied, showStatusDropdown, onToggleDropdown,
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
}) {
  const displayMessage = prospect.customMessage || prospect.generatedMessage;
  const statusColor = PROSPECT_STATUS_COLORS[prospect.status] || "bg-gray-100 text-gray-600";

  return (
    <div style={{ background: "#fff", borderRadius: 13, border: "1px solid rgba(0,0,0,0.09)", overflow: "hidden", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer" }}
        onClick={onToggle}
      >
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e8edff", display: "flex", alignItems: "center", justifyContent: "center", color: "#0147ff", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
          {prospect.name[0]?.toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 600, color: "#121a2e", fontSize: 14 }}>{prospect.name}</span>
            <span style={{ fontSize: 12, color: "rgba(18,26,46,0.4)" }}>{ACTION_LABELS[prospect.actionType]}</span>
            {prospect.profileUrl && (
              <a href={prospect.profileUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "rgba(18,26,46,0.3)", display: "flex" }}>
                <ExternalLink size={12} />
              </a>
            )}
          </div>
          <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: "2px 0 0" }}>
            {displayMessage.slice(0, 60)}...
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ position: "relative" }}>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleDropdown(); }}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${statusColor}`}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, padding: "4px 10px", borderRadius: 20, fontWeight: 500, background: "none", border: "none", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
            >
              <span className={statusColor}>{PROSPECT_STATUS_LABELS[prospect.status]}</span>
              <ChevronDown size={11} />
            </button>
            {showStatusDropdown && (
              <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 12, boxShadow: "0px 8px 24px rgba(0,0,0,0.12)", zIndex: 10, padding: 4, width: 176 }}>
                {STATUS_VARIANTS.map((s) => (
                  <button
                    key={s}
                    onClick={(e) => { e.stopPropagation(); onStatusChange(s); }}
                    style={{
                      width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 12, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif',
                      background: "none", border: "none", borderRadius: 8,
                      color: s === prospect.status ? "#121a2e" : "rgba(18,26,46,0.6)",
                      fontWeight: s === prospect.status ? 600 : 400,
                      display: "flex", alignItems: "center", gap: 8,
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "currentColor", display: "inline-block", opacity: 0.5 }} />
                    {PROSPECT_STATUS_LABELS[s]}
                    {s === prospect.status && <Check size={11} style={{ marginLeft: "auto" }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <ChevronDown size={16} style={{ color: "rgba(18,26,46,0.4)", transform: expanded ? "rotate(180deg)" : "none" }} />
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "12px 16px 16px", borderTop: "1px solid rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: 12 }}>
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
              style={{ width: "100%", fontSize: 13, border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9, padding: "9px 12px", background: "#f6f6f6", color: "#121a2e", outline: "none", resize: "none", boxSizing: "border-box", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => onCopy(displayMessage)}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, border: "1px solid rgba(0,0,0,0.09)", color: "rgba(18,26,46,0.6)", padding: "7px 12px", borderRadius: 9, background: "#f6f6f6", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copié !" : "Copier"}
            </button>

            {prospect.status === "draft" && (
              <button
                onClick={() => onStatusChange("sent")}
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)", border: "1px solid #2f4d9d", color: "#fff", padding: "7px 12px", borderRadius: 9, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
              >
                <Check size={13} />Marquer comme envoyé
              </button>
            )}

            <button
              onClick={onDelete}
              style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#ef4444", padding: "7px 12px", borderRadius: 9, background: "none", border: "none", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
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
    </div>
  );
}
