"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, Plus, Download, Filter, RefreshCw,
  Mail, MessageSquare, Linkedin, Globe, Zap,
  ChevronDown, Check, X, ExternalLink, Trash2,
  TrendingUp, Users, MousePointerClick, Calendar,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Source = "lead_magnet" | "linkedin" | "google_maps" | "manual" | "webhook";
type Status = "new" | "contacted" | "responded" | "meeting" | "converted" | "lost";
type Channel = "email" | "whatsapp" | "linkedin_dm";

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
  outreach_attempts?: { count: number }[];
}

interface StatsData {
  bySource: Record<string, number>;
  byStatus: Record<string, number>;
  total: number;
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<StatsData>({ bySource: {}, byStatus: {}, total: 0 });
  const [loading, setLoading] = useState(true);

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

  // Confirm delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  useEffect(() => {
    const t = setTimeout(fetchLeads, 200);
    return () => clearTimeout(t);
  }, [fetchLeads]);

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

  // Stats cards
  const statCards = [
    { label: "Total leads", value: stats.total, icon: <Users size={18} />, color: "text-indigo-600 bg-indigo-50" },
    { label: "Nouveaux", value: stats.byStatus["new"] ?? 0, icon: <TrendingUp size={18} />, color: "text-sky-600 bg-sky-50" },
    { label: "RDV obtenus", value: stats.byStatus["meeting"] ?? 0, icon: <Calendar size={18} />, color: "text-green-600 bg-green-50" },
    { label: "Convertis", value: stats.byStatus["converted"] ?? 0, icon: <MousePointerClick size={18} />, color: "text-emerald-600 bg-emerald-50" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Leads</h1>
            <p className="text-xs text-gray-400 mt-0.5">Centralisez et suivez tous vos prospects</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              disabled={leads.length === 0}
              className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              <Download size={13} />
              CSV
            </button>
            <button
              onClick={fetchLeads}
              className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw size={13} />
              Rafraîchir
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Plus size={14} />
              Ajouter un lead
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Stats */}
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

        {/* Source breakdown */}
        {Object.keys(stats.bySource).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Par source</p>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(stats.bySource) as [Source, number][]).map(([source, count]) => (
                <button
                  key={source}
                  onClick={() => setFilterSource(filterSource === source ? "" : source)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    filterSource === source
                      ? "border-gray-900 ring-2 ring-gray-900/10"
                      : "border-transparent"
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

        {/* Filtres + Search */}
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
            <button
              onClick={() => { setFilterSource(""); setFilterStatus(""); setSearch(""); }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            >
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
                  <th className="px-4 py-3" />
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
                      {new Date(lead.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteId(lead.id); }}
                        className="text-gray-300 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

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
              <button
                onClick={handleAddLead}
                disabled={addLoading || (!addForm.email && !addForm.name)}
                className="text-sm bg-gray-900 text-white px-5 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
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
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-gray-900 text-base">
                  {selectedLead.name || selectedLead.email || "Lead sans nom"}
                </h2>
                {selectedLead.company && <p className="text-sm text-gray-500 mt-0.5">{selectedLead.company}</p>}
              </div>
              <button onClick={() => setSelectedLead(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {/* Infos */}
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

              {/* Statut */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Statut</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(STATUS_LABELS) as [Status, string][]).map(([s, l]) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(selectedLead, s)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        selectedLead.status === s
                          ? `${STATUS_COLORS[s]} border-current ring-2 ring-current/20`
                          : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {selectedLead.status === s && <Check size={11} />}
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Métadonnées source */}
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

              {/* Notes */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Notes</p>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  placeholder="Notes sur ce lead..."
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/20 resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={() => setDeleteId(selectedLead.id)}
                className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
              >
                <Trash2 size={13} />
                Supprimer
              </button>
              <button
                onClick={() => handleSaveNotes(selectedLead)}
                disabled={savingNotes}
                className="text-sm bg-gray-900 text-white px-5 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {savingNotes ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                Enregistrer notes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete ───────────────────────────────────────────────────── */}
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
                <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[s].split(" ")[0].replace("bg-", "bg-")}`} />
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
