"use client";

import { useState, useEffect, useRef } from "react";
import { Settings, X, Eye, EyeOff, Check, ChevronDown, ChevronRight } from "lucide-react";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface LinkedInSettings {
  openrouterApiKey: string;
  model: string;
  carouselTemplate: string;
  language: string;
  // Prospection IA
  prospectionBigModel: string;
  prospectionSmallModel: string;
  prospectionBigPrompt: string;
  prospectionSmallPrompt: string;
  prospectionAutoAnalysis: boolean;
  prospectionAutoAnalysisEvery: number;
  // Airtable
  airtableKey: string;
  airtableBaseId: string;
  airtableTableName: string;
  airtableAutoSync: boolean;
}

export const OPENROUTER_MODELS = [
  // ── Anthropic ──
  { id: "anthropic/claude-sonnet-4-6",          label: "Claude Sonnet 4.6 ⭐ — meilleur rédacteur" },
  { id: "anthropic/claude-opus-4-6",            label: "Claude Opus 4.6 — le plus intelligent" },
  { id: "anthropic/claude-haiku-4-5-20251001",  label: "Claude Haiku 4.5 — ultra rapide & léger" },
  // ── OpenAI ──
  { id: "openai/gpt-4o",                        label: "GPT-4o — excellent toutes tâches" },
  { id: "openai/o4-mini",                       label: "o4-mini — raisonnement rapide" },
  { id: "openai/o3",                            label: "o3 — raisonnement avancé" },
  // ── Google ──
  { id: "google/gemini-2.5-pro-preview",        label: "Gemini 2.5 Pro — très long contexte" },
  { id: "google/gemini-2.5-flash-preview",      label: "Gemini 2.5 Flash — rapide & capable" },
  { id: "google/gemini-2.0-flash-001",          label: "Gemini 2.0 Flash — économique" },
  // ── Meta ──
  { id: "meta-llama/llama-4-maverick",          label: "Llama 4 Maverick — open source" },
  // ── Mistral ──
  { id: "mistralai/mistral-large-2411",         label: "Mistral Large 2411 — très bon en FR" },
  // ── DeepSeek ──
  { id: "deepseek/deepseek-chat-v3-0324",       label: "DeepSeek V3 — très économique" },
];

// Subset for Big AI (heavy analysis)
export const MODELS_BIG = OPENROUTER_MODELS.filter(m =>
  ["anthropic/claude-sonnet-4-6", "anthropic/claude-opus-4-6", "openai/gpt-4o",
   "openai/o3", "google/gemini-2.5-pro-preview", "meta-llama/llama-4-maverick"].includes(m.id)
);

// Subset for Small AI (fast generation)
export const MODELS_SMALL = OPENROUTER_MODELS.filter(m =>
  ["anthropic/claude-haiku-4-5-20251001", "openai/o4-mini", "google/gemini-2.5-flash-preview",
   "google/gemini-2.0-flash-001", "deepseek/deepseek-chat-v3-0324",
   "mistralai/mistral-large-2411", "anthropic/claude-sonnet-4-6"].includes(m.id)
);

export const DEFAULT_CAROUSEL_TEMPLATE = `Pour chaque slide, génère exactement ce format :

TITRE: [3-5 mots — accroche courte et percutante]
SOUS-TITRE: [8-12 mots — développe et complète le titre]
TEXTE: [2-4 phrases — contenu principal du slide, concret et actionnable]
VISUEL: [1 phrase — description précise du visuel ou image idéale pour ce slide]

---

Slide 1 = accroche / problématique principale
Slides intermédiaires = une idée clé par slide
Dernier slide = résumé + appel à l'action fort`;

export const DEFAULT_BIG_PROMPT = `Analyse les données de prospection LinkedIn et crée 3 à 5 squelettes de messages optimisés.

Un squelette définit LA STRUCTURE d'un message (ordre des éléments, ton, longueur), pas les mots exacts. Il doit capturer ce qui rend les messages performants dans les données.

Pour chaque squelette, génère un objet JSON avec :
- "name": nom court et mémorable (ex: "Compliment → Problème → Question directe")
- "description": pourquoi ce squelette fonctionne (1-2 phrases)
- "actionTypes": tableau parmi ["liked", "commented", "visited_profile"]
- "structure": le squelette avec étapes numérotées et placeholders [NOM], [DETAIL_CONTEXTE], [QUESTION]
- "promptFragment": instruction courte (2-4 phrases) à injecter dans le prompt de génération pour guider l'IA dans la personnalisation

Réponds UNIQUEMENT avec un tableau JSON valide, sans markdown ni texte autour.`;

