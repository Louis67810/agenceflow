"use client";

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import {
  MessageSquare, Figma, FileText, Sparkles, Check, Eye, EyeOff,
  ExternalLink, AlertCircle, CheckCircle2, Settings, Zap, Key,
  Plus, Copy, Trash2, Loader2, Clock, UserCheck, Briefcase,
  ChevronDown, ChevronUp, GripVertical, Euro, X, ImageIcon,
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

interface FormTemplate {
  id: string;
  name: string;
  pages?: { id: string; title: string; fields: { id: string; type: string; label: string; required?: boolean; options?: string[] }[] }[];
  fields?: { id: string; type: string; label: string; required?: boolean; options?: string[] }[];
}

interface ServiceStage {
  id: string;
  label: string;
  duration_days: number;
  image_url?: string;
}

interface ServiceType {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  stages: ServiceStage[];
  created_at: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<"integrations" | "keys" | "services">("integrations");

  // ── Integrations state ──
  const [savedKeys, setSavedKeys]     = useState<Record<string, string>>({});
  const [editingKeys, setEditingKeys] = useState<Record<string, string>>({});
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});

  // ── Access keys state ──
  const [accessKeys, setAccessKeys]         = useState<AccessKey[]>([]);
  const [keysLoading, setKeysLoading]       = useState(false);
  const [showCreate, setShowCreate]         = useState(false);
  const [newName, setNewName]               = useState("");
  const [newRole, setNewRole]               = useState<"client" | "designer">("client");
  const [forms, setForms]                   = useState<FormTemplate[]>([]);
  const [selectedFormId, setSelectedFormId] = useState("");
  const [serviceTypes, setServiceTypes]     = useState<ServiceType[]>([]);
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState("");
  const [creating, setCreating]             = useState(false);
  const [createError, setCreateError]       = useState<string | null>(null);
  const [createdKey, setCreatedKey]         = useState<AccessKey | null>(null);
  const [copied, setCopied]                 = useState(false);
  const [deleting, setDeleting]             = useState<string | null>(null);

  // ── Service types state ──
  const [stLoading, setStLoading]       = useState(false);
  const [showNewService, setShowNewService] = useState(false);
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const [sName, setSName]               = useState("");
  const [sDesc, setSDesc]               = useState("");
  const [sPrice, setSPrice]             = useState("");
  const [sStages, setSStages]           = useState<ServiceStage[]>([]);
  const [sSaving, setSSaving]           = useState(false);
  const [sError, setSError]             = useState<string | null>(null);

  useEffect(() => {
    if (tab === "keys") {
      loadKeys();
      fetch("/api/forms").then((r) => r.json()).then((d) => {
        setForms(d.forms ?? []);
        if (d.forms?.length > 0) setSelectedFormId(d.forms[0].id);
      });
      fetch("/api/service-types").then((r) => r.json()).then((d) => {
        setServiceTypes(d.service_types ?? []);
        if (d.service_types?.length > 0) setSelectedServiceTypeId(d.service_types[0].id);
      });
    }
    if (tab === "services") loadServiceTypes();
  }, [tab]);

  // ── Keys ──────────────────────────────────────────────────────────────────

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
    const selectedForm = forms.find((f) => f.id === selectedFormId);
    if (!selectedForm) { setCreateError("Sélectionne un formulaire."); setCreating(false); return; }
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        role: newRole,
        formPages: selectedForm.pages ?? [],
        serviceTypeId: selectedServiceTypeId || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setCreateError(data.error ?? "Erreur"); setCreating(false); return; }
    setCreatedKey(data.key);
    setNewName(""); setNewRole("client");
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

  // ── Service types ──────────────────────────────────────────────────────────

  async function loadServiceTypes() {
    setStLoading(true);
    const r = await fetch("/api/service-types");
    const d = await r.json();
    setServiceTypes(d.service_types ?? []);
    setStLoading(false);
  }

  function openNewService() {
    setEditingService(null);
    setSName(""); setSDesc(""); setSPrice(""); setSStages([]);
    setSError(null);
    setShowNewService(true);
  }

  function openEditService(s: ServiceType) {
    setEditingService(s);
    setSName(s.name);
    setSDesc(s.description ?? "");
    setSPrice(s.price != null ? String(s.price) : "");
    setSStages([...s.stages]);
    setSError(null);
    setShowNewService(true);
  }

  function addStage() {
    setSStages((p) => [
      ...p,
      { id: `s_${Date.now()}`, label: "Nouvelle étape", duration_days: 7 },
    ]);
  }

  function updateStage(id: string, field: keyof ServiceStage, value: string | number) {
    setSStages((p) => p.map((s) => s.id === id ? { ...s, [field]: value } : s));
  }

  function handleStageImage(id: string, file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setSStages((p) => p.map((s) => s.id === id ? { ...s, image_url: dataUrl } : s));
    };
    reader.readAsDataURL(file);
  }

  function removeStage(id: string) {
    setSStages((p) => p.filter((s) => s.id !== id));
  }

  async function saveService(e: React.FormEvent) {
    e.preventDefault();
    if (!sName.trim()) { setSError("Nom requis"); return; }
    setSSaving(true);
    setSError(null);
    const body = {
      name: sName.trim(),
      description: sDesc.trim() || null,
      price: sPrice ? Number(sPrice) : null,
      stages: sStages,
    };
    const url = editingService ? `/api/service-types/${editingService.id}` : "/api/service-types";
    const method = editingService ? "PUT" : "POST";
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) { setSError(d.error ?? "Erreur"); setSSaving(false); return; }
    setShowNewService(false);
    loadServiceTypes();
    setSSaving(false);
  }

  async function deleteService(id: string) {
    if (!confirm("Supprimer cette prestation ?")) return;
    await fetch(`/api/service-types/${id}`, { method: "DELETE" });
    loadServiceTypes();
  }

  // ── Integrations ──────────────────────────────────────────────────────────

  const integrations: Integration[] = [
    {
      id: "greenapi", name: "WhatsApp — Green API",
      description: "Envoyez et recevez des messages WhatsApp depuis le dashboard.",
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
      description: "Connectez Figma pour voir les commentaires clients dans la messagerie.",
      icon: <Figma size={20} />, iconBg: "bg-purple-100 text-purple-600",
      status: savedKeys["figma_token"] ? "connected" : "disconnected",
      fields: [{ key: "figma_token", label: "Token d'accès personnel", placeholder: "figd_...", helpUrl: "https://www.figma.com/settings", helpText: "figma.com → Paramètres → Security → Personal access tokens", type: "password" }],
    },
    {
      id: "claude", name: "Claude AI (Anthropic)",
      description: "Active le bouton \"Peaufiner avec IA\" dans la messagerie.",
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
        <p className="text-gray-500 mt-1">Gérez vos intégrations, prestations et accès clients.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-8 w-fit">
        {([
          ["integrations", "Intégrations"],
          ["services", "Prestations"],
          ["keys", "Clés d'accès"],
        ] as const).map(([id, label]) => (
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
                      <p className="text-xs text-gray-400 mt-1">{field.helpText}{" "}<a href={field.helpUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-700 inline-flex items-center gap-0.5">Obtenir la clé<ExternalLink size={10} /></a></p>
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
      )}

      {/* ── Services Tab ── */}
      {tab === "services" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Mes prestations</h2>
              <p className="text-sm text-gray-500 mt-0.5">Définissez vos types de projets avec étapes et tarifs.</p>
            </div>
            {!showNewService && (
              <button onClick={openNewService} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700">
                <Plus size={15} />Nouvelle prestation
              </button>
            )}
          </div>

          {/* Form to create/edit */}
          {showNewService && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
                <Briefcase size={16} className="text-indigo-600" />
                {editingService ? "Modifier la prestation" : "Nouvelle prestation"}
              </h3>
              {sError && <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4"><AlertCircle size={14} className="text-red-500 mt-0.5" /><p className="text-sm text-red-700">{sError}</p></div>}
              <form onSubmit={saveService} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom de la prestation <span className="text-red-500">*</span></label>
                    <input value={sName} onChange={(e) => setSName(e.target.value)} placeholder="Ex : Site vitrine, Identité visuelle..." required
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Prix (€)</label>
                    <div className="relative">
                      <Euro size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="number" value={sPrice} onChange={(e) => setSPrice(e.target.value)} placeholder="Ex : 2500"
                        className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Description (optionnelle)</label>
                  <input value={sDesc} onChange={(e) => setSDesc(e.target.value)} placeholder="Brève description de la prestation"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>

                {/* Stages */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Étapes du projet</label>
                    <button type="button" onClick={addStage} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                      <Plus size={13} />Ajouter une étape
                    </button>
                  </div>
                  {sStages.length === 0 ? (
                    <p className="text-sm text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-lg">
                      Aucune étape définie. Cliquez sur "Ajouter une étape".
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {sStages.map((stage, idx) => {
                        const imgInputId = `stage-img-${stage.id}`;
                        return (
                          <div key={stage.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <GripVertical size={14} className="text-gray-300 shrink-0" />
                            <span className="text-xs text-gray-400 w-5 shrink-0">{idx + 1}.</span>
                            {/* Image preview / upload */}
                            <label htmlFor={imgInputId} className="shrink-0 cursor-pointer" title="Ajouter une icône">
                              {stage.image_url ? (
                                <img src={stage.image_url} alt="" className="w-8 h-8 rounded-lg object-cover border border-gray-200 hover:opacity-80 transition-opacity" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 hover:border-indigo-400 hover:text-indigo-400 transition-colors">
                                  <ImageIcon size={14} />
                                </div>
                              )}
                              <input
                                id={imgInputId}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleStageImage(stage.id, file);
                                }}
                              />
                            </label>
                            <input
                              value={stage.label}
                              onChange={(e) => updateStage(stage.id, "label", e.target.value)}
                              placeholder="Nom de l'étape"
                              className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                            <input
                              type="number"
                              value={stage.duration_days}
                              onChange={(e) => updateStage(stage.id, "duration_days", Number(e.target.value))}
                              min={1}
                              className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 text-center"
                            />
                            <span className="text-xs text-gray-400 shrink-0">jours</span>
                            {stage.image_url && (
                              <button
                                type="button"
                                onClick={() => setSStages((p) => p.map((s) => s.id === stage.id ? { ...s, image_url: undefined } : s))}
                                className="text-gray-300 hover:text-orange-400 transition-colors shrink-0"
                                title="Supprimer l'icône"
                              >
                                <ImageIcon size={13} />
                              </button>
                            )}
                            <button type="button" onClick={() => removeStage(stage.id)} className="text-gray-300 hover:text-red-400 transition-colors shrink-0">
                              <X size={15} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={sSaving} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                    {sSaving ? <><Loader2 size={14} className="animate-spin" />Enregistrement...</> : <><Check size={14} />{editingService ? "Mettre à jour" : "Créer la prestation"}</>}
                  </button>
                  <button type="button" onClick={() => setShowNewService(false)} className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
                </div>
              </form>
            </div>
          )}

          {/* List */}
          {stLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={24} /></div>
          ) : serviceTypes.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <Briefcase size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">Aucune prestation créée</p>
              <p className="text-gray-400 text-xs mt-1">Créez vos types de projets pour les associer aux liens d&apos;invitation.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {serviceTypes.map((st) => (
                <div key={st.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-gray-900">{st.name}</h3>
                        {st.price != null && (
                          <span className="flex items-center gap-1 text-sm font-medium text-green-700 bg-green-50 px-2.5 py-0.5 rounded-full">
                            <Euro size={12} />{st.price.toLocaleString("fr-FR")} €
                          </span>
                        )}
                      </div>
                      {st.description && <p className="text-sm text-gray-500 mt-0.5">{st.description}</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        {st.stages.length} étape{st.stages.length !== 1 ? "s" : ""}
                        {st.stages.length > 0 && ` · ${st.stages.reduce((n, s) => n + s.duration_days, 0)} jours au total`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEditService(st)} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium px-3 py-1.5 border border-indigo-200 rounded-lg">Modifier</button>
                      <button onClick={() => deleteService(st.id)} className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 border border-red-100 rounded-lg">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  {st.stages.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {st.stages.map((s, i) => (
                        <span key={s.id} className="flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full text-gray-600">
                          {s.image_url ? (
                            <img src={s.image_url} alt="" className="w-4 h-4 rounded object-cover" />
                          ) : (
                            <span className="text-gray-300">{i + 1}.</span>
                          )}
                          {s.label}
                          <span className="text-gray-400">· {s.duration_days}j</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Access Keys Tab ── */}
      {tab === "keys" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Clés d&apos;accès</h2>
              <p className="text-sm text-gray-500 mt-0.5">Créez un lien unique par client ou prestataire.</p>
            </div>
            {!showCreate && (
              <button onClick={() => { setShowCreate(true); setCreatedKey(null); }} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700">
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
                    <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex : Jean Dupont" required
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                    <select value={newRole} onChange={(e) => setNewRole(e.target.value as "client" | "designer")} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                      <option value="client">Client</option>
                      <option value="designer">Prestataire</option>
                    </select>
                  </div>
                </div>

                {/* Service type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Type de prestation</label>
                  {serviceTypes.length === 0 ? (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                      <AlertCircle size={14} />
                      Aucune prestation. <button type="button" onClick={() => setTab("services")} className="underline font-medium">Créer une prestation</button> d&apos;abord.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors border-gray-200 hover:border-gray-300">
                        <input type="radio" name="service" checked={!selectedServiceTypeId} onChange={() => setSelectedServiceTypeId("")} className="accent-indigo-600" />
                        <span className="text-sm text-gray-500 italic">Sans prestation spécifique</span>
                      </label>
                      {serviceTypes.map((st) => (
                        <label key={st.id} className={`flex items-start gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${selectedServiceTypeId === st.id ? "bg-indigo-50 border-indigo-300" : "border-gray-200 hover:border-gray-300"}`}>
                          <input type="radio" name="service" checked={selectedServiceTypeId === st.id} onChange={() => setSelectedServiceTypeId(st.id)} className="mt-0.5 accent-indigo-600" />
                          <div>
                            <p className={`text-sm font-medium ${selectedServiceTypeId === st.id ? "text-indigo-800" : "text-gray-800"}`}>{st.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {st.stages.length} étape{st.stages.length !== 1 ? "s" : ""}
                              {st.price != null && ` · ${st.price.toLocaleString("fr-FR")} €`}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Form */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Formulaire d&apos;onboarding</label>
                  {forms.length === 0 ? (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                      <AlertCircle size={14} />
                      Aucun formulaire. <a href="/admin/forms" className="underline font-medium">Créer un formulaire</a> d&apos;abord.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {forms.map((f) => (
                        <label key={f.id} className={`flex items-start gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${selectedFormId === f.id ? "bg-indigo-50 border-indigo-300" : "border-gray-200 hover:border-gray-300"}`}>
                          <input type="radio" name="form" checked={selectedFormId === f.id} onChange={() => setSelectedFormId(f.id)} className="mt-0.5 accent-indigo-600" />
                          <div>
                            <p className={`text-sm font-medium ${selectedFormId === f.id ? "text-indigo-800" : "text-gray-800"}`}>{f.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {f.pages
                                ? `${f.pages.length} page${f.pages.length !== 1 ? "s" : ""} · ${f.pages.reduce((n, p) => n + p.fields.length, 0)} champs`
                                : `${f.fields?.length ?? 0} champ${(f.fields?.length ?? 0) !== 1 ? "s" : ""}`
                              }
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={creating || !selectedFormId} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed">
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
              <p className="text-gray-500 text-sm font-medium">Aucune clé créée</p>
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
                      <td className="px-5 py-3.5 font-medium text-gray-900 text-sm">{k.name}</td>
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
                      <td className="px-5 py-3.5 text-xs text-gray-400">{new Date(k.created_at).toLocaleDateString("fr-FR")}</td>
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
