"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus, Sparkles, RefreshCw, Copy, Check, ChevronDown, X,
  ExternalLink, TrendingUp, MessageSquare, ThumbsUp, Eye,
  PenLine, Bot, Send, User, ChevronRight, MessagesSquare,
  Layers, Trash2, Globe, Minus,
} from "lucide-react";
import {
  LinkedInProspect, ConversationMessage, ProspectionSkeleton,
  ACTION_LABELS, PROSPECT_STATUS_LABELS, PROSPECT_TO_LEAD_STATUS,
} from "@/types/linkedin";
import { loadLinkedInSettings } from "@/lib/linkedin/settings";
import SmartSelectionTextarea from "@/components/shared/SmartSelectionTextarea";
import {
  fetchRemoteLinkedInWorkspace,
  hasMeaningfulLinkedInWorkspaceData,
  loadLinkedInWorkspaceCache,
  patchRemoteLinkedInWorkspace,
  persistLinkedInWorkspacePatch,
} from "@/lib/linkedin/workspace";

const jk = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;
const DRAFT_KEY = "linkedin_prospection_draft";

const inp = {
  width: "100%", fontSize: 13, border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9,
  padding: "9px 12px", background: "#f6f6f6", color: "#121a2e", outline: "none",
  boxSizing: "border-box" as const, fontFamily: '"Plus Jakarta Sans", sans-serif',
};

// Small gradient button (for inline / secondary actions)
const btnGrad = {
  background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
  border: "1px solid #2f4d9d", color: "#fff", cursor: "pointer", borderRadius: 9,
  fontFamily: '"Plus Jakarta Sans", sans-serif',
};

function getLoginButtonStyle(disabled = false, loading = false) {
  return {
    width: "100%",
    padding: "15px 20px",
    background: loading
      ? "linear-gradient(121deg, rgb(40,80,200) 9.99%, rgb(0,45,180) 82.49%)"
      : "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
    color: "#fff",
    border: "1px solid #2f4d9d",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: "-0.45px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: "inset 0px -3px 0px 0px #0e42c8, 0px 4px 12px rgba(1,71,255,0.2)",
    fontFamily: '"Plus Jakarta Sans", sans-serif',
  } as const;
}