export const DEFAULT_SMALL_PROMPT = `Tu es un expert en prospection LinkedIn. Génère un message personnalisé, authentique et court (3-5 phrases max).
Règles absolues :
- Commence par le prénom du prospect
- Ne pitche JAMAIS dans le premier message
- Termine par une seule question ouverte simple
- Sonne comme un humain, pas un template
- Si un squelette est fourni, respecte sa structure tout en personnalisant chaque élément`;

export const DEFAULT_SETTINGS: LinkedInSettings = {
  openrouterApiKey: "",
  model: "anthropic/claude-sonnet-4-6",
  carouselTemplate: DEFAULT_CAROUSEL_TEMPLATE,
  language: "fr",
  prospectionBigModel: "anthropic/claude-sonnet-4-6",
  prospectionSmallModel: "google/gemini-2.0-flash-001",
  prospectionBigPrompt: DEFAULT_BIG_PROMPT,
  prospectionSmallPrompt: DEFAULT_SMALL_PROMPT,
  prospectionAutoAnalysis: false,
  prospectionAutoAnalysisEvery: 10,
  airtableKey: "",
  airtableBaseId: "",
  airtableTableName: "Prospects LinkedIn",
  airtableAutoSync: false,
};

export const SETTINGS_KEY = "linkedin_settings";

export function loadLinkedInSettings(): LinkedInSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_SETTINGS;
}

async function saveLinkedInSettingsRemote(settings: LinkedInSettings): Promise<LinkedInSettings> {
  const supabase = createSupabaseBrowserClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  const res = await fetch("/api/linkedin/settings-store", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ settings }),
  });
  const responseData = await res.json();
  if (!res.ok) throw new Error(responseData.error || "Impossible de sauvegarder les paramètres LinkedIn.");
  return { ...DEFAULT_SETTINGS, ...(responseData.settings ?? {}) };
}

function InlineToggle({
  checked,
  onClick,
}: {
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      style={{
        position: "relative",
        width: 40,
        height: 20,
        borderRadius: 999,
        background: checked ? "#0A66C2" : "#e5e7eb",
        border: "none",
        cursor: "pointer",
        transition: "background-color 0.2s ease",
        padding: 0,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 22 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transition: "left 0.2s ease",
        }}
      />
    </button>
  );
}

