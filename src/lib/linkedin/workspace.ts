import {
  DEFAULT_STYLES,
  type LinkedInIdea,
  type LinkedInProspect,
  type LinkedInStyle,
  type LinkedInWorkspaceData,
  type LinkedInWorkspacePreferences,
  type ProspectionSkeleton,
} from "@/types/linkedin";
import { getAccessToken } from "@/lib/supabase/client";

const WORKSPACE_CACHE_KEY = "linkedin_workspace_cache";
const PENDING_LINKEDIN_WORKSPACE_SYNC_KEY = "linkedin_workspace_pending_remote_sync";
const STYLES_KEY = "linkedin_styles";
const IDEAS_KEY = "linkedin_ideas";
const PROSPECTS_KEY = "linkedin_prospects";
const SKELETONS_KEY = "linkedin_prospection_skeletons";
const IDEAS_LANGUAGE_KEY = "linkedin_ideas_language";
const IDEAS_LAST_GENERATED_KEY = "linkedin_ideas_last_generated";
const PROSPECTION_LANGUAGE_KEY = "linkedin_prospection_language";

export const DEFAULT_LINKEDIN_WORKSPACE_PREFERENCES: LinkedInWorkspacePreferences = {
  ideasLanguage: "fr",
  ideasLastGenerated: null,
  prospectionLanguage: "fr",
};

export const DEFAULT_LINKEDIN_WORKSPACE: LinkedInWorkspaceData = {
  styles: DEFAULT_STYLES,
  ideas: [],
  prospects: [],
  skeletons: [],
  preferences: DEFAULT_LINKEDIN_WORKSPACE_PREFERENCES,
};

async function getAuthHeaders(): Promise<Record<string, string>> {
  const accessToken = await getAccessToken();
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

function persistPendingWorkspace(data: LinkedInWorkspaceData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    PENDING_LINKEDIN_WORKSPACE_SYNC_KEY,
    JSON.stringify(normalizeLinkedInWorkspaceData(data))
  );
}

function readPendingWorkspace(): LinkedInWorkspaceData | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PENDING_LINKEDIN_WORKSPACE_SYNC_KEY);
  if (!raw) return null;
  try {
    return normalizeLinkedInWorkspaceData(JSON.parse(raw) as Partial<LinkedInWorkspaceData>);
  } catch {
    return null;
  }
}

function clearPendingWorkspace(expected?: LinkedInWorkspaceData) {
  if (typeof window === "undefined") return;
  if (!expected) {
    localStorage.removeItem(PENDING_LINKEDIN_WORKSPACE_SYNC_KEY);
    return;
  }

  const current = readPendingWorkspace();
  if (!current) return;
  if (JSON.stringify(current) === JSON.stringify(normalizeLinkedInWorkspaceData(expected))) {
    localStorage.removeItem(PENDING_LINKEDIN_WORKSPACE_SYNC_KEY);
  }
}

export type LinkedInWorkspacePatch = Partial<
  Omit<LinkedInWorkspaceData, "preferences">
> & {
  preferences?: Partial<LinkedInWorkspacePreferences>;
};

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function cloneDefaults(): LinkedInWorkspaceData {
  return {
    styles: [...DEFAULT_STYLES],
    ideas: [],
    prospects: [],
    skeletons: [],
    preferences: { ...DEFAULT_LINKEDIN_WORKSPACE_PREFERENCES },
  };
}

export function normalizeLinkedInWorkspaceData(
  data?: Partial<LinkedInWorkspaceData> | null
): LinkedInWorkspaceData {
  const defaults = cloneDefaults();

  return {
    styles: Array.isArray(data?.styles) && data.styles.length > 0 ? data.styles : defaults.styles,
    ideas: Array.isArray(data?.ideas) ? data.ideas : defaults.ideas,
    prospects: Array.isArray(data?.prospects) ? data.prospects : defaults.prospects,
    skeletons: Array.isArray(data?.skeletons) ? data.skeletons : defaults.skeletons,
    preferences: {
      ...defaults.preferences,
      ...(data?.preferences ?? {}),
    },
  };
}

