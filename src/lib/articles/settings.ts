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

export async function fetchRemoteArticleConfig() {
  const res = await fetch("/api/articles/settings-store", { method: "GET" });
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
  const res = await fetch("/api/articles/settings-store", {
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
