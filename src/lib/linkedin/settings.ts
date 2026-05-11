"use client";

import { linkedinFetch } from "@/lib/linkedin/fetchWithAuth";
import { DEFAULT_LINKEDIN_GLOBAL_SYSTEM_PROMPT } from "@/lib/linkedin/post-style-prompts";
import {
  DEFAULT_LINKEDIN_EDIT_ACTION_GENERAL_PROMPT,
  DEFAULT_LINKEDIN_EDIT_ACTIONS,
  normalizeLinkedInEditActions,
  type LinkedInEditAction,
} from "@/lib/linkedin/edit-ai-actions";

export interface LinkedInSettings {
  openrouterApiKey: string;
  model: string;
  businessContext: string;
  postSystemPrompt: string;
  editActionGeneralPrompt: string;
  editActions: LinkedInEditAction[];
  carouselTemplate: string;
  carouselContentModel: string;
  carouselImageModel: string;
  carouselSkillPrompt: string;
  language: string;
  prospectionBigModel: string;
  prospectionSmallModel: string;
  prospectionBigPrompt: string;
  prospectionSmallPrompt: string;
  prospectionAutoAnalysis: boolean;
  prospectionAutoAnalysisEvery: number;
  airtableKey: string;
  airtableBaseId: string;
  airtableTableName: string;
  airtableAutoSync: boolean;
  viralityOpenAiApiKey: string;
  viralityAnalyzerModel: string;
  viralityImageModel: string;
  viralitySystemPrompt: string;
}

