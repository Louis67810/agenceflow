"use client";

import { useState, useEffect } from "react";
import type { ReactNode, CSSProperties } from "react";
import {
  MessageSquare, Figma, Sparkles, Check, Eye, EyeOff,
  ExternalLink, AlertCircle, CheckCircle2, Settings, Zap, Key,
  Plus, Copy, Trash2, Loader2, Clock, UserCheck, Briefcase,
  ChevronDown, GripVertical, Euro, X, ImageIcon,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type IntegrationStatus = "connected" | "disconnected";

interface Integration {
  id: string; name: string; description: string;
  icon: ReactNode; iconStyle: CSSProperties; status: IntegrationStatus;
  fields: { key: string; label: string; placeholder: string; helpUrl: string; helpText: string; type?: "text" | "password" }[];
  badge?: string; recommended?: boolean;
}

interface AccessKey {
  id: string; key: string; name: string; role: "client" | "designer" | "developer";
  form_fields: { id: string; label: string; required?: boolean }[];
  banner_url?: string | null;
  whatsapp_group_name?: string | null;
  whatsapp_group_profile_url?: string | null;
  used_at: string | null; created_at: string;
}

interface FormTemplate {
  id: string; name: string;
  pages?: { id: string; title: string; fields: { id: string; type: string; label: string; required?: boolean; options?: string[] }[] }[];
  fields?: { id: string; type: string; label: string; required?: boolean; options?: string[] }[];
}

interface ServiceStage {
  id: string; label: string; duration_days: number; image_url?: string;
}

interface ServiceType {
  id: string; name: string; description: string | null;
  price: number | null; stages: ServiceStage[]; created_at: string;
}

// ─── Style tokens ─────────────────────────────────────────────────────────────

const jk: CSSProperties = { fontFamily: '"Plus Jakarta Sans", sans-serif' };
const card: CSSProperties = { background: "#fff", borderRadius: 13, border: "1px solid rgba(0,0,0,0.1)", padding: 24 };
const inp: CSSProperties = { width: "100%", background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9, padding: "9px 12px", fontSize: 14, color: "#121a2e", outline: "none", boxSizing: "border-box", fontFamily: '"Plus Jakarta Sans", sans-serif' };
const btnPri: CSSProperties = { background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)", border: "1px solid #2f4d9d", color: "#fff", borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: '"Plus Jakarta Sans", sans-serif' };
const btnSec: CSSProperties = { background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", color: "rgba(18,26,46,0.6)", fontFamily: '"Plus Jakarta Sans", sans-serif' };
const ROLE_STYLES: Record<"client" | "designer" | "developer", CSSProperties> = {
  client: { background: "#d5eeff", color: "#073e63" },
  designer: { background: "#E1D1FA", color: "#6236AA" },
  developer: { background: "#fee6d0", color: "#663b12" },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<"integrations" | "keys" | "services" | "ia">("integrations");

  const [businessContext, setBusinessContext] = useState("");
  const [aiModels, setAiModels] = useState({
    copywriting: "openai/gpt-4o-mini", linkedin_posts: "openai/gpt-4o-mini",
    linkedin_ideas: "openai/gpt-4o-mini", leads: "openai/gpt-4o-mini", coach: "openai/gpt-4o-mini",
  });
  const [iaSaving, setIaSaving] = useState(false);
  const [iaSaved, setIaSaved] = useState(false);

  const [savedKeys, setSavedKeys]     = useState<Record<string, string>>({});
  const [editingKeys, setEditingKeys] = useState<Record<string, string>>({});
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});

  const [accessKeys, setAccessKeys]         = useState<AccessKey[]>([]);
  const [keysLoading, setKeysLoading]       = useState(false);
  const [keysError, setKeysError]           = useState<string | null>(null);
  const [showCreate, setShowCreate]         = useState(false);
  const [newName, setNewName]               = useState("");
  const [newRole, setNewRole]               = useState<"client" | "designer" | "developer">("client");
  const [forms, setForms]                   = useState<FormTemplate[]>([]);
  const [selectedFormId, setSelectedFormId] = useState("");
  const [serviceTypes, setServiceTypes]     = useState<ServiceType[]>([]);
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState("");
  const [newBannerUrl, setNewBannerUrl]           = useState("");
  const [newWhatsappGroupName, setNewWhatsappGroupName] = useState("");
  const [newWhatsappGroupProfileUrl, setNewWhatsappGroupProfileUrl] = useState("");
  const [creating, setCreating]             = useState(false);
  const [createError, setCreateError]       = useState<string | null>(null);
  const [createdKey, setCreatedKey]         = useState<AccessKey | null>(null);
  const [copied, setCopied]                 = useState(false);
  const [deleting, setDeleting]             = useState<string | null>(null);

  const [stLoading, setStLoading]           = useState(false);
  const [showNewService, setShowNewService] = useState(false);
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const [sName, setSName]                   = useState("");
  const [sDesc, setSDesc]                   = useState("");
  const [sPrice, setSPrice]                 = useState("");
  const [sStages, setSStages]               = useState<ServiceStage[]>([]);
  const [sSaving, setSSaving]               = useState(false);
  const [sError, setSError]                 = useState<string | null>(null);

  useEffect(() => {
    if (tab === "ia") {
      import("@/lib/agenda/fetchWithAuth").then(({ agendaFetch }) => {
        agendaFetch("/api/app-settings").then(r => r.json()).then(d => {
          if (d.settings) {
            setBusinessContext(d.settings.business_context ?? "");
            if (d.settings.ai_models) setAiModels(d.settings.ai_models);
          }
        });
      });
    }
    if (tab === "keys") {
      loadKeys();
      fetch("/api/forms").then(r => r.json()).then(d => {
        setForms(d.forms ?? []);
        if (d.forms?.length > 0) setSelectedFormId(d.forms[0].id);
      });
      fetch("/api/service-types").then(r => r.json()).then(d => {
        setServiceTypes(d.service_types ?? []);
        if (d.service_types?.length > 0) setSelectedServiceTypeId(d.service_types[0].id);
      });
    }
    if (tab === "services") loadServiceTypes();
  }, [tab]);

  async function loadKeys() {
    setKeysLoading(true);
    setKeysError(null);
    try {
      const r = await fetch("/api/keys");
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setAccessKeys([]);
        setKeysError(d.error ?? `Erreur API /api/keys (${r.status})`);
        return;
      }
      setAccessKeys(d.keys ?? []);
    } catch (error) {
      setAccessKeys([]);
      setKeysError(error instanceof Error ? error.message : "Erreur de chargement des cles.");
    } finally {
      setKeysLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true); setCreateError(null);
    const selectedForm = forms.find(f => f.id === selectedFormId);
    if (!selectedForm) { setCreateError("Sélectionne un formulaire."); setCreating(false); return; }
    const res = await fetch("/api/keys", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        role: newRole,
        formPages: selectedForm.pages ?? [],
        serviceTypeId: selectedServiceTypeId || null,
        bannerUrl: newBannerUrl.trim() || null,
        whatsappGroupName: newWhatsappGroupName.trim() || null,
        whatsappGroupProfileUrl: newWhatsappGroupProfileUrl.trim() || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setCreateError(data.error ?? "Erreur"); setCreating(false); return; }
    setCreatedKey(data.key);
    setNewName(""); setNewRole("client"); setNewBannerUrl(""); setNewWhatsappGroupName(""); setNewWhatsappGroupProfileUrl(""); setShowCreate(false); setCreating(false);
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

  async function loadServiceTypes() {
    setStLoading(true);
    const r = await fetch("/api/service-types");
    const d = await r.json();
    setServiceTypes(d.service_types ?? []);
    setStLoading(false);
  }

  function openNewService() {
    setEditingService(null); setSName(""); setSDesc(""); setSPrice(""); setSStages([]); setSError(null); setShowNewService(true);
  }

  function openEditService(s: ServiceType) {
    setEditingService(s); setSName(s.name); setSDesc(s.description ?? "");
    setSPrice(s.price != null ? String(s.price) : ""); setSStages([...s.stages]); setSError(null); setShowNewService(true);
  }

  function addStage() {
    setSStages(p => [...p, { id: `s_${Date.now()}`, label: "Nouvelle étape", duration_days: 7 }]);
  }

  function updateStage(id: string, field: keyof ServiceStage, value: string | number) {
    setSStages(p => p.map(s => s.id === id ? { ...s, [field]: value } : s));
  }

  function handleStageImage(id: string, file: File) {
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target?.result as string;
      setSStages(p => p.map(s => s.id === id ? { ...s, image_url: dataUrl } : s));
    };
    reader.readAsDataURL(file);
  }

  function removeStage(id: string) { setSStages(p => p.filter(s => s.id !== id)); }

  async function saveService(e: React.FormEvent) {
    e.preventDefault();
    if (!sName.trim()) { setSError("Nom requis"); return; }
    setSSaving(true); setSError(null);
    const body = { name: sName.trim(), description: sDesc.trim() || null, price: sPrice ? Number(sPrice) : null, stages: sStages };
    const url = editingService ? `/api/service-types/${editingService.id}` : "/api/service-types";
    const method = editingService ? "PUT" : "POST";
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) { setSError(d.error ?? "Erreur"); setSSaving(false); return; }
    setShowNewService(false); loadServiceTypes(); setSSaving(false);
  }

  async function deleteService(id: string) {
    if (!confirm("Supprimer cette prestation ?")) return;
    await fetch(`/api/service-types/${id}`, { method: "DELETE" });
    loadServiceTypes();
  }

  const handleChange = (key: string, value: string) => setEditingKeys(p => ({ ...p, [key]: value }));
  const getValue = (key: string) => editingKeys[key] !== undefined ? editingKeys[key] : savedKeys[key] ?? "";
  const toggleVisible = (key: string) => setVisibleKeys(p => ({ ...p, [key]: !p[key] }));
  const handleSave = (integrationId: string, fields: Integration["fields"]) => {
    const updates: Record<string, string> = {};
    fields.forEach(f => { if (editingKeys[f.key] !== undefined) updates[f.key] = editingKeys[f.key]; });
    setSavedKeys(p => ({ ...p, ...updates }));
    setSavedStatus(p => ({ ...p, [integrationId]: true }));
    setTimeout(() => setSavedStatus(p => ({ ...p, [integrationId]: false })), 2500);
  };

  const integrations: Integration[] = [
    {
      id: "greenapi", name: "WhatsApp — Green API",
      description: "Envoyez et recevez des messages WhatsApp depuis le dashboard.",
      icon: <MessageSquare size={20} />, iconStyle: { background: "#d1fae5", color: "#168b64" },
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
      icon: <Figma size={20} />, iconStyle: { background: "#ede9fe", color: "#7c3aed" },
      status: savedKeys["figma_token"] ? "connected" : "disconnected",
      fields: [{ key: "figma_token", label: "Token d'accès personnel", placeholder: "figd_...", helpUrl: "https://www.figma.com/settings", helpText: "figma.com → Paramètres → Security → Personal access tokens", type: "password" }],
    },
    {
      id: "claude", name: "Claude AI (Anthropic)",
      description: "Active le bouton \"Peaufiner avec IA\" dans la messagerie.",
      icon: <Sparkles size={20} />, iconStyle: { background: "#fee6d0", color: "#d95b0a" },
      status: savedKeys["claude_api_key"] ? "connected" : "disconnected",
      fields: [{ key: "claude_api_key", label: "Clé API Anthropic", placeholder: "sk-ant-...", helpUrl: "https://console.anthropic.com/settings/keys", helpText: "console.anthropic.com → API Keys → Créer une clé", type: "password" }],
    },
  ];

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 32, maxWidth: 1120, ...jk }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Settings size={20} style={{ color: "rgba(18,26,46,0.4)" }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#121a2e", margin: 0, letterSpacing: "-0.4px" }}>Paramètres</h1>
        </div>
        <p style={{ fontSize: 13, color: "rgba(18,26,46,0.5)", margin: 0 }}>Gérez vos intégrations, prestations et accès clients.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "#f2f2f2", borderRadius: 11, padding: 4, marginBottom: 32, width: "fit-content" }}>
        {([ ["integrations", "Intégrations"], ["ia", "IA & Modèles"], ["services", "Prestations"], ["keys", "Clés d'accès"] ] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", border: "none",
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            ...(tab === id ? { background: "#fff", color: "#121a2e", boxShadow: "0px 1px 4px rgba(0,0,0,0.1)" } : { background: "transparent", color: "rgba(18,26,46,0.55)" }),
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Integrations Tab ── */}
      {tab === "integrations" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {integrations.map(integration => {
            const isConnected = integration.status === "connected";
            const isSaved = savedStatus[integration.id];
            return (
              <div key={integration.id} style={card}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                    <div style={{ padding: 10, borderRadius: 11, ...integration.iconStyle }}>{integration.icon}</div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <h2 style={{ fontSize: 15, fontWeight: 600, color: "#121a2e", margin: 0 }}>{integration.name}</h2>
                        {integration.recommended && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#073e63", background: "#d5eeff", padding: "2px 8px", borderRadius: 20 }}>
                            <Zap size={9} />Recommandé
                          </span>
                        )}
                        {integration.badge && (
                          <span style={{ fontSize: 11, color: "#168b64", background: "#d1fae5", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>{integration.badge}</span>
                        )}
                      </div>
                      <p style={{ fontSize: 13, color: "rgba(18,26,46,0.55)", marginTop: 4, marginBottom: 0 }}>{integration.description}</p>
                    </div>
                  </div>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 20, flexShrink: 0, ...(isConnected ? { background: "#d1fae5", color: "#168b64" } : { background: "#f6f6f6", color: "rgba(18,26,46,0.45)" }) }}>
                    {isConnected ? <CheckCircle2 size={12} /> : <span style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(18,26,46,0.25)", display: "inline-block" }} />}
                    {isConnected ? "Connecté" : "Non connecté"}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {integration.fields.map(field => (
                    <div key={field.key}>
                      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>{field.label}</label>
                      <div style={{ position: "relative" }}>
                        <input
                          type={field.type === "password" && !visibleKeys[field.key] ? "password" : "text"}
                          value={getValue(field.key)}
                          onChange={e => handleChange(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          style={{ ...inp, paddingRight: field.type === "password" ? 40 : 12, fontFamily: "monospace, monospace" }}
                        />
                        {field.type === "password" && (
                          <button type="button" onClick={() => toggleVisible(field.key)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.4)", display: "flex" }}>
                            {visibleKeys[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        )}
                      </div>
                      <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", marginTop: 4 }}>
                        {field.helpText}{" "}
                        <a href={field.helpUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#0147ff", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 2 }}>
                          Obtenir la clé<ExternalLink size={10} />
                        </a>
                      </p>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={() => handleSave(integration.id, integration.fields)} style={{
                    ...btnPri,
                    ...(isSaved ? { background: "#d1fae5", border: "1px solid #168b64", color: "#168b64" } : {}),
                  }}>
                    {isSaved ? <><Check size={14} />Enregistré</> : "Enregistrer"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── IA Tab ── */}
      {tab === "ia" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={card}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
              <div style={{ padding: 10, borderRadius: 11, background: "#E1D1FA", color: "#6236AA" }}><Sparkles size={20} /></div>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: "#121a2e", margin: 0 }}>Mémoire business globale</h2>
                <p style={{ fontSize: 13, color: "rgba(18,26,46,0.55)", marginTop: 4, marginBottom: 0 }}>Ce contexte est injecté dans tous vos prompts IA (coach, copywriting, LinkedIn, leads). Décrivez votre agence, vos cibles, vos valeurs.</p>
              </div>
            </div>
            <textarea
              value={businessContext}
              onChange={e => setBusinessContext(e.target.value)}
              rows={6}
              placeholder="Ex: Je dirige une agence de design web pour PME françaises. Mes services sont : sites vitrine (3 500€), e-commerce (6 500€), identité visuelle (2 000€). Ma cible : entrepreneurs 30-50 ans dans le secteur B2B."
              style={{ ...inp, resize: "vertical", lineHeight: 1.6, height: "auto" }}
            />
          </div>

          <div style={card}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "#121a2e", margin: 0, marginBottom: 4 }}>Modèles IA par fonctionnalité</h2>
            <p style={{ fontSize: 13, color: "rgba(18,26,46,0.55)", marginBottom: 20, marginTop: 0 }}>Choisissez le modèle via OpenRouter pour chaque fonctionnalité IA de l'app.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {([
                ["copywriting", "Copywriting web"], ["linkedin_posts", "Posts LinkedIn"],
                ["linkedin_ideas", "Idées LinkedIn"], ["leads", "Analyse Leads"], ["coach", "Coach IA"],
              ] as const).map(([key, label]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: "#121a2e", width: 160, flexShrink: 0 }}>{label}</label>
                  <div style={{ position: "relative", flex: 1 }}>
                    <select
                      value={aiModels[key]}
                      onChange={e => setAiModels(m => ({ ...m, [key]: e.target.value }))}
                      style={{ ...inp, paddingRight: 36, appearance: "none" }}
                    >
                      <optgroup label="OpenAI">
                        <option value="openai/gpt-4o">GPT-4o (puissant)</option>
                        <option value="openai/gpt-4o-mini">GPT-4o Mini (rapide & éco)</option>
                      </optgroup>
                      <optgroup label="Anthropic (Claude)">
                        <option value="anthropic/claude-opus-4">Claude Opus 4 (très puissant)</option>
                        <option value="anthropic/claude-sonnet-4-5">Claude Sonnet 4.5 (équilibré)</option>
                        <option value="anthropic/claude-haiku-4-5">Claude Haiku 4.5 (rapide)</option>
                      </optgroup>
                      <optgroup label="Google (Gemini)">
                        <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash (rapide)</option>
                        <option value="google/gemini-pro-1.5">Gemini Pro 1.5 (puissant)</option>
                      </optgroup>
                      <optgroup label="Mistral AI">
                        <option value="mistralai/mistral-large-2411">Mistral Large (FR natif)</option>
                        <option value="mistralai/mistral-small-3.1-24b-instruct">Mistral Small (rapide)</option>
                      </optgroup>
                      <optgroup label="Meta">
                        <option value="meta-llama/llama-3.3-70b-instruct">Llama 3.3 70B (open source)</option>
                      </optgroup>
                    </select>
                    <ChevronDown size={14} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(18,26,46,0.4)", pointerEvents: "none" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={async () => {
              setIaSaving(true);
              const { agendaFetch } = await import("@/lib/agenda/fetchWithAuth");
              await agendaFetch("/api/app-settings", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ business_context: businessContext, ai_models: aiModels }),
              });
              setIaSaving(false); setIaSaved(true);
              setTimeout(() => setIaSaved(false), 2500);
            }}
            style={{ ...btnPri, ...(iaSaved ? { background: "#d1fae5", border: "1px solid #168b64", color: "#168b64" } : {}), alignSelf: "flex-start" }}
          >
            {iaSaved ? <><CheckCircle2 size={15} />Sauvegardé !</> : iaSaving ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        </div>
      )}

      {/* ── Services Tab ── */}
      {tab === "services" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "#121a2e", margin: 0 }}>Mes prestations</h2>
              <p style={{ fontSize: 13, color: "rgba(18,26,46,0.5)", marginTop: 2, marginBottom: 0 }}>Définissez vos types de projets avec étapes et tarifs.</p>
            </div>
            {!showNewService && (
              <button onClick={openNewService} style={btnPri}>
                <Plus size={14} />Nouvelle prestation
              </button>
            )}
          </div>

          {showNewService && (
            <div style={card}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#121a2e", margin: 0, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <Briefcase size={15} style={{ color: "#0147ff" }} />
                {editingService ? "Modifier la prestation" : "Nouvelle prestation"}
              </h3>
              {sError && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", background: "#fff0f0", border: "1px solid #fcc", borderRadius: 9, marginBottom: 16 }}>
                  <AlertCircle size={14} style={{ color: "#e53e3e", marginTop: 1 }} />
                  <p style={{ fontSize: 13, color: "#c53030", margin: 0 }}>{sError}</p>
                </div>
              )}
              <form onSubmit={saveService} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>Nom de la prestation <span style={{ color: "#e53e3e" }}>*</span></label>
                    <input value={sName} onChange={e => setSName(e.target.value)} placeholder="Ex : Site vitrine..." required style={inp} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>Prix (€)</label>
                    <div style={{ position: "relative" }}>
                      <Euro size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(18,26,46,0.4)" }} />
                      <input type="number" value={sPrice} onChange={e => setSPrice(e.target.value)} placeholder="Ex : 2500" style={{ ...inp, paddingLeft: 30 }} />
                    </div>
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>Description (optionnelle)</label>
                  <input value={sDesc} onChange={e => setSDesc(e.target.value)} placeholder="Brève description de la prestation" style={inp} />
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: "#121a2e" }}>Étapes du projet</label>
                    <button type="button" onClick={addStage} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#0147ff", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                      <Plus size={12} />Ajouter une étape
                    </button>
                  </div>
                  {sStages.length === 0 ? (
                    <p style={{ fontSize: 13, color: "rgba(18,26,46,0.35)", padding: "12px 0", textAlign: "center", border: "1px dashed rgba(0,0,0,0.12)", borderRadius: 9 }}>
                      Aucune étape définie. Cliquez sur &quot;Ajouter une étape&quot;.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {sStages.map((stage, idx) => {
                        const imgInputId = `stage-img-${stage.id}`;
                        return (
                          <div key={stage.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#f6f6f6", borderRadius: 9, border: "1px solid rgba(0,0,0,0.07)" }}>
                            <span style={{ color: "rgba(18,26,46,0.25)", cursor: "grab", display: "flex" }}><GripVertical size={14} /></span>
                            <span style={{ fontSize: 12, color: "rgba(18,26,46,0.35)", width: 20, flexShrink: 0 }}>{idx + 1}.</span>
                            <label htmlFor={imgInputId} style={{ flexShrink: 0, cursor: "pointer" }}>
                              {stage.image_url ? (
                                <img src={stage.image_url} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", border: "1px solid rgba(0,0,0,0.09)" }} />
                              ) : (
                                <div style={{ width: 32, height: 32, borderRadius: 8, border: "2px dashed rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(18,26,46,0.25)" }}>
                                  <ImageIcon size={13} />
                                </div>
                              )}
                              <input id={imgInputId} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleStageImage(stage.id, f); }} />
                            </label>
                            <input value={stage.label} onChange={e => updateStage(stage.id, "label", e.target.value)} placeholder="Nom de l'étape"
                              style={{ flex: 1, padding: "6px 10px", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 7, fontSize: 13, background: "#fff", outline: "none", fontFamily: '"Plus Jakarta Sans", sans-serif', color: "#121a2e" }} />
                            <input type="number" value={stage.duration_days} onChange={e => updateStage(stage.id, "duration_days", Number(e.target.value))} min={1}
                              style={{ width: 64, padding: "6px 8px", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 7, fontSize: 13, background: "#fff", outline: "none", textAlign: "center", fontFamily: '"Plus Jakarta Sans", sans-serif', color: "#121a2e" }} />
                            <span style={{ fontSize: 12, color: "rgba(18,26,46,0.35)", flexShrink: 0 }}>jours</span>
                            {stage.image_url && (
                              <button type="button" onClick={() => setSStages(p => p.map(s => s.id === stage.id ? { ...s, image_url: undefined } : s))} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.3)", display: "flex" }}>
                                <ImageIcon size={13} />
                              </button>
                            )}
                            <button type="button" onClick={() => removeStage(stage.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.3)", display: "flex" }}>
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                  <button type="submit" disabled={sSaving} style={{ ...btnPri, opacity: sSaving ? 0.7 : 1 }}>
                    {sSaving ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />Enregistrement...</> : <><Check size={14} />{editingService ? "Mettre à jour" : "Créer la prestation"}</>}
                  </button>
                  <button type="button" onClick={() => setShowNewService(false)} style={btnSec}>Annuler</button>
                </div>
              </form>
            </div>
          )}

          {stLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Loader2 size={24} style={{ color: "rgba(18,26,46,0.3)", animation: "spin 1s linear infinite" }} /></div>
          ) : serviceTypes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "64px 24px", ...card }}>
              <Briefcase size={32} style={{ color: "rgba(18,26,46,0.15)", margin: "0 auto 12px" }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: "rgba(18,26,46,0.5)", margin: 0 }}>Aucune prestation créée</p>
              <p style={{ fontSize: 12, color: "rgba(18,26,46,0.35)", marginTop: 4 }}>Créez vos types de projets pour les associer aux liens d&apos;invitation.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {serviceTypes.map(st => (
                <div key={st.id} style={card}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 600, color: "#121a2e", margin: 0 }}>{st.name}</h3>
                        {st.price != null && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#168b64", background: "#d1fae5", padding: "2px 8px", borderRadius: 20 }}>
                            <Euro size={11} />{st.price.toLocaleString("fr-FR")} €
                          </span>
                        )}
                      </div>
                      {st.description && <p style={{ fontSize: 13, color: "rgba(18,26,46,0.5)", marginTop: 2, marginBottom: 0 }}>{st.description}</p>}
                      <p style={{ fontSize: 12, color: "rgba(18,26,46,0.35)", marginTop: 4, marginBottom: 0 }}>
                        {st.stages.length} étape{st.stages.length !== 1 ? "s" : ""}
                        {st.stages.length > 0 && ` · ${st.stages.reduce((n, s) => n + s.duration_days, 0)} jours au total`}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => openEditService(st)} style={{ fontSize: 12, fontWeight: 600, color: "#0147ff", padding: "5px 12px", border: "1px solid #c7d3ff", background: "#e8edff", borderRadius: 8, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Modifier</button>
                      <button onClick={() => deleteService(st.id)} style={{ padding: "5px 10px", border: "1px solid rgba(229,57,53,0.2)", background: "rgba(229,57,53,0.05)", borderRadius: 8, cursor: "pointer", color: "#c53030", display: "flex" }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  {st.stages.length > 0 && (
                    <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {st.stages.map((s, i) => (
                        <span key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.08)", padding: "4px 10px", borderRadius: 20, color: "rgba(18,26,46,0.6)" }}>
                          {s.image_url ? <img src={s.image_url} alt="" style={{ width: 16, height: 16, borderRadius: 4, objectFit: "cover" }} /> : <span style={{ color: "rgba(18,26,46,0.25)", fontSize: 11 }}>{i + 1}.</span>}
                          {s.label}
                          <span style={{ color: "rgba(18,26,46,0.35)" }}>· {s.duration_days}j</span>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "#121a2e", margin: 0 }}>Clés d&apos;accès</h2>
              <p style={{ fontSize: 13, color: "rgba(18,26,46,0.5)", marginTop: 2, marginBottom: 0 }}>Créez un lien unique par client ou prestataire.</p>
            </div>
            {!showCreate && (
              <button onClick={() => { setShowCreate(true); setCreatedKey(null); }} style={btnPri}>
                <Plus size={14} />Créer une clé
              </button>
            )}
          </div>

          {createdKey && (
            <div style={{ background: "#d1fae5", border: "1px solid #168b64", borderRadius: 13, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <CheckCircle2 size={16} style={{ color: "#168b64" }} />
                <p style={{ fontSize: 13, fontWeight: 600, color: "#0a5c40", margin: 0 }}>Lien créé pour <strong>{createdKey.name}</strong></p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input readOnly value={`${typeof window !== "undefined" ? window.location.origin : ""}/access/${createdKey.key}`}
                  style={{ flex: 1, padding: "8px 12px", background: "#fff", border: "1px solid #168b64", borderRadius: 8, fontSize: 12, fontFamily: "monospace, monospace", color: "#121a2e", outline: "none" }} />
                <button onClick={() => copyLink(createdKey.key)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", ...(copied ? { background: "#168b64", color: "#fff" } : { background: "#0a5c40", color: "#fff" }) }}>
                  {copied ? <><Check size={12} />Copié</> : <><Copy size={12} />Copier</>}
                </button>
              </div>
              <button onClick={() => setCreatedKey(null)} style={{ marginTop: 8, fontSize: 12, color: "#168b64", background: "none", border: "none", cursor: "pointer" }}>Fermer</button>
            </div>
          )}

          {showCreate && (
            <div style={card}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#121a2e", margin: 0, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <Key size={15} style={{ color: "#0147ff" }} />Nouvelle clé d&apos;accès
              </h3>
              {createError && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", background: "#fff0f0", border: "1px solid #fcc", borderRadius: 9, marginBottom: 16 }}>
                  <AlertCircle size={14} style={{ color: "#e53e3e", marginTop: 1 }} />
                  <p style={{ fontSize: 13, color: "#c53030", margin: 0 }}>{createError}</p>
                </div>
              )}
              <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>Nom du destinataire</label>
                    <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex : Jean Dupont" required style={inp} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>Type</label>
                    <select value={newRole} onChange={e => setNewRole(e.target.value as "client" | "designer" | "developer")} style={inp}>
                      <option value="client">Client</option>
                      <option value="designer">Prestataire — Designer</option>
                      <option value="developer">Prestataire — Développeur</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>Type de prestation</label>
                  {serviceTypes.length === 0 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: 9, fontSize: 13, color: "#92400e" }}>
                      <AlertCircle size={13} />
                      Aucune prestation.{" "}
                      <button type="button" onClick={() => setTab("services")} style={{ textDecoration: "underline", fontWeight: 600, background: "none", border: "none", cursor: "pointer", color: "#92400e", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                        Créer une prestation
                      </button> d&apos;abord.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderRadius: 9, border: "1px solid rgba(0,0,0,0.09)", cursor: "pointer" }}>
                        <input type="radio" name="service" checked={!selectedServiceTypeId} onChange={() => setSelectedServiceTypeId("")} style={{ accentColor: "#0147ff" }} />
                        <span style={{ fontSize: 13, color: "rgba(18,26,46,0.5)", fontStyle: "italic" }}>Sans prestation spécifique</span>
                      </label>
                      {serviceTypes.map(st => (
                        <label key={st.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", borderRadius: 9, border: `1px solid ${selectedServiceTypeId === st.id ? "#0147ff" : "rgba(0,0,0,0.09)"}`, background: selectedServiceTypeId === st.id ? "#e8edff" : "#fff", cursor: "pointer" }}>
                          <input type="radio" name="service" checked={selectedServiceTypeId === st.id} onChange={() => setSelectedServiceTypeId(st.id)} style={{ accentColor: "#0147ff", marginTop: 2 }} />
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 500, color: selectedServiceTypeId === st.id ? "#0147ff" : "#121a2e", margin: 0 }}>{st.name}</p>
                            <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", marginTop: 2, marginBottom: 0 }}>
                              {st.stages.length} étape{st.stages.length !== 1 ? "s" : ""}
                              {st.price != null && ` · ${st.price.toLocaleString("fr-FR")} €`}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>Bannière du projet <span style={{ color: "rgba(18,26,46,0.4)", fontWeight: 400 }}>(optionnel)</span></label>
                  <input
                    type="url"
                    value={newBannerUrl}
                    onChange={e => setNewBannerUrl(e.target.value)}
                    placeholder="https://... image de bannière"
                    style={inp}
                  />
                  <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", marginTop: 6, marginBottom: 0 }}>
                    Cette image sera appliquée automatiquement quand le projet sera créé via cette clé.
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>Nom du groupe WhatsApp <span style={{ color: "rgba(18,26,46,0.4)", fontWeight: 400 }}>(optionnel)</span></label>
                    <input type="text" value={newWhatsappGroupName} onChange={e => setNewWhatsappGroupName(e.target.value)} placeholder="Ex : Projet {{client}}" style={inp} />
                    <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", marginTop: 6, marginBottom: 0 }}>
                      Stocké seulement pour une future activation WhatsApp. Tu peux utiliser {"{{client}}"} et {"{{project}}"}.
                    </p>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>Photo du groupe WhatsApp <span style={{ color: "rgba(18,26,46,0.4)", fontWeight: 400 }}>(optionnel)</span></label>
                    <input type="url" value={newWhatsappGroupProfileUrl} onChange={e => setNewWhatsappGroupProfileUrl(e.target.value)} placeholder="https://... image de profil" style={inp} />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>Formulaire d&apos;onboarding</label>
                  {forms.length === 0 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: 9, fontSize: 13, color: "#92400e" }}>
                      <AlertCircle size={13} />
                      Aucun formulaire.{" "}
                      <a href="/admin/forms" style={{ textDecoration: "underline", fontWeight: 600, color: "#92400e" }}>Créer un formulaire</a> d&apos;abord.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {forms.map(f => (
                        <label key={f.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", borderRadius: 9, border: `1px solid ${selectedFormId === f.id ? "#0147ff" : "rgba(0,0,0,0.09)"}`, background: selectedFormId === f.id ? "#e8edff" : "#fff", cursor: "pointer" }}>
                          <input type="radio" name="form" checked={selectedFormId === f.id} onChange={() => setSelectedFormId(f.id)} style={{ accentColor: "#0147ff", marginTop: 2 }} />
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 500, color: selectedFormId === f.id ? "#0147ff" : "#121a2e", margin: 0 }}>{f.name}</p>
                            <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", marginTop: 2, marginBottom: 0 }}>
                              {f.pages
                                ? `${f.pages.length} page${f.pages.length !== 1 ? "s" : ""} · ${f.pages.reduce((n, p) => n + p.fields.length, 0)} champs`
                                : `${f.fields?.length ?? 0} champ${(f.fields?.length ?? 0) !== 1 ? "s" : ""}`}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                  <button type="submit" disabled={creating || !selectedFormId} style={{ ...btnPri, opacity: creating || !selectedFormId ? 0.5 : 1, cursor: creating || !selectedFormId ? "not-allowed" : "pointer" }}>
                    {creating ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />Création...</> : <><Key size={14} />Générer le lien</>}
                  </button>
                  <button type="button" onClick={() => setShowCreate(false)} style={btnSec}>Annuler</button>
                </div>
              </form>
            </div>
          )}

          {keysLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Loader2 size={24} style={{ color: "rgba(18,26,46,0.3)", animation: "spin 1s linear infinite" }} /></div>
          ) : keysError ? (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 16, background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 13, color: "#b91c1c", fontSize: 13 }}>
              <AlertCircle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
              <div>
                <p style={{ margin: "0 0 4px", fontWeight: 700 }}>Erreur de chargement des cles</p>
                <p style={{ margin: 0 }}>{keysError}</p>
              </div>
            </div>
          ) : accessKeys.length === 0 ? (
            <div style={{ textAlign: "center", padding: "64px 24px", ...card }}>
              <Key size={32} style={{ color: "rgba(18,26,46,0.15)", margin: "0 auto 12px" }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: "rgba(18,26,46,0.5)", margin: 0 }}>Aucune clé créée</p>
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 13, border: "1px solid rgba(0,0,0,0.1)", overflow: "hidden", width: "100%" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.07)", background: "#f9f9f9" }}>
                    {["Nom", "Type", "Bannière", "WhatsApp", "Statut", "Créé le", ""].map(h => (
                      <th key={h} style={{ padding: "10px 20px", textAlign: h === "" ? "right" : "left", fontSize: 11, fontWeight: 600, color: "rgba(18,26,46,0.45)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accessKeys.map(k => (
                    <tr key={k.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                      <td style={{ padding: "12px 20px", fontSize: 13, fontWeight: 500, color: "#121a2e" }}>{k.name}</td>
                      <td style={{ padding: "12px 20px" }}>
                        <span style={{ fontSize: 12, fontWeight: 500, padding: "3px 8px", borderRadius: 20, ...ROLE_STYLES[k.role] }}>
                          {k.role === "client" ? "Client" : k.role === "developer" ? "Développeur" : "Designer"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 20px", fontSize: 12, color: "rgba(18,26,46,0.5)" }}>
                        {k.banner_url ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#0147ff", fontWeight: 500 }}>
                            <ImageIcon size={12} />Définie
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ padding: "12px 20px", fontSize: 12, color: "rgba(18,26,46,0.55)" }}>
                        {k.whatsapp_group_name ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 500, color: "#168b64" }}>
                            <MessageSquare size={12} />{k.whatsapp_group_name}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ padding: "12px 20px" }}>
                        {k.used_at ? (
                          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, color: "#168b64" }}><UserCheck size={13} />Connecté</span>
                        ) : (
                          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(18,26,46,0.4)" }}><Clock size={13} />En attente</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 20px", fontSize: 12, color: "rgba(18,26,46,0.4)" }}>{new Date(k.created_at).toLocaleDateString("fr-FR")}</td>
                      <td style={{ padding: "12px 20px", textAlign: "right" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
                          <button onClick={() => copyLink(k.key)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#0147ff", background: "none", border: "none", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                            <Copy size={12} />Copier
                          </button>
                          <button onClick={() => handleDelete(k.id)} disabled={deleting === k.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#e53e3e", background: "none", border: "none", cursor: "pointer" }}>
                            {deleting === k.id ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={12} />}
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

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
