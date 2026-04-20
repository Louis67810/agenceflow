"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Save, ExternalLink, Plus, Trash2, GripVertical,
  Check, ChevronUp, ChevronDown, Eye, Copy, Download, X,
} from "lucide-react";
import { leadMagnetFetch } from "@/lib/lead-magnet/fetchWithAuth";
import {
  DEFAULT_LEAD_MAGNET_AIRTABLE_SETTINGS,
  fetchRemoteLeadMagnetAirtableSettings,
  flushPendingRemoteLeadMagnetAirtableSettings,
  loadLeadMagnetAirtableSettings,
  persistRemoteLeadMagnetAirtableSettings,
  queueRemoteLeadMagnetAirtableSettingsSync,
} from "@/lib/lead-magnet/settings";

type FieldType = "text" | "email" | "phone" | "number" | "url" | "select";
type TabId = "content" | "questions" | "email" | "airtable" | "leads";

interface FieldOption {
  id: string;
  label: string;
  value: string;
  hiddenStepIds?: string[];
}

interface Field {
  id: string;
  type: FieldType;
  label: string;
  placeholder: string;
  required: boolean;
  key: string;
  options?: FieldOption[];
}

interface Step {
  id: string;
  fields: Field[];
}

interface LeadMagnet {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  image_url: string;
  resource_url: string;
  timer_minutes: number | null;
  steps: Step[];
  cta_text: string;
  email_subject: string;
  email_body: string;
  from_name: string;
  airtable_auto_sync: boolean;
  airtable_table_name: string | null;
  status: "draft" | "active" | "paused";
}

type LeadMagnetAirtableSettings = {
  airtableKey: string;
  airtableBaseId: string;
};

interface Lead {
  id: string;
  data: Record<string, string>;
  email: string | null;
  email_sent: boolean;
  created_at: string;
}

function uid() {
  return `id_${Math.random().toString(36).slice(2)}`;
}

