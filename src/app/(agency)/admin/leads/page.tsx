"use client";

import { useState, useEffect, useCallback } from "react";
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
  id: string;
  email: string | null;
  name: string | null;
  company: string | null;
  sector: string | null;
  phone: string | null;
  source: Source;
  source_ref: string | null;
  status: Status;
  channel_preference: Channel;
  metadata: Record<string, unknown>;
  notes: string | null;
  last_contact_at: string | null;
  created_at: string;
}

interface StatsData {
  bySource: Record<string, number>;
  byStatus: Record<string, number>;
  total: number;
}

interface FullStats {
  funnel: Record<string, number>;
  channelStats: Record<string, { sent: number; opened: number; responded: number }>;
  sourceStats: Record<string, { total: number; contacted: number; responded: number; meeting: number; converted: number }>;
  sectorStats: Record<string, { total: number; contacted: number; responded: number; converted: number }>;
  monthly: Record<string, { leads: number; contacted: number }>;
  rates: { openRate: number; responseRate: number; contactRate: number; conversionRate: number; meetingRate: number };
  totalAttempts: number;
  totalSent: number;
}

interface MessageTemplate {
  id: string;
  variant_label: string;
  sent_count: number;
  score: number;
  is_exploration: boolean;
  ai_hypothesis: string | null;
}

interface AnalysisRun {
  id: string;
  triggered_at: string;
  insights: string | null;
  hypotheses: string | null;
  templates_created: number;
  total_leads: number;
  model_used: string | null;
  status: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<Source, string> = {
  lead_magnet: "Lead Magnet",
  linkedin: "LinkedIn",
  google_maps: "Google Maps",
  manual: "Manuel",
  webhook: "Agent / API",
};

const SOURCE_COLORS: Record<Source, string> = {
  lead_magnet: "bg-purple-100 text-purple-700",
  linkedin: "bg-blue-100 text-blue-700",
  google_maps: "bg-green-100 text-green-700",
  manual: "bg-gray-100 text-gray-600",
  webhook: "bg-orange-100 text-orange-700",
};

const SOURCE_ICONS: Record<Source, React.ReactNode> = {
  lead_magnet: <Zap size={11} />,
  linkedin: <Linkedin size={11} />,
  google_maps: <Globe size={11} />,
  manual: <Plus size={11} />,
  webhook: <RefreshCw size={11} />,
};

const STATUS_LABELS: Record<Status, string> = {
  new: "Nouveau",
  contacted: "Contacté",
  responded: "A répondu",
  meeting: "RDV",
  converted: "Converti",
  lost: "Perdu",
};

const STATUS_COLORS: Record<Status, string> = {
  new: "bg-sky-100 text-sky-700",
  contacted: "bg-amber-100 text-amber-700",
  responded: "bg-indigo-100 text-indigo-700",
  meeting: "bg-green-100 text-green-700",
  converted: "bg-emerald-100 text-emerald-700",
  lost: "bg-red-100 text-red-600",
};

const CHANNEL_ICONS: Record<Channel, React.ReactNode> = {
  email: <Mail size={13} />,
  whatsapp: <MessageSquare size={13} />,
  linkedin_dm: <Linkedin size={13} />,
};

const CHANNEL_LABELS: Record<Channel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  linkedin_dm: "LinkedIn DM",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LeadsPage() {
  const [view, setView] = useState<View>("leads");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<StatsData>({ bySource: {}, byStatus: {}, total: 0 });
  const [fullStats, setFullStats] = useState<FullStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);

  // Filtres
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  // Modal ajout
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", company: "", sector: "", phone: "", channel_preference: "email" as Channel });
  const [addLoading, setAddLoading] = useState(false);

  // Modal détail
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Modal outreach
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

