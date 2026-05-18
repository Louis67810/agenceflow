export type ArticlePublishingSettings = {
  projectId: string;
  collectionName: string;
  apiToken: string;
  siteUrl: string;
  cloudflareUploadUrl: string;
  cloudflareDestination: string;
  cloudflareAccountId: string;
  cloudflareZoneId: string;
  cloudflareToken: string;
  articleDomain: string;
  googleAnalyticsPropertyId: string;
  googleAnalyticsMeasurementId: string;
  googleAnalyticsApiSecret: string;
  googleAnalyticsServiceAccountJson: string;
  analyticsSiteId: string;
  agentCycleFrequencyHours: string;
  agentPagesPerCycle: string;
  agentResearchModel: string;
  agentCreationModel: string;
  agentAnalysisModel: string;
  agentRecommendationModel: string;
  agentResearchPrompt: string;
  agentCreationPrompt: string;
  agentAnalysisPrompt: string;
  agentRecommendationPrompt: string;
};

export type ArticlePublishingConnection = {
  cloudflareConnected?: boolean;
  cloudflareMessage?: string;
  googleAnalyticsConnected?: boolean;
  googleAnalyticsMessage?: string;
  testedAt?: string;
};

export const ARTICLE_SETTINGS_STORAGE_KEY = "agenceflow.articlePublishingSettings.v1";
export const ARTICLE_CONNECTION_STORAGE_KEY = "agenceflow.articlePublishingConnection.v1";

export const DEFAULT_ARTICLE_SETTINGS: ArticlePublishingSettings = {
  projectId: "",
  collectionName: "Articles",
  apiToken: "",
  siteUrl: "",
  cloudflareUploadUrl: "",
  cloudflareDestination: "/articles/{slug}/index.html",
  cloudflareAccountId: "",
  cloudflareZoneId: "",
  cloudflareToken: "",
  articleDomain: "",
  googleAnalyticsPropertyId: "",
  googleAnalyticsMeasurementId: "",
  googleAnalyticsApiSecret: "",
  googleAnalyticsServiceAccountJson: "",
  analyticsSiteId: "ruff-agency",
  agentCycleFrequencyHours: "24",
  agentPagesPerCycle: "3",
  agentResearchModel: "perplexity/sonar-pro",
  agentCreationModel: "anthropic/claude-sonnet-4",
  agentAnalysisModel: "openai/gpt-4.1",
  agentRecommendationModel: "anthropic/claude-sonnet-4",
  agentResearchPrompt: "Trouve des opportunites d'articles SEO pour les pages ressources Ruff. Priorise les sujets proches de la conversion et indique la source, l'intention et la difficulte estimee.",
  agentCreationPrompt: "Transforme une recommandation validee en brief d'article, plan H2/H3, angle de conversion et brouillon publiable dans Framer.",
  agentAnalysisPrompt: "Analyse les pages ressources avec les donnees AgenceFlow et Google Analytics. Compare vues, visiteurs, temps moyen, scroll, signaux SEO et tire des conclusions actionnables.",
  agentRecommendationPrompt: "A partir de l'analyse, propose les prochains tests: pages a creer, pages a ameliorer, angles a abandonner et priorites du cycle suivant.",
};

export const DEFAULT_ARTICLE_CONNECTION: ArticlePublishingConnection = {};

export function normalizeArticleSettings(settings?: Partial<ArticlePublishingSettings> | null): ArticlePublishingSettings {
  return {
    ...DEFAULT_ARTICLE_SETTINGS,
    ...(settings ?? {}),
  };
}

export function normalizeArticleConnection(connection?: Partial<ArticlePublishingConnection> | null): ArticlePublishingConnection {
  return {
    ...DEFAULT_ARTICLE_CONNECTION,
    ...(connection ?? {}),
  };
}

export function hasMeaningfulArticleSettings(settings: ArticlePublishingSettings) {
  return JSON.stringify(normalizeArticleSettings(settings)) !== JSON.stringify(DEFAULT_ARTICLE_SETTINGS);
}

export function loadLocalArticleSettings(): ArticlePublishingSettings | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ARTICLE_SETTINGS_STORAGE_KEY);
  if (!raw) return null;
  try {
    return normalizeArticleSettings(JSON.parse(raw) as Partial<ArticlePublishingSettings>);
  } catch {
    window.localStorage.removeItem(ARTICLE_SETTINGS_STORAGE_KEY);
    return null;
  }
}

export function loadLocalArticleConnection(): ArticlePublishingConnection | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ARTICLE_CONNECTION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return normalizeArticleConnection(JSON.parse(raw) as Partial<ArticlePublishingConnection>);
  } catch {
    window.localStorage.removeItem(ARTICLE_CONNECTION_STORAGE_KEY);
    return null;
  }
}

export function saveLocalArticleConfig(settings: ArticlePublishingSettings, connection?: ArticlePublishingConnection) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ARTICLE_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeArticleSettings(settings)));
  if (connection) {
    window.localStorage.setItem(ARTICLE_CONNECTION_STORAGE_KEY, JSON.stringify(normalizeArticleConnection(connection)));
  }
}

async function articleConfigFetch(url: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string> | undefined) ?? {}),
  };

  if (typeof window !== "undefined") {
    const { getAccessToken } = await import("@/lib/supabase/client");
    const token = await getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });
}

export async function fetchRemoteArticleConfig() {
  const res = await articleConfigFetch("/api/articles/settings-store", { method: "GET" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Impossible de charger les parametres articles.");
  return {
    settings: normalizeArticleSettings(data.settings),
    connection: normalizeArticleConnection(data.connection),
  };
}

export async function saveRemoteArticleConfig(
  settings: ArticlePublishingSettings,
  connection?: ArticlePublishingConnection
) {
  const res = await articleConfigFetch("/api/articles/settings-store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      settings: normalizeArticleSettings(settings),
      connection: connection ? normalizeArticleConnection(connection) : undefined,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Impossible de sauvegarder les parametres articles.");
  const normalized = {
    settings: normalizeArticleSettings(data.settings),
    connection: normalizeArticleConnection(data.connection),
  };
  saveLocalArticleConfig(normalized.settings, normalized.connection);
  return normalized;
}