function autoKey(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function getDefaultPlaceholder(type: FieldType) {
  if (type === "email") return "Votre adresse email";
  if (type === "phone") return "Votre numero de telephone";
  if (type === "number") return "Entrez un nombre";
  if (type === "url") return "https://...";
  if (type === "select") return "Choisissez une option";
  return "Votre reponse...";
}

function createDefaultOption(index = 1): FieldOption {
  const label = `Option ${index}`;
  return {
    id: uid(),
    label,
    value: autoKey(label) || `option_${index}`,
    hiddenStepIds: [],
  };
}

const FIELD_TYPE_LABELS: Partial<Record<FieldType, string>> = {
  text: "Texte",
  email: "Email",
  phone: "Téléphone",
};

const FIELD_TYPE_OPTIONS: Array<{ value: FieldType; label: string }> = [
  { value: "text", label: "Texte" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Telephone" },
  { value: "number", label: "Nombre" },
  { value: "url", label: "URL" },
  { value: "select", label: "Choix" },
];

const STATUS_STYLES = {
  active: "bg-green-100 text-green-700",
  draft: "bg-gray-100 text-gray-600",
  paused: "bg-amber-100 text-amber-700",
};

export default function LeadMagnetEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [magnet, setMagnet] = useState<LeadMagnet | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("content");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [imagePreviewError, setImagePreviewError] = useState(false);
  const [editingSelectFieldId, setEditingSelectFieldId] = useState<string | null>(null);
  const [airtableSettings, setAirtableSettings] = useState<LeadMagnetAirtableSettings>(
    DEFAULT_LEAD_MAGNET_AIRTABLE_SETTINGS
  );
  const [airtableSyncMsg, setAirtableSyncMsg] = useState<string | null>(null);
  const [syncingAirtable, setSyncingAirtable] = useState(false);
  const airtableBootstrappedRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSettingsSnapshotRef = useRef(JSON.stringify(DEFAULT_LEAD_MAGNET_AIRTABLE_SETTINGS));
  const lastSavedMagnetSnapshotRef = useRef(JSON.stringify({ airtable_auto_sync: false, airtable_table_name: null }));

  const siteUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "";


  const describeAirtableState = useCallback(
    (nextSettings: LeadMagnetAirtableSettings, nextMagnet?: Pick<LeadMagnet, "airtable_auto_sync" | "airtable_table_name" | "title"> | null) => {
      const baseLabel = nextSettings.airtableBaseId.trim() ? "Airtable configure" : "Airtable non configure";
      const targetLabel = nextMagnet?.airtable_table_name?.trim() || `LM - ${nextMagnet?.title || ""}`;
      const magnetLabel = nextMagnet?.airtable_auto_sync ? `auto sync active · ${targetLabel}` : "auto sync desactive";
      return `Supabase actif · ${baseLabel} · ${magnetLabel}`;
    },
    []
  );

  useEffect(() => {
    void Promise.all([fetchMagnet(), fetchAirtableSettings()]);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [id]);

  useEffect(() => {
    if (activeTab === "leads") fetchLeads();
  }, [activeTab]);

  async function fetchMagnet() {
    setLoading(true);
    try {
      const res = await fetch(`/api/lead-magnet/${id}`);
      const data = await res.json();
      if (data.magnet) {
        setMagnet(data.magnet);
        lastSavedMagnetSnapshotRef.current = JSON.stringify({
          airtable_auto_sync: Boolean(data.magnet.airtable_auto_sync),
          airtable_table_name: data.magnet.airtable_table_name ?? null,
        });
      }
    } catch {}
    setLoading(false);
  }

  async function fetchAirtableSettings() {
    try {
      const localSettings = loadLeadMagnetAirtableSettings();
      setAirtableSettings(localSettings);
      lastSavedSettingsSnapshotRef.current = JSON.stringify(localSettings);

      await flushPendingRemoteLeadMagnetAirtableSettings();

      const remoteSettings = await fetchRemoteLeadMagnetAirtableSettings();
      setAirtableSettings(remoteSettings);
      lastSavedSettingsSnapshotRef.current = JSON.stringify(remoteSettings);
      setAirtableSyncMsg("✓ Configuration Airtable chargee depuis Supabase");
    } catch (error) {
      setAirtableSyncMsg(`❌ ${error instanceof Error ? error.message : "Chargement Airtable impossible."}`);
    } finally {
      airtableBootstrappedRef.current = true;
    }
  }

  async function fetchLeads() {
    setLeadsLoading(true);
    try {
      const res = await fetch(`/api/lead-magnet/${id}/leads`);
      const data = await res.json();
      setLeads(data.leads ?? []);
    } catch {}
    setLeadsLoading(false);
  }

  const handleAirtablePull = useCallback(async () => {
    if (!magnet) return;
    if (!airtableSettings.airtableKey || !airtableSettings.airtableBaseId || !magnet.airtable_table_name) {
      setAirtableSyncMsg("⚠️ Configurez Airtable dans les parametres ci-dessous");
      return;
    }

    setSyncingAirtable(true);
    try {
      const res = await leadMagnetFetch(`/api/lead-magnet/${id}/airtable-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "pull" }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setAirtableSyncMsg(`❌ ${data.error || "Import Airtable impossible"}`);
        return;
      }
      setAirtableSyncMsg(`✓ ${data.message || "Airtable connecte"}`);
    } catch (error) {
      console.error(error);
      setAirtableSyncMsg("❌ Erreur reseau");
    } finally {
      setSyncingAirtable(false);
    }
  }, [airtableSettings.airtableBaseId, airtableSettings.airtableKey, id, magnet]);

  const handleAirtablePush = useCallback(async () => {
    if (!magnet) return;
    if (!airtableSettings.airtableKey || !airtableSettings.airtableBaseId || !magnet.airtable_table_name) {
      setAirtableSyncMsg("⚠️ Configurez Airtable dans les parametres ci-dessous");
      return;
    }

    setSyncingAirtable(true);
    try {
      const res = await leadMagnetFetch(`/api/lead-magnet/${id}/airtable-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "push" }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setAirtableSyncMsg(`❌ ${data.error || "Synchronisation Airtable impossible"}`);
        return;
      }
      setAirtableSyncMsg(`✓ ${data.message || `${data.recordsCreated || 0} synchronises`}`);
    } catch (error) {
      console.error(error);
      setAirtableSyncMsg("❌ Erreur reseau");
    } finally {
      setSyncingAirtable(false);
    }
  }, [airtableSettings.airtableBaseId, airtableSettings.airtableKey, id, magnet]);

  useEffect(() => {
    if (!airtableBootstrappedRef.current || !magnet) return;
    if (!airtableSettings.airtableKey || !airtableSettings.airtableBaseId || !magnet.airtable_table_name) return;
    void handleAirtablePull();
  }, [airtableSettings.airtableBaseId, airtableSettings.airtableKey, magnet, handleAirtablePull]);

  const persistAirtableConfig = useCallback(
    async (nextSettings: LeadMagnetAirtableSettings, nextMagnet: LeadMagnet) => {
      setSyncingAirtable(true);
      setAirtableSyncMsg("Synchronisation Airtable...");

      try {
        const savedSettings = await persistRemoteLeadMagnetAirtableSettings(nextSettings);
        const magnetRes = await leadMagnetFetch(`/api/lead-magnet/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            airtable_auto_sync: nextMagnet.airtable_auto_sync,
            airtable_table_name: nextMagnet.airtable_table_name,
          }),
        });
        const magnetData = await magnetRes.json();

        if (!magnetRes.ok) {
          throw new Error(magnetData.error || "Impossible de sauvegarder la config Airtable du lead magnet.");
        }

        const settingsSnapshot = JSON.stringify(savedSettings);
        const magnetSnapshot = JSON.stringify({
          airtable_auto_sync: Boolean(nextMagnet.airtable_auto_sync),
          airtable_table_name: nextMagnet.airtable_table_name ?? null,
        });

        lastSavedSettingsSnapshotRef.current = settingsSnapshot;
        lastSavedMagnetSnapshotRef.current = magnetSnapshot;
        setAirtableSyncMsg(`✓ ${describeAirtableState(savedSettings, nextMagnet)}`);

        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sauvegarde Airtable impossible.";
        setAirtableSyncMsg(`❌ ${message}`);
      } finally {
        setSyncingAirtable(false);
      }
    },
    [describeAirtableState, id]
  );

  async function handleSave() {
    if (!magnet) return;
    setSaving(true);
    setAirtableSyncMsg("Sauvegarde du lead magnet...");
    try {
      const [magnetRes, settingsRes] = await Promise.all([
        leadMagnetFetch(`/api/lead-magnet/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: magnet.title,
            subtitle: magnet.subtitle,
            image_url: magnet.image_url,
            resource_url: magnet.resource_url,
            timer_minutes: magnet.timer_minutes,
            steps: magnet.steps,
            cta_text: magnet.cta_text,
            email_subject: magnet.email_subject,
            email_body: magnet.email_body,
            from_name: magnet.from_name,
            status: magnet.status,
            slug: magnet.slug,
            airtable_auto_sync: magnet.airtable_auto_sync,
            airtable_table_name: magnet.airtable_table_name,
          }),
        }),
        leadMagnetFetch("/api/lead-magnet/settings-store", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: airtableSettings }),
        }),
      ]);

      if (!magnetRes.ok || !settingsRes.ok) {
        throw new Error("Impossible de sauvegarder la configuration Lead Magnet.");
      }

      setAirtableSyncMsg("✓ Contenu du lead magnet et configuration Airtable sauvegardes dans Supabase");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      setAirtableSyncMsg(`❌ ${error instanceof Error ? error.message : "Sauvegarde du lead magnet impossible."}`);
    }
    setSaving(false);
  }

  function update<K extends keyof LeadMagnet>(key: K, value: LeadMagnet[K]) {
    setMagnet((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  useEffect(() => {
    if (!airtableBootstrappedRef.current || !magnet) return;

    const queuedSettings = queueRemoteLeadMagnetAirtableSettingsSync(airtableSettings);
    const settingsSnapshot = JSON.stringify(queuedSettings);
    const magnetSnapshot = JSON.stringify({
      airtable_auto_sync: Boolean(magnet.airtable_auto_sync),
      airtable_table_name: magnet.airtable_table_name ?? null,
    });

    if (
      settingsSnapshot === lastSavedSettingsSnapshotRef.current
      && magnetSnapshot === lastSavedMagnetSnapshotRef.current
    ) {
      return;
    }

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(() => {
      void persistAirtableConfig(queuedSettings, magnet);
    }, 350);
  }, [airtableSettings, magnet?.airtable_auto_sync, magnet?.airtable_table_name, magnet, persistAirtableConfig]);

  // ─── Steps / Fields helpers ────────────────────────────────────────────────

  function addStep() {
    if (!magnet) return;
    const newStep: Step = {
      id: uid(),
      fields: [
        {
          id: uid(),
          type: "text",
          label: "Nouvelle question",
          placeholder: getDefaultPlaceholder("text"),
          required: false,
          key: "question_" + (magnet.steps.length + 1),
          options: [],
        },
      ],
    };
    update("steps", [...magnet.steps, newStep]);
  }

  function removeStep(stepId: string) {
    if (!magnet) return;
    update("steps", magnet.steps.filter((s) => s.id !== stepId));
  }

  function moveStep(stepId: string, dir: "up" | "down") {
    if (!magnet) return;
    const idx = magnet.steps.findIndex((s) => s.id === stepId);
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === magnet.steps.length - 1) return;
    const steps = [...magnet.steps];
    const newIdx = dir === "up" ? idx - 1 : idx + 1;
    [steps[idx], steps[newIdx]] = [steps[newIdx], steps[idx]];
    update("steps", steps);
  }

  function updateField(stepId: string, fieldId: string, patch: Partial<Field>) {
    if (!magnet) return;
    update(
      "steps",
      magnet.steps.map((step) =>
        step.id !== stepId
          ? step
          : {
              ...step,
              fields: step.fields.map((f) =>
                f.id !== fieldId ? f : { ...f, ...patch }
              ),
            }
      )
    );
  }

  function addOption(stepId: string, fieldId: string) {
    if (!magnet) return;
    update(
      "steps",
      magnet.steps.map((step) =>
        step.id !== stepId
          ? step
          : {
              ...step,
              fields: step.fields.map((field) =>
                field.id !== fieldId
                  ? field
                  : {
                      ...field,
                      options: [...(field.options ?? []), createDefaultOption((field.options?.length ?? 0) + 1)],
                    }
              ),
            }
      )
    );
  }

  function updateOption(stepId: string, fieldId: string, optionId: string, patch: Partial<FieldOption>) {
    if (!magnet) return;
    update(
      "steps",
      magnet.steps.map((step) =>
        step.id !== stepId
          ? step
          : {
              ...step,
              fields: step.fields.map((field) =>
                field.id !== fieldId
                  ? field
                  : {
                      ...field,
                      options: (field.options ?? []).map((option) => {
                        if (option.id !== optionId) return option;
                        const next = { ...option, ...patch };
                        if (patch.label !== undefined && patch.value === undefined) {
                          next.value = autoKey(patch.label) || next.value;
                        }
                        return next;
                      }),
                    }
              ),
            }
      )
    );
  }

  function removeOption(stepId: string, fieldId: string, optionId: string) {
    if (!magnet) return;
    update(
      "steps",
      magnet.steps.map((step) =>
        step.id !== stepId
          ? step
          : {
              ...step,
              fields: step.fields.map((field) =>
                field.id !== fieldId
                  ? field
                  : {
                      ...field,
                      options: (field.options ?? []).filter((option) => option.id !== optionId),
                    }
              ),
            }
      )
    );
  }

  function toggleOptionHiddenStep(stepId: string, fieldId: string, optionId: string, hiddenStepId: string) {
    if (!magnet) return;
    update(
      "steps",
      magnet.steps.map((step) =>
        step.id !== stepId
          ? step
          : {
              ...step,
              fields: step.fields.map((field) =>
                field.id !== fieldId
                  ? field
                  : {
                      ...field,
                      options: (field.options ?? []).map((option) => {
                        if (option.id !== optionId) return option;
                        const current = option.hiddenStepIds ?? [];
                        return {
                          ...option,
                          hiddenStepIds: current.includes(hiddenStepId)
                            ? current.filter((id) => id !== hiddenStepId)
                            : [...current, hiddenStepId],
                        };
                      }),
                    }
              ),
            }
      )
    );
  }

  function addField(stepId: string) {
    if (!magnet) return;
    const newField: Field = {
      id: uid(),
      type: "text",
      label: "Nouveau champ",
      placeholder: getDefaultPlaceholder("text"),
      required: false,
      key: "champ_" + uid().slice(3, 7),
      options: [],
    };
    update(
      "steps",
      magnet.steps.map((s) =>
        s.id === stepId ? { ...s, fields: [...s.fields, newField] } : s
      )
    );
  }

  function removeField(stepId: string, fieldId: string) {
    if (!magnet) return;
    update(
      "steps",
      magnet.steps.map((s) =>
        s.id !== stepId
          ? s
          : { ...s, fields: s.fields.filter((f) => f.id !== fieldId) }
      )
    );
  }

  // ─── CSV export ────────────────────────────────────────────────────────────

  function exportCsv() {
    if (leads.length === 0) return;
    const keys = Array.from(
      new Set(leads.flatMap((l) => Object.keys(l.data)))
    );
    const header = ["Date", ...keys, "Email envoyé"].join(",");
    const rows = leads.map((l) => {
      const date = new Date(l.created_at).toLocaleDateString("fr-FR");
      const vals = keys.map((k) => `"${(l.data[k] || "").replace(/"/g, '""')}"`);
      return [date, ...vals, l.email_sent ? "Oui" : "Non"].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${magnet?.slug || id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Chargement...
      </div>
    );
  }

  if (!magnet) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-3">
        <p className="text-gray-500">Lead magnet introuvable</p>
        <button
          onClick={() => router.push("/admin/lead-magnet")}
          className="text-sm text-gray-600 hover:underline"
        >
          ← Retour
        </button>
      </div>
    );
  }

  const publicUrl = `${siteUrl}/lm/${magnet.slug}`;
  const flatFieldCount = magnet.steps.reduce((s, st) => s + st.fields.length, 0);
  const generatedAirtableTableName = (magnet.airtable_table_name?.trim() || `LM - ${magnet.title}`).slice(0, 100);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/admin/lead-magnet")}
            className="text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={magnet.title}
              onChange={(e) => update("title", e.target.value)}
              className="text-base font-semibold text-gray-900 bg-transparent border-none outline-none w-full truncate"
            />
            <p className="text-xs text-gray-400 mt-0.5 truncate">/lm/{magnet.slug}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Status */}
            <select
              value={magnet.status}
              onChange={(e) => update("status", e.target.value as LeadMagnet["status"])}
              className={`text-xs px-2.5 py-1.5 rounded-full font-medium border-0 cursor-pointer focus:outline-none ${STATUS_STYLES[magnet.status]}`}
            >
              <option value="draft">Brouillon</option>
              <option value="active">Actif</option>
              <option value="paused">Pausé</option>
            </select>

            {/* Copy URL */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(publicUrl);
                setCopiedUrl(true);
                setTimeout(() => setCopiedUrl(false), 2000);
              }}
              className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {copiedUrl ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
              Copier URL
            </button>

            {magnet.status === "active" && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ExternalLink size={13} />
                Voir
              </a>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg font-medium transition-colors ${
                saved
                  ? "bg-green-500 text-white"
                  : "bg-gray-900 text-white hover:bg-gray-700"
              } disabled:opacity-50`}
            >
              {saved ? <Check size={14} /> : <Save size={14} />}
              {saved ? "Enregistré !" : saving ? "Sauvegarde..." : "Enregistrer"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 mt-3 -mb-3">
          {(
            [
              { id: "content", label: "Contenu" },
              { id: "questions", label: `Questions (${flatFieldCount})` },
              { id: "email", label: "Email" },
              { id: "airtable", label: "Airtable" },
              { id: "leads", label: "Leads" },
            ] as { id: TabId; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {/* ── CONTENT TAB ── */}
        {activeTab === "content" && (
          <div className="max-w-2xl mx-auto p-6 space-y-6">
            <Section title="Page publique">
              <Field label="Titre principal">
                <input
                  type="text"
                  value={magnet.title}
                  onChange={(e) => update("title", e.target.value)}
                  placeholder="Ex: Recevez les 100 Hooks LinkedIn pour atteindre 10k abonnés"
                  className="input"
                />
              </Field>
              <Field label="Sous-titre">
                <input
                  type="text"
                  value={magnet.subtitle}
                  onChange={(e) => update("subtitle", e.target.value)}
                  placeholder="Veuillez remplir les champs ci-dessous avant de recevoir votre ressource"
                  className="input"
                />
              </Field>
              <Field label="Slug (URL)" hint={`URL publique : ${publicUrl}`}>
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-gray-900/20 focus-within:border-gray-900">
                  <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-r border-gray-200">/lm/</span>
                  <input
                    type="text"
                    value={magnet.slug}
                    onChange={(e) => update("slug", e.target.value.replace(/[^a-z0-9-]/g, ""))}
                    className="flex-1 px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </Field>
              <Field label="Texte du bouton final">
                <input
                  type="text"
                  value={magnet.cta_text}
                  onChange={(e) => update("cta_text", e.target.value)}
                  placeholder="Accéder à la ressource"
                  className="input"
                />
              </Field>
            </Section>

            <Section title="Ressource">
              <Field
                label="URL de la ressource"
                hint="Lien vers votre ressource (vidéo, page, PDF en ligne...) envoyé par email"
              >
                <input
                  type="url"
                  value={magnet.resource_url}
                  onChange={(e) => update("resource_url", e.target.value)}
                  placeholder="https://exemple.com/ressource"
                  className="input"
                />
              </Field>
              <Field
                label="Image de prévisualisation"
                hint="Affichée floutée sur la page pour donner envie de remplir le formulaire"
              >
                <input
                  type="url"
                  value={magnet.image_url || ""}
                  onChange={(e) => {
                    update("image_url", e.target.value);
                    setImagePreviewError(false);
                  }}
                  placeholder="https://exemple.com/preview.jpg"
                  className="input"
                />
                {magnet.image_url && !imagePreviewError && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-gray-200 h-32">
                    <img
                      src={magnet.image_url}
                      alt="preview"
                      className="w-full h-full object-cover"
                      onError={() => setImagePreviewError(true)}
                    />
                  </div>
                )}
                {imagePreviewError && (
                  <p className="text-xs text-red-500 mt-1">Image inaccessible</p>
                )}
              </Field>
            </Section>

            <Section title="Timer d'urgence (optionnel)">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="timer-toggle"
                  checked={magnet.timer_minutes !== null && magnet.timer_minutes > 0}
                  onChange={(e) =>
                    update("timer_minutes", e.target.checked ? 30 : null)
                  }
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="timer-toggle" className="text-sm text-gray-700">
                  Afficher un compte à rebours
                </label>
              </div>
              {magnet.timer_minutes !== null && magnet.timer_minutes > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={magnet.timer_minutes}
                    onChange={(e) => update("timer_minutes", Number(e.target.value))}
                    className="w-24 input text-center"
                  />
                  <span className="text-sm text-gray-500">minutes</span>
                </div>
              )}
            </Section>
          </div>
        )}

        {/* ── QUESTIONS TAB ── */}
        {activeTab === "questions" && (
          <div className="max-w-2xl mx-auto p-6 space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
              Chaque étape = un écran affiché l'un après l'autre. L'IA collecte les réponses en douceur, une question à la fois.
              <br />
              <span className="text-xs text-blue-500 mt-1 block">
                L'ordre des étapes = l'ordre affiché. Incluez obligatoirement un champ <strong>email</strong> pour envoyer la ressource.
              </span>
            </div>

            {magnet.steps.map((step, stepIdx) => (
              <div
                key={step.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <GripVertical size={14} className="text-gray-300" />
                  <span className="text-sm font-medium text-gray-700">
                    Étape {stepIdx + 1}
                  </span>
                  <div className="flex items-center gap-1 ml-auto">
                    <button
                      onClick={() => moveStep(step.id, "up")}
                      disabled={stepIdx === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => moveStep(step.id, "down")}
                      disabled={stepIdx === magnet.steps.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      onClick={() => removeStep(step.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {step.fields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-start gap-3 bg-gray-50 rounded-lg p-3 border border-gray-100"
                    >
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Type</label>
                          <select
                            value={field.type}
                            onChange={(e) =>
                              updateField(step.id, field.id, {
                                type: e.target.value as FieldType,
                                placeholder: getDefaultPlaceholder(e.target.value as FieldType),
                                options:
                                  e.target.value === "select"
                                    ? (field.options && field.options.length > 0 ? field.options : [createDefaultOption(1)])
                                    : [],
                              })
                            }
                            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                          >
                            {FIELD_TYPE_OPTIONS.map(({ value: optionValue, label }) => (
                              <option key={optionValue} value={optionValue}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Label</label>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) =>
                              updateField(step.id, field.id, {
                                label: e.target.value,
                                key: autoKey(e.target.value) || field.key,
                              })
                            }
                            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Placeholder</label>
                          <input
                            type="text"
                            value={field.placeholder}
                            onChange={(e) =>
                              updateField(step.id, field.id, { placeholder: e.target.value })
                            }
                            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
                          />
                        </div>
                        <div className="flex items-end gap-2 pb-0.5">
                          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) =>
                                updateField(step.id, field.id, { required: e.target.checked })
                              }
                              className="w-3.5 h-3.5"
                            />
                            Obligatoire
                          </label>
                          <span className="text-xs text-gray-300 ml-auto">
                            key: {field.key}
                          </span>
                        </div>
                      </div>
                      {field.type === "select" ? (
                        <div className="mt-3 w-full rounded-lg border border-gray-200 bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-medium text-gray-700">Choix affiches sur l'interface</p>
                              <p className="mt-1 text-xs text-gray-500">
                                Le visiteur verra des boutons cliquables, puis il pourra continuer manuellement.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingSelectFieldId((current) => (current === field.id ? null : field.id))
                              }
                              className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:border-gray-300 hover:text-gray-800"
                            >
                              {editingSelectFieldId === field.id ? "Masquer" : "Configurer les choix"}
                            </button>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {(field.options ?? []).map((option) => (
                              <span
                                key={option.id}
                                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700"
                              >
                                {option.label || option.value || "Option"}
                              </span>
                            ))}
                            {(field.options ?? []).length === 0 ? (
                              <span className="text-xs text-gray-400">Aucune option definie pour l'instant.</span>
                            ) : null}
                          </div>

                          {editingSelectFieldId === field.id ? (
                            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">{field.label || "Question a choix"}</p>
                                  <p className="mt-1 text-xs text-gray-500">
                                    Definis ici les reponses visibles et les etapes a masquer pour chaque choix.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setEditingSelectFieldId(null)}
                                  className="rounded-full border border-gray-200 bg-white p-1.5 text-gray-500 hover:text-gray-700"
                                  aria-label="Fermer le panneau des choix"
                                >
                                  <X size={14} />
                                </button>
                              </div>

                              <div className="mt-4 space-y-3">
                                {(field.options ?? []).map((option, optionIndex) => (
                                  <div key={option.id} className="rounded-xl border border-white bg-white p-3 shadow-sm">
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-xs text-gray-500 mb-1 block">Libelle visible</label>
                                        <input
                                          type="text"
                                          value={option.label}
                                          onChange={(e) =>
                                            updateOption(step.id, field.id, option.id, {
                                              label: e.target.value,
                                            })
                                          }
                                          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-gray-500 mb-1 block">Valeur technique</label>
                                        <input
                                          type="text"
                                          value={option.value}
                                          onChange={(e) =>
                                            updateOption(step.id, field.id, option.id, {
                                              value: e.target.value,
                                            })
                                          }
                                          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none"
                                        />
                                      </div>
                                    </div>

                                    <div className="mt-3">
                                      <p className="text-xs text-gray-500">Si "{option.label || `Option ${optionIndex + 1}`}" est choisi, masquer :</p>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {magnet.steps
                                          .filter((candidateStep) => candidateStep.id !== step.id)
                                          .map((candidateStep, candidateIndex) => {
                                            const checked = (option.hiddenStepIds ?? []).includes(candidateStep.id);
                                            return (
                                              <label
                                                key={candidateStep.id}
                                                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                                                  checked
                                                    ? "border-blue-200 bg-blue-100 text-blue-700"
                                                    : "border-gray-200 bg-white text-gray-600"
                                                }`}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={checked}
                                                  onChange={() =>
                                                    toggleOptionHiddenStep(step.id, field.id, option.id, candidateStep.id)
                                                  }
                                                  className="w-3.5 h-3.5"
                                                />
                                                Etape {candidateIndex + 1}
                                              </label>
                                            );
                                          })}
                                      </div>
                                    </div>

                                    <div className="mt-3 flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() => removeOption(step.id, field.id, option.id)}
                                        className="text-xs text-red-500 hover:text-red-600"
                                        disabled={(field.options ?? []).length <= 1}
                                      >
                                        Supprimer l'option
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="mt-4 flex justify-between">
                                <button
                                  type="button"
                                  onClick={() => addOption(step.id, field.id)}
                                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-800"
                                >
                                  Ajouter une option
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingSelectFieldId(null)}
                                  className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white"
                                >
                                  Fermer
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {step.fields.length > 1 && (
                        <button
                          onClick={() => removeField(step.id, field.id)}
                          className="mt-6 text-gray-300 hover:text-red-500 shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => addField(step.id)}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <Plus size={13} />
                    Ajouter un champ
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={addStep}
              className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              Ajouter une étape
            </button>
          </div>
        )}

        {/* ── EMAIL TAB ── */}
        {activeTab === "email" && (
          <div className="max-w-2xl mx-auto p-6 space-y-6">
            <Section title="Paramètres d'envoi">
              <Field label="Nom expéditeur">
                <input
                  type="text"
                  value={magnet.from_name}
                  onChange={(e) => update("from_name", e.target.value)}
                  placeholder="AgenceFlow"
                  className="input"
                />
              </Field>
              <Field label="Objet de l'email">
                <input
                  type="text"
                  value={magnet.email_subject}
                  onChange={(e) => update("email_subject", e.target.value)}
                  placeholder="🎁 Votre ressource est prête"
                  className="input"
                />
              </Field>
            </Section>

            <Section title="Corps de l'email (HTML)">
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-600 mb-3">
                Variables disponibles :{" "}
                <code className="font-mono bg-blue-100 px-1 rounded">{"{{firstname}}"}</code>{" "}
                <code className="font-mono bg-blue-100 px-1 rounded">{"{{resource_link}}"}</code>
              </div>
              <textarea
                value={magnet.email_body}
                onChange={(e) => update("email_body", e.target.value)}
                rows={14}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900/20 resize-none leading-relaxed"
              />
            </Section>

            <Section title="Aperçu rendu">
              <div
                className="border border-gray-200 rounded-xl p-4 bg-white"
                dangerouslySetInnerHTML={{
                  __html: (magnet.email_body || "")
                    .replace(/\{\{firstname\}\}/g, "Prénom")
                    .replace(/\{\{resource_link\}\}/g, magnet.resource_url || "#"),
                }}
              />
            </Section>
          </div>
        )}

        {/* ── LEADS TAB ── */}
        {activeTab === "airtable" && (
          <div className="max-w-2xl mx-auto p-6 space-y-6">
            <Section title="Base Airtable commune">
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
                Tous les lead magnets utilisent la meme base Airtable, avec une table existante que vous choisissez ici.
                <span className="text-xs text-blue-500 mt-1 block">
                  Cette integration fonctionne comme la prospection : aucune creation automatique de table, on synchronise les lignes dans une table Airtable deja creee.
                </span>
              </div>

              <Field
                label="Token Airtable"
                hint="Scopes recommandes : data.records:read, data.records:write, schema.bases:read et schema.bases:write"
              >
                <input
                  type="password"
                  value={airtableSettings.airtableKey}
                  onChange={(e) =>
                    setAirtableSettings((current) => ({
                      ...current,
                      airtableKey: e.target.value,
                    }))
                  }
                  placeholder="pat..."
                  className="input"
                />
              </Field>

              <Field label="Base ID commune" hint="Exemple : appXXXXXXXXXXXXXX">
                <input
                  type="text"
                  value={airtableSettings.airtableBaseId}
                  onChange={(e) =>
                    setAirtableSettings((current) => ({
                      ...current,
                      airtableBaseId: e.target.value,
                    }))
                  }
                  placeholder="app..."
                  className="input"
                />
              </Field>
            </Section>

            <Section title="Sync de ce lead magnet">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="airtable-sync-toggle"
                  checked={magnet.airtable_auto_sync}
                  onChange={(e) => update("airtable_auto_sync", e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="airtable-sync-toggle" className="text-sm text-gray-700">
                  Activer l&apos;auto sync Airtable pour ce lead magnet
                </label>
              </div>

              <Field
                label="Nom de table Airtable"
                hint="Entrez le nom exact d'une table Airtable deja existante dans cette base."
              >
                <input
                  type="text"
                  value={magnet.airtable_table_name || ""}
                  onChange={(e) => update("airtable_table_name", e.target.value || null)}
                  placeholder="Exemple : Leads Lead Magnet"
                  className="input"
                />
              </Field>

              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                <p className="font-medium text-gray-800">Table cible actuelle</p>
                <p className="mt-1">{generatedAirtableTableName}</p>
                <p className="mt-2 text-xs text-gray-500">
                  La table doit deja exister dans Airtable et contenir les colonnes attendues par la synchronisation du lead magnet.
                </p>
              </div>

              {airtableSyncMsg && (
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
                  <p className={`font-medium ${
                    airtableSyncMsg.startsWith("✓")
                      ? "text-emerald-700"
                      : airtableSyncMsg.startsWith("⚠")
                      ? "text-amber-700"
                      : airtableSyncMsg.startsWith("❌")
                      ? "text-red-600"
                      : "text-gray-700"
                  }`}>
                    {syncingAirtable ? "Synchronisation Airtable..." : airtableSyncMsg}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleAirtablePull()}
                  disabled={syncingAirtable}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Tester la connexion
                </button>
                <button
                  type="button"
                  onClick={() => void handleAirtablePush()}
                  disabled={syncingAirtable}
                  className="rounded-lg bg-[#0A66C2] px-4 py-2 text-sm font-medium text-white hover:bg-[#0057a3] disabled:opacity-60"
                >
                  Synchroniser Airtable
                </button>
              </div>
            </Section>
          </div>
        )}

        {activeTab === "leads" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {leads.length} lead{leads.length > 1 ? "s" : ""} collecté{leads.length > 1 ? "s" : ""}
                </h3>
                <p className="text-sm text-gray-400 mt-0.5">
                  {leads.filter((l) => l.email_sent).length} emails envoyés
                </p>
              </div>
              {leads.length > 0 && (
                <button
                  onClick={exportCsv}
                  className="flex items-center gap-2 text-sm border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download size={14} />
                  Exporter CSV
                </button>
              )}
            </div>

            {leadsLoading ? (
              <div className="text-center py-12 text-gray-400 text-sm">Chargement...</div>
            ) : leads.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-sm">Aucun lead pour l'instant</p>
                <p className="text-xs mt-1">
                  Activez votre lead magnet et partagez l'URL publique
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Date
                      </th>
                      {Array.from(
                        new Set(leads.flatMap((l) => Object.keys(l.data)))
                      ).map((key) => (
                        <th
                          key={key}
                          className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide"
                        >
                          {key}
                        </th>
                      ))}
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Email
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => {
                      const allKeys = Array.from(
                        new Set(leads.flatMap((l) => Object.keys(l.data)))
                      );
                      return (
                        <tr
                          key={lead.id}
                          className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                        >
                          <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                            {new Date(lead.created_at).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          {allKeys.map((key) => (
                            <td key={key} className="px-4 py-3 text-gray-700">
                              {lead.data[key] || "—"}
                            </td>
                          ))}
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                lead.email_sent
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {lead.email_sent ? "✓ Envoyé" : "Non envoyé"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CSS helpers */}
      <style>{`
        .input {
          width: 100%;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input:focus {
          border-color: #111827;
          box-shadow: 0 0 0 3px rgba(17,24,39,0.08);
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}



