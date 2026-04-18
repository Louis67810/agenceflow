"use client";

import { getAccessToken } from "@/lib/supabase/client";

export interface LinkedInSettings {
  openrouterApiKey: string;
  model: string;
  carouselTemplate: string;
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
const PENDING_LINKEDIN_SETTINGS_SYNC_KEY = "linkedin_settings_pending_remote_sync";

function canUseStorage() {
  return typeof window !== "undefined";
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const accessToken = await getAccessToken();
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

export function normalizeLinkedInSettings(
  settings?: Partial<LinkedInSettings> | null
): LinkedInSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...(settings ?? {}),
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
  const res = await fetch("/api/linkedin/settings-store", {
    cache: "no-store",
    headers: await getAuthHeaders(),
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
  const res = await fetch("/api/linkedin/settings-store", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await getAuthHeaders()),
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