export const OPENROUTER_MODELS = [
  { id: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6 - meilleur redacteur" },
  { id: "anthropic/claude-opus-4-6", label: "Claude Opus 4.6 - le plus intelligent" },
  { id: "anthropic/claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 - ultra rapide & leger" },
  { id: "openai/gpt-4o", label: "GPT-4o - excellent toutes taches" },
  { id: "openai/o4-mini", label: "o4-mini - raisonnement rapide" },
  { id: "openai/o3", label: "o3 - raisonnement avance" },
  { id: "google/gemini-2.5-pro-preview", label: "Gemini 2.5 Pro - tres long contexte" },
  { id: "google/gemini-2.5-flash-preview", label: "Gemini 2.5 Flash - rapide & capable" },
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash - economique" },
  { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick - open source" },
  { id: "mistralai/mistral-large-2411", label: "Mistral Large 2411 - tres bon en FR" },
  { id: "deepseek/deepseek-chat-v3-0324", label: "DeepSeek V3 - tres economique" },
];

export const MODELS_BIG = OPENROUTER_MODELS.filter((model) =>
  [
    "anthropic/claude-sonnet-4-6",
    "anthropic/claude-opus-4-6",
    "openai/gpt-4o",
    "openai/o3",
    "google/gemini-2.5-pro-preview",
    "meta-llama/llama-4-maverick",
  ].includes(model.id)
);

export const MODELS_SMALL = OPENROUTER_MODELS.filter((model) =>
  [
    "anthropic/claude-haiku-4-5-20251001",
    "openai/o4-mini",
    "google/gemini-2.5-flash-preview",
    "google/gemini-2.0-flash-001",
    "deepseek/deepseek-chat-v3-0324",
    "mistralai/mistral-large-2411",
    "anthropic/claude-sonnet-4-6",
  ].includes(model.id)
);

export const DEFAULT_CAROUSEL_TEMPLATE = `Pour chaque slide, genere exactement ce format :

TITRE: [3-5 mots - accroche courte et percutante]
SOUS-TITRE: [8-12 mots - developpe et complete le titre]
TEXTE: [2-4 phrases - contenu principal du slide, concret et actionnable]
VISUEL: [1 phrase - description precise du visuel ou image ideale pour ce slide]

---

Slide 1 = accroche / problematique principale
Slides intermediaires = une idee cle par slide
Dernier slide = resume + appel a l'action fort`;

export const CAROUSEL_IMAGE_MODELS = [
  { id: "openai/gpt-image-1", label: "GPT Image 1 - visuels premium" },
  { id: "google/gemini-2.0-flash-preview-image-generation", label: "Gemini Image - rapide" },
];

export const DEFAULT_CAROUSEL_SKILL_PROMPT = `# Role
Tu es un systeme expert de generation de carrousels LinkedIn.

# Objectif
Genere un carrousel coherent slide par slide en respectant strictement :
- le style selectionne
- le nom du carrousel
- la categorie
- le prompt global du carrousel
- le pre-prompt de chaque page
- tous les champs et options de chaque page

# Regles
- N'invente aucun champ hors structure
- Respecte exactement l'intention de chaque slide
- Si une option permet d'afficher ou cacher un element, tiens-en compte dans le texte genere
- Pour les slides avec image, decris precisement l'image attendue pour qu'un modele image puisse la produire
- Garde un ton adapte a LinkedIn, clair, expert, impactant
- Assure une progression logique entre les slides
- Evite les repetitions entre slides`;

export const DEFAULT_BIG_PROMPT = `Analyse les donnees de prospection LinkedIn et cree 3 a 5 squelettes de messages optimises.

Un squelette definit LA STRUCTURE d'un message (ordre des elements, ton, longueur), pas les mots exacts. Il doit capturer ce qui rend les messages performants dans les donnees.

Pour chaque squelette, genere un objet JSON avec :
- "name": nom court et memorable (ex: "Compliment -> Probleme -> Question directe")
- "description": pourquoi ce squelette fonctionne (1-2 phrases)
- "actionTypes": tableau parmi ["liked", "commented", "visited_profile"]
- "structure": le squelette avec etapes numerotees et placeholders [NOM], [DETAIL_CONTEXTE], [QUESTION]
- "promptFragment": instruction courte (2-4 phrases) a injecter dans le prompt de generation pour guider l'IA dans la personnalisation

Reponds UNIQUEMENT avec un tableau JSON valide, sans markdown ni texte autour.`;

export const DEFAULT_SMALL_PROMPT = `Tu es un expert en prospection LinkedIn. Genere un message personnalise, authentique et court (3-5 phrases max).
Regles absolues :
- Commence par le prenom du prospect
- Ne pitche JAMAIS dans le premier message
- Termine par une seule question ouverte simple
- Sonne comme un humain, pas un template
- Si un squelette est fourni, respecte sa structure tout en personnalisant chaque element`;

export const DEFAULT_VIRALITY_PROMPT = `Tu es une IA fine-tunee pour predire les performances de posts LinkedIn.
Analyse le texte, le format, le hook, le rythme, la clarte, le niveau de debat potentiel et l'image decrite.
Retourne uniquement un JSON valide avec:
{
  "likes": nombre_estime,
  "comments": nombre_estime,
  "shares": nombre_estime,
  "ratio": "x%",
  "viralityLevel": "faible|moyen|fort|tres fort",
  "viralityScore": nombre_de_0_a_100,
  "boostingFactors": ["facteur 1", "facteur 2"],
  "limitingFactors": ["facteur 1", "facteur 2"]
}`;

export const DEFAULT_SETTINGS: LinkedInSettings = {
  openrouterApiKey: "",
  model: "anthropic/claude-sonnet-4-6",
  businessContext: "",
  postSystemPrompt: DEFAULT_LINKEDIN_GLOBAL_SYSTEM_PROMPT,
  editActionGeneralPrompt: DEFAULT_LINKEDIN_EDIT_ACTION_GENERAL_PROMPT,
  editActions: DEFAULT_LINKEDIN_EDIT_ACTIONS,
  carouselTemplate: DEFAULT_CAROUSEL_TEMPLATE,
  carouselContentModel: "anthropic/claude-sonnet-4-6",
  carouselImageModel: "openai/gpt-image-1",
  carouselSkillPrompt: DEFAULT_CAROUSEL_SKILL_PROMPT,
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
  viralityOpenAiApiKey: "",
  viralityAnalyzerModel: "",
  viralityImageModel: "qwen/qwen2.5-vl-72b-instruct",
  viralitySystemPrompt: DEFAULT_VIRALITY_PROMPT,
};

export const SETTINGS_KEY = "linkedin_settings";
const PENDING_LINKEDIN_SETTINGS_SYNC_KEY = "linkedin_settings_pending_remote_sync";

function canUseStorage() {
  return typeof window !== "undefined";
}

export function normalizeLinkedInSettings(
  settings?: Partial<LinkedInSettings> | null
): LinkedInSettings {
  const airtableKey = typeof settings?.airtableKey === "string"
    ? settings.airtableKey
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .trim()
        .replace(/^authorization:\s*/i, "")
        .replace(/^Bearer\s+/i, "")
        .replace(/^["'`]+|["'`]+$/g, "")
        .trim()
    : undefined;

  return {
    ...DEFAULT_SETTINGS,
    ...(settings ?? {}),
    editActionGeneralPrompt: typeof settings?.editActionGeneralPrompt === "string"
      ? settings.editActionGeneralPrompt
      : DEFAULT_SETTINGS.editActionGeneralPrompt,
    editActions: normalizeLinkedInEditActions(settings?.editActions),
    airtableKey: airtableKey ?? DEFAULT_SETTINGS.airtableKey,
    airtableBaseId: typeof settings?.airtableBaseId === "string"
      ? settings.airtableBaseId.trim()
      : settings?.airtableBaseId ?? DEFAULT_SETTINGS.airtableBaseId,
    airtableTableName: typeof settings?.airtableTableName === "string"
      ? settings.airtableTableName.trim()
      : settings?.airtableTableName ?? DEFAULT_SETTINGS.airtableTableName,
  };
}

export function loadLinkedInSettings(): LinkedInSettings {
  if (!canUseStorage()) return DEFAULT_SETTINGS;
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) return normalizeLinkedInSettings(JSON.parse(saved) as Partial<LinkedInSettings>);
  } catch {}
  return DEFAULT_SETTINGS;
}

export function saveLinkedInSettingsLocal(settings: LinkedInSettings): LinkedInSettings {
  const normalized = normalizeLinkedInSettings(settings);
  if (canUseStorage()) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

function persistPendingSettings(settings: LinkedInSettings) {
  if (!canUseStorage()) return;
  localStorage.setItem(
    PENDING_LINKEDIN_SETTINGS_SYNC_KEY,
    JSON.stringify(normalizeLinkedInSettings(settings))
  );
}

export function queueRemoteLinkedInSettingsSync(settings: LinkedInSettings): LinkedInSettings {
  const normalized = saveLinkedInSettingsLocal(settings);
  persistPendingSettings(normalized);
  return normalized;
}

function readPendingSettings(): LinkedInSettings | null {
  if (!canUseStorage()) return null;
  const raw = localStorage.getItem(PENDING_LINKEDIN_SETTINGS_SYNC_KEY);
  if (!raw) return null;
  try {
    return normalizeLinkedInSettings(JSON.parse(raw) as Partial<LinkedInSettings>);
  } catch {
    return null;
  }
}

function clearPendingSettings(expected?: LinkedInSettings) {
  if (!canUseStorage()) return;
  if (!expected) {
    localStorage.removeItem(PENDING_LINKEDIN_SETTINGS_SYNC_KEY);
    return;
  }

  const current = readPendingSettings();
  if (!current) return;
  if (JSON.stringify(current) === JSON.stringify(normalizeLinkedInSettings(expected))) {
    localStorage.removeItem(PENDING_LINKEDIN_SETTINGS_SYNC_KEY);
  }
}

export function hasMeaningfulLinkedInSettings(settings: LinkedInSettings): boolean {
  return JSON.stringify(normalizeLinkedInSettings(settings)) !== JSON.stringify(DEFAULT_SETTINGS);
}

export async function fetchRemoteLinkedInSettings(): Promise<LinkedInSettings> {
  const res = await linkedinFetch("/api/linkedin/settings-store", {
    cache: "no-store",
  });
  const responseData = await res.json();
  if (!res.ok) {
    throw new Error(responseData.error || "Impossible de charger les parametres LinkedIn.");
  }
  return saveLinkedInSettingsLocal(normalizeLinkedInSettings(responseData.settings));
}

export async function saveRemoteLinkedInSettings(
  settings: LinkedInSettings
): Promise<LinkedInSettings> {
  const normalized = normalizeLinkedInSettings(settings);
  const res = await linkedinFetch("/api/linkedin/settings-store", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ settings: normalized }),
  });
  const responseData = await res.json();
  if (!res.ok) {
    throw new Error(responseData.error || "Impossible de sauvegarder les parametres LinkedIn.");
  }
  return saveLinkedInSettingsLocal(normalizeLinkedInSettings(responseData.settings));
}

export async function persistRemoteLinkedInSettings(
  settings: LinkedInSettings
): Promise<LinkedInSettings> {
  const normalized = queueRemoteLinkedInSettingsSync(settings);

  try {
    const saved = await saveRemoteLinkedInSettings(normalized);
    clearPendingSettings(saved);
    return saved;
  } catch (error) {
    console.error("LinkedIn settings remote sync failed", error);
    throw error;
  }
}

export async function flushPendingRemoteLinkedInSettings(): Promise<LinkedInSettings | null> {
  const pending = readPendingSettings();
  if (!pending) return null;
  return persistRemoteLinkedInSettings(pending);
}

export function clearLinkedInSettingsLocal(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(PENDING_LINKEDIN_SETTINGS_SYNC_KEY);
}