function readLegacyWorkspace(): Partial<LinkedInWorkspaceData> {
  if (typeof window === "undefined") return {};

  const legacyStyles = parseJson<LinkedInStyle[] | null>(localStorage.getItem(STYLES_KEY), null);
  const legacyIdeas = parseJson<LinkedInIdea[] | null>(localStorage.getItem(IDEAS_KEY), null);
  const legacyProspects = parseJson<LinkedInProspect[] | null>(localStorage.getItem(PROSPECTS_KEY), null);
  const legacySkeletons = parseJson<ProspectionSkeleton[] | null>(localStorage.getItem(SKELETONS_KEY), null);
  const ideasLanguage = localStorage.getItem(IDEAS_LANGUAGE_KEY);
  const ideasLastGenerated = localStorage.getItem(IDEAS_LAST_GENERATED_KEY);
  const prospectionLanguage = localStorage.getItem(PROSPECTION_LANGUAGE_KEY);

  return {
    styles: legacyStyles ?? undefined,
    ideas: legacyIdeas ?? undefined,
    prospects: legacyProspects ?? undefined,
    skeletons: legacySkeletons ?? undefined,
    preferences: {
      ideasLanguage: ideasLanguage === "en" ? "en" : "fr",
      ideasLastGenerated: ideasLastGenerated ?? null,
      prospectionLanguage: prospectionLanguage === "en" ? "en" : "fr",
    },
  };
}

export function syncLinkedInWorkspaceToLegacyStorage(data: LinkedInWorkspaceData): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(STYLES_KEY, JSON.stringify(data.styles));
  localStorage.setItem(IDEAS_KEY, JSON.stringify(data.ideas));
  localStorage.setItem(PROSPECTS_KEY, JSON.stringify(data.prospects));
  localStorage.setItem(SKELETONS_KEY, JSON.stringify(data.skeletons));
  localStorage.setItem(IDEAS_LANGUAGE_KEY, data.preferences.ideasLanguage);
  if (data.preferences.ideasLastGenerated) {
    localStorage.setItem(IDEAS_LAST_GENERATED_KEY, data.preferences.ideasLastGenerated);
  } else {
    localStorage.removeItem(IDEAS_LAST_GENERATED_KEY);
  }
  localStorage.setItem(PROSPECTION_LANGUAGE_KEY, data.preferences.prospectionLanguage);
}

export function saveLinkedInWorkspaceCache(data: LinkedInWorkspaceData): LinkedInWorkspaceData {
  const normalized = normalizeLinkedInWorkspaceData(data);
  if (typeof window !== "undefined") {
    localStorage.setItem(WORKSPACE_CACHE_KEY, JSON.stringify(normalized));
    syncLinkedInWorkspaceToLegacyStorage(normalized);
  }
  return normalized;
}

export function loadLinkedInWorkspaceCache(): LinkedInWorkspaceData {
  if (typeof window === "undefined") return cloneDefaults();

  const cached = parseJson<Partial<LinkedInWorkspaceData> | null>(
    localStorage.getItem(WORKSPACE_CACHE_KEY),
    null
  );
  const legacy = readLegacyWorkspace();

  const merged = normalizeLinkedInWorkspaceData({
    ...legacy,
    ...(cached ?? {}),
    preferences: {
      ...DEFAULT_LINKEDIN_WORKSPACE_PREFERENCES,
      ...(legacy.preferences ?? {}),
      ...(cached?.preferences ?? {}),
    },
  });

  saveLinkedInWorkspaceCache(merged);
  return merged;
}

export function patchLinkedInWorkspaceCache(
  patch: LinkedInWorkspacePatch
): LinkedInWorkspaceData {
  const current = loadLinkedInWorkspaceCache();
  return saveLinkedInWorkspaceCache({
    ...current,
    ...patch,
    preferences: {
      ...current.preferences,
      ...(patch.preferences ?? {}),
    },
  });
}

