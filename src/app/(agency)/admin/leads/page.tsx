"use client";

import { useState, useEffect, useCallback } from "react";
import type { CSSProperties } from "react";
import {
  Search, Plus, Download, RefreshCw,
  Mail, MessageSquare, Linkedin, Globe, Zap,
  ChevronDown, Check, X, ExternalLink, Trash2,
  TrendingUp, Users, MousePointerClick, Calendar,
  Sparkles, Send, BarChart2, Copy,
  Eye, EyeOff, ArrowDownToLine, BrainCircuit,
  FlaskConical, Settings2, ChevronRight, AlertCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Source = "lead_magnet" | "linkedin" | "google_maps" | "manual" | "webhook";
type Status = "new" | "contacted" | "responded" | "meeting" | "converted" | "lost";
type Channel = "email" | "whatsapp" | "linkedin_dm";
type View = "leads" | "stats";

interface Lead {
  id: string; email: string | null; name: string | null; company: string | null;
  sector: string | null; phone: string | null; source: Source; source_ref: string | null;
  status: Status; channel_preference: Channel; metadata: Record<string, unknown>;
  notes: string | null; last_contact_at: string | null; created_at: string;
}
interface StatsData { bySource: Record<string, number>; byStatus: Record<string, number>; total: number; }
interface FullStats {
  funnel: Record<string, number>;
  channelStats: Record<string, { sent: number; opened: number; responded: number }>;
  sourceStats: Record<string, { total: number; contacted: number; responded: number; meeting: number; converted: number }>;
  sectorStats: Record<string, { total: number; contacted: number; responded: number; converted: number }>;
  monthly: Record<string, { leads: number; contacted: number }>;
  rates: { openRate: number; responseRate: number; contactRate: number; conversionRate: number; meetingRate: number };
  totalAttempts: number; totalSent: number;
}
interface MessageTemplate {
  id: string; variant_label: string; sent_count: number; score: number;
  is_exploration: boolean; ai_hypothesis: string | null;
}
interface AnalysisRun {
  id: string; triggered_at: string; insights: string | null; hypotheses: string | null;
  templates_created: number; total_leads: number; model_used: string | null; status: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<Source, string> = { lead_magnet: "Lead Magnet", linkedin: "LinkedIn", google_maps: "Google Maps", manual: "Manuel", webhook: "Agent / API" };
const SOURCE_STYLES: Record<Source, { bg: string; color: string }> = {
  lead_magnet: { bg: "#E1D1FA", color: "#6236AA" },
  linkedin: { bg: "#d5eeff", color: "#073e63" },
  google_maps: { bg: "#d1fae5", color: "#168b64" },
  manual: { bg: "#f6f6f6", color: "rgba(18,26,46,0.55)" },
  webhook: { bg: "#fee6d0", color: "#663b12" },
};
const SOURCE_ICONS: Record<Source, React.ReactNode> = {
  lead_magnet: <Zap size={11} />, linkedin: <Linkedin size={11} />,
  google_maps: <Globe size={11} />, manual: <Plus size={11} />, webhook: <RefreshCw size={11} />,
};
const STATUS_LABELS: Record<Status, string> = { new: "Nouveau", contacted: "Contacté", responded: "A répondu", meeting: "RDV", converted: "Converti", lost: "Perdu" };
const STATUS_STYLES: Record<Status, { bg: string; color: string; dot: string }> = {
  new:       { bg: "#d5eeff",  color: "#073e63",  dot: "#0ea5e9" },
  contacted: { bg: "#fee6d0",  color: "#663b12",  dot: "#f59e0b" },
  responded: { bg: "#E1D1FA",  color: "#6236AA",  dot: "#6366f1" },
  meeting:   { bg: "#d1fae5",  color: "#168b64",  dot: "#22c55e" },
  converted: { bg: "#d1fae5",  color: "#0a5c40",  dot: "#10b981" },
  lost:      { bg: "#ffe4e4",  color: "#c53030",  dot: "#ef4444" },
};
const CHANNEL_ICONS: Record<Channel, React.ReactNode> = { email: <Mail size={13} />, whatsapp: <MessageSquare size={13} />, linkedin_dm: <Linkedin size={13} /> };
const CHANNEL_LABELS: Record<Channel, string> = { email: "Email", whatsapp: "WhatsApp", linkedin_dm: "LinkedIn DM" };

// ─── Style tokens ─────────────────────────────────────────────────────────────

const jk: CSSProperties = { fontFamily: '"Plus Jakarta Sans", sans-serif' };
const inp: CSSProperties = { background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9, padding: "8px 12px", fontSize: 13, color: "#121a2e", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: '"Plus Jakarta Sans", sans-serif' };
const btnGrad: CSSProperties = { background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)", border: "1px solid #2f4d9d", color: "#fff", borderRadius: 9, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 600 };
const card: CSSProperties = { background: "#fff", borderRadius: 13, border: "1px solid rgba(0,0,0,0.09)" };

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LeadsPage() {
  const [view, setView] = useState<View>("leads");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<StatsData>({ bySource: {}, byStatus: {}, total: 0 });
  const [fullStats, setFullStats] = useState<FullStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", company: "", sector: "", phone: "", channel_preference: "email" as Channel });
  const [addLoading, setAddLoading] = useState(false);

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const [outreachLead, setOutreachLead] = useState<Lead | null>(null);
  const [outreachChannel, setOutreachChannel] = useState<Channel>("email");
  const [outreachSubject, setOutreachSubject] = useState("");
  const [outreachContent, setOutreachContent] = useState("");
  const [outreachGenerating, setOutreachGenerating] = useState(false);
  const [outreachSending, setOutreachSending] = useState(false);
  const [outreachSent, setOutreachSent] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ imported: number; skipped: number } | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisRuns, setAnalysisRuns] = useState<AnalysisRun[]>([]);
  const [analysisTemplates, setAnalysisTemplates] = useState<Record<string, unknown>[]>([]);
  const [analysisResult, setAnalysisResult] = useState<{ insights: string; hypotheses: string; templatesCreated: number } | null>(null);
  const [aiConfig, setAiConfig] = useState({ threshold: "10", exploration: "0.20", minSamples: "5", autoEnabled: true });
  const [showAiConfig, setShowAiConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const [contactLead, setContactLead] = useState<Lead | null>(null);
  const [contactChannel, setContactChannel] = useState<Channel>("email");
  const [contactTemplate, setContactTemplate] = useState<MessageTemplate | null>(null);
  const [contactSubject, setContactSubject] = useState("");
  const [contactContent, setContactContent] = useState("");
  const [contactLoading, setContactLoading] = useState(false);
  const [contactSending, setContactSending] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [contactError, setContactError] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("linkedin_settings");
      if (stored) { const s = JSON.parse(stored); if (s.openrouterApiKey) setApiKey(s.openrouterApiKey); }
    } catch {}
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search) params.set("search", search);
      if (filterSource) params.set("source", filterSource);
      if (filterStatus) params.set("status", filterStatus);
      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setLeads(data.leads ?? []); setTotal(data.total ?? 0);
      setStats({ bySource: data.bySource ?? {}, byStatus: data.byStatus ?? {}, total: data.total ?? 0 });
    } catch {}
    setLoading(false);
  }, [search, filterSource, filterStatus]);

  const fetchAnalysisData = useCallback(async () => {
    try {
      const [runsRes, templatesRes, configRes] = await Promise.all([fetch("/api/leads/analysis-runs"), fetch("/api/leads/templates"), fetch("/api/leads/config")]);
      if (runsRes.ok) { const d = await runsRes.json(); setAnalysisRuns(d.runs ?? []); }
      if (templatesRes.ok) { const d = await templatesRes.json(); setAnalysisTemplates(d.templates ?? []); }
      if (configRes.ok) {
        const d = await configRes.json();
        setAiConfig({ threshold: d.analysis_threshold ?? "10", exploration: d.exploration_rate ?? "0.20", minSamples: d.min_sample_size ?? "5", autoEnabled: d.auto_analysis_enabled !== "false" });
      }
    } catch {}
  }, []);

  useEffect(() => { if (view === "stats") fetchAnalysisData(); }, [view, fetchAnalysisData]);

  async function handleAnalyze() {
    if (!apiKey) { setShowApiKeyInput(true); return; }
    setAnalyzing(true); setAnalysisResult(null);
    try {
      const res = await fetch("/api/leads/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ openrouterApiKey: apiKey }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAnalysisResult({ insights: data.insights ?? "", hypotheses: data.hypotheses ?? "", templatesCreated: data.templatesCreated ?? 0 });
      fetchAnalysisData();
    } catch (e) { setAnalysisResult({ insights: `Erreur : ${e}`, hypotheses: "", templatesCreated: 0 }); }
    setAnalyzing(false);
  }

  async function handleSaveConfig() {
    setSavingConfig(true);
    try {
      await fetch("/api/leads/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analysis_threshold: aiConfig.threshold, exploration_rate: aiConfig.exploration, min_sample_size: aiConfig.minSamples, auto_analysis_enabled: aiConfig.autoEnabled ? "true" : "false" }) });
      setShowAiConfig(false);
    } catch {}
    setSavingConfig(false);
  }

  async function openContact(lead: Lead) {
    setContactLead(lead); setContactChannel(lead.channel_preference); setContactTemplate(null);
    setContactSubject(""); setContactContent(""); setContactSent(false); setContactError(""); setContactLoading(true);
    const params = new URLSearchParams({ leadId: lead.id, channel: lead.channel_preference });
    if (apiKey) params.set("openrouterApiKey", apiKey);
    try {
      const res = await fetch(`/api/leads/template?${params}`);
      const data = await res.json();
      if (data.noTemplates) setContactError("Aucun template disponible. Lancez une analyse IA dans l'onglet Statistiques.");
      else if (data.error) setContactError(data.error);
      else { setContactTemplate(data.template); setContactSubject(data.adapted?.subject ?? ""); setContactContent(data.adapted?.content ?? ""); }
    } catch { setContactError("Erreur lors du chargement du template."); }
    setContactLoading(false);
  }

  async function handleContactSend() {
    if (!contactLead || !contactContent) return;
    setContactSending(true);
    try {
      await fetch(`/api/leads/${contactLead.id}/outreach`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", channel: contactChannel, subject: contactSubject, content: contactContent }) });
      if (contactTemplate) fetch("/api/leads/template", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId: contactTemplate.id, event: "sent" }) }).catch(() => {});
      setContactSent(true);
      setLeads(prev => prev.map(l => l.id === contactLead.id ? { ...l, status: l.status === "new" ? "contacted" : l.status } : l));
      setTimeout(() => { setContactLead(null); setContactSent(false); }, 1800);
    } catch {}
    setContactSending(false);
  }

  async function handleSync() {
    setSyncing(true); setSyncResult(null);
    try {
      const res = await fetch("/api/leads/sync", { method: "POST" });
      const data = await res.json();
      setSyncResult({ imported: data.imported ?? 0, skipped: data.skipped ?? 0 });
      if (data.imported > 0) fetchLeads();
      setTimeout(() => setSyncResult(null), 5000);
    } catch {}
    setSyncing(false);
  }

  const fetchFullStats = useCallback(async () => {
    setStatsLoading(true);
    try { const res = await fetch("/api/leads/stats"); const data = await res.json(); setFullStats(data); } catch {}
    setStatsLoading(false);
  }, []);

  useEffect(() => { const t = setTimeout(fetchLeads, 200); return () => clearTimeout(t); }, [fetchLeads]);
  useEffect(() => { if (view === "stats") fetchFullStats(); }, [view, fetchFullStats]);

  async function handleAddLead() {
    if (!addForm.email && !addForm.name) return;
    setAddLoading(true);
    try {
      await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...addForm, source: "manual" }) });
      setShowAdd(false); setAddForm({ name: "", email: "", company: "", sector: "", phone: "", channel_preference: "email" }); fetchLeads();
    } catch {}
    setAddLoading(false);
  }

  async function handleStatusChange(lead: Lead, status: Status) {
    await fetch(`/api/leads/${lead.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status } : l));
    if (selectedLead?.id === lead.id) setSelectedLead({ ...selectedLead, status });
  }

  async function handleSaveNotes(lead: Lead) {
    setSavingNotes(true);
    await fetch(`/api/leads/${lead.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes: editNotes }) });
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, notes: editNotes } : l));
    if (selectedLead) setSelectedLead({ ...selectedLead, notes: editNotes });
    setSavingNotes(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    setLeads(prev => prev.filter(l => l.id !== id));
    setDeleteId(null);
    if (selectedLead?.id === id) setSelectedLead(null);
  }

  async function handleEnrichGoogleMaps(lead: Lead) {
    if (!lead.company) return;
    try {
      const res = await fetch("/api/leads/enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead_id: lead.id, company: lead.company }) });
      const data = await res.json();
      if (data.enriched) {
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, metadata: { ...(l.metadata ?? {}), ...data.enriched } } : l));
        if (selectedLead?.id === lead.id) setSelectedLead(l => l ? { ...l, metadata: { ...(l.metadata ?? {}), ...data.enriched } } : l);
      }
    } catch {}
  }

  function openOutreach(lead: Lead) {
    setOutreachLead(lead); setOutreachChannel(lead.channel_preference); setOutreachSubject(""); setOutreachContent(""); setOutreachSent(false);
  }

  async function handleGenerate() {
    if (!outreachLead) return;
    if (!apiKey) { setShowApiKeyInput(true); return; }
    setOutreachGenerating(true);
    try {
      const res = await fetch(`/api/leads/${outreachLead.id}/outreach`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate", channel: outreachChannel, openrouterApiKey: apiKey }) });
      const data = await res.json();
      if (data.subject) setOutreachSubject(data.subject);
      if (data.content) setOutreachContent(data.content);
    } catch {}
    setOutreachGenerating(false);
  }

  async function handleSend() {
    if (!outreachLead || !outreachContent) return;
    setOutreachSending(true);
    try {
      await fetch(`/api/leads/${outreachLead.id}/outreach`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", channel: outreachChannel, subject: outreachSubject, content: outreachContent }) });
      setOutreachSent(true);
      setLeads(prev => prev.map(l => l.id === outreachLead.id ? { ...l, status: l.status === "new" ? "contacted" : l.status } : l));
      setTimeout(() => { setOutreachLead(null); setOutreachSent(false); }, 1800);
    } catch {}
    setOutreachSending(false);
  }

  function exportCsv() {
    const headers = ["Nom", "Email", "Entreprise", "Secteur", "Téléphone", "Source", "Statut", "Canal", "Date"];
    const rows = leads.map(l => [l.name ?? "", l.email ?? "", l.company ?? "", l.sector ?? "", l.phone ?? "", SOURCE_LABELS[l.source], STATUS_LABELS[l.status], CHANNEL_LABELS[l.channel_preference], new Date(l.created_at).toLocaleDateString("fr-FR")]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  const kpiCards = [
    { label: "Total leads", value: stats.total, icon: <Users size={18} />, iconBg: "#e8edff", iconColor: "#0147ff" },
    { label: "Nouveaux", value: stats.byStatus["new"] ?? 0, icon: <TrendingUp size={18} />, iconBg: "#d5eeff", iconColor: "#073e63" },
    { label: "RDV obtenus", value: stats.byStatus["meeting"] ?? 0, icon: <Calendar size={18} />, iconBg: "#d1fae5", iconColor: "#168b64" },
    { label: "Convertis", value: stats.byStatus["converted"] ?? 0, icon: <MousePointerClick size={18} />, iconBg: "#d1fae5", iconColor: "#0a5c40" },
  ];

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#fbfbfb", ...jk }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.07)", padding: "14px 24px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 700, color: "#121a2e", margin: 0, letterSpacing: "-0.4px" }}>Leads</h1>
              <p style={{ fontSize: 12, color: "rgba(18,26,46,0.45)", marginTop: 2, marginBottom: 0 }}>CRM & prospection automatisée</p>
            </div>
            {/* View toggle */}
            <div style={{ display: "flex", alignItems: "center", background: "#f2f2f2", borderRadius: 9, padding: 3 }}>
              {(["leads", "stats"] as View[]).map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: "pointer", border: "none",
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  ...(view === v ? { background: "#fff", color: "#121a2e", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" } : { background: "transparent", color: "rgba(18,26,46,0.5)" }),
                }}>
                  {v === "leads" ? <Users size={13} /> : <BarChart2 size={13} />}
                  {v === "leads" ? "Leads" : "Statistiques"}
                </button>
              ))}
            </div>
          </div>

          {view === "leads" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={exportCsv} disabled={leads.length === 0} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(18,26,46,0.55)", border: "1px solid rgba(0,0,0,0.09)", padding: "7px 12px", borderRadius: 9, background: "#f6f6f6", cursor: "pointer", opacity: leads.length === 0 ? 0.4 : 1, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                <Download size={13} />CSV
              </button>
              <button onClick={fetchLeads} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(18,26,46,0.55)", border: "1px solid rgba(0,0,0,0.09)", padding: "7px 12px", borderRadius: 9, background: "#f6f6f6", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                <RefreshCw size={13} />Rafraîchir
              </button>
              <button onClick={handleSync} disabled={syncing} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#6236AA", border: "1px solid #c4b5fd", padding: "7px 12px", borderRadius: 9, background: "#f3f0ff", cursor: "pointer", opacity: syncing ? 0.6 : 1, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                <ArrowDownToLine size={13} style={{ animation: syncing ? "bounce 0.8s infinite" : "none" }} />
                {syncing ? "Sync..." : "Importer"}
              </button>
              {syncResult && (
                <span style={{ fontSize: 12, color: "#168b64", fontWeight: 600 }}>
                  {syncResult.imported > 0 ? `+${syncResult.imported} importé${syncResult.imported > 1 ? "s" : ""}` : "Déjà à jour"}
                </span>
              )}
              <button onClick={() => setShowAdd(true)} style={{ ...btnGrad, padding: "8px 16px", fontSize: 13 }}>
                <Plus size={14} />Ajouter
              </button>
            </div>
          )}
          {view === "stats" && (
            <button onClick={fetchFullStats} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(18,26,46,0.55)", border: "1px solid rgba(0,0,0,0.09)", padding: "7px 12px", borderRadius: 9, background: "#f6f6f6", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
              <RefreshCw size={13} style={{ animation: statsLoading ? "spin 1s linear infinite" : "none" }} />Actualiser
            </button>
          )}
        </div>
      </div>

      {/* ── LEADS VIEW ── */}
      {view === "leads" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
          {/* KPI cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
            {kpiCards.map(c => (
              <div key={c.label} style={{ ...card, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ padding: 8, borderRadius: 10, background: c.iconBg, color: c.iconColor }}>{c.icon}</div>
                <div>
                  <p style={{ fontSize: 22, fontWeight: 700, color: "#121a2e", margin: 0 }}>{c.value}</p>
                  <p style={{ fontSize: 12, color: "rgba(18,26,46,0.45)", marginTop: 1, marginBottom: 0 }}>{c.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Source pills */}
          {Object.keys(stats.bySource).length > 0 && (
            <div style={{ ...card, padding: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(18,26,46,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, marginTop: 0 }}>Par source</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(Object.entries(stats.bySource) as [Source, number][]).map(([source, count]) => {
                  const ss = SOURCE_STYLES[source];
                  const isActive = filterSource === source;
                  return (
                    <button key={source} onClick={() => setFilterSource(filterSource === source ? "" : source)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif', background: ss.bg, color: ss.color, border: isActive ? `2px solid ${ss.color}` : "2px solid transparent" }}>
                      {SOURCE_ICONS[source]}{SOURCE_LABELS[source]}<strong>{count}</strong>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filters */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(18,26,46,0.35)" }} />
              <input type="text" placeholder="Rechercher nom, email, entreprise..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ ...inp, paddingLeft: 36, paddingRight: search ? 36 : 12 }} />
              {search && (
                <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.4)", display: "flex" }}><X size={13} /></button>
              )}
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width: "auto", flexShrink: 0, paddingRight: 12 }}>
              <option value="">Tous les statuts</option>
              {(Object.entries(STATUS_LABELS) as [Status, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {(filterSource || filterStatus || search) && (
              <button onClick={() => { setFilterSource(""); setFilterStatus(""); setSearch(""); }} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgba(18,26,46,0.5)", background: "none", border: "none", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                <X size={13} />Réinitialiser
              </button>
            )}
            <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", flexShrink: 0 }}>{total} lead{total > 1 ? "s" : ""}</p>
          </div>

          {/* Table */}
          <div style={{ ...card, overflow: "hidden" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "64px 0", color: "rgba(18,26,46,0.4)", fontSize: 13 }}>Chargement...</div>
            ) : leads.length === 0 ? (
              <div style={{ textAlign: "center", padding: "64px 0" }}>
                <Users size={32} style={{ color: "rgba(18,26,46,0.1)", margin: "0 auto 12px" }} />
                <p style={{ fontSize: 14, fontWeight: 500, color: "rgba(18,26,46,0.5)", margin: 0 }}>Aucun lead pour l&apos;instant</p>
                <p style={{ fontSize: 12, color: "rgba(18,26,46,0.35)", marginTop: 4 }}>Créez votre premier lead ou configurez votre lead magnet</p>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", background: "#f9f9f9" }}>
                    {["Contact", "Source", "Statut", "Canal", "Date", ""].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: h === "" ? "right" : "left", fontSize: 11, fontWeight: 600, color: "rgba(18,26,46,0.4)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map(lead => (
                    <tr key={lead.id} onClick={() => { setSelectedLead(lead); setEditNotes(lead.notes ?? ""); }} style={{ borderBottom: "1px solid rgba(0,0,0,0.05)", cursor: "pointer" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <p style={{ fontWeight: 600, color: "#121a2e", margin: 0 }}>
                          {lead.name || <span style={{ color: "rgba(18,26,46,0.35)", fontStyle: "italic" }}>Sans nom</span>}
                        </p>
                        {lead.email && <p style={{ fontSize: 12, color: "rgba(18,26,46,0.45)", marginTop: 2, marginBottom: 0 }}>{lead.email}</p>}
                        {lead.company && <p style={{ fontSize: 12, color: "rgba(18,26,46,0.55)", marginTop: 1, marginBottom: 0 }}>{lead.company}</p>}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, ...SOURCE_STYLES[lead.source] }}>
                          {SOURCE_ICONS[lead.source]}{SOURCE_LABELS[lead.source]}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <StatusDropdown lead={lead} onStatusChange={handleStatusChange} />
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgba(18,26,46,0.55)" }}>
                          {CHANNEL_ICONS[lead.channel_preference]}{CHANNEL_LABELS[lead.channel_preference]}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "rgba(18,26,46,0.4)", whiteSpace: "nowrap" }}>
                        {new Date(lead.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => openContact(lead)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#0147ff", background: "#e8edff", border: "none", padding: "5px 10px", borderRadius: 8, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                            <Send size={11} />Contacter
                          </button>
                          <button onClick={() => setDeleteId(lead.id)} style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.2)", display: "flex" }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── STATS VIEW ── */}
      {view === "stats" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
          {statsLoading || !fullStats ? (
            <div style={{ textAlign: "center", paddingTop: 80, fontSize: 13, color: "rgba(18,26,46,0.4)" }}>Chargement des statistiques...</div>
          ) : (
            <>
              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16 }}>
                {[
                  { label: "Taux de contact",    value: `${fullStats.rates.contactRate}%`,    desc: "leads contactés / total",     color: "#0147ff" },
                  { label: "Taux d'ouverture",   value: `${fullStats.rates.openRate}%`,        desc: "emails ouverts / envoyés",    color: "#073e63" },
                  { label: "Taux de réponse",    value: `${fullStats.rates.responseRate}%`,    desc: "réponses / envoyés",          color: "#6236AA" },
                  { label: "Taux de RDV",        value: `${fullStats.rates.meetingRate}%`,     desc: "RDV / total leads",           color: "#663b12" },
                  { label: "Taux de conversion", value: `${fullStats.rates.conversionRate}%`,  desc: "convertis / total leads",     color: "#168b64" },
                ].map(kpi => (
                  <div key={kpi.label} style={{ ...card, padding: 16 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: kpi.color, marginBottom: 4 }}>{kpi.value}</div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#121a2e", margin: 0 }}>{kpi.label}</p>
                    <p style={{ fontSize: 11, color: "rgba(18,26,46,0.4)", marginTop: 2, marginBottom: 0 }}>{kpi.desc}</p>
                  </div>
                ))}
              </div>

              {/* Funnel */}
              <div style={{ ...card, padding: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: "#121a2e", marginTop: 0, marginBottom: 16 }}>Funnel de conversion</h3>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 112 }}>
                  {(["new", "contacted", "responded", "meeting", "converted"] as Status[]).map(s => {
                    const val = fullStats.funnel[s] ?? 0;
                    const max = fullStats.funnel.total || 1;
                    const pct = Math.round((val / max) * 100);
                    const ss = STATUS_STYLES[s];
                    return (
                      <div key={s} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#121a2e" }}>{val}</span>
                        <div style={{ width: "100%", borderRadius: "4px 4px 0 0", background: ss.dot, height: `${Math.max(4, pct)}%` }} />
                        <span style={{ fontSize: 11, color: "rgba(18,26,46,0.5)", textAlign: "center" }}>{STATUS_LABELS[s]}</span>
                        <span style={{ fontSize: 10, color: "rgba(18,26,46,0.3)" }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                {/* Par canal */}
                <div style={{ ...card, padding: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "#121a2e", marginTop: 0, marginBottom: 16 }}>Performance par canal</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {(Object.entries(fullStats.channelStats) as [Channel, { sent: number; opened: number; responded: number }][]).map(([ch, data]) => {
                      const openRate = data.sent > 0 ? Math.round((data.opened / data.sent) * 100) : 0;
                      const replyRate = data.sent > 0 ? Math.round((data.responded / data.sent) * 100) : 0;
                      return (
                        <div key={ch}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, color: "#121a2e" }}>{CHANNEL_ICONS[ch]}{CHANNEL_LABELS[ch]}</div>
                            <div style={{ display: "flex", gap: 12, fontSize: 11, color: "rgba(18,26,46,0.5)" }}>
                              <span>{data.sent} envoyés</span>
                              <span style={{ color: "#073e63", fontWeight: 600 }}>{openRate}% ouv.</span>
                              <span style={{ color: "#6236AA", fontWeight: 600 }}>{replyRate}% rép.</span>
                            </div>
                          </div>
                          <div style={{ height: 6, background: "#f2f2f2", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ height: "100%", background: "#0147ff", borderRadius: 4, width: `${openRate}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {Object.keys(fullStats.channelStats).every(k => fullStats.channelStats[k].sent === 0) && (
                      <p style={{ fontSize: 12, color: "rgba(18,26,46,0.35)", textAlign: "center", padding: "16px 0" }}>Aucun message envoyé encore</p>
                    )}
                  </div>
                </div>

                {/* Par source */}
                <div style={{ ...card, padding: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "#121a2e", marginTop: 0, marginBottom: 16 }}>Performance par source</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(Object.entries(fullStats.sourceStats) as [Source, { total: number; contacted: number; responded: number; meeting: number; converted: number }][])
                      .sort((a, b) => b[1].total - a[1].total)
                      .map(([src, data]) => {
                        const convRate = data.total > 0 ? Math.round((data.converted / data.total) * 100) : 0;
                        return (
                          <div key={src} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, flexShrink: 0, ...SOURCE_STYLES[src] }}>
                              {SOURCE_ICONS[src]}{SOURCE_LABELS[src]}
                            </span>
                            <div style={{ flex: 1, height: 6, background: "#f2f2f2", borderRadius: 4, overflow: "hidden" }}>
                              <div style={{ height: "100%", background: "#168b64", borderRadius: 4, width: `${convRate}%` }} />
                            </div>
                            <div style={{ fontSize: 12, color: "rgba(18,26,46,0.5)", flexShrink: 0, textAlign: "right", width: 96 }}>
                              <strong style={{ color: "#121a2e" }}>{data.total}</strong> leads · <span style={{ color: "#168b64" }}>{convRate}%</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Par secteur */}
              {Object.keys(fullStats.sectorStats).length > 0 && (
                <div style={{ ...card, padding: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "#121a2e", marginTop: 0, marginBottom: 16 }}>Performance par secteur</h3>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                          {["Secteur", "Leads", "Contactés", "Réponses", "Convertis", "Taux conv."].map((h, i) => (
                            <th key={h} style={{ padding: "8px 0", textAlign: i === 0 ? "left" : "center", fontSize: 11, fontWeight: 600, color: "rgba(18,26,46,0.4)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(Object.entries(fullStats.sectorStats) as [string, { total: number; contacted: number; responded: number; converted: number }][])
                          .sort((a, b) => b[1].total - a[1].total)
                          .map(([sector, data]) => {
                            const conv = data.total > 0 ? Math.round((data.converted / data.total) * 100) : 0;
                            const convStyle = conv >= 20 ? { bg: "#d1fae5", color: "#168b64" } : conv >= 5 ? { bg: "#fee6d0", color: "#663b12" } : { bg: "#f6f6f6", color: "rgba(18,26,46,0.5)" };
                            return (
                              <tr key={sector} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                                <td style={{ padding: "10px 0", fontWeight: 500, color: "#121a2e" }}>{sector}</td>
                                <td style={{ padding: "10px 0", textAlign: "center", color: "rgba(18,26,46,0.6)" }}>{data.total}</td>
                                <td style={{ padding: "10px 0", textAlign: "center", color: "rgba(18,26,46,0.6)" }}>{data.contacted}</td>
                                <td style={{ padding: "10px 0", textAlign: "center", color: "rgba(18,26,46,0.6)" }}>{data.responded}</td>
                                <td style={{ padding: "10px 0", textAlign: "center", fontWeight: 600, color: "#168b64" }}>{data.converted}</td>
                                <td style={{ padding: "10px 0", textAlign: "center" }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, ...convStyle }}>{conv}%</span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Évolution mensuelle */}
              <div style={{ ...card, padding: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: "#121a2e", marginTop: 0, marginBottom: 16 }}>Évolution mensuelle (12 derniers mois)</h3>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 96 }}>
                  {Object.entries(fullStats.monthly).map(([month, data]) => {
                    const maxLeads = Math.max(...Object.values(fullStats.monthly).map(m => m.leads), 1);
                    const pct = Math.round((data.leads / maxLeads) * 100);
                    const pctContacted = Math.round((data.contacted / maxLeads) * 100);
                    return (
                      <div key={month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ width: "100%", position: "relative", height: 60 }}>
                          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#d5eeff", borderRadius: "3px 3px 0 0", height: `${pct}%` }} />
                          {data.contacted > 0 && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#0147ff", borderRadius: "3px 3px 0 0", height: `${pctContacted}%` }} />}
                        </div>
                        <span style={{ fontSize: 10, color: "rgba(18,26,46,0.4)" }}>{month.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8, fontSize: 11, color: "rgba(18,26,46,0.5)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 8, background: "#d5eeff", borderRadius: 2, display: "inline-block" }} />Leads totaux</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 8, background: "#0147ff", borderRadius: 2, display: "inline-block" }} />Leads contactés</span>
                </div>
              </div>

              {/* Analyse IA */}
              <div style={{ ...card, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <BrainCircuit size={18} style={{ color: "#0147ff" }} />
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: "#121a2e", margin: 0 }}>Boucle d&apos;amélioration IA</h3>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#073e63", background: "#d5eeff", padding: "2px 8px", borderRadius: 20 }}>{analysisTemplates.length} templates actifs</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => setShowAiConfig(!showAiConfig)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(18,26,46,0.55)", border: "1px solid rgba(0,0,0,0.09)", padding: "5px 10px", borderRadius: 8, background: "#f6f6f6", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                      <Settings2 size={12} />Config
                    </button>
                    <button onClick={handleAnalyze} disabled={analyzing} style={{ ...btnGrad, padding: "8px 14px", fontSize: 12, opacity: analyzing ? 0.7 : 1 }}>
                      <BrainCircuit size={13} style={{ animation: analyzing ? "pulse 1s infinite" : "none" }} />
                      {analyzing ? "Analyse en cours..." : "Lancer une analyse"}
                    </button>
                  </div>
                </div>

                {showAiConfig && (
                  <div style={{ background: "#f6f6f6", borderRadius: 11, padding: 16, marginBottom: 16, border: "1px solid rgba(0,0,0,0.07)" }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#121a2e", marginTop: 0, marginBottom: 12 }}>Configuration de la boucle</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                      {[
                        { label: "Seuil déclenchement", key: "threshold" as const, suffix: "leads", type: "number", min: 5, max: 100, step: 1 },
                        { label: "Taux exploration", key: "exploration" as const, suffix: "(0-1)", type: "number", min: 0.05, max: 0.5, step: 0.05 },
                        { label: "Échantillon minimum", key: "minSamples" as const, suffix: "", type: "number", min: 3, max: 50, step: 1 },
                      ].map(f => (
                        <div key={f.key}>
                          <label style={{ fontSize: 11, color: "rgba(18,26,46,0.5)", display: "block", marginBottom: 4 }}>{f.label}</label>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <input type={f.type} min={f.min} max={f.max} step={f.step} value={aiConfig[f.key]} onChange={e => setAiConfig(p => ({ ...p, [f.key]: e.target.value }))}
                              style={{ ...inp, width: "100%", textAlign: "center", padding: "6px 8px" }} />
                            {f.suffix && <span style={{ fontSize: 11, color: "rgba(18,26,46,0.4)", flexShrink: 0 }}>{f.suffix}</span>}
                          </div>
                        </div>
                      ))}
                      <div>
                        <label style={{ fontSize: 11, color: "rgba(18,26,46,0.5)", display: "block", marginBottom: 4 }}>Analyse auto</label>
                        <button onClick={() => setAiConfig(p => ({ ...p, autoEnabled: !p.autoEnabled }))} style={{ width: "100%", padding: "6px 8px", borderRadius: 9, fontSize: 12, cursor: "pointer", border: "1px solid", fontFamily: '"Plus Jakarta Sans", sans-serif', ...(aiConfig.autoEnabled ? { background: "#e8edff", borderColor: "#0147ff", color: "#0147ff", fontWeight: 600 } : { background: "#f6f6f6", borderColor: "rgba(0,0,0,0.09)", color: "rgba(18,26,46,0.5)" }) }}>
                          {aiConfig.autoEnabled ? "Activée" : "Désactivée"}
                        </button>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                      <button onClick={handleSaveConfig} disabled={savingConfig} style={{ ...btnGrad, padding: "6px 14px", fontSize: 12, opacity: savingConfig ? 0.7 : 1 }}>
                        {savingConfig ? "Sauvegarde..." : "Enregistrer"}
                      </button>
                    </div>
                  </div>
                )}

                {analysisResult && (
                  <div style={{ background: "#e8edff", border: "1px solid #c7d3ff", borderRadius: 11, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <Check size={13} style={{ color: "#0147ff" }} />
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#0147ff", margin: 0 }}>
                        Analyse terminée — {analysisResult.templatesCreated} nouveau{analysisResult.templatesCreated > 1 ? "x" : ""} template{analysisResult.templatesCreated > 1 ? "s" : ""} créé{analysisResult.templatesCreated > 1 ? "s" : ""}
                      </p>
                    </div>
                    {analysisResult.insights && <p style={{ fontSize: 12, color: "#073e63", marginBottom: 4, marginTop: 0 }}><strong>Observations :</strong> {analysisResult.insights}</p>}
                    {analysisResult.hypotheses && <p style={{ fontSize: 12, color: "#073e63", margin: 0 }}><strong>Hypothèses testées :</strong> {analysisResult.hypotheses}</p>}
                  </div>
                )}

                {analysisRuns.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(18,26,46,0.4)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8, marginTop: 0 }}>Historique des analyses</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {analysisRuns.slice(0, 3).map(run => {
                        const runSt = run.status === "completed" ? { bg: "#d1fae5", color: "#168b64" } : run.status === "failed" ? { bg: "#ffe4e4", color: "#c53030" } : { bg: "#fee6d0", color: "#663b12" };
                        return (
                          <div key={run.id} style={{ border: "1px solid rgba(0,0,0,0.07)", borderRadius: 10, padding: 12, background: "#f9f9f9" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                              <p style={{ fontSize: 12, fontWeight: 500, color: "#121a2e", margin: 0 }}>
                                {new Date(run.triggered_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </p>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 11, color: "#0147ff" }}>{run.templates_created} templates créés</span>
                                <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 20, ...runSt }}>{run.status}</span>
                              </div>
                            </div>
                            {run.insights && <p style={{ fontSize: 12, color: "rgba(18,26,46,0.5)", margin: 0 }}>{run.insights}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {analysisTemplates.length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(18,26,46,0.4)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8, marginTop: 0 }}>Templates A/B actifs</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 256, overflowY: "auto" }}>
                      {analysisTemplates.map((t: Record<string, unknown>) => {
                        const sent = t.sent_count as number;
                        const score = t.score as number;
                        const isExp = !!t.is_exploration;
                        return (
                          <div key={t.id as string} style={{ border: "1px solid rgba(0,0,0,0.07)", borderRadius: 10, padding: 12, display: "flex", alignItems: "flex-start", gap: 12 }}>
                            <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, ...(isExp ? { background: "#fee6d0", color: "#663b12" } : { background: "#e8edff", color: "#0147ff" }) }}>
                              {t.variant_label as string}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                                <span style={{ fontSize: 12, fontWeight: 500, color: "#121a2e" }}>
                                  {(t.source_filter as string) || "Toutes sources"} · {(t.channel as string)} · {(t.sector_filter as string) || "Tous secteurs"}
                                </span>
                                {isExp && (
                                  <span style={{ fontSize: 10, fontWeight: 600, color: "#663b12", background: "#fee6d0", padding: "1px 6px", borderRadius: 20, display: "flex", alignItems: "center", gap: 3 }}>
                                    <FlaskConical size={8} />Test
                                  </span>
                                )}
                              </div>
                              <p style={{ fontSize: 12, color: "rgba(18,26,46,0.45)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.content as string}</p>
                              {!!t.ai_hypothesis && <p style={{ fontSize: 11, color: "#0147ff", marginTop: 2, marginBottom: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>💡 {t.ai_hypothesis as string}</p>}
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <p style={{ fontSize: 12, fontWeight: 700, color: "#121a2e", margin: 0 }}>{sent} envois</p>
                              <p style={{ fontSize: 11, margin: 0, color: score > 0.3 ? "#168b64" : score > 0.1 ? "#663b12" : "rgba(18,26,46,0.4)" }}>score {(score * 100).toFixed(0)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {analysisTemplates.length === 0 && !analyzing && (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(18,26,46,0.35)" }}>
                    <AlertCircle size={24} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                    <p style={{ fontSize: 13, margin: 0 }}>Aucun template généré pour l&apos;instant</p>
                    <p style={{ fontSize: 12, marginTop: 4 }}>Lancez une première analyse pour démarrer la boucle d&apos;apprentissage</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Modal Outreach ── */}
      {outreachLead && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setOutreachLead(null)}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 560, boxShadow: "0px 20px 40px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", maxHeight: "90vh", ...jk }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(0,0,0,0.07)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: "#121a2e", margin: 0 }}>Générer un message</h2>
                  <p style={{ fontSize: 12, color: "rgba(18,26,46,0.45)", marginTop: 3, marginBottom: 0 }}>
                    Pour {outreachLead.name || outreachLead.email || "ce lead"}
                    {outreachLead.company && ` — ${outreachLead.company}`}
                  </p>
                </div>
                <button onClick={() => setOutreachLead(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.4)", display: "flex" }}><X size={18} /></button>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                {(["email", "whatsapp", "linkedin_dm"] as Channel[]).map(ch => (
                  <button key={ch} onClick={() => setOutreachChannel(ch)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 9, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif', border: "1px solid", ...(outreachChannel === ch ? { background: "#e8edff", borderColor: "#0147ff", color: "#0147ff" } : { background: "#f6f6f6", borderColor: "rgba(0,0,0,0.09)", color: "rgba(18,26,46,0.55)" }) }}>
                    {CHANNEL_ICONS[ch]}{CHANNEL_LABELS[ch]}
                  </button>
                ))}
              </div>
            </div>

            {showApiKeyInput && (
              <div style={{ padding: "12px 24px", background: "#fffbeb", borderBottom: "1px solid #fef3c7", flexShrink: 0 }}>
                <p style={{ fontSize: 12, color: "#92400e", fontWeight: 600, marginTop: 0, marginBottom: 8 }}>Clé OpenRouter requise pour la génération IA</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <input type={showApiKey ? "text" : "password"} value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-or-v1-..."
                      style={{ ...inp, paddingRight: 36, fontSize: 12 }} />
                    <button onClick={() => setShowApiKey(s => !s)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.4)", display: "flex" }}>
                      {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                  <button onClick={() => { try { const stored = localStorage.getItem("linkedin_settings") ?? "{}"; localStorage.setItem("linkedin_settings", JSON.stringify({ ...JSON.parse(stored), openrouterApiKey: apiKey })); } catch {} setShowApiKeyInput(false); handleGenerate(); }} disabled={!apiKey}
                    style={{ padding: "8px 14px", background: "#f59e0b", border: "none", borderRadius: 9, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer", opacity: !apiKey ? 0.5 : 1, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                    Sauvegarder
                  </button>
                </div>
              </div>
            )}

            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              {outreachChannel === "email" && (
                <div>
                  <label style={{ fontSize: 12, color: "rgba(18,26,46,0.5)", display: "block", marginBottom: 5 }}>Objet de l&apos;email</label>
                  <input type="text" value={outreachSubject} onChange={e => setOutreachSubject(e.target.value)} placeholder="L'objet sera généré automatiquement..." style={inp} />
                </div>
              )}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: 12, color: "rgba(18,26,46,0.5)" }}>Message</label>
                  {outreachContent && (
                    <button onClick={() => navigator.clipboard.writeText(outreachContent)} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "rgba(18,26,46,0.4)", background: "none", border: "none", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                      <Copy size={10} />Copier
                    </button>
                  )}
                </div>
                <textarea value={outreachContent} onChange={e => setOutreachContent(e.target.value)}
                  placeholder={outreachGenerating ? "Génération en cours..." : "Cliquez sur 'Générer' pour créer un message personnalisé..."}
                  rows={outreachChannel === "linkedin_dm" ? 5 : 10}
                  style={{ ...inp, resize: "none", lineHeight: 1.6, opacity: outreachGenerating ? 0.5 : 1 }} />
                {outreachChannel === "linkedin_dm" && outreachContent && (
                  <p style={{ fontSize: 11, marginTop: 3, color: outreachContent.length > 300 ? "#c53030" : "rgba(18,26,46,0.4)" }}>{outreachContent.length}/300 caractères</p>
                )}
              </div>
              <div style={{ background: "#f6f6f6", borderRadius: 10, padding: 12, fontSize: 12, color: "rgba(18,26,46,0.5)" }}>
                <p style={{ fontWeight: 600, color: "#121a2e", marginTop: 0, marginBottom: 6 }}>Contexte utilisé par l&apos;IA</p>
                {[
                  outreachLead.name && `Nom : ${outreachLead.name}`,
                  outreachLead.company && `Entreprise : ${outreachLead.company}`,
                  outreachLead.sector && `Secteur : ${outreachLead.sector}`,
                  outreachLead.email && `Email : ${outreachLead.email}`,
                  outreachLead.notes && `Notes : ${outreachLead.notes}`,
                  `Source : ${SOURCE_LABELS[outreachLead.source]}`,
                ].filter(Boolean).map((line, i) => <p key={i} style={{ margin: "2px 0" }}>{line}</p>)}
              </div>
            </div>

            <div style={{ padding: "14px 24px", borderTop: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <button onClick={handleGenerate} disabled={outreachGenerating} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#0147ff", background: "#e8edff", border: "1px solid #c7d3ff", padding: "8px 14px", borderRadius: 9, cursor: "pointer", opacity: outreachGenerating ? 0.6 : 1, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                <Sparkles size={13} style={{ animation: outreachGenerating ? "spin 1s linear infinite" : "none" }} />
                {outreachGenerating ? "Génération..." : "Générer avec l'IA"}
              </button>
              {outreachSent ? (
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#168b64" }}><Check size={15} />Message envoyé !</span>
              ) : (
                <button onClick={handleSend} disabled={outreachSending || !outreachContent} style={{ ...btnGrad, padding: "8px 18px", fontSize: 13, opacity: outreachSending || !outreachContent ? 0.5 : 1 }}>
                  <Send size={12} />{outreachSending ? "Envoi..." : outreachChannel === "email" ? "Envoyer l'email" : "Enregistrer"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Contacter ── */}
      {contactLead && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setContactLead(null)}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 560, boxShadow: "0px 20px 40px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", maxHeight: "90vh", ...jk }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(0,0,0,0.07)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: "#121a2e", margin: 0 }}>Contacter</h2>
                  <p style={{ fontSize: 12, color: "rgba(18,26,46,0.45)", marginTop: 3, marginBottom: 0 }}>
                    {contactLead.name || contactLead.email || "Ce lead"}
                    {contactLead.company && ` — ${contactLead.company}`}
                  </p>
                </div>
                <button onClick={() => setContactLead(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.4)", display: "flex" }}><X size={18} /></button>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {(["email", "whatsapp", "linkedin_dm"] as Channel[]).map(ch => (
                  <button key={ch} onClick={() => { setContactChannel(ch); openContact({ ...contactLead, channel_preference: ch }); }}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 9, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif', border: "1px solid", ...(contactChannel === ch ? { background: "#e8edff", borderColor: "#0147ff", color: "#0147ff" } : { background: "#f6f6f6", borderColor: "rgba(0,0,0,0.09)", color: "rgba(18,26,46,0.55)" }) }}>
                    {CHANNEL_ICONS[ch]}{CHANNEL_LABELS[ch]}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              {contactLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 0", gap: 8, color: "rgba(18,26,46,0.4)" }}>
                  <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />
                  <span style={{ fontSize: 13 }}>Sélection du meilleur template...</span>
                </div>
              ) : contactError ? (
                <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: 11, padding: 16, textAlign: "center" }}>
                  <AlertCircle size={20} style={{ color: "#f59e0b", margin: "0 auto 8px" }} />
                  <p style={{ fontSize: 13, color: "#92400e", margin: 0 }}>{contactError}</p>
                  <button onClick={() => { setView("stats"); setContactLead(null); }} style={{ marginTop: 12, fontSize: 12, color: "#92400e", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", display: "flex", alignItems: "center", gap: 3, margin: "12px auto 0", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                    Aller dans Statistiques → Lancer une analyse <ChevronRight size={10} />
                  </button>
                </div>
              ) : (
                <>
                  {contactTemplate && (
                    <div style={{ background: "#e8edff", border: "1px solid #c7d3ff", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, ...(contactTemplate.is_exploration ? { background: "#fee6d0", color: "#663b12" } : { background: "#d5eeff", color: "#073e63" }) }}>
                        {contactTemplate.variant_label}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 12, color: "#073e63", fontWeight: 600, margin: 0 }}>
                          Template {contactTemplate.is_exploration ? "(en test)" : `— score ${(contactTemplate.score * 100).toFixed(0)}`}
                          {" · "}{contactTemplate.sent_count} envois
                        </p>
                        {contactTemplate.ai_hypothesis && <p style={{ fontSize: 11, color: "#0147ff", marginTop: 2, marginBottom: 0 }}>💡 {contactTemplate.ai_hypothesis}</p>}
                      </div>
                    </div>
                  )}
                  {contactChannel === "email" && (
                    <div>
                      <label style={{ fontSize: 12, color: "rgba(18,26,46,0.5)", display: "block", marginBottom: 5 }}>Objet</label>
                      <input type="text" value={contactSubject} onChange={e => setContactSubject(e.target.value)} style={inp} />
                    </div>
                  )}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <label style={{ fontSize: 12, color: "rgba(18,26,46,0.5)" }}>Message</label>
                      <button onClick={() => navigator.clipboard.writeText(contactContent)} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "rgba(18,26,46,0.4)", background: "none", border: "none", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                        <Copy size={10} />Copier
                      </button>
                    </div>
                    <textarea value={contactContent} onChange={e => setContactContent(e.target.value)} rows={contactChannel === "linkedin_dm" ? 5 : 9}
                      style={{ ...inp, resize: "none", lineHeight: 1.6 }} />
                    {contactChannel === "linkedin_dm" && (
                      <p style={{ fontSize: 11, marginTop: 3, color: contactContent.length > 300 ? "#c53030" : "rgba(18,26,46,0.4)" }}>{contactContent.length}/300 caractères</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {!contactError && !contactLoading && (
              <div style={{ padding: "14px 24px", borderTop: "1px solid rgba(0,0,0,0.07)", display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
                {contactSent ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#168b64" }}><Check size={15} />Message envoyé !</span>
                ) : (
                  <button onClick={handleContactSend} disabled={contactSending || !contactContent} style={{ ...btnGrad, padding: "8px 18px", fontSize: 13, opacity: contactSending || !contactContent ? 0.5 : 1 }}>
                    <Send size={12} />{contactSending ? "Envoi..." : contactChannel === "email" ? "Envoyer l'email" : "Enregistrer"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Ajout ── */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setShowAdd(false)}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 448, boxShadow: "0px 20px 40px rgba(0,0,0,0.15)", ...jk }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#121a2e", margin: 0 }}>Ajouter un lead</h2>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Nom", key: "name" as const, type: "text", placeholder: "Jean Dupont" },
                { label: "Email", key: "email" as const, type: "email", placeholder: "jean@exemple.fr" },
                { label: "Entreprise", key: "company" as const, type: "text", placeholder: "ACME SAS" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 5 }}>{f.label}</label>
                  <input type={f.type} value={addForm[f.key]} onChange={e => setAddForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={inp} />
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 5 }}>Secteur</label>
                  <input type="text" value={addForm.sector} onChange={e => setAddForm(p => ({ ...p, sector: e.target.value }))} placeholder="Marketing" style={inp} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 5 }}>Téléphone</label>
                  <input type="text" value={addForm.phone} onChange={e => setAddForm(p => ({ ...p, phone: e.target.value }))} placeholder="+33 6 00 00 00 00" style={inp} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 5 }}>Canal préféré</label>
                <select value={addForm.channel_preference} onChange={e => setAddForm(p => ({ ...p, channel_preference: e.target.value as Channel }))} style={inp}>
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="linkedin_dm">LinkedIn DM</option>
                </select>
              </div>
            </div>
            <div style={{ padding: "14px 24px", borderTop: "1px solid rgba(0,0,0,0.07)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setShowAdd(false)} style={{ fontSize: 13, color: "rgba(18,26,46,0.55)", padding: "8px 16px", borderRadius: 9, background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Annuler</button>
              <button onClick={handleAddLead} disabled={addLoading || (!addForm.email && !addForm.name)} style={{ ...btnGrad, padding: "8px 18px", fontSize: 13, opacity: addLoading || (!addForm.email && !addForm.name) ? 0.5 : 1 }}>
                {addLoading ? "Ajout..." : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Détail Lead ── */}
      {selectedLead && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 16 }} onClick={() => setSelectedLead(null)}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 512, boxShadow: "0px 20px 40px rgba(0,0,0,0.15)", ...jk }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "#121a2e", margin: 0 }}>{selectedLead.name || selectedLead.email || "Lead sans nom"}</h2>
                {selectedLead.company && <p style={{ fontSize: 13, color: "rgba(18,26,46,0.5)", marginTop: 2, marginBottom: 0 }}>{selectedLead.company}</p>}
              </div>
              <button onClick={() => setSelectedLead(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.4)", display: "flex" }}><X size={18} /></button>
            </div>

            <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
                {selectedLead.email && (
                  <div>
                    <p style={{ fontSize: 11, color: "rgba(18,26,46,0.4)", margin: 0, marginBottom: 2 }}>Email</p>
                    <a href={`mailto:${selectedLead.email}`} style={{ display: "flex", alignItems: "center", gap: 4, color: "#0147ff", textDecoration: "none", fontSize: 13 }}>
                      {selectedLead.email} <ExternalLink size={10} />
                    </a>
                  </div>
                )}
                {selectedLead.phone && <div><p style={{ fontSize: 11, color: "rgba(18,26,46,0.4)", margin: 0, marginBottom: 2 }}>Téléphone</p><p style={{ fontSize: 13, color: "#121a2e", margin: 0 }}>{selectedLead.phone}</p></div>}
                {selectedLead.sector && <div><p style={{ fontSize: 11, color: "rgba(18,26,46,0.4)", margin: 0, marginBottom: 2 }}>Secteur</p><p style={{ fontSize: 13, color: "#121a2e", margin: 0 }}>{selectedLead.sector}</p></div>}
                <div>
                  <p style={{ fontSize: 11, color: "rgba(18,26,46,0.4)", margin: 0, marginBottom: 2 }}>Source</p>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, ...SOURCE_STYLES[selectedLead.source] }}>
                    {SOURCE_ICONS[selectedLead.source]}{SOURCE_LABELS[selectedLead.source]}
                  </span>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "rgba(18,26,46,0.4)", margin: 0, marginBottom: 2 }}>Canal</p>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgba(18,26,46,0.6)" }}>{CHANNEL_ICONS[selectedLead.channel_preference]}{CHANNEL_LABELS[selectedLead.channel_preference]}</span>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "rgba(18,26,46,0.4)", margin: 0, marginBottom: 2 }}>Ajouté le</p>
                  <p style={{ fontSize: 13, color: "#121a2e", margin: 0 }}>{new Date(selectedLead.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
                {selectedLead.company && (
                  <button onClick={() => handleEnrichGoogleMaps(selectedLead)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(18,26,46,0.5)", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 8, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                    <span>📍</span>Enrichir via Google Maps
                  </button>
                )}
              </div>

              <div>
                <p style={{ fontSize: 12, fontWeight: 500, color: "rgba(18,26,46,0.5)", marginBottom: 8, marginTop: 0 }}>Statut</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {(Object.entries(STATUS_LABELS) as [Status, string][]).map(([s, l]) => {
                    const ss = STATUS_STYLES[s];
                    const isActive = selectedLead.status === s;
                    return (
                      <button key={s} onClick={() => handleStatusChange(selectedLead, s)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif', border: "1px solid", ...(isActive ? { background: ss.bg, color: ss.color, borderColor: ss.color, boxShadow: `0 0 0 2px ${ss.color}22` } : { background: "#f6f6f6", color: "rgba(18,26,46,0.5)", borderColor: "rgba(0,0,0,0.09)" }) }}>
                        {isActive && <Check size={10} />}{l}
                      </button>
                    );
                  })}
                </div>
              </div>

              {Object.keys(selectedLead.metadata).length > 0 && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "rgba(18,26,46,0.5)", marginBottom: 8, marginTop: 0 }}>Données source</p>
                  <div style={{ background: "#f6f6f6", borderRadius: 9, padding: 12, fontSize: 12, color: "rgba(18,26,46,0.6)", maxHeight: 112, overflowY: "auto" }}>
                    {Object.entries(selectedLead.metadata).map(([k, v]) => (
                      <div key={k} style={{ display: "flex", gap: 8, marginBottom: 2 }}>
                        <span style={{ color: "rgba(18,26,46,0.35)", flexShrink: 0 }}>{k}:</span>
                        <span>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p style={{ fontSize: 12, fontWeight: 500, color: "rgba(18,26,46,0.5)", marginBottom: 8, marginTop: 0 }}>Notes</p>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} placeholder="Notes sur ce lead..." style={{ ...inp, resize: "none", lineHeight: 1.6 }} />
              </div>
            </div>

            <div style={{ padding: "14px 24px", borderTop: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button onClick={() => setDeleteId(selectedLead.id)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#c53030", background: "none", border: "none", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                <Trash2 size={13} />Supprimer
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => { setSelectedLead(null); openOutreach(selectedLead); }} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, color: "#0147ff", background: "#e8edff", border: "1px solid #c7d3ff", padding: "7px 14px", borderRadius: 9, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                  <Sparkles size={12} />Générer message
                </button>
                <button onClick={() => handleSaveNotes(selectedLead)} disabled={savingNotes} style={{ ...btnGrad, padding: "7px 14px", fontSize: 13, opacity: savingNotes ? 0.7 : 1 }}>
                  {savingNotes ? <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={12} />}
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete ── */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 360, padding: 24, textAlign: "center", boxShadow: "0px 20px 40px rgba(0,0,0,0.15)", ...jk }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#121a2e", marginTop: 0, marginBottom: 8 }}>Supprimer ce lead ?</p>
            <p style={{ fontSize: 13, color: "rgba(18,26,46,0.45)", marginBottom: 24 }}>Cette action est irréversible.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setDeleteId(null)} style={{ padding: "8px 20px", fontSize: 13, border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9, background: "#f6f6f6", cursor: "pointer", color: "rgba(18,26,46,0.6)", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Annuler</button>
              <button onClick={() => handleDelete(deleteId)} style={{ padding: "8px 20px", fontSize: 13, background: "#ef4444", border: "none", borderRadius: 9, color: "#fff", cursor: "pointer", fontWeight: 600, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }`}</style>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDropdown({ lead, onStatusChange }: { lead: Lead; onStatusChange: (lead: Lead, s: Status) => void }) {
  const [open, setOpen] = useState(false);
  const ss = STATUS_STYLES[lead.status];
  return (
    <div style={{ position: "relative" }}>
      <button onClick={e => { e.stopPropagation(); setOpen(o => !o); }} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none", fontFamily: '"Plus Jakarta Sans", sans-serif', background: ss.bg, color: ss.color }}>
        {STATUS_LABELS[lead.status]}<ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={e => { e.stopPropagation(); setOpen(false); }} />
          <div style={{ position: "absolute", left: 0, top: "100%", marginTop: 4, zIndex: 20, background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 11, boxShadow: "0px 8px 24px rgba(0,0,0,0.1)", padding: "4px 0", minWidth: 148 }}>
            {(Object.entries(STATUS_LABELS) as [Status, string][]).map(([s, l]) => {
              const ds = STATUS_STYLES[s];
              return (
                <button key={s} onClick={e => { e.stopPropagation(); onStatusChange(lead, s); setOpen(false); }} style={{ width: "100%", textAlign: "left", padding: "7px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", background: "none", border: "none", fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: lead.status === s ? 700 : 400, color: "#121a2e" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: ds.dot, display: "inline-block", flexShrink: 0 }} />
                  {l}
                  {lead.status === s && <Check size={10} style={{ marginLeft: "auto" }} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
