"use client";

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import {
  MessageSquare, Figma, FileText, Sparkles, Check, Eye, EyeOff,
  ExternalLink, AlertCircle, CheckCircle2, Settings, Zap, Key,
  Plus, Copy, Trash2, Loader2, Clock, UserCheck,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type IntegrationStatus = "connected" | "disconnected";

interface Integration {
  id: string; name: string; description: string;
  icon: ReactNode; iconBg: string; status: IntegrationStatus;
  fields: { key: string; label: string; placeholder: string; helpUrl: string; helpText: string; type?: "text" | "password" }[];
  badge?: string; recommended?: boolean;
}

interface AccessKey {
  id: string; key: string; name: string; role: "client" | "designer";
  form_fields: { id: string; label: string; required?: boolean }[];
  used_at: string | null; created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STANDARD_FIELDS = [
  { id: "full_name",    label: "Nom complet",                   type: "text" },
  { id: "email",        label: "Email",                         type: "email" },
  { id: "company",      label: "Entreprise / Organisation",     type: "text" },
  { id: "phone",        label: "Téléphone",                     type: "text" },
  { id: "project_name", label: "Nom du projet",                 type: "text" },
  { id: "description",  label: "Description du projet",         type: "textarea" },
  { id: "budget",       label: "Budget estimé",                 type: "text" },
  { id: "deadline",     label: "Délai souhaité",                type: "text" },
  { id: "references",   label: "Références / inspirations",     type: "textarea" },
  { id: "notes",        label: "Remarques complémentaires",     type: "textarea" },
];

const DEFAULT_SELECTED = ["full_name", "email", "project_name", "description"];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<"integrations" | "keys">("integrations");

  // ── Integrations state ──
  const [savedKeys, setSavedKeys]       = useState<Record<string, string>>({});
  const [editingKeys, setEditingKeys]   = useState<Record<string, string>>({});
  const [visibleKeys, setVisibleKeys]   = useState<Record<string, boolean>>({});
  const [savedStatus, setSavedStatus]   = useState<Record<string, boolean>>({});

  // ── Access keys state ──
  const [accessKeys, setAccessKeys]       = useState<AccessKey[]>([]);
  const [keysLoading, setKeysLoading]     = useState(false);
  const [showCreate, setShowCreate]       = useState(false);
  const [newName, setNewName]             = useState("");
  const [newRole, setNewRole]             = useState<"client" | "designer">("client");
  const [selectedFields, setSelectedFields] = useState<string[]>(DEFAULT_SELECTED);
  const [creating, setCreating]           = useState(false);
  const [createError, setCreateError]     = useState<string | null>(null);
  const [createdKey, setCreatedKey]       = useState<AccessKey | null>(null);
  const [copied, setCopied]               = useState(false);
  const [deleting, setDeleting]           = useState<string | null>(null);

  useEffect(() => {
    if (tab === "keys") loadKeys();
  }, [tab]);

  async function loadKeys() {
    setKeysLoading(true);
    const r = await fetch("/api/keys");
    const d = await r.json();
    setAccessKeys(d.keys ?? []);
    setKeysLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    const fields = STANDARD_FIELDS.filter((f) => selectedFields.includes(f.id)).map((f) => ({
      id: f.id, label: f.label, required: true,
    }));
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, role: newRole, formFields: fields }),
    });
    const data = await res.json();
    if (!res.ok) { setCreateError(data.error ?? "Erreur"); setCreating(false); return; }
    setCreatedKey(data.key);
    setNewName(""); setNewRole("client"); setSelectedFields(DEFAULT_SELECTED);
    setShowCreate(false);
    setCreating(false);
    loadKeys();
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette clé ? Le lien ne fonctionnera plus.")) return;
    setDeleting(id);
    await fetch("/api/keys", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setDeleting(null);
    loadKeys();
  }

  function copyLink(key: string) {
    navigator.clipboard.writeText(`${window.location.origin}/access/${key}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleField(id: string) {
    setSelectedFields((p) => p.includes(id) ? p.filter((f) => f !== id) : [...p, id]);
  }

  // ── Integrations ──
  const integrations: Integration[] = [
    {
      id: "greenapi", name: "WhatsApp — Green API",
      description: "Envoyez et recevez des messages WhatsApp depuis le dashboard. Green API est la solution la plus simple : pas de vérification business, tier gratuit à 1 500 messages/mois.",
      icon: <MessageSquare size={20} />, iconBg: "bg-green-100 text-green-600",
      status: savedKeys["greenapi_instance"] && savedKeys["greenapi_token"] ? "connected" : "disconnected",
      badge: "Gratuit jusqu'à 1 500 msg/mois", recommended: true,
      fields: [
        { key: "greenapi_instance", label: "ID d'instance", placeholder: "Ex: 1101234567", helpUrl: "https://console.green-api.com", helpText: "Créez un compte sur green-api.com → Créer une instance → copiez l'ID", type: "text" },
        { key: "greenapi_token", label: "Token API", placeholder: "Ex: abc123xyz...", helpUrl: "https://console.green-api.com", helpText: "Dans votre instance Green API → API Token", type: "password" },
      ],
    },
    {
      id: "figma", name: "Figma",
      description: "Connectez Figma pour voir les commentaires de vos clients directement dans la messagerie. Utilise un token personnel gratuit.",
      icon: <Figma size={20} />, iconBg: "bg-purple-100 text-purple-600",
      status: savedKeys["figma_token"] ? "connected" : "disconnected",
      fields: [{ key: "figma_token", label: "Token d'accès personnel", placeholder: "figd_...", helpUrl: "https://www.figma.com/settings", helpText: "figma.com → Paramètres → Security → Personal access tokens → Générer un token", type: "password" }],
    },
    {
      id: "google", name: "Google Docs / Drive",
      description: "Synchronisez les retours Google Docs de vos clients. Nécessite une clé API Google Cloud.",
      icon: <FileText size={20} />, iconBg: "bg-blue-100 text-blue-600",
      status: savedKeys["google_api_key"] ? "connected" : "disconnected",
      fields: [{ key: "google_api_key", label: "Clé API Google Cloud", placeholder: "AIza...", helpUrl: "https://console.cloud.google.com/apis/credentials", helpText: "console.cloud.google.com → APIs & Services → Credentials → Créer une clé API", type: "password" }],
    },
    {
      id: "claude", name: "Claude AI (Anthropic)",
      description: "Active le bouton \"Peaufiner avec IA\" dans la messagerie pour reformuler vos messages automatiquement.",
      icon: <Sparkles size={20} />, iconBg: "bg-orange-100 text-orange-600",
      status: savedKeys["claude_api_key"] ? "connected" : "disconnected",
      fields: [{ key: "claude_api_key", label: "Clé API Anthropic", placeholder: "sk-ant-...", helpUrl: "https://console.anthropic.com/settings/keys", helpText: "console.anthropic.com → API Keys → Créer une clé", type: "password" }],
    },
  ];

  const handleChange = (key: string, value: string) => setEditingKeys((p) => ({ ...p, [key]: value }));
  const getValue = (key: string) => editingKeys[key] !== undefined ? editingKeys[key] : savedKeys[key] ?? "";
  const toggleVisible = (key: string) => setVisibleKeys((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = (integrationId: string, fields: Integration["fields"]) => {
    const updates: Record<string, string> = {};
    fields.forEach((f) => { if (editingKeys[f.key] !== undefined) updates[f.key] = editingKeys[f.key]; });
    setSavedKeys((p) => ({ ...p, ...updates }));
    setSavedStatus((p) => ({ ...p, [integrationId]: true }));
    setTimeout(() => setSavedStatus((p) => ({ ...p, [integrationId]: false })), 2500);
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Settings size={22} className="text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
        </div>
        <p className="text-gray-500 mt-1">Gérez vos intégrations et vos accès clients.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-8 w-fit">
        {([["integrations", "Intégrations"], ["keys", "Clés d'accès"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Integrations Tab ── */}
      {tab === "integrations" && (
        <>
          <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">Pourquoi Green API plutôt que WhatsApp Business officiel ?</p>
              <p className="text-amber-700 mt-0.5">L&apos;API officielle Meta nécessite une vérification business longue et coûteuse. Green API fonctionne avec votre numéro WhatsApp existant via un QR code — parfait pour une agence.</p>
            </div>
          </div>
          <div className="space-y-5">
            {integrations.map((integration) => {
              const isConnected = integration.status === "connected";
              const isSaved = savedStatus[integration.id];
              return (
                <div key={integration.id} className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-2.5 rounded-xl ${integration.iconBg}`}>{integration.icon}</div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="font-semibold text-gray-900">{integration.name}</h2>
                          {integration.recommended && <span className="flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full"><Zap size={10} />Recommandé</span>}
                          {integration.badge && <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-medium">{integration.badge}</span>}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{integration.description}</p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${isConnected ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {isConnected ? <CheckCircle2 size={12} /> : <div className="w-2 h-2 rounded-full bg-gray-400" />}
                      {isConnected ? "Connecté" : "Non connecté"}
                    </div>
                  </div>
                  <div className="space-y-4">
                    {integration.fields.map((field) => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">{field.label}</label>
                        <div className="relative">
                          <input
                            type={field.type === "password" && !visibleKeys[field.key] ? "password" : "text"}
                            value={getValue(field.key)}
                            onChange={(e) => handleChange(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
                          />
                          {field.type === "password" && (
                            <button type="button" onClick={() => toggleVisible(field.key)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                              {visibleKeys[field.key] ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          )}
                        </div>
                        <div className="flex items-start gap-1 mt-1.5">
                          <AlertCircle size={12} className="text-gray-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-gray-400">{field.helpText}{" "}<a href={field.helpUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-700 inline-flex items-center gap-0.5">Obtenir la clé<ExternalLink size={10} /></a></p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex justify-end">
                    <button onClick={() => handleSave(integration.id, integration.fields)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isSaved ? "bg-green-500 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}>
                      {isSaved ? <><Check size={14} />Enregistré</> : "Enregistrer"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Access Keys Tab ── */}
      {tab === "keys" && (
        <div className="space-y-6">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Clés d&apos;accès</h2>
              <p className="text-sm text-gray-500 mt-0.5">Créez un lien unique par client ou prestataire avec un formulaire personnalisé.</p>
            </div>
            {!showCreate && (
              <button onClick={() => { setShowCreate(true); setCreatedKey(null); }} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                <Plus size={15} />Créer une clé
              </button>
            )}
          </div>

          {/* Success banner */}
          {createdKey && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={16} className="text-green-600" />
                <p className="text-sm font-semibold text-green-800">Lien créé pour <span className="font-bold">{createdKey.name}</span></p>
              </div>
              <div className="flex gap-2">
                <input readOnly value={`${typeof window !== "undefined" ? window.location.origin : ""}/access/${createdKey.key}`} className="flex-1 px-3 py-2 bg-white border border-green-300 rounded-lg text-xs font-mono text-gray-700 focus:outline-none" />
                <button onClick={() => copyLink(createdKey.key)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${copied ? "bg-green-500 text-white" : "bg-green-700 text-white hover:bg-green-800"}`}>
                  {copied ? <><Check size={13} />Copié</> : <><Copy size={13} />Copier</>}
                </button>
              </div>
              <button onClick={() => setCreatedKey(null)} className="mt-2 text-xs text-green-600 hover:text-green-800">Fermer</button>
            </div>
          )}

          {/* Create form */}
          {showCreate && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-5 flex items-center gap-2"><Key size={16} className="text-indigo-600" />Nouvelle clé d&apos;accès</h3>
              {createError && <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4"><AlertCircle size={14} className="text-red-500 mt-0.5" /><p className="text-sm text-red-700">{createError}</p></div>}
              <form onSubmit={handleCreate} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom du destinataire</label>
                    <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex : Jean Dupont" required className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                    <select value={newRole} onChange={(e) => setNewRole(e.target.value as "client" | "designer")} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                      <option value="client">Client</option>
                      <option value="designer">Prestataire</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Champs du formulaire</label>
                  <div className="grid grid-cols-2 gap-2">
                    {STANDARD_FIELDS.map((f) => (
                      <label key={f.id} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm cursor-pointer transition-colors ${selectedFields.includes(f.id) ? "bg-indigo-50 border-indigo-300 text-indigo-800" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                        <input type="checkbox" checked={selectedFields.includes(f.id)} onChange={() => toggleField(f.id)} className="rounded accent-indigo-600" />
                        {f.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={creating || selectedFields.length === 0} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed">
                    {creating ? <><Loader2 size={14} className="animate-spin" />Création...</> : <><Key size={14} />Générer le lien</>}
                  </button>
                  <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
                </div>
              </form>
            </div>
          )}

          {/* Keys list */}
          {keysLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={24} /></div>
          ) : accessKeys.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <Key size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">Aucune clé créée pour l&apos;instant</p>
              <p className="text-gray-400 text-xs mt-1">Créez votre première clé pour inviter un client ou un prestataire.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nom</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Créé le</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {accessKeys.map((k) => (
                    <tr key={k.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-gray-900 text-sm">{k.name}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${k.role === "client" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
                          {k.role === "client" ? "Client" : "Prestataire"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {k.used_at ? (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-green-700"><UserCheck size={13} />Connecté</span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-gray-400"><Clock size={13} />En attente</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-400">
                        {new Date(k.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => copyLink(k.key)} className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-medium">
                            <Copy size={12} />Copier
                          </button>
                          <button onClick={() => handleDelete(k.id)} disabled={deleting === k.id} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
                            {deleting === k.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