export function hasMeaningfulLinkedInWorkspaceData(data: LinkedInWorkspaceData): boolean {
  return (
    data.ideas.length > 0 ||
    data.prospects.length > 0 ||
    data.skeletons.length > 0 ||
    data.styles.length !== DEFAULT_STYLES.length ||
    data.styles.some((style, index) => DEFAULT_STYLES[index]?.id !== style.id) ||
    data.preferences.ideasLanguage !== DEFAULT_LINKEDIN_WORKSPACE_PREFERENCES.ideasLanguage ||
    data.preferences.prospectionLanguage !== DEFAULT_LINKEDIN_WORKSPACE_PREFERENCES.prospectionLanguage ||
    Boolean(data.preferences.ideasLastGenerated)
  );
}

export async function fetchRemoteLinkedInWorkspace(): Promise<{
  workspace: LinkedInWorkspaceData;
  hasStoredData: boolean;
}> {
  const res = await fetch("/api/linkedin/workspace-store", {
    cache: "no-store",
    headers: await getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Impossible de charger l'espace LinkedIn.");
  const workspace = saveLinkedInWorkspaceCache(normalizeLinkedInWorkspaceData(data.workspace));
  return {
    workspace,
    hasStoredData: Boolean(data.hasStoredData),
  };
}

export async function patchRemoteLinkedInWorkspace(
  patch: LinkedInWorkspacePatch
): Promise<LinkedInWorkspaceData> {
  const res = await fetch("/api/linkedin/workspace-store", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await getAuthHeaders()),
    },
    body: JSON.stringify({ patch }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Impossible de sauvegarder l'espace LinkedIn.");
  return saveLinkedInWorkspaceCache(normalizeLinkedInWorkspaceData(data.workspace));
}

export async function saveRemoteLinkedInWorkspace(
  workspace: LinkedInWorkspaceData
): Promise<LinkedInWorkspaceData> {
  const normalized = normalizeLinkedInWorkspaceData(workspace);
  const res = await fetch("/api/linkedin/workspace-store", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await getAuthHeaders()),
    },
    body: JSON.stringify({ patch: normalized }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Impossible de sauvegarder l'espace LinkedIn.");
  return saveLinkedInWorkspaceCache(normalizeLinkedInWorkspaceData(data.workspace));
}

export function persistLinkedInWorkspacePatch(
  patch: LinkedInWorkspacePatch
): LinkedInWorkspaceData {
  const optimistic = patchLinkedInWorkspaceCache(patch);
  persistPendingWorkspace(optimistic);
  void saveRemoteLinkedInWorkspace(optimistic)
    .then((saved) => {
      clearPendingWorkspace(saved);
    })
    .catch((error) => {
    console.error(error);
  });
  return optimistic;
}

export async function flushPendingRemoteLinkedInWorkspace(): Promise<LinkedInWorkspaceData | null> {
  const pending = readPendingWorkspace();
  if (!pending) return null;
  const saved = await saveRemoteLinkedInWorkspace(pending);
  clearPendingWorkspace(saved);
  return saved;
}

export function clearLinkedInWorkspaceLocal(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(WORKSPACE_CACHE_KEY);
  localStorage.removeItem(PENDING_LINKEDIN_WORKSPACE_SYNC_KEY);
  localStorage.removeItem(STYLES_KEY);
  localStorage.removeItem(IDEAS_KEY);
  localStorage.removeItem(PROSPECTS_KEY);
  localStorage.removeItem(SKELETONS_KEY);
  localStorage.removeItem(IDEAS_LANGUAGE_KEY);
  localStorage.removeItem(IDEAS_LAST_GENERATED_KEY);
  localStorage.removeItem(PROSPECTION_LANGUAGE_KEY);
}