export default function LinkedInLayout({ children }: { children: React.ReactNode }) {
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<LinkedInSettings>(DEFAULT_SETTINGS);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showBigPrompt, setShowBigPrompt] = useState(false);
  const [showSmallPrompt, setShowSmallPrompt] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [saveError, setSaveError] = useState("");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedRemoteRef = useRef(false);
  const lastSavedSnapshotRef = useRef(JSON.stringify(DEFAULT_SETTINGS));

  useEffect(() => {
    const localSettings = loadLinkedInSettings();
    setSettings(localSettings);
    lastSavedSnapshotRef.current = JSON.stringify(localSettings);

    void (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        const res = await fetch("/api/linkedin/settings-store", {
          cache: "no-store",
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        const data = await res.json();
        if (res.ok && data.settings) {
          const merged = { ...DEFAULT_SETTINGS, ...data.settings };
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
          setSettings(merged);
          lastSavedSnapshotRef.current = JSON.stringify(merged);
        }
      } catch {}
      hasLoadedRemoteRef.current = true;
      setBootstrapped(true);
    })();

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!bootstrapped || !hasLoadedRemoteRef.current) return;

    const serialized = JSON.stringify(settings);
    localStorage.setItem(SETTINGS_KEY, serialized);

    if (serialized === lastSavedSnapshotRef.current) return;

    setSaveError("");
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const savedSettings = await saveLinkedInSettingsRemote(settings);
          const savedSnapshot = JSON.stringify(savedSettings);
          localStorage.setItem(SETTINGS_KEY, savedSnapshot);
          lastSavedSnapshotRef.current = savedSnapshot;
        } catch (error) {
          setSaveError(error instanceof Error ? error.message : "Sauvegarde Supabase impossible.");
        }
      })();
    }, 500);
  }, [settings, bootstrapped]);

  const handleSave = async () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setSaveError("");
    try {
      const savedSettings = await saveLinkedInSettingsRemote(settings);
      const savedSnapshot = JSON.stringify(savedSettings);
      localStorage.setItem(SETTINGS_KEY, savedSnapshot);
      lastSavedSnapshotRef.current = savedSnapshot;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Sauvegarde Supabase impossible.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClose = () => {
    setSettings(loadLinkedInSettings());
    setShowSettings(false);
    setSaved(false);
  };

  const resetCarouselTemplate = () =>
    setSettings((s) => ({ ...s, carouselTemplate: DEFAULT_CAROUSEL_TEMPLATE }));

  const hasApiKey = settings.openrouterApiKey.trim().length > 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#0A66C2] rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-black">in</span>
            </div>
            <h1 className="font-bold text-gray-900 text-sm">LinkedIn</h1>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              hasApiKey
                ? "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                : "text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200"
            }`}
          >
            <Settings size={14} />
            {hasApiKey ? "Paramètres IA" : "Configurer l'IA"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden" style={{ zoom: 1.04 }}>
        {bootstrapped ? children : (
          <div className="flex h-full items-center justify-center bg-[#fbfbfb] text-sm text-gray-400">
            Chargement des paramètres LinkedIn...
          </div>
        )}
      </div>

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="font-semibold text-gray-900 text-lg">Paramètres LinkedIn IA</h2>
                <p className="text-xs text-gray-400 mt-0.5">Connexion OpenRouter, modèles et configuration prospection</p>
              </div>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* ── OpenRouter ── */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <div className="w-5 h-5 bg-gray-900 rounded flex items-center justify-center">
                    <span className="text-white text-[9px] font-bold">OR</span>
                  </div>
                  Connexion OpenRouter
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Clé API OpenRouter</label>
                    <div className="relative">
                      <input
                        type={showKey ? "text" : "password"}
                        value={settings.openrouterApiKey}
                        onChange={(e) => setSettings({ ...settings, openrouterApiKey: e.target.value })}
                        placeholder="sk-or-v1-..."
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 focus:border-[#0A66C2] font-mono"
                      />
                      <button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Clé stockée localement. Obtenez-la sur{" "}
                      <span className="text-[#0A66C2] font-medium">openrouter.ai/keys</span>
                    </p>
                    {!hasApiKey && (
                      <p className="text-xs text-amber-600 mt-1 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                        Sans clé personnelle, l&apos;IA utilisera la clé serveur si configurée.
                      </p>
                    )}
                  </div>

                  {/* Modèle général */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Modèle général (posts, idées, copywriting)</label>
                    <div className="relative">
                      <select
                        value={settings.model}
                        onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 pr-8"
                      >
                        {OPENROUTER_MODELS.map((m) => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Langue */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Langue par défaut</label>
                    <div className="flex gap-2">
                      {[{ value: "fr", label: "Français" }, { value: "en", label: "English" }].map((lang) => (
                        <button
                          key={lang.value}
                          onClick={() => setSettings({ ...settings, language: lang.value })}
                          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            settings.language === lang.value
                              ? "bg-[#0A66C2] border-[#0A66C2] text-white"
                              : "border-gray-200 text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Prospection IA ── */}
              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-2">
                  <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                    <span className="text-white text-[9px] font-bold">DM</span>
                  </div>
                  Prospection IA
                </h3>
                <p className="text-xs text-gray-400 mb-4">Deux IA distinctes : la Big AI analyse et crée des squelettes, la Small AI génère les messages personnalisés.</p>

                <div className="space-y-4">
                  {/* Big AI model */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      🧠 Big AI — Analyse & création de squelettes
                    </label>
                    <div className="relative">
                      <select
                        value={settings.prospectionBigModel}
                        onChange={(e) => setSettings({ ...settings, prospectionBigModel: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 pr-8"
                      >
                        {MODELS_BIG.map((m) => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Utilisée pour créer et améliorer les squelettes de messages à partir de vos données.</p>
                  </div>

                  {/* Big AI prompt */}
                  <div>
                    <button
                      onClick={() => setShowBigPrompt((v) => !v)}
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {showBigPrompt ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      Prompt Big AI (avancé)
                    </button>
                    {showBigPrompt && (
                      <div className="mt-2">
                        <textarea
                          value={settings.prospectionBigPrompt}
                          onChange={(e) => setSettings({ ...settings, prospectionBigPrompt: e.target.value })}
                          rows={6}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 resize-none text-gray-700 leading-relaxed"
                        />
                        <button
                          onClick={() => setSettings((s) => ({ ...s, prospectionBigPrompt: DEFAULT_BIG_PROMPT }))}
                          className="text-xs text-gray-400 hover:text-gray-600 mt-1"
                        >
                          Réinitialiser
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Small AI model */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      ⚡ Small AI — Génération des messages
                    </label>
                    <div className="relative">
                      <select
                        value={settings.prospectionSmallModel}
                        onChange={(e) => setSettings({ ...settings, prospectionSmallModel: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 pr-8"
                      >
                        {MODELS_SMALL.map((m) => (
                          <option key={m.id} value={m.id}>{m.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Utilisée pour chaque génération de message — doit être rapide et économique.</p>
                  </div>

                  {/* Small AI prompt */}
                  <div>
                    <button
                      onClick={() => setShowSmallPrompt((v) => !v)}
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {showSmallPrompt ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      Prompt Small AI (avancé)
                    </button>
                    {showSmallPrompt && (
                      <div className="mt-2">
                        <textarea
                          value={settings.prospectionSmallPrompt}
                          onChange={(e) => setSettings({ ...settings, prospectionSmallPrompt: e.target.value })}
                          rows={5}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 resize-none text-gray-700 leading-relaxed"
                        />
                        <button
                          onClick={() => setSettings((s) => ({ ...s, prospectionSmallPrompt: DEFAULT_SMALL_PROMPT }))}
                          className="text-xs text-gray-400 hover:text-gray-600 mt-1"
                        >
                          Réinitialiser
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Auto-analysis */}
                  <div className="flex items-center justify-between py-3 border-t border-gray-100">
                    <div>
                      <p className="text-xs font-medium text-gray-700">Auto-analyse des squelettes</p>
                      <p className="text-xs text-gray-400 mt-0.5">Régénère automatiquement les squelettes tous les N prospects envoyés</p>
                    </div>
                    <InlineToggle
                      checked={settings.prospectionAutoAnalysis}
                      onClick={() => setSettings((s) => ({ ...s, prospectionAutoAnalysis: !s.prospectionAutoAnalysis }))}
                    />
                  </div>
                  {settings.prospectionAutoAnalysis && (
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-gray-600">Analyser tous les</label>
                      <input
                        type="number"
                        min={5}
                        max={100}
                        step={5}
                        value={settings.prospectionAutoAnalysisEvery}
                        onChange={(e) => setSettings((s) => ({ ...s, prospectionAutoAnalysisEvery: Math.max(5, parseInt(e.target.value) || 10) }))}
                        className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30"
                      />
                      <label className="text-xs text-gray-600">prospects envoyés</label>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Airtable ── */}
              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-2">
                  <div className="w-5 h-5 bg-yellow-400 rounded flex items-center justify-center">
                    <span className="text-white text-[9px] font-bold">AT</span>
                  </div>
                  Synchronisation Airtable
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Synchronise vos prospects LinkedIn vers Airtable. <span className="text-green-600 font-medium">Plan gratuit suffisant.</span>
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Personal Access Token (PAT)</label>
                    <input
                      type="password"
                      value={settings.airtableKey}
                      onChange={(e) => setSettings({ ...settings, airtableKey: e.target.value })}
                      placeholder="patXXXXXXXX..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30"
                    />
                    <p className="text-xs text-gray-400 mt-1">Créez-le sur <span className="text-[#0A66C2]">airtable.com/create/tokens</span> avec les scopes <code>data.records:read</code> et <code>data.records:write</code></p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Base ID</label>
                    <input
                      type="text"
                      value={settings.airtableBaseId}
                      onChange={(e) => setSettings({ ...settings, airtableBaseId: e.target.value })}
                      placeholder="appXXXXXXXX"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30"
                    />
                    <p className="text-xs text-gray-400 mt-1">Visible dans l&apos;URL de votre base : airtable.com/<strong>appXXXX</strong>/...</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Nom de la table</label>
                    <input
                      type="text"
                      value={settings.airtableTableName}
                      onChange={(e) => setSettings({ ...settings, airtableTableName: e.target.value })}
                      placeholder="Prospects LinkedIn"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30"
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-xs font-medium text-gray-700">Synchronisation automatique</p>
                      <p className="text-xs text-gray-400 mt-0.5">Synchronise à chaque changement de statut</p>
                    </div>
                    <InlineToggle
                      checked={settings.airtableAutoSync}
                      onClick={() => setSettings((s) => ({ ...s, airtableAutoSync: !s.airtableAutoSync }))}
                    />
                  </div>
                </div>
              </div>

              {/* ── Template carrousel ── */}
              <div className="border-t border-gray-100 pt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800">Template de carrousel</h3>
                  <button onClick={resetCarouselTemplate} className="text-xs text-gray-400 hover:text-gray-600">
                    Réinitialiser
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Ces instructions définissent la structure de chaque slide généré.
                </p>
                <textarea
                  value={settings.carouselTemplate}
                  onChange={(e) => setSettings({ ...settings, carouselTemplate: e.target.value })}
                  rows={10}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 focus:border-[#0A66C2] resize-none text-gray-700 leading-relaxed"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 shrink-0">
              <div className="flex flex-col gap-1">
                <button onClick={handleClose} className="text-left text-sm text-gray-500 hover:text-gray-700">
                  Annuler
                </button>
                {saveError ? (
                  <span className="text-xs text-red-500">{saveError}</span>
                ) : (
                  <span className="text-xs text-gray-400">Sauvegarde automatique vers Supabase activée</span>
                )}
              </div>
              <button
                onClick={handleSave}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  saved ? "bg-green-500 text-white" : "bg-[#0A66C2] text-white hover:bg-[#0057a3]"
                }`}
              >
                {saved ? <><Check size={15} /> Enregistré !</> : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