  // Confirm delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Sync
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ imported: number; skipped: number } | null>(null);

  // Analyse IA
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisRuns, setAnalysisRuns] = useState<AnalysisRun[]>([]);
  const [analysisTemplates, setAnalysisTemplates] = useState<Record<string, unknown>[]>([]);
  const [analysisResult, setAnalysisResult] = useState<{ insights: string; hypotheses: string; templatesCreated: number } | null>(null);
  const [aiConfig, setAiConfig] = useState({ threshold: "10", exploration: "0.20", minSamples: "5", autoEnabled: true });
  const [showAiConfig, setShowAiConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Modal "Contacter" (template pré-généré)
  const [contactLead, setContactLead] = useState<Lead | null>(null);
  const [contactChannel, setContactChannel] = useState<Channel>("email");
  const [contactTemplate, setContactTemplate] = useState<MessageTemplate | null>(null);
  const [contactSubject, setContactSubject] = useState("");
  const [contactContent, setContactContent] = useState("");
  const [contactLoading, setContactLoading] = useState(false);
  const [contactSending, setContactSending] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [contactError, setContactError] = useState("");

  // Load stored API key
  useEffect(() => {
    try {
      const stored = localStorage.getItem("linkedin_settings");
      if (stored) {
        const s = JSON.parse(stored);
        if (s.openrouterApiKey) setApiKey(s.openrouterApiKey);
      }
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
      setLeads(data.leads ?? []);
      setTotal(data.total ?? 0);
      setStats({ bySource: data.bySource ?? {}, byStatus: data.byStatus ?? {}, total: data.total ?? 0 });
    } catch {}
    setLoading(false);
  }, [search, filterSource, filterStatus]);

  // Charger les données d'analyse (runs + templates)
  const fetchAnalysisData = useCallback(async () => {
    try {
      const [runsRes, templatesRes, configRes] = await Promise.all([
        fetch("/api/leads/analysis-runs"),
        fetch("/api/leads/templates"),
        fetch("/api/leads/config"),
      ]);
      if (runsRes.ok) { const d = await runsRes.json(); setAnalysisRuns(d.runs ?? []); }
      if (templatesRes.ok) { const d = await templatesRes.json(); setAnalysisTemplates(d.templates ?? []); }
      if (configRes.ok) {
        const d = await configRes.json();
        setAiConfig({
          threshold: d.analysis_threshold ?? "10",
          exploration: d.exploration_rate ?? "0.20",
          minSamples: d.min_sample_size ?? "5",
          autoEnabled: d.auto_analysis_enabled !== "false",
        });
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (view === "stats") fetchAnalysisData();
  }, [view, fetchAnalysisData]);

  async function handleAnalyze() {
    if (!apiKey) { setShowApiKeyInput(true); return; }
    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const res = await fetch("/api/leads/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openrouterApiKey: apiKey }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAnalysisResult({
        insights: data.insights ?? "",
        hypotheses: data.hypotheses ?? "",
        templatesCreated: data.templatesCreated ?? 0,
      });
      fetchAnalysisData();
    } catch (e) {
      setAnalysisResult({ insights: `Erreur : ${e}`, hypotheses: "", templatesCreated: 0 });
    }
    setAnalyzing(false);
  }

  async function handleSaveConfig() {
    setSavingConfig(true);
    try {
      await fetch("/api/leads/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis_threshold: aiConfig.threshold,
          exploration_rate: aiConfig.exploration,
          min_sample_size: aiConfig.minSamples,
          auto_analysis_enabled: aiConfig.autoEnabled ? "true" : "false",
        }),
      });
      setShowAiConfig(false);
    } catch {}
    setSavingConfig(false);
  }

  async function openContact(lead: Lead) {
    setContactLead(lead);
    setContactChannel(lead.channel_preference);
    setContactTemplate(null);
    setContactSubject("");
    setContactContent("");
    setContactSent(false);
    setContactError("");
    setContactLoading(true);

    const key = apiKey;
    const params = new URLSearchParams({
      leadId: lead.id,
      channel: lead.channel_preference,
    });
    if (key) params.set("openrouterApiKey", key);

    try {
      const res = await fetch(`/api/leads/template?${params}`);
      const data = await res.json();
      if (data.noTemplates) {
        setContactError("Aucun template disponible. Lancez une analyse IA dans l'onglet Statistiques.");
      } else if (data.error) {
        setContactError(data.error);
      } else {
        setContactTemplate(data.template);
        setContactSubject(data.adapted?.subject ?? "");
        setContactContent(data.adapted?.content ?? "");
      }
    } catch {
      setContactError("Erreur lors du chargement du template.");
    }
    setContactLoading(false);
  }

  async function handleContactSend() {
    if (!contactLead || !contactContent) return;
    setContactSending(true);
    try {
      await fetch(`/api/leads/${contactLead.id}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          channel: contactChannel,
          subject: contactSubject,
          content: contactContent,
        }),
      });

      // Tracker la performance du template
      if (contactTemplate) {
        fetch("/api/leads/template", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId: contactTemplate.id, event: "sent" }),
        }).catch(() => {});
      }

      setContactSent(true);
      setLeads((prev) =>
        prev.map((l) =>
          l.id === contactLead.id
            ? { ...l, status: l.status === "new" ? "contacted" : l.status }
            : l
        )
      );
      setTimeout(() => { setContactLead(null); setContactSent(false); }, 1800);
    } catch {}
    setContactSending(false);
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
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
    try {
      const res = await fetch("/api/leads/stats");
      const data = await res.json();
      setFullStats(data);
    } catch {}
    setStatsLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchLeads, 200);
    return () => clearTimeout(t);
  }, [fetchLeads]);

  useEffect(() => {
    if (view === "stats") fetchFullStats();
  }, [view, fetchFullStats]);

  async function handleAddLead() {
    if (!addForm.email && !addForm.name) return;
    setAddLoading(true);
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...addForm, source: "manual" }),
      });
      setShowAdd(false);
      setAddForm({ name: "", email: "", company: "", sector: "", phone: "", channel_preference: "email" });
      fetchLeads();
    } catch {}
    setAddLoading(false);
  }

  async function handleStatusChange(lead: Lead, status: Status) {
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, status } : l));
    if (selectedLead?.id === lead.id) setSelectedLead({ ...selectedLead, status });
  }

  async function handleSaveNotes(lead: Lead) {
    setSavingNotes(true);
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: editNotes }),
    });
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, notes: editNotes } : l));
    if (selectedLead) setSelectedLead({ ...selectedLead, notes: editNotes });
    setSavingNotes(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setDeleteId(null);
    if (selectedLead?.id === id) setSelectedLead(null);
  }

  // ── Outreach ──────────────────────────────────────────────────────────────

  function openOutreach(lead: Lead) {
    setOutreachLead(lead);
    setOutreachChannel(lead.channel_preference);
    setOutreachSubject("");
    setOutreachContent("");
    setOutreachSent(false);
  }

  async function handleGenerate() {
    if (!outreachLead) return;
    if (!apiKey) { setShowApiKeyInput(true); return; }
    setOutreachGenerating(true);
    try {
      const res = await fetch(`/api/leads/${outreachLead.id}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          channel: outreachChannel,
          openrouterApiKey: apiKey,
        }),
      });
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
      await fetch(`/api/leads/${outreachLead.id}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          channel: outreachChannel,
          subject: outreachSubject,
          content: outreachContent,
        }),
      });
      setOutreachSent(true);
      // Update lead status in list
      setLeads((prev) =>
        prev.map((l) =>
          l.id === outreachLead.id
            ? { ...l, status: l.status === "new" ? "contacted" : l.status }
            : l
        )
      );
      setTimeout(() => { setOutreachLead(null); setOutreachSent(false); }, 1800);
    } catch {}
    setOutreachSending(false);
  }

  function exportCsv() {
    const headers = ["Nom", "Email", "Entreprise", "Secteur", "Téléphone", "Source", "Statut", "Canal", "Date"];
    const rows = leads.map((l) => [
      l.name ?? "", l.email ?? "", l.company ?? "", l.sector ?? "", l.phone ?? "",
      SOURCE_LABELS[l.source], STATUS_LABELS[l.status], CHANNEL_LABELS[l.channel_preference],
      new Date(l.created_at).toLocaleDateString("fr-FR"),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const statCards = [
    { label: "Total leads", value: stats.total, icon: <Users size={18} />, color: "text-indigo-600 bg-indigo-50" },
    { label: "Nouveaux", value: stats.byStatus["new"] ?? 0, icon: <TrendingUp size={18} />, color: "text-sky-600 bg-sky-50" },
    { label: "RDV obtenus", value: stats.byStatus["meeting"] ?? 0, icon: <Calendar size={18} />, color: "text-green-600 bg-green-50" },
    { label: "Convertis", value: stats.byStatus["converted"] ?? 0, icon: <MousePointerClick size={18} />, color: "text-emerald-600 bg-emerald-50" },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Leads</h1>
              <p className="text-xs text-gray-400 mt-0.5">CRM & prospection automatisée</p>
            </div>
            {/* View toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setView("leads")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  view === "leads" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Users size={13} />
                Leads
              </button>
              <button
                onClick={() => setView("stats")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  view === "stats" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <BarChart2 size={13} />
                Statistiques
              </button>
            </div>
          </div>

          {view === "leads" && (
            <div className="flex items-center gap-2">
              <button onClick={exportCsv} disabled={leads.length === 0} className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                <Download size={13} />
                CSV
              </button>
              <button onClick={fetchLeads} className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50">
                <RefreshCw size={13} />
                Rafraîchir
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                title="Importer les leads des lead magnets et de LinkedIn dans le CRM"
                className="flex items-center gap-1.5 text-xs text-purple-600 border border-purple-200 bg-purple-50 hover:bg-purple-100 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                <ArrowDownToLine size={13} className={syncing ? "animate-bounce" : ""} />
                {syncing ? "Sync..." : "Importer"}
              </button>
              {syncResult && (
                <span className="text-xs text-emerald-600 font-medium">
                  {syncResult.imported > 0 ? `+${syncResult.imported} importé${syncResult.imported > 1 ? "s" : ""}` : "Déjà à jour"}
                </span>
              )}
              <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700">
                <Plus size={14} />
                Ajouter
              </button>
            </div>
          )}
          {view === "stats" && (
            <button onClick={fetchFullStats} className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50">
              <RefreshCw size={13} className={statsLoading ? "animate-spin" : ""} />
              Actualiser
            </button>
          )}
        </div>
      </div>

      {/* ── LEADS VIEW ─────────────────────────────────────────────────────── */}
      {view === "leads" && (
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Stats mini */}
          <div className="grid grid-cols-4 gap-4">
            {statCards.map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${s.color}`}>{s.icon}</div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-400">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Source pills */}
          {Object.keys(stats.bySource).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Par source</p>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(stats.bySource) as [Source, number][]).map(([source, count]) => (
                  <button
                    key={source}
                    onClick={() => setFilterSource(filterSource === source ? "" : source)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      filterSource === source ? "border-gray-900 ring-2 ring-gray-900/10" : "border-transparent"
                    } ${SOURCE_COLORS[source]}`}
                  >
                    {SOURCE_ICONS[source]}
                    {SOURCE_LABELS[source]}
                    <span className="font-bold">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filtres */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher nom, email, entreprise..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20 bg-white"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={13} />
                </button>
              )}
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none text-gray-600"
            >
              <option value="">Tous les statuts</option>
              {(Object.entries(STATUS_LABELS) as [Status, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            {(filterSource || filterStatus || search) && (
              <button onClick={() => { setFilterSource(""); setFilterStatus(""); setSearch(""); }} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                <X size={13} />
                Réinitialiser
              </button>
            )}
            <p className="text-xs text-gray-400 shrink-0">{total} lead{total > 1 ? "s" : ""}</p>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="text-center py-16 text-gray-400 text-sm">Chargement...</div>
            ) : leads.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Users size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Aucun lead pour l'instant</p>
                <p className="text-xs mt-1">Créez votre premier lead ou configurez votre lead magnet</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Canal</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => { setSelectedLead(lead); setEditNotes(lead.notes ?? ""); }}
                      className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-sm">
                          {lead.name || <span className="text-gray-400 italic">Sans nom</span>}
                        </p>
                        {lead.email && <p className="text-xs text-gray-400 mt-0.5">{lead.email}</p>}
                        {lead.company && <p className="text-xs text-gray-500 mt-0.5">{lead.company}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${SOURCE_COLORS[lead.source]}`}>
                          {SOURCE_ICONS[lead.source]}
                          {SOURCE_LABELS[lead.source]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusDropdown lead={lead} onStatusChange={handleStatusChange} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          {CHANNEL_ICONS[lead.channel_preference]}
                          {CHANNEL_LABELS[lead.channel_preference]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {new Date(lead.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openContact(lead)}
                            className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
                          >
                            <Send size={12} />
                            Contacter
                          </button>
                          <button
                            onClick={() => setDeleteId(lead.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors p-1"
                          >
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

      {/* ── STATS VIEW ─────────────────────────────────────────────────────── */}
      {view === "stats" && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {statsLoading || !fullStats ? (
            <div className="text-center py-20 text-gray-400 text-sm">Chargement des statistiques...</div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: "Taux de contact", value: `${fullStats.rates.contactRate}%`, desc: "leads contactés / total", color: "text-blue-600 bg-blue-50" },
                  { label: "Taux d'ouverture", value: `${fullStats.rates.openRate}%`, desc: "emails ouverts / envoyés", color: "text-indigo-600 bg-indigo-50" },
                  { label: "Taux de réponse", value: `${fullStats.rates.responseRate}%`, desc: "réponses / envoyés", color: "text-purple-600 bg-purple-50" },
                  { label: "Taux de RDV", value: `${fullStats.rates.meetingRate}%`, desc: "RDV / total leads", color: "text-amber-600 bg-amber-50" },
                  { label: "Taux de conversion", value: `${fullStats.rates.conversionRate}%`, desc: "convertis / total leads", color: "text-emerald-600 bg-emerald-50" },
                ].map((kpi) => (
                  <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className={`text-2xl font-bold mb-1 ${kpi.color.split(" ")[0]}`}>{kpi.value}</div>
                    <p className="text-xs font-semibold text-gray-700">{kpi.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{kpi.desc}</p>
                  </div>
                ))}
              </div>

              {/* Funnel */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Funnel de conversion</h3>
                <div className="flex items-end gap-2 h-28">
                  {(["new", "contacted", "responded", "meeting", "converted"] as Status[]).map((s) => {
                    const val = fullStats.funnel[s] ?? 0;
                    const max = fullStats.funnel.total || 1;
                    const pct = Math.round((val / max) * 100);
                    return (
                      <div key={s} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs font-bold text-gray-700">{val}</span>
                        <div className="w-full rounded-t-lg" style={{ height: `${Math.max(4, pct)}%`, background: s === "converted" ? "#10b981" : s === "meeting" ? "#22c55e" : s === "responded" ? "#6366f1" : s === "contacted" ? "#f59e0b" : "#0ea5e9" }} />
                        <span className="text-xs text-gray-400">{STATUS_LABELS[s]}</span>
                        <span className="text-xs text-gray-300">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Par canal */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4">Performance par canal</h3>
                  <div className="space-y-3">
                    {(Object.entries(fullStats.channelStats) as [Channel, { sent: number; opened: number; responded: number }][]).map(([ch, data]) => {
                      const openRate = data.sent > 0 ? Math.round((data.opened / data.sent) * 100) : 0;
                      const replyRate = data.sent > 0 ? Math.round((data.responded / data.sent) * 100) : 0;
                      return (
                        <div key={ch} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                              {CHANNEL_ICONS[ch]}
                              {CHANNEL_LABELS[ch]}
                            </div>
                            <div className="flex gap-3 text-xs text-gray-400">
                              <span>{data.sent} envoyés</span>
                              <span className="text-indigo-600 font-medium">{openRate}% ouv.</span>
                              <span className="text-purple-600 font-medium">{replyRate}% rép.</span>
                            </div>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${openRate}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {Object.keys(fullStats.channelStats).every((k) => fullStats.channelStats[k].sent === 0) && (
                      <p className="text-xs text-gray-400 text-center py-4">Aucun message envoyé encore</p>
                    )}
                  </div>
                </div>

                {/* Par source */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4">Performance par source</h3>
                  <div className="space-y-2">
                    {(Object.entries(fullStats.sourceStats) as [Source, { total: number; contacted: number; responded: number; meeting: number; converted: number }][])
                      .sort((a, b) => b[1].total - a[1].total)
                      .map(([src, data]) => {
                        const convRate = data.total > 0 ? Math.round((data.converted / data.total) * 100) : 0;
                        return (
                          <div key={src} className="flex items-center gap-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${SOURCE_COLORS[src]}`}>
                              {SOURCE_ICONS[src]}
                              {SOURCE_LABELS[src]}
                            </span>
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${convRate}%` }} />
                            </div>
                            <div className="text-xs text-gray-500 shrink-0 text-right w-24">
                              <span className="font-medium text-gray-700">{data.total}</span> leads · <span className="text-emerald-600">{convRate}%</span>
                            </div>
                          </div>
                        );
                    })}
                  </div>
                </div>
              </div>

              {/* Par secteur */}
              {Object.keys(fullStats.sectorStats).length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-800 mb-4">Performance par secteur</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Secteur</th>
                          <th className="text-center py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Leads</th>
                          <th className="text-center py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contactés</th>
                          <th className="text-center py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Réponses</th>
                          <th className="text-center py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Convertis</th>
                          <th className="text-center py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Taux conv.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Object.entries(fullStats.sectorStats) as [string, { total: number; contacted: number; responded: number; converted: number }][])
                          .sort((a, b) => b[1].total - a[1].total)
                          .map(([sector, data]) => {
                            const conv = data.total > 0 ? Math.round((data.converted / data.total) * 100) : 0;
                            return (
                              <tr key={sector} className="border-b border-gray-50">
                                <td className="py-2.5 text-sm font-medium text-gray-700">{sector}</td>
                                <td className="py-2.5 text-center text-sm text-gray-600">{data.total}</td>
                                <td className="py-2.5 text-center text-sm text-gray-600">{data.contacted}</td>
                                <td className="py-2.5 text-center text-sm text-gray-600">{data.responded}</td>
                                <td className="py-2.5 text-center text-sm text-emerald-600 font-medium">{data.converted}</td>
                                <td className="py-2.5 text-center">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${conv >= 20 ? "bg-emerald-100 text-emerald-700" : conv >= 5 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                                    {conv}%
                                  </span>
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
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Évolution mensuelle (12 derniers mois)</h3>
                <div className="flex items-end gap-2 h-24">
                  {Object.entries(fullStats.monthly).map(([month, data]) => {
                    const maxLeads = Math.max(...Object.values(fullStats.monthly).map((m) => m.leads), 1);
                    const pct = Math.round((data.leads / maxLeads) * 100);
                    const label = month.slice(5); // MM
                    return (
                      <div key={month} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full relative rounded-t-sm overflow-hidden" style={{ height: "60px" }}>
                          <div className="absolute bottom-0 left-0 right-0 bg-indigo-200 rounded-t-sm" style={{ height: `${pct}%` }} />
                          {data.contacted > 0 && (
                            <div className="absolute bottom-0 left-0 right-0 bg-indigo-500 rounded-t-sm" style={{ height: `${Math.round((data.contacted / maxLeads) * 100)}%` }} />
                          )}
                        </div>
                        <span className="text-xs text-gray-400">{label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-2 bg-indigo-200 rounded-sm inline-block" /> Leads totaux</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-2 bg-indigo-500 rounded-sm inline-block" /> Leads contactés</span>
                </div>
              </div>

              {/* ── Analyse IA ── */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BrainCircuit size={18} className="text-indigo-600" />
                    <h3 className="text-sm font-semibold text-gray-800">Boucle d'amélioration IA</h3>
                    <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                      {analysisTemplates.length} templates actifs
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAiConfig(!showAiConfig)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-2 py-1 rounded-lg"
                    >
                      <Settings2 size={12} />
                      Config
                    </button>
                    <button
                      onClick={handleAnalyze}
                      disabled={analyzing}
                      className="flex items-center gap-1.5 text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      <BrainCircuit size={14} className={analyzing ? "animate-pulse" : ""} />
                      {analyzing ? "Analyse en cours..." : "Lancer une analyse"}
                    </button>
                  </div>
                </div>

                {/* Config panel */}
                {showAiConfig && (
                  <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200">
                    <p className="text-xs font-semibold text-gray-600 mb-3">Configuration de la boucle</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Seuil déclenchement</label>
                        <div className="flex items-center gap-1">
                          <input type="number" min="5" max="100" value={aiConfig.threshold}
                            onChange={(e) => setAiConfig((p) => ({ ...p, threshold: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none text-center" />
                          <span className="text-xs text-gray-400 shrink-0">leads</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Taux exploration</label>
                        <div className="flex items-center gap-1">
                          <input type="number" min="0.05" max="0.5" step="0.05" value={aiConfig.exploration}
                            onChange={(e) => setAiConfig((p) => ({ ...p, exploration: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none text-center" />
                          <span className="text-xs text-gray-400 shrink-0">(0-1)</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Échantillon minimum</label>
                        <input type="number" min="3" max="50" value={aiConfig.minSamples}
                          onChange={(e) => setAiConfig((p) => ({ ...p, minSamples: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none text-center" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Analyse auto</label>
                        <button
                          onClick={() => setAiConfig((p) => ({ ...p, autoEnabled: !p.autoEnabled }))}
                          className={`w-full py-1.5 rounded-lg text-sm border transition-all ${
                            aiConfig.autoEnabled ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-gray-50 text-gray-500 border-gray-200"
                          }`}
                        >
                          {aiConfig.autoEnabled ? "Activée" : "Désactivée"}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-end mt-3">
                      <button onClick={handleSaveConfig} disabled={savingConfig}
                        className="text-xs bg-gray-900 text-white px-4 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-50">
                        {savingConfig ? "Sauvegarde..." : "Enregistrer"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Résultat dernier run */}
                {analysisResult && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Check size={14} className="text-indigo-600" />
                      <p className="text-sm font-semibold text-indigo-700">
                        Analyse terminée — {analysisResult.templatesCreated} nouveau{analysisResult.templatesCreated > 1 ? "x" : ""} template{analysisResult.templatesCreated > 1 ? "s" : ""} créé{analysisResult.templatesCreated > 1 ? "s" : ""}
                      </p>
                    </div>
                    {analysisResult.insights && (
                      <p className="text-xs text-indigo-700 mb-2"><strong>Observations :</strong> {analysisResult.insights}</p>
                    )}
                    {analysisResult.hypotheses && (
                      <p className="text-xs text-indigo-600"><strong>Hypothèses testées :</strong> {analysisResult.hypotheses}</p>
                    )}
                  </div>
                )}

                {/* Historique des runs */}
                {analysisRuns.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Historique des analyses</p>
                    <div className="space-y-2">
                      {analysisRuns.slice(0, 3).map((run) => (
                        <div key={run.id} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-medium text-gray-700">
                              {new Date(run.triggered_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-indigo-600">{run.templates_created} templates créés</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${run.status === "completed" ? "bg-green-100 text-green-700" : run.status === "failed" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                                {run.status}
                              </span>
                            </div>
                          </div>
                          {run.insights && <p className="text-xs text-gray-500 line-clamp-2">{run.insights}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Templates actifs */}
                {analysisTemplates.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Templates A/B actifs</p>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {analysisTemplates.map((t: Record<string, unknown>) => {
                        const sent = t.sent_count as number;
                        const score = t.score as number;
                        return (
                          <div key={t.id as string} className="border border-gray-100 rounded-xl p-3 flex items-start gap-3">
                            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${
                              t.is_exploration ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"
                            }`}>
                              {t.variant_label as string}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-medium text-gray-700">
                                  {(t.source_filter as string) || "Toutes sources"} · {(t.channel as string)} · {(t.sector_filter as string) || "Tous secteurs"}
                                </span>
                                {!!t.is_exploration && (
                                  <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                    <FlaskConical size={9} />
                                    Test
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 truncate">{t.content as string}</p>
                              {!!t.ai_hypothesis && (
                                <p className="text-xs text-indigo-400 mt-0.5 truncate">💡 {t.ai_hypothesis as string}</p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-bold text-gray-700">{sent} envois</p>
                              <p className={`text-xs ${score > 0.3 ? "text-emerald-600" : score > 0.1 ? "text-amber-600" : "text-gray-400"}`}>
                                score {(score * 100).toFixed(0)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {analysisTemplates.length === 0 && !analyzing && (
                  <div className="text-center py-8 text-gray-400">
                    <AlertCircle size={24} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Aucun template généré pour l'instant</p>
                    <p className="text-xs mt-1">Lancez une première analyse pour démarrer la boucle d'apprentissage</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Modal Outreach (Générer + Envoyer) ───────────────────────────── */}
      {outreachLead && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOutreachLead(null)}>
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Générer un message</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Pour {outreachLead.name || outreachLead.email || "ce lead"}
                    {outreachLead.company && ` — ${outreachLead.company}`}
                  </p>
                </div>
                <button onClick={() => setOutreachLead(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>

              {/* Canal selector */}
              <div className="flex gap-2 mt-4">
                {(["email", "whatsapp", "linkedin_dm"] as Channel[]).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setOutreachChannel(ch)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      outreachChannel === ch
                        ? "bg-gray-900 text-white border-gray-900"
                        : "border-gray-200 text-gray-500 hover:border-gray-400"
                    }`}
                  >
                    {CHANNEL_ICONS[ch]}
                    {CHANNEL_LABELS[ch]}
                  </button>
                ))}
              </div>
            </div>

            {/* API Key input (if needed) */}
            {showApiKeyInput && (
              <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 shrink-0">
                <p className="text-xs text-amber-700 mb-2 font-medium">Clé OpenRouter requise pour la génération IA</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-or-v1-..."
                      className="w-full text-xs border border-amber-200 rounded-lg px-3 py-2 pr-8 focus:outline-none bg-white"
                    />
                    <button onClick={() => setShowApiKey((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                      {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      try {
                        const stored = localStorage.getItem("linkedin_settings") ?? "{}";
                        localStorage.setItem("linkedin_settings", JSON.stringify({ ...JSON.parse(stored), openrouterApiKey: apiKey }));
                      } catch {}
                      setShowApiKeyInput(false);
                      handleGenerate();
                    }}
                    disabled={!apiKey}
                    className="text-xs bg-amber-500 text-white px-3 py-2 rounded-lg hover:bg-amber-600 disabled:opacity-50"
                  >
                    Sauvegarder
                  </button>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {outreachChannel === "email" && (
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Objet de l'email</label>
                  <input
                    type="text"
                    value={outreachSubject}
                    onChange={(e) => setOutreachSubject(e.target.value)}
                    placeholder="L'objet sera généré automatiquement..."
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-gray-500">Message</label>
                  {outreachContent && (
                    <button
                      onClick={() => { navigator.clipboard.writeText(outreachContent); }}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                    >
                      <Copy size={11} />
                      Copier
                    </button>
                  )}
                </div>
                <textarea
                  value={outreachContent}
                  onChange={(e) => setOutreachContent(e.target.value)}
                  placeholder={outreachGenerating ? "Génération en cours..." : "Cliquez sur 'Générer' pour créer un message personnalisé avec l'IA..."}
                  rows={outreachChannel === "linkedin_dm" ? 5 : 10}
                  className={`w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900/20 resize-none leading-relaxed ${
                    outreachGenerating ? "opacity-50 animate-pulse" : ""
                  }`}
                />
                {outreachChannel === "linkedin_dm" && outreachContent && (
                  <p className={`text-xs mt-1 ${outreachContent.length > 300 ? "text-red-500" : "text-gray-400"}`}>
                    {outreachContent.length}/300 caractères
                  </p>
                )}
              </div>

              {/* Infos lead */}
              <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
                <p className="font-medium text-gray-600 mb-1.5">Contexte utilisé par l'IA</p>
                {[
                  outreachLead.name && `Nom : ${outreachLead.name}`,
                  outreachLead.company && `Entreprise : ${outreachLead.company}`,
                  outreachLead.sector && `Secteur : ${outreachLead.sector}`,
                  outreachLead.email && `Email : ${outreachLead.email}`,
                  outreachLead.notes && `Notes : ${outreachLead.notes}`,
                  `Source : ${SOURCE_LABELS[outreachLead.source]}`,
                ].filter(Boolean).map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
              <button
                onClick={handleGenerate}
                disabled={outreachGenerating}
                className="flex items-center gap-1.5 text-sm text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors font-medium disabled:opacity-50"
              >
                <Sparkles size={14} className={outreachGenerating ? "animate-spin" : ""} />
                {outreachGenerating ? "Génération..." : "Générer avec l'IA"}
              </button>

              {outreachSent ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
                  <Check size={16} />
                  Message envoyé !
                </div>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={outreachSending || !outreachContent}
                  className="flex items-center gap-1.5 text-sm bg-gray-900 text-white px-5 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  <Send size={13} />
                  {outreachSending ? "Envoi..." : outreachChannel === "email" ? "Envoyer l'email" : "Enregistrer"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Contacter (template pré-généré) ────────────────────────────── */}
      {contactLead && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setContactLead(null)}>
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100 shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">Contacter</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {contactLead.name || contactLead.email || "Ce lead"}
                    {contactLead.company && ` — ${contactLead.company}`}
                  </p>
                </div>
                <button onClick={() => setContactLead(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </div>
              {/* Canal selector */}
              <div className="flex gap-2 mt-3">
                {(["email", "whatsapp", "linkedin_dm"] as Channel[]).map((ch) => (
                  <button key={ch} onClick={() => { setContactChannel(ch); openContact({ ...contactLead, channel_preference: ch }); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      contactChannel === ch ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-500 hover:border-gray-400"
                    }`}
                  >
                    {CHANNEL_ICONS[ch]}
                    {CHANNEL_LABELS[ch]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {contactLoading ? (
                <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
                  <RefreshCw size={16} className="animate-spin" />
                  <span className="text-sm">Sélection du meilleur template...</span>
                </div>
              ) : contactError ? (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                  <AlertCircle size={20} className="mx-auto mb-2 text-amber-500" />
                  <p className="text-sm text-amber-700">{contactError}</p>
                  <button onClick={() => { setView("stats"); setContactLead(null); }}
                    className="mt-3 text-xs text-amber-600 underline flex items-center gap-1 mx-auto">
                    Aller dans Statistiques → Lancer une analyse <ChevronRight size={11} />
                  </button>
                </div>
              ) : (
                <>
                  {contactTemplate && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        contactTemplate.is_exploration ? "bg-amber-200 text-amber-800" : "bg-indigo-200 text-indigo-800"
                      }`}>
                        {contactTemplate.variant_label}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-indigo-700 font-medium">
                          Template {contactTemplate.is_exploration ? "(en test)" : `— score ${(contactTemplate.score * 100).toFixed(0)}`}
                          {" · "}{contactTemplate.sent_count} envois
                        </p>
                        {contactTemplate.ai_hypothesis && (
                          <p className="text-xs text-indigo-500 mt-0.5">💡 {contactTemplate.ai_hypothesis}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {contactChannel === "email" && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1.5 block">Objet</label>
                      <input type="text" value={contactSubject} onChange={(e) => setContactSubject(e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/20" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-gray-500">Message</label>
                      <button onClick={() => navigator.clipboard.writeText(contactContent)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                        <Copy size={11} />Copier
                      </button>
                    </div>
                    <textarea value={contactContent} onChange={(e) => setContactContent(e.target.value)}
                      rows={contactChannel === "linkedin_dm" ? 5 : 9}
                      className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900/20 resize-none leading-relaxed" />
                    {contactChannel === "linkedin_dm" && (
                      <p className={`text-xs mt-1 ${contactContent.length > 300 ? "text-red-500" : "text-gray-400"}`}>
                        {contactContent.length}/300 caractères
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {!contactError && !contactLoading && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end shrink-0">
                {contactSent ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
                    <Check size={16} />Message envoyé !
                  </div>
                ) : (
                  <button onClick={handleContactSend} disabled={contactSending || !contactContent}
                    className="flex items-center gap-1.5 text-sm bg-gray-900 text-white px-5 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50">
                    <Send size={13} />
                    {contactSending ? "Envoi..." : contactChannel === "email" ? "Envoyer l'email" : "Enregistrer"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Ajout ──────────────────────────────────────────────────────── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Ajouter un lead</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <FormRow label="Nom">
                <input type="text" value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} placeholder="Jean Dupont" className="modal-input" />
              </FormRow>
              <FormRow label="Email">
                <input type="email" value={addForm.email} onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))} placeholder="jean@exemple.fr" className="modal-input" />
              </FormRow>
              <FormRow label="Entreprise">
                <input type="text" value={addForm.company} onChange={(e) => setAddForm((p) => ({ ...p, company: e.target.value }))} placeholder="ACME SAS" className="modal-input" />
              </FormRow>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Secteur">
                  <input type="text" value={addForm.sector} onChange={(e) => setAddForm((p) => ({ ...p, sector: e.target.value }))} placeholder="Marketing" className="modal-input" />
                </FormRow>
                <FormRow label="Téléphone">
                  <input type="text" value={addForm.phone} onChange={(e) => setAddForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+33 6 00 00 00 00" className="modal-input" />
                </FormRow>
              </div>
              <FormRow label="Canal préféré">
                <select value={addForm.channel_preference} onChange={(e) => setAddForm((p) => ({ ...p, channel_preference: e.target.value as Channel }))} className="modal-input">
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="linkedin_dm">LinkedIn DM</option>
                </select>
              </FormRow>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowAdd(false)} className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={handleAddLead} disabled={addLoading || (!addForm.email && !addForm.name)} className="text-sm bg-gray-900 text-white px-5 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50">
                {addLoading ? "Ajout..." : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Détail Lead ─────────────────────────────────────────────────── */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setSelectedLead(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-gray-900 text-base">
                  {selectedLead.name || selectedLead.email || "Lead sans nom"}
                </h2>
                {selectedLead.company && <p className="text-sm text-gray-500 mt-0.5">{selectedLead.company}</p>}
              </div>
              <button onClick={() => setSelectedLead(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {selectedLead.email && (
                  <InfoItem label="Email" value={
                    <a href={`mailto:${selectedLead.email}`} className="flex items-center gap-1 text-indigo-600 hover:underline">
                      {selectedLead.email} <ExternalLink size={11} />
                    </a>
                  } />
                )}
                {selectedLead.phone && <InfoItem label="Téléphone" value={selectedLead.phone} />}
                {selectedLead.sector && <InfoItem label="Secteur" value={selectedLead.sector} />}
                <InfoItem label="Source" value={
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${SOURCE_COLORS[selectedLead.source]}`}>
                    {SOURCE_ICONS[selectedLead.source]}
                    {SOURCE_LABELS[selectedLead.source]}
                  </span>
                } />
                <InfoItem label="Canal" value={
                  <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                    {CHANNEL_ICONS[selectedLead.channel_preference]}
                    {CHANNEL_LABELS[selectedLead.channel_preference]}
                  </span>
                } />
                <InfoItem label="Ajouté le" value={new Date(selectedLead.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} />
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Statut</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(STATUS_LABELS) as [Status, string][]).map(([s, l]) => (
                    <button key={s} onClick={() => handleStatusChange(selectedLead, s)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        selectedLead.status === s ? `${STATUS_COLORS[s]} border-current ring-2 ring-current/20` : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {selectedLead.status === s && <Check size={11} />}
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {Object.keys(selectedLead.metadata).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Données source</p>
                  <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1 max-h-28 overflow-y-auto">
                    {Object.entries(selectedLead.metadata).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-gray-400 shrink-0">{k}:</span>
                        <span>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Notes</p>
                <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} placeholder="Notes sur ce lead..." className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/20 resize-none" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={() => setDeleteId(selectedLead.id)} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
                  <Trash2 size={13} />
                  Supprimer
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setSelectedLead(null); openOutreach(selectedLead); }}
                  className="flex items-center gap-1.5 text-sm text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg font-medium"
                >
                  <Sparkles size={13} />
                  Générer message
                </button>
                <button onClick={() => handleSaveNotes(selectedLead)} disabled={savingNotes} className="text-sm bg-gray-900 text-white px-4 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center gap-1.5">
                  {savingNotes ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete ─────────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
            <p className="font-semibold text-gray-900 mb-2">Supprimer ce lead ?</p>
            <p className="text-sm text-gray-400 mb-6">Cette action est irréversible.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteId(null)} className="px-5 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={() => handleDelete(deleteId)} className="px-5 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .modal-input {
          width: 100%;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 14px;
          outline: none;
          background: white;
        }
        .modal-input:focus {
          border-color: #111827;
          box-shadow: 0 0 0 3px rgba(17,24,39,0.08);
        }
      `}</style>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDropdown({ lead, onStatusChange }: { lead: Lead; onStatusChange: (lead: Lead, s: Status) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[lead.status]}`}
      >
        {STATUS_LABELS[lead.status]}
        <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[140px]">
            {(Object.entries(STATUS_LABELS) as [Status, string][]).map(([s, l]) => (
              <button
                key={s}
                onClick={(e) => { e.stopPropagation(); onStatusChange(lead, s); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 ${lead.status === s ? "font-semibold" : ""}`}
              >
                <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[s].split(" ")[0]}`} />
                {l}
                {lead.status === s && <Check size={10} className="ml-auto" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-700">{value}</p>
    </div>
  );
}
