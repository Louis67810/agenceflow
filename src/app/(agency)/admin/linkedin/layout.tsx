"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Settings, X, Eye, EyeOff, Check, ChevronDown } from "lucide-react";

const tabs = [
  { href: "/admin/linkedin/posts", label: "Posts" },
  { href: "/admin/linkedin/planification", label: "Planification" },
  { href: "/admin/linkedin/style", label: "Style" },
  { href: "/admin/linkedin/idees", label: "Idées" },
  { href: "/admin/linkedin/prospection", label: "Prospection" },
];

export interface LinkedInSettings {
  openrouterApiKey: string;
  model: string;
  carouselTemplate: string;
  language: string;
}

const OPENROUTER_MODELS = [
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini — rapide & économique" },
  { id: "openai/gpt-4o", label: "GPT-4o — meilleure qualité" },
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet — excellent rédacteur" },
  { id: "anthropic/claude-3-haiku", label: "Claude 3 Haiku — ultra rapide" },
  { id: "google/gemini-flash-1.5", label: "Gemini Flash 1.5 — gratuit (tier)" },
  { id: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B — open source" },
  { id: "mistralai/mistral-large", label: "Mistral Large" },
  { id: "deepseek/deepseek-chat", label: "DeepSeek Chat — économique" },
];

export const DEFAULT_CAROUSEL_TEMPLATE = `Pour chaque slide, génère exactement ce format :

TITRE: [3-5 mots — accroche courte et percutante]
SOUS-TITRE: [8-12 mots — développe et complète le titre]
TEXTE: [2-4 phrases — contenu principal du slide, concret et actionnable]
VISUEL: [1 phrase — description précise du visuel ou image idéale pour ce slide]

---

Slide 1 = accroche / problématique principale
Slides intermédiaires = une idée clé par slide
Dernier slide = résumé + appel à l'action fort`;

export const DEFAULT_SETTINGS: LinkedInSettings = {
  openrouterApiKey: "",
  model: "openai/gpt-4o-mini",
  carouselTemplate: DEFAULT_CAROUSEL_TEMPLATE,
  language: "fr",
};

export const SETTINGS_KEY = "linkedin_settings";

export function loadLinkedInSettings(): LinkedInSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export default function LinkedInLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<LinkedInSettings>(DEFAULT_SETTINGS);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(loadLinkedInSettings());
  }, []);

  const handleSave = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClose = () => {
    // Reset to saved state
    setSettings(loadLinkedInSettings());
    setShowSettings(false);
    setSaved(false);
  };

  const resetCarouselTemplate = () => {
    setSettings((s) => ({ ...s, carouselTemplate: DEFAULT_CAROUSEL_TEMPLATE }));
  };

  const hasApiKey = settings.openrouterApiKey.trim().length > 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Sub-navigation */}
      <div className="bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center px-6">
          <div className="flex items-center gap-2.5 mr-8 py-3.5">
            <div className="w-7 h-7 bg-[#0A66C2] rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-black">in</span>
            </div>
            <h1 className="font-bold text-gray-900">LinkedIn</h1>
          </div>
          <div className="flex items-center gap-0 flex-1">
            {tabs.map((tab) => {
              const isActive = pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-4 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? "border-[#0A66C2] text-[#0A66C2]"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>

          {/* Settings button */}
          <button
            onClick={() => setShowSettings(true)}
            className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              hasApiKey
                ? "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                : "text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200"
            }`}
          >
            <Settings size={14} />
            {hasApiKey ? "Paramètres" : "Configurer l'IA"}
          </button>
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-hidden">{children}</div>

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="font-semibold text-gray-900 text-lg">Paramètres LinkedIn IA</h2>
                <p className="text-xs text-gray-400 mt-0.5">Configurez votre connexion OpenRouter et vos préférences</p>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* OpenRouter section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <div className="w-5 h-5 bg-gray-900 rounded flex items-center justify-center">
                    <span className="text-white text-[9px] font-bold">OR</span>
                  </div>
                  Connexion OpenRouter
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Clé API OpenRouter
                    </label>
                    <div className="relative">
                      <input
                        type={showKey ? "text" : "password"}
                        value={settings.openrouterApiKey}
                        onChange={(e) =>
                          setSettings({ ...settings, openrouterApiKey: e.target.value })
                        }
                        placeholder="sk-or-v1-..."
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 focus:border-[#0A66C2] font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Clé stockée localement dans votre navigateur. Obtenez-la sur{" "}
                      <span className="text-[#0A66C2]">openrouter.ai/keys</span>
                    </p>
                    {!hasApiKey && (
                      <p className="text-xs text-amber-600 mt-1 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                        Sans clé personnelle, l'IA utilisera la clé serveur si configurée.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Modèle IA
                    </label>
                    <div className="relative">
                      <select
                        value={settings.model}
                        onChange={(e) =>
                          setSettings({ ...settings, model: e.target.value })
                        }
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 focus:border-[#0A66C2] pr-8"
                      >
                        {OPENROUTER_MODELS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Modèle utilisé pour générer tous les contenus LinkedIn
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Langue par défaut
                    </label>
                    <div className="flex gap-2">
                      {[
                        { value: "fr", label: "Français" },
                        { value: "en", label: "English" },
                      ].map((lang) => (
                        <button
                          key={lang.value}
                          onClick={() =>
                            setSettings({ ...settings, language: lang.value })
                          }
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

              {/* Carousel template section */}
              <div className="border-t border-gray-100 pt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800">
                    Template de carrousel
                  </h3>
                  <button
                    onClick={resetCarouselTemplate}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Réinitialiser
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Ces instructions définissent la structure de chaque slide généré. L'IA les suivra pour formater le contenu de vos carrousels Figma.
                </p>
                <textarea
                  value={settings.carouselTemplate}
                  onChange={(e) =>
                    setSettings({ ...settings, carouselTemplate: e.target.value })
                  }
                  rows={12}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 focus:border-[#0A66C2] resize-none text-gray-700 leading-relaxed"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="text-xs text-gray-400">Variables disponibles :</span>
                  {["TITRE", "SOUS-TITRE", "TEXTE", "VISUEL", "CTA", "EXEMPLE", "STAT"].map(
                    (v) => (
                      <span
                        key={v}
                        className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono"
                      >
                        {v}:
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 shrink-0">
              <button
                onClick={handleClose}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  saved
                    ? "bg-green-500 text-white"
                    : "bg-[#0A66C2] text-white hover:bg-[#0057a3]"
                }`}
              >
                {saved ? (
                  <>
                    <Check size={15} /> Enregistré !
                  </>
                ) : (
                  "Enregistrer"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