const ACTION_OPTIONS: { value: LinkedInProspect["actionType"]; label: string; icon: React.ReactNode }[] = [
  { value: "liked",           label: "A liké votre post",      icon: <ThumbsUp size={14} /> },
  { value: "commented",       label: "A commenté votre post",  icon: <MessageSquare size={14} /> },
  { value: "visited_profile", label: "A visité votre profil",  icon: <Eye size={14} /> },
  { value: "none",            label: "Aucune / Autre",         icon: <Minus size={14} /> },
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

const SKELETONS_KEY = "linkedin_prospection_skeletons";

function loadSkeletons(): ProspectionSkeleton[] {
  try {
    const saved = localStorage.getItem(SKELETONS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function pickBestSkeleton(skeletons: ProspectionSkeleton[], actionType: string): ProspectionSkeleton | null {
  const active = skeletons.filter(
    (s) => s.isActive && (s.actionTypes.length === 0 || s.actionTypes.includes(actionType))
  );
  if (active.length === 0) return null;
  return active.sort((a, b) => {
    const rateA = a.timesUsed > 0 ? a.timesSuccess / a.timesUsed : 0;
    const rateB = b.timesUsed > 0 ? b.timesSuccess / b.timesUsed : 0;
    if (rateB !== rateA) return rateB - rateA;
    return b.timesUsed - a.timesUsed;
  })[0];
}

function getStats(prospects: LinkedInProspect[]) {
  const sent = prospects.filter((p) => p.status !== "draft").length;
  const positive = prospects.filter((p) =>
    ["accepted", "replied", "conversation", "deal_closed"].includes(p.status)
  ).length;
  const byAction: Record<string, { total: number; positive: number }> = {};
  for (const p of prospects) {
    if (p.status === "draft") continue;
    if (!byAction[p.actionType]) byAction[p.actionType] = { total: 0, positive: 0 };
    byAction[p.actionType].total++;
    if (["accepted", "replied", "conversation", "deal_closed"].includes(p.status))
      byAction[p.actionType].positive++;
  }
  return {
    total: prospects.length, sent, positive,
    accepted: prospects.filter((p) => p.status === "accepted").length,
    replied: prospects.filter((p) => p.status === "replied").length,
    conversation: prospects.filter((p) => p.status === "conversation").length,
    dealClosed: prospects.filter((p) => p.status === "deal_closed").length,
    dealLost: prospects.filter((p) => p.status === "deal_lost").length,
    rejected: prospects.filter((p) => p.status === "rejected").length,
    conversionRate: sent === 0 ? "—" : `${Math.round((positive / sent) * 100)}%`,
    byAction,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Left Panel
// ─────────────────────────────────────────────────────────────────────────────
function LeftPanel({
  language, onLanguageChange, onSave, skeletons, onSkeletonsUpdate, allProspects,
}: {
  language: "fr" | "en";
  onLanguageChange: (l: "fr" | "en") => void;
  onSave: (p: LinkedInProspect) => void;
  skeletons: ProspectionSkeleton[];
  onSkeletonsUpdate: (s: ProspectionSkeleton[]) => void;
  allProspects: LinkedInProspect[];
}) {
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [generating, setGenerating] = useState(false);
  const [creatingSkeletons, setCreatingSkeletons] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSkeletonPicker, setShowSkeletonPicker] = useState(false);
  const [selectedSkeleton, setSelectedSkeleton] = useState<ProspectionSkeleton | null>(null);
  const [refiningGenerated, setRefiningGenerated] = useState(false);
  const [refiningManual, setRefiningManual] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const draftLoadedRef = useRef(false);
  const [draftHydrated, setDraftHydrated] = useState(false);

  const [form, setForm] = useState({
    name: "", profileUrl: "", siteUrl: "",
    actionType: "liked" as LinkedInProspect["actionType"],
    context: "",
  });
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [manualMessage, setManualMessage] = useState("");
  const [explanation, setExplanation] = useState("");
  const smartAiSettings = loadLinkedInSettings();

  // Auto-select best skeleton when action type changes
  useEffect(() => {
    const best = pickBestSkeleton(skeletons, form.actionType);
    setSelectedSkeleton(best);
  }, [form.actionType, skeletons]);

  useEffect(() => {
    if (draftLoadedRef.current) return;
    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (!savedDraft) return;
      const draft = JSON.parse(savedDraft) as {
        mode?: "ai" | "manual";
        form?: typeof form;
        generatedMessage?: string;
        manualMessage?: string;
        explanation?: string;
        selectedSkeletonId?: string | null;
      };
      if (draft.mode) setMode(draft.mode);
      if (draft.form) setForm((prev) => ({ ...prev, ...draft.form }));
      if (typeof draft.generatedMessage === "string") setGeneratedMessage(draft.generatedMessage);
      if (typeof draft.manualMessage === "string") setManualMessage(draft.manualMessage);
      if (typeof draft.explanation === "string") setExplanation(draft.explanation);
      if (draft.selectedSkeletonId) {
        const matchingSkeleton = skeletons.find((sk) => sk.id === draft.selectedSkeletonId);
        if (matchingSkeleton) setSelectedSkeleton(matchingSkeleton);
      }
    } catch {}
    draftLoadedRef.current = true;
    setDraftHydrated(true);
  }, [skeletons]);

  useEffect(() => {
    if (!draftHydrated) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        mode,
        form,
        generatedMessage,
        manualMessage,
        explanation,
        selectedSkeletonId: selectedSkeleton?.id ?? null,
      }));
      setDraftSavedAt(new Date().toISOString());
    } catch {}
  }, [draftHydrated, mode, form, generatedMessage, manualMessage, explanation, selectedSkeleton]);

  const resetDraft = () => {
    setForm({ name: "", profileUrl: "", siteUrl: "", actionType: "liked", context: "" });
    setGeneratedMessage("");
    setManualMessage("");
    setExplanation("");
    setSelectedSkeleton(pickBestSkeleton(skeletons, "liked"));
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setDraftSavedAt(null);
  };

  const getLearningData = () => {
    return allProspects
      .filter((p) => p.status !== "draft")
      .map((p) => ({ message: p.customMessage || p.generatedMessage, status: p.status, actionType: p.actionType }));
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
          name: form.name, actionType: form.actionType,
          context: form.context, siteUrl: form.siteUrl || undefined,
          skeleton: selectedSkeleton || undefined,
          learningData: getLearningData(), language,
          openrouterApiKey: s.openrouterApiKey || undefined,
          model: s.prospectionSmallModel || s.model,
          smallPrompt: s.prospectionSmallPrompt || undefined,
        }),
      });
      const data = await res.json();
      setGeneratedMessage(data.message || "");
      setExplanation(data.explanation || "");
    } catch (e) { console.error(e); }
    finally { setGenerating(false); }
  };

  const handleRefineGenerated = async () => {
    if (!generatedMessage.trim()) return;
    setRefiningGenerated(true);
    try {
      const s = loadLinkedInSettings();
      const res = await fetch("/api/linkedin/refine-message", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: generatedMessage, name: form.name || undefined, context: form.context || undefined,
          openrouterApiKey: s.openrouterApiKey || undefined,
          model: s.prospectionSmallModel || s.model,
          smallPrompt: s.prospectionSmallPrompt || undefined,
        }),
      });
      const data = await res.json();
      if (data.message) setGeneratedMessage(data.message);
    } catch (e) { console.error(e); }
    finally { setRefiningGenerated(false); }
  };

  const handleRefineManual = async () => {
    if (!manualMessage.trim()) return;
    setRefiningManual(true);
    try {
      const s = loadLinkedInSettings();
      const res = await fetch("/api/linkedin/refine-message", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: manualMessage, name: form.name || undefined, context: form.context || undefined,
          openrouterApiKey: s.openrouterApiKey || undefined,
          model: s.prospectionSmallModel || s.model,
          smallPrompt: s.prospectionSmallPrompt || undefined,
        }),
      });
      const data = await res.json();
      if (data.message) setManualMessage(data.message);
    } catch (e) { console.error(e); }
    finally { setRefiningManual(false); }
  };

  const buildProspect = (message: string, isManual: boolean): LinkedInProspect | null => {
    if (!message.trim() || !form.name.trim()) return null;
    return {
      id: `prospect_${Date.now()}`,
      name: form.name, profileUrl: form.profileUrl || undefined,
      siteUrl: form.siteUrl || undefined,
      actionType: form.actionType, context: form.context || undefined,
      generatedMessage: message, isManual,
      skeletonId: !isManual && selectedSkeleton ? selectedSkeleton.id : undefined,
      status: "draft", createdAt: new Date().toISOString(),
    };
  };

  const handleSaveAI = async () => {
    const prospect = buildProspect(generatedMessage, false);
    if (!prospect) return;

    // Track skeleton usage
    if (selectedSkeleton) {
      const updated = skeletons.map((sk) =>
        sk.id === selectedSkeleton.id ? { ...sk, timesUsed: sk.timesUsed + 1 } : sk
      );
      onSkeletonsUpdate(updated);
    }

    // Sync with CRM
    try {
      const res = await fetch("/api/leads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, source: "linkedin", source_ref: form.profileUrl || null, channel_preference: "linkedin_dm", metadata: { action_type: form.actionType, context: form.context || null, site_url: form.siteUrl || null }, status: "new" }),
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
    resetDraft();
  };

  const handleSaveManual = () => {
    const prospect = buildProspect(manualMessage, true);
    if (!prospect) return;
    onSave(prospect);
    resetDraft();
  };

  const handleCreateSkeletons = async () => {
    const sentProspects = allProspects.filter((p) => p.status !== "draft");
    if (sentProspects.length < 3) return;
    setCreatingSkeletons(true);
    try {
      const s = loadLinkedInSettings();
      const res = await fetch("/api/linkedin/create-skeletons", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospects: sentProspects.map((p) => ({
            name: p.name, actionType: p.actionType, status: p.status,
            message: p.customMessage || p.generatedMessage,
          })),
          openrouterApiKey: s.openrouterApiKey || undefined,
          bigModel: s.prospectionBigModel, bigPrompt: s.prospectionBigPrompt,
        }),
      });
      const data = await res.json();
      if (data.skeletons?.length > 0) {
        const existingIds = new Set(skeletons.map((sk) => sk.id));
        const newOnes = data.skeletons.filter((sk: ProspectionSkeleton) => !existingIds.has(sk.id));
        onSkeletonsUpdate([...skeletons, ...newOnes]);
      }
    } catch (e) { console.error(e); }
    finally { setCreatingSkeletons(false); }
  };

  const toggleSkeleton = (id: string) =>
    onSkeletonsUpdate(skeletons.map((sk) => sk.id === id ? { ...sk, isActive: !sk.isActive } : sk));

  const deleteSkeleton = (id: string) =>
    onSkeletonsUpdate(skeletons.filter((sk) => sk.id !== id));

  const copyMsg = (msg: string) => {
    navigator.clipboard.writeText(msg);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const canSaveManual = form.name.trim().length > 0 && manualMessage.trim().length > 0;
  const sentCount = allProspects.filter((p) => p.status !== "draft").length;

  return (
    <div style={{ width: 384, background: "#fff", borderRight: "1px solid rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
      {/* Header */}
      <div style={{ padding: "14px 20px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontWeight: 700, color: "#121a2e", fontSize: 15, margin: 0, letterSpacing: "-0.3px" }}>Nouveau prospect</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {draftSavedAt && (
              <span style={{ fontSize: 11, color: "rgba(18,26,46,0.35)", whiteSpace: "nowrap" }}>
                Auto-save
              </span>
            )}
            <select
              value={language}
              onChange={(e) => { onLanguageChange(e.target.value as "fr" | "en"); localStorage.setItem("linkedin_prospection_language", e.target.value); }}
              style={{ border: "1px solid rgba(0,0,0,0.09)", borderRadius: 8, padding: "4px 8px", fontSize: 12, color: "#121a2e", background: "#f6f6f6", outline: "none", ...jk }}
            >
              <option value="fr">FR</option>
              <option value="en">EN</option>
            </select>
          </div>
        </div>

        {/* Mode tabs */}
        <div style={{ display: "flex", background: "#f2f2f2", borderRadius: 10, padding: 3, gap: 3, marginBottom: 0 }}>
          {([["ai", Bot, "Générer avec l'IA"], ["manual", PenLine, "Message manuel"]] as const).map(([m, Icon, label]) => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "7px 8px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", ...jk,
              ...(mode === m
                ? { background: "#fff", border: "none", color: "#121a2e", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }
                : { background: "none", border: "none", color: "rgba(18,26,46,0.45)" }),
            }}>
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
              <button key={opt.value} onClick={() => setForm({ ...form, actionType: opt.value })} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9,
                fontSize: 13, textAlign: "left", cursor: "pointer", ...jk,
                ...(form.actionType === opt.value
                  ? { border: "1px solid #0147ff", background: "#e8edff", color: "#0147ff" }
                  : { border: "1px solid rgba(0,0,0,0.09)", background: "#f6f6f6", color: "rgba(18,26,46,0.7)" }),
              }}>
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)" }}>
              <Globe size={12} />
              Site web du prospect <span style={{ fontWeight: 400, opacity: 0.7 }}>(optionnel)</span>
            </label>
            {form.siteUrl && (
              <a href={form.siteUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#0147ff", textDecoration: "none", fontWeight: 600, ...jk }}>
                <ExternalLink size={11} />Ouvrir
              </a>
            )}
          </div>
          <input type="text" value={form.siteUrl} onChange={(e) => setForm({ ...form, siteUrl: e.target.value })} placeholder="https://example.com" style={inp} />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)", marginBottom: 6 }}>Contexte <span style={{ fontWeight: 400, opacity: 0.7 }}>(optionnel)</span></label>
          <textarea value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} placeholder="Ex: Directrice marketing, startup SaaS B2B..." rows={2} style={{ ...inp, resize: "none" }} />
        </div>

        {/* AI mode */}
        {mode === "ai" && (
          <>
            {/* Skeleton selector */}
            <div style={{ border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9, overflow: "visible", position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#f6f6f6", borderRadius: "9px 9px 0 0" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)", display: "flex", alignItems: "center", gap: 5 }}>
                  <Layers size={12} /> Squelette
                </span>
                <button
                  onClick={() => setShowSkeletonPicker((v) => !v)}
                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500, background: "none", border: "none", cursor: "pointer", color: "#121a2e", ...jk }}
                >
                  {selectedSkeleton ? selectedSkeleton.name : <span style={{ color: "rgba(18,26,46,0.4)" }}>Aucun (auto)</span>}
                  <ChevronDown size={11} style={{ color: "rgba(18,26,46,0.4)", transform: showSkeletonPicker ? "rotate(180deg)" : "none" }} />
                </button>
              </div>

              {selectedSkeleton && !showSkeletonPicker && (
                <div style={{ padding: "8px 12px", fontSize: 11, color: "rgba(18,26,46,0.45)", borderTop: "1px solid rgba(0,0,0,0.06)", background: "#fff", borderRadius: "0 0 9px 9px" }}>
                  {selectedSkeleton.description}
                  {selectedSkeleton.timesUsed > 0 && (
                    <span style={{ marginLeft: 8, color: "#168b64", fontWeight: 600 }}>
                      {Math.round((selectedSkeleton.timesSuccess / selectedSkeleton.timesUsed) * 100)}% de succès
                    </span>
                  )}
                </div>
              )}

              {showSkeletonPicker && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "0 0 9px 9px", zIndex: 20, boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}>
                  <button
                    onClick={() => { setSelectedSkeleton(null); setShowSkeletonPicker(false); }}
                    style={{ width: "100%", padding: "9px 12px", textAlign: "left", fontSize: 12, color: "rgba(18,26,46,0.5)", background: "none", border: "none", cursor: "pointer", ...jk, borderBottom: "1px solid rgba(0,0,0,0.06)" }}
                  >
                    Aucun squelette (libre)
                  </button>
                  {skeletons.filter((s) => s.isActive).length === 0 ? (
                    <p style={{ padding: "9px 12px", fontSize: 12, color: "rgba(18,26,46,0.4)", margin: 0 }}>
                      Aucun squelette actif. Générez-en via l&apos;IA ci-dessous.
                    </p>
                  ) : (
                    skeletons.filter((s) => s.isActive).map((sk) => (
                      <button
                        key={sk.id}
                        onClick={() => { setSelectedSkeleton(sk); setShowSkeletonPicker(false); }}
                        style={{
                          width: "100%", padding: "9px 12px", textAlign: "left", background: selectedSkeleton?.id === sk.id ? "#f0f4ff" : "none",
                          border: "none", cursor: "pointer", ...jk, borderBottom: "1px solid rgba(0,0,0,0.04)",
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#121a2e" }}>{sk.name}</div>
                        <div style={{ fontSize: 11, color: "rgba(18,26,46,0.45)", marginTop: 2 }}>
                          {sk.actionTypes.length > 0 ? sk.actionTypes.join(", ") : "tous types"}
                          {sk.timesUsed > 0 && ` · ${Math.round((sk.timesSuccess / sk.timesUsed) * 100)}% succès`}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || !form.name.trim()}
              style={getLoginButtonStyle(generating || !form.name.trim(), generating)}
            >
              {generating ? <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={15} />}
              {generating ? "Génération..." : "Générer le message"}
            </button>

            {generatedMessage && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {explanation && <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", margin: 0 }}>{explanation}</p>}
                <SmartSelectionTextarea
                  value={generatedMessage}
                  onChange={setGeneratedMessage}
                  rows={6}
                  contextLabel="message de prospection LinkedIn"
                  globalLabel="Améliorer tout le message"
                  apiKey={smartAiSettings.openrouterApiKey || undefined}
                  model={smartAiSettings.prospectionSmallModel || smartAiSettings.model}
                  prompt={smartAiSettings.prospectionSmallPrompt || undefined}
                  style={{ ...inp }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => copyMsg(generatedMessage)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, border: "1px solid rgba(0,0,0,0.09)", color: "rgba(18,26,46,0.6)", padding: "8px", borderRadius: 9, background: "#f6f6f6", cursor: "pointer", ...jk }}>
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? "Copié !" : "Copier"}
                  </button>
                  <button onClick={handleSaveAI} style={{ ...getLoginButtonStyle(false, false), flex: 1, padding: "15px 16px" }}>
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
              <SmartSelectionTextarea
                value={manualMessage}
                onChange={setManualMessage}
                placeholder={`${form.name || "Marie"}, j'ai vu ton post sur…`}
                rows={6}
                contextLabel="message manuel de prospection LinkedIn"
                globalLabel="Améliorer tout le message"
                apiKey={smartAiSettings.openrouterApiKey || undefined}
                model={smartAiSettings.prospectionSmallModel || smartAiSettings.model}
                prompt={smartAiSettings.prospectionSmallPrompt || undefined}
                style={{ ...inp, lineHeight: 1.6 }}
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
                style={{ ...getLoginButtonStyle(!canSaveManual, false), flex: 1, padding: "15px 16px" }}
              >
                <Plus size={13} />Sauvegarder
              </button>
            </div>
          </>
        )}

        {/* ── Skeleton management ── */}
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 16, marginTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(18,26,46,0.6)", display: "flex", alignItems: "center", gap: 5 }}>
              <Layers size={13} /> Squelettes ({skeletons.filter((s) => s.isActive).length} actifs)
            </span>
            <button
              onClick={handleCreateSkeletons}
              disabled={creatingSkeletons || sentCount < 3}
              title={sentCount < 3 ? "Il faut au moins 3 prospects envoyés" : "Générer des squelettes via Big AI"}
              style={{ ...getLoginButtonStyle(creatingSkeletons || sentCount < 3, creatingSkeletons), width: "auto", padding: "10px 14px", fontSize: 12 }}
            >
              {creatingSkeletons
                ? <RefreshCw size={11} style={{ animation: "spin 1s linear infinite" }} />
                : <Sparkles size={11} />}
              {creatingSkeletons ? "Analyse..." : "Générer via IA"}
            </button>
          </div>

          {sentCount < 3 && (
            <p style={{ fontSize: 11, color: "rgba(18,26,46,0.4)", margin: "0 0 8px", textAlign: "center" }}>
              Envoyez au moins 3 messages pour générer des squelettes ({sentCount}/3)
            </p>
          )}

          {skeletons.length === 0 ? (
            <p style={{ fontSize: 11, color: "rgba(18,26,46,0.35)", textAlign: "center", padding: "8px 0", margin: 0 }}>
              Aucun squelette — la Big AI créera des structures basées sur vos données
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {skeletons.map((sk) => (
                <div key={sk.id} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                  borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)",
                  background: sk.isActive ? "#f9f9f9" : "#fff", opacity: sk.isActive ? 1 : 0.5,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#121a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sk.name}</div>
                    {sk.timesUsed > 0 && (
                      <div style={{ fontSize: 10, color: "#168b64" }}>
                        {Math.round((sk.timesSuccess / sk.timesUsed) * 100)}% · {sk.timesUsed} envoi{sk.timesUsed > 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleSkeleton(sk.id)}
                    style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, cursor: "pointer", ...jk,
                      ...(sk.isActive
                        ? { background: "#d1fae5", color: "#168b64", border: "none" }
                        : { background: "#f6f6f6", color: "rgba(18,26,46,0.4)", border: "1px solid rgba(0,0,0,0.09)" }),
                    }}
                  >
                    {sk.isActive ? "ON" : "OFF"}
                  </button>
                  <button
                    onClick={() => deleteSkeleton(sk.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 3, display: "flex" }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
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

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const stats = getStats(prospects);

  const SUGGESTIONS = [
    "Quel type d'action génère le plus de réponses ?",
    "Qu'est-ce qui différencie mes messages performants ?",
    "Comment améliorer mon taux de conversion ?",
    "Quel est le meilleur moment pour suivre un prospect ?",
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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: text, history: messages, stats,
          prospects: prospects.map((p) => ({
            name: p.name, actionType: p.actionType, status: p.status,
            message: p.customMessage || p.generatedMessage,
            conversationLength: p.conversation?.length,
          })),
          openrouterApiKey: s.openrouterApiKey || undefined, model: s.model,
        }),
      });
      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.reply || data.error || "Erreur." }]);
    } catch (e) {
      setMessages([...newMessages, { role: "assistant", content: "Erreur de connexion." }]);
      console.error(e);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#fbfbfb" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "10px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12, color: "rgba(18,26,46,0.5)" }}>
          <span style={{ fontWeight: 700, color: "#121a2e", fontSize: 13 }}>Contexte IA</span>
          <span>{stats.total} prospects</span><span>·</span>
          <span>{stats.sent} envoyés</span><span>·</span>
          <span style={{ color: "#168b64", fontWeight: 600 }}>{stats.conversionRate} conversion</span><span>·</span>
          <span>{stats.dealClosed} deals</span>
        </div>
      </div>

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
                <button key={s} onClick={() => sendMessage(s)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, background: "#fff", border: "1px solid rgba(0,0,0,0.09)", fontSize: 13, color: "#121a2e", cursor: "pointer", textAlign: "left", ...jk }}>
                  <ChevronRight size={14} style={{ color: "rgba(18,26,46,0.3)", flexShrink: 0 }} />{s}
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
                maxWidth: "75%", padding: "10px 14px", fontSize: 13, lineHeight: 1.6, ...jk, whiteSpace: "pre-wrap",
                borderRadius: msg.role === "user" ? "13px 13px 4px 13px" : "13px 13px 13px 4px",
                background: msg.role === "user" ? "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)" : "#fff",
                color: msg.role === "user" ? "#fff" : "#121a2e",
                border: msg.role === "user" ? "none" : "1px solid rgba(0,0,0,0.08)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
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
            <div style={{ padding: "10px 14px", background: "#fff", borderRadius: "13px 13px 13px 4px", border: "1px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "center", gap: 4 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#0147ff", opacity: 0.6, animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: "12px 20px", background: "#fff", borderTop: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="Posez une question sur vos données..." rows={1}
            style={{ ...inp, flex: 1, resize: "none", padding: "10px 14px", lineHeight: 1.5 }}
          />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading} style={{ ...btnGrad, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "center", opacity: !input.trim() || loading ? 0.5 : 1, flexShrink: 0 }}>
            <Send size={15} />
          </button>
        </div>
        <p style={{ fontSize: 11, color: "rgba(18,26,46,0.3)", marginTop: 6, marginBottom: 0 }}>Entrée pour envoyer · Maj+Entrée pour sauter une ligne</p>
      </div>
      <style>{`@keyframes bounce { 0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1} }`}</style>
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
  const [generatingReply, setGeneratingReply] = useState(false);
  const [generatedReply, setGeneratedReply] = useState("");
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [refiningMsg, setRefiningMsg] = useState(false);
  const [refiningConv, setRefiningConv] = useState(false);
  const smartAiSettings = loadLinkedInSettings();

  const displayMessage = prospect.customMessage || prospect.generatedMessage;
  const ss = STATUS_STYLES[prospect.status] ?? STATUS_STYLES.draft;
  const convLen = prospect.conversation?.length ?? 0;

  const addConvMessage = () => {
    if (!convInput.trim()) return;
    const msg: ConversationMessage = {
      id: `msg_${Date.now()}`,
      sender: convSender, content: convInput.trim(), sentAt: new Date().toISOString(),
    };
    onUpdateConversation([...(prospect.conversation ?? []), msg]);
    setConvInput("");
  };

  const deleteConvMessage = (id: string) =>
    onUpdateConversation((prospect.conversation ?? []).filter((m) => m.id !== id));

  const handleGenerateReply = async () => {
    if (!prospect.conversation?.length) return;
    setGeneratingReply(true);
    try {
      const s = loadLinkedInSettings();
      const history = (prospect.conversation ?? []).map((m) => ({
        role: m.sender === "me" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      }));
      const res = await fetch("/api/linkedin/generate-prospection", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: prospect.name, actionType: prospect.actionType,
          context: prospect.context, conversationHistory: history,
          mode: "reply",
          openrouterApiKey: loadLinkedInSettings().openrouterApiKey || undefined,
          model: s.prospectionSmallModel || s.model,
          smallPrompt: s.prospectionSmallPrompt || undefined,
        }),
      });
      const data = await res.json();
      setGeneratedReply(data.message || "");
    } catch (e) { console.error(e); }
    finally { setGeneratingReply(false); }
  };

  const handleRefineMsg = async () => {
    if (!displayMessage.trim()) return;
    setRefiningMsg(true);
    try {
      const s = loadLinkedInSettings();
      const res = await fetch("/api/linkedin/refine-message", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: displayMessage, name: prospect.name, context: prospect.context,
          openrouterApiKey: s.openrouterApiKey || undefined,
          model: s.prospectionSmallModel || s.model,
          smallPrompt: s.prospectionSmallPrompt || undefined,
        }),
      });
      const data = await res.json();
      if (data.message) onMessageChange(data.message);
    } catch (e) { console.error(e); }
    finally { setRefiningMsg(false); }
  };

  const handleRefineConv = async () => {
    if (!convInput.trim()) return;
    setRefiningConv(true);
    try {
      const s = loadLinkedInSettings();
      const res = await fetch("/api/linkedin/refine-message", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: convInput, name: prospect.name, context: prospect.context,
          openrouterApiKey: s.openrouterApiKey || undefined,
          model: s.prospectionSmallModel || s.model,
          smallPrompt: s.prospectionSmallPrompt || undefined,
        }),
      });
      const data = await res.json();
      if (data.message) setConvInput(data.message);
    } catch (e) { console.error(e); }
    finally { setRefiningConv(false); }
  };

  const useGeneratedReply = () => {
    setConvInput(generatedReply);
    setConvSender("me");
    setGeneratedReply("");
  };

  return (
    <div style={{ background: "#fff", borderRadius: 13, border: "1px solid rgba(0,0,0,0.09)", ...jk }}>
      {/* Row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer" }} onClick={onToggle}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e8edff", display: "flex", alignItems: "center", justifyContent: "center", color: "#0147ff", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
          {prospect.name[0]?.toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
            {prospect.siteUrl && (
              <a href={prospect.siteUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "rgba(18,26,46,0.3)", display: "flex" }} title={prospect.siteUrl}>
                <Globe size={12} />
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
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, padding: "5px 14px", borderRadius: 100, fontWeight: 600, cursor: "pointer", ...jk, background: ss.bg, color: ss.color, border: "none" }}
            >
              {PROSPECT_STATUS_LABELS[prospect.status]}<ChevronDown size={11} />
            </button>
            {showStatusDropdown && (
              <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 12, boxShadow: "0px 8px 24px rgba(0,0,0,0.12)", zIndex: 10, padding: 4, width: 180 }}>
                {STATUS_VARIANTS.map((s) => {
                  const sss = STATUS_STYLES[s] ?? STATUS_STYLES.draft;
                  return (
                    <button key={s} onClick={(e) => { e.stopPropagation(); onStatusChange(s); }} style={{
                      width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 12, cursor: "pointer", ...jk,
                      background: s === prospect.status ? "#f6f6f6" : "none", border: "none", borderRadius: 8,
                      color: "#121a2e", fontWeight: s === prospect.status ? 600 : 400,
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
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
              <button key={t} onClick={() => setCardTab(t)} style={{
                flex: 1, padding: "10px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", ...jk,
                background: "none", borderBottom: cardTab === t ? "2px solid #0147ff" : "2px solid transparent",
                borderLeft: "none", borderRight: "none", borderTop: "none",
                color: cardTab === t ? "#0147ff" : "rgba(18,26,46,0.4)",
              }}>
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
                <SmartSelectionTextarea
                  value={displayMessage}
                  onChange={onMessageChange}
                  rows={5}
                  contextLabel="message de prospection LinkedIn"
                  globalLabel="Améliorer tout le message"
                  apiKey={smartAiSettings.openrouterApiKey || undefined}
                  model={smartAiSettings.prospectionSmallModel || smartAiSettings.model}
                  prompt={smartAiSettings.prospectionSmallPrompt || undefined}
                  style={{ ...inp }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => onCopy(displayMessage)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, border: "1px solid rgba(0,0,0,0.09)", color: "rgba(18,26,46,0.6)", padding: "7px 12px", borderRadius: 9, background: "#f6f6f6", cursor: "pointer", ...jk }}>
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Copié !" : "Copier"}
                </button>
                {prospect.status === "draft" && (
                  <button onClick={() => onStatusChange("sent")} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, ...btnGrad, padding: "7px 12px" }}>
                    <Check size={13} />Marquer comme envoyé
                  </button>
                )}
                <button onClick={onDelete} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#ef4444", padding: "7px 12px", borderRadius: 9, background: "none", border: "none", cursor: "pointer", ...jk }}>
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
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
                {(prospect.conversation ?? []).length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px 0" }}>
                    <MessagesSquare size={22} style={{ color: "rgba(18,26,46,0.2)", margin: "0 auto 8px" }} />
                    <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", margin: 0 }}>Aucun message</p>
                    <p style={{ fontSize: 11, color: "rgba(18,26,46,0.3)", marginTop: 4 }}>Collez les messages échangés pour garder un historique</p>
                  </div>
                ) : (
                  (prospect.conversation ?? []).map((msg) => (
                    <div
                      key={msg.id}
                      style={{ display: "flex", flexDirection: "column", alignItems: msg.sender === "me" ? "flex-end" : "flex-start", position: "relative" }}
                      onMouseEnter={() => setHoveredMsgId(msg.id)}
                      onMouseLeave={() => setHoveredMsgId(null)}
                    >
                      <div style={{ fontSize: 10, color: "rgba(18,26,46,0.35)", marginBottom: 3, display: "flex", alignItems: "center", gap: 6, paddingLeft: msg.sender === "them" ? 6 : 0, paddingRight: msg.sender === "me" ? 6 : 0 }}>
                        {msg.sender === "me" ? "Moi" : prospect.name} · {new Date(msg.sentAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        {hoveredMsgId === msg.id && (
                          <button
                            onClick={() => deleteConvMessage(msg.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 0, display: "flex", alignItems: "center" }}
                          >
                            <X size={10} />
                          </button>
                        )}
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

              {/* Generated reply preview */}
              {generatedReply && (
                <div style={{ background: "#f0f4ff", border: "1px solid #c7d3ff", borderRadius: 9, padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#0147ff", display: "flex", alignItems: "center", gap: 5 }}>
                      <Sparkles size={11} /> Réponse suggérée
                    </span>
                    <button onClick={() => setGeneratedReply("")} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.3)", padding: 0 }}>
                      <X size={12} />
                    </button>
                  </div>
                  <p style={{ fontSize: 12, color: "#121a2e", lineHeight: 1.6, margin: "0 0 8px" }}>{generatedReply}</p>
                  <button
                    onClick={useGeneratedReply}
                    style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, ...btnGrad, padding: "5px 10px" }}
                  >
                    <Plus size={11} />Utiliser ce message
                  </button>
                </div>
              )}

              {/* Generate reply button */}
              <button
                onClick={handleGenerateReply}
                disabled={generatingReply || convLen === 0}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, fontWeight: 600,
                  padding: "8px", width: "100%",
                  background: btnGrad.background, border: btnGrad.border, color: btnGrad.color,
                  borderRadius: 9, cursor: generatingReply || convLen === 0 ? "not-allowed" : "pointer",
                  ...jk, opacity: generatingReply || convLen === 0 ? 0.5 : 1,
                }}
              >
                {generatingReply ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={13} />}
                {generatingReply ? "Génération..." : "Générer une réponse IA"}
              </button>

              {/* Add message */}
              <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["them", "me"] as const).map((s) => (
                    <button key={s} onClick={() => setConvSender(s)} style={{
                      flex: 1, padding: "6px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", ...jk,
                      ...(convSender === s
                        ? { background: s === "me" ? "#e8edff" : "#f6f6f6", border: s === "me" ? "1px solid #c7d3ff" : "1px solid rgba(0,0,0,0.12)", color: s === "me" ? "#0147ff" : "#121a2e" }
                        : { background: "none", border: "1px solid rgba(0,0,0,0.07)", color: "rgba(18,26,46,0.4)" }),
                    }}>
                      {s === "me" ? "Moi" : prospect.name}
                    </button>
                  ))}
                </div>
                <SmartSelectionTextarea
                  value={convInput}
                  onChange={setConvInput}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      addConvMessage();
                    }
                  }}
                  placeholder="Collez ou tapez le message..."
                  rows={2}
                  contextLabel="réponse de conversation LinkedIn"
                  globalLabel="Améliorer tout le texte"
                  apiKey={smartAiSettings.openrouterApiKey || undefined}
                  model={smartAiSettings.prospectionSmallModel || smartAiSettings.model}
                  prompt={smartAiSettings.prospectionSmallPrompt || undefined}
                  style={{ ...inp }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addConvMessage} disabled={!convInput.trim()} style={{ ...btnGrad, padding: "9px 12px", display: "flex", alignItems: "center", justifyContent: "center", opacity: convInput.trim() ? 1 : 0.5, flexShrink: 0 }}>
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
  const [skeletons, setSkeletons] = useState<ProspectionSkeleton[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null);
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [rightView, setRightView] = useState<"prospects" | "chat">("prospects");
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [syncingAirtable, setSyncingAirtable] = useState(false);
  const [airtableSyncMsg, setAirtableSyncMsg] = useState<string | null>(null);
  const hasLoadedProspectsRef = useRef(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncSignatureRef = useRef("");
  const initialAirtableLoadRef = useRef(false);

  useEffect(() => {
    const cachedWorkspace = loadLinkedInWorkspaceCache();
    setProspects(cachedWorkspace.prospects);
    setLanguage(cachedWorkspace.preferences.prospectionLanguage);
    setSkeletons(cachedWorkspace.skeletons);

    void (async () => {
      try {
        const remote = await fetchRemoteLinkedInWorkspace();
        if (remote.hasStoredData) {
          setProspects(remote.workspace.prospects);
          setSkeletons(remote.workspace.skeletons);
          setLanguage(remote.workspace.preferences.prospectionLanguage);
        } else if (hasMeaningfulLinkedInWorkspaceData(cachedWorkspace)) {
          await patchRemoteLinkedInWorkspace(cachedWorkspace);
        }
      } catch {} finally {
        hasLoadedProspectsRef.current = true;
        setWorkspaceReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (initialAirtableLoadRef.current) return;
    initialAirtableLoadRef.current = true;

    const s = loadLinkedInSettings();
    if (!s.airtableKey || !s.airtableBaseId || !s.airtableTableName) return;

    void (async () => {
      setSyncingAirtable(true);
      try {
        const res = await fetch("/api/linkedin/airtable-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "pull",
            prospects: [],
            airtableKey: s.airtableKey,
            baseId: s.airtableBaseId,
            tableName: s.airtableTableName,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          setAirtableSyncMsg(`❌ ${data.error || "Import Airtable impossible"}`);
          return;
        }

        const importedProspects = Array.isArray(data.prospects) ? data.prospects as LinkedInProspect[] : [];
        if (importedProspects.length > 0) {
          setProspects(importedProspects);
          persistLinkedInWorkspacePatch({ prospects: importedProspects });
          syncSignatureRef.current = JSON.stringify(importedProspects.map((p) => ({
            id: p.id,
            status: p.status,
            generatedMessage: p.generatedMessage,
            customMessage: p.customMessage,
            context: p.context,
            profileUrl: p.profileUrl,
            siteUrl: p.siteUrl,
            sentAt: p.sentAt,
            conversation: p.conversation,
            leadId: p.leadId,
          })));
          setAirtableSyncMsg(`✓ ${data.message || `${importedProspects.length} prospects importés`}`);
        } else {
          setAirtableSyncMsg("✓ Airtable connecté");
        }
      } catch (error) {
        console.error(error);
        setAirtableSyncMsg("❌ Erreur réseau");
      } finally {
        setSyncingAirtable(false);
        setTimeout(() => setAirtableSyncMsg(null), 5000);
      }
    })();
  }, []);

  const saveProspects = (updated: LinkedInProspect[]) => {
    setProspects(updated);
    persistLinkedInWorkspacePatch({ prospects: updated });
  };

  const handleSkeletonsUpdate = (updated: ProspectionSkeleton[]) => {
    setSkeletons(updated);
    persistLinkedInWorkspacePatch({ skeletons: updated });
  };

  useEffect(() => {
    if (!workspaceReady) return;
    persistLinkedInWorkspacePatch({
      preferences: {
        prospectionLanguage: language,
      },
    });
  }, [language, workspaceReady]);

  const handleAirtableSync = async (
    prospectList: LinkedInProspect[],
    options?: { silentIfNotConfigured?: boolean }
  ) => {
    const s = loadLinkedInSettings();
    if (!s.airtableKey || !s.airtableBaseId || !s.airtableTableName) {
      if (options?.silentIfNotConfigured) return;
      setAirtableSyncMsg("⚠️ Configurez Airtable dans les paramètres");
      setTimeout(() => setAirtableSyncMsg(null), 4000);
      return;
    }
    setSyncingAirtable(true);
    try {
      const res = await fetch("/api/linkedin/airtable-sync", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospects: prospectList.map((p) => ({
            id: p.id, name: p.name, actionType: p.actionType, status: p.status,
            generatedMessage: p.generatedMessage, customMessage: p.customMessage,
            isManual: p.isManual, context: p.context, profileUrl: p.profileUrl,
            siteUrl: p.siteUrl, createdAt: p.createdAt, sentAt: p.sentAt,
            conversationLength: p.conversation?.length, skeletonId: p.skeletonId, leadId: p.leadId,
          })),
          airtableKey: s.airtableKey, baseId: s.airtableBaseId, tableName: s.airtableTableName,
          pruneMissing: true,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setAirtableSyncMsg(`❌ ${data.error}`);
      } else {
        setAirtableSyncMsg(`✓ ${data.message || `${data.synced} synchronisés`}`);
      }
    } catch (e) {
      setAirtableSyncMsg("❌ Erreur réseau");
      console.error(e);
    } finally {
      setSyncingAirtable(false);
      setTimeout(() => setAirtableSyncMsg(null), 5000);
    }
  };

  useEffect(() => {
    if (!hasLoadedProspectsRef.current) return;

    const s = loadLinkedInSettings();
    if (!s.airtableKey || !s.airtableBaseId || !s.airtableTableName) return;

    const signature = JSON.stringify(prospects.map((p) => ({
      id: p.id,
      status: p.status,
      generatedMessage: p.generatedMessage,
      customMessage: p.customMessage,
      context: p.context,
      profileUrl: p.profileUrl,
      siteUrl: p.siteUrl,
      sentAt: p.sentAt,
      conversation: p.conversation,
      leadId: p.leadId,
    })));

    if (signature === syncSignatureRef.current) return;

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      syncSignatureRef.current = signature;
      handleAirtableSync(prospects, { silentIfNotConfigured: true });
    }, 1200);
  }, [prospects]);

  const handleSave = (p: LinkedInProspect) => {
    const updated = [p, ...prospects];
    saveProspects(updated);

    // Auto-analysis trigger
    const s = loadLinkedInSettings();
    if (s.prospectionAutoAnalysis) {
      const sentCount = updated.filter((pr) => pr.status !== "draft").length;
      if (sentCount > 0 && sentCount % s.prospectionAutoAnalysisEvery === 0) {
        fetch("/api/linkedin/create-skeletons", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prospects: updated.filter((pr) => pr.status !== "draft").map((pr) => ({
              name: pr.name, actionType: pr.actionType, status: pr.status,
              message: pr.customMessage || pr.generatedMessage,
            })),
            openrouterApiKey: s.openrouterApiKey || undefined,
            bigModel: s.prospectionBigModel, bigPrompt: s.prospectionBigPrompt,
          }),
        }).then((r) => r.json()).then((data) => {
          if (data.skeletons?.length > 0) {
            const loaded = loadSkeletons();
            const existingIds = new Set(loaded.map((sk: ProspectionSkeleton) => sk.id));
            const newOnes = data.skeletons.filter((sk: ProspectionSkeleton) => !existingIds.has(sk.id));
            if (newOnes.length > 0) handleSkeletonsUpdate([...loaded, ...newOnes]);
          }
        }).catch(() => {});
      }
    }
  };

  const updateStatus = async (id: string, status: LinkedInProspect["status"]) => {
    const prospect = prospects.find((p) => p.id === id);
    const updated = prospects.map((p) => {
      if (p.id !== id) return p;
      return { ...p, status, sentAt: status === "sent" && !p.sentAt ? new Date().toISOString() : p.sentAt };
    });
    saveProspects(updated);
    setStatusDropdown(null);

    // Track skeleton success
    if (prospect?.skeletonId && ["accepted", "replied", "conversation", "deal_closed"].includes(status)) {
      const wasAlreadyPositive = ["accepted", "replied", "conversation", "deal_closed"].includes(prospect.status);
      if (!wasAlreadyPositive) {
        const updatedSkeletons = skeletons.map((sk) =>
          sk.id === prospect.skeletonId ? { ...sk, timesSuccess: sk.timesSuccess + 1 } : sk
        );
        handleSkeletonsUpdate(updatedSkeletons);
      }
    }

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
      <LeftPanel
        language={language} onLanguageChange={setLanguage} onSave={handleSave}
        skeletons={skeletons} onSkeletonsUpdate={handleSkeletonsUpdate} allProspects={prospects}
      />

      {/* Right area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
        {/* Stats + view toggle */}
        <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.07)", padding: "12px 24px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
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

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              {airtableSyncMsg && (
                <span style={{ fontSize: 11, color: airtableSyncMsg.startsWith("✓") ? "#168b64" : airtableSyncMsg.startsWith("⚠") ? "#b45309" : "#c53030", fontWeight: 600 }}>
                  {syncingAirtable ? "Synchronisation Airtable..." : airtableSyncMsg}
                </span>
              )}

              <div style={{ display: "flex", background: "#f2f2f2", borderRadius: 10, padding: 3, gap: 3 }}>
                <button onClick={() => setRightView("prospects")} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", ...jk,
                  ...(rightView === "prospects"
                    ? { background: "#fff", border: "none", color: "#121a2e", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }
                    : { background: "none", border: "none", color: "rgba(18,26,46,0.45)" }),
                }}>
                  <MessageSquare size={13} />Prospects ({prospects.length})
                </button>
                <button onClick={() => setRightView("chat")} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", ...jk,
                  ...(rightView === "chat"
                    ? { background: "#fff", border: "none", color: "#0147ff", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }
                    : { background: "none", border: "none", color: "rgba(18,26,46,0.45)" }),
                }}>
                  <Bot size={13} />Analyser avec l&apos;IA
                </button>
              </div>
            </div>

            {stats.positive >= 3 && rightView === "prospects" && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#168b64", background: "#d1fae5", padding: "6px 12px", borderRadius: 9, border: "1px solid #86efac" }}>
                <TrendingUp size={13} />L&apos;IA apprend de vos {stats.sent} messages
              </div>
            )}
          </div>
        </div>

        {rightView === "prospects" && (
          <>
            <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "8px 24px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => setFilterStatus("all")} style={{
                  padding: "5px 14px", borderRadius: 100, fontSize: 12, fontWeight: 500, cursor: "pointer", ...jk,
                  ...(filterStatus === "all"
                    ? { background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)", border: "1px solid #2f4d9d", color: "#fff" }
                    : { background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", color: "rgba(18,26,46,0.6)" }),
                }}>
                  Tous ({prospects.length})
                </button>
                {STATUS_VARIANTS.map((s) => {
                  const count = prospects.filter((p) => p.status === s).length;
                  if (count === 0) return null;
                  return (
                    <button key={s} onClick={() => setFilterStatus(s)} style={{
                      padding: "5px 14px", borderRadius: 100, fontSize: 12, fontWeight: 500, cursor: "pointer", ...jk,
                      ...(filterStatus === s
                        ? { background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)", border: "1px solid #2f4d9d", color: "#fff" }
                        : { background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", color: "rgba(18,26,46,0.6)" }),
                    }}>
                      {PROSPECT_STATUS_LABELS[s]} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
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
                    key={prospect.id} prospect={prospect}
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

        {rightView === "chat" && <AIChatPanel prospects={prospects} />}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
