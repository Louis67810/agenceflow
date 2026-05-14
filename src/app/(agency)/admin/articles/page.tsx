"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUp,
  BarChart3,
  ChevronDown,
  Eye,
  FileBarChart,
  FileText,
  Hammer,
  Layers,
  Loader2,
  MessageSquareText,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  Video,
} from "lucide-react";
import { fetchRemoteArticleConfig } from "@/lib/articles/settings";

type ArticleTab = "actions" | "ai";
type ArticlePage = {
  id: string;
  title: string;
  url?: string;
  viewsLastWeek?: number;
  visitorsLastWeek?: number;
  sessionsLastWeek?: number;
  clicksLastWeek?: number;
  avgDurationMs?: number;
  maxScrollDepth?: number;
  createdAt: string;
};
type ActionEntry = {
  id: string;
  title: string;
  createdAt: string;
};
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  source?: string;
};
type PageDiscoveryDebug = {
  domain?: string;
  destinationPath?: string;
  fetched?: Array<{ label: string; url: string; ok: boolean; status?: number; bytes?: number; error?: string }>;
  sitemapUrlsFound?: number;
  publicLinksFound?: number;
  candidateUrlsFound?: number;
  rejectedOtherDomain?: number;
  rejectedNotResource?: number;
};

const jk = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;
const cardShadow = "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)";
const sortShadow = "0px 4.71px 3px rgba(0,0,0,0.02), 0px 2.12px 2.12px rgba(0,0,0,0.03), 0px 0.47px 1.18px rgba(0,0,0,0.03)";
const articleChatStorageKey = "agenceflow.articleAiChat.v1";
const articleModelStorageKey = "agenceflow.articleAiModel.v1";
const articlePanelShadow = "0px 18px 48px rgba(1,71,255,0.12), 0px 10px 28px rgba(18,26,46,0.08)";
const articleModelOptions = [
  "anthropic/claude-sonnet-4",
  "openai/gpt-4.1",
  "google/gemini-2.5-pro-preview",
  "google/gemini-2.0-flash-001",
  "perplexity/sonar-pro",
];
const articleSourceActions = [
  { id: "video_summary", label: "Résumer une vidéo", icon: Video, color: "#0147ff" },
  { id: "from_post", label: "Partir d'un post", icon: MessageSquareText, color: "#168b64" },
  { id: "from_carousel", label: "Partir d'un carrousel", icon: Layers, color: "#7c3aed" },
  { id: "from_video_summary", label: "Partir d'un résumé vidéo", icon: FileText, color: "#f97316" },
  { id: "create_video_summary", label: "Créer un résumé vidéo", icon: Sparkles, color: "#0f6bff" },
];

const articlePages: ArticlePage[] = [];
const actionEntries: ActionEntry[] = [];
function formatDuration(ms?: number) {
  if (!ms) return "0s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function normalizePath(value: string) {
  try {
    const url = value.startsWith("http") ? new URL(value) : null;
    const path = url ? url.pathname : value;
    return canonicalPath(path);
  } catch {
    return canonicalPath(value);
  }
}

function canonicalPath(value: string) {
  let path = value.trim();
  if (!path) return "/";
  if (path.startsWith("http")) {
    try {
      path = new URL(path).pathname;
    } catch {
      // Keep the raw value and normalize it below.
    }
  }
  path = path.split("#")[0].split("?")[0] || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/\/index\.html?$/i, "");
  path = path.replace(/\.html?$/i, "");
  path = path.replace(/\/{2,}/g, "/");
  path = path.replace(/\/(ressources|articles|blog)\/\1(?=\/|$)/gi, "/$1");
  path = path.replace(/\/$/, "");
  return path || "/";
}

function titleFromPath(path: string) {
  const slug = path.split("/").filter(Boolean).pop() || path;
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function discoveryBase(destinationPattern?: string) {
  const pattern = destinationPattern || "/articles/{slug}/index.html";
  const base = pattern.includes("{slug}") ? pattern.split("{slug}")[0] : pattern;
  return base.replace(/\/index\.html$/, "").replace(/\/$/, "") || "/";
}

function matchesArticleDestination(path: string, destinationPattern?: string) {
  const normalizedPath = normalizePath(path).toLowerCase();
  const base = discoveryBase(destinationPattern).toLowerCase();
  if (base !== "/" && (normalizedPath === base || normalizedPath.startsWith(`${base}/`))) return true;
  return normalizedPath.includes("/articles/") || normalizedPath.includes("/blog/");
}

function summaryUrl(summary: { url?: string; path?: string }, articleDomain?: string) {
  if (summary.url) return summary.url;
  if (!summary.path || !articleDomain) return summary.path;
  try {
    return new URL(summary.path, articleDomain).toString();
  } catch {
    return summary.path;
  }
}

function summariesToPages(
  summaries: Array<ArticlePage & { path?: string; lastSeenAt?: string | null }>,
  articleDomain?: string,
  destinationPattern?: string
) {
  const matchingSummaries = summaries.filter((summary) => (
    matchesArticleDestination(summary.path || summary.url || "", destinationPattern)
  ));
  const sourceSummaries = matchingSummaries.length > 0 ? matchingSummaries : summaries;

  return sourceSummaries
    .map((summary) => {
      const path = normalizePath(summary.path || summary.url || "");
      const url = summaryUrl(summary, articleDomain);
      return {
        id: path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || crypto.randomUUID(),
        title: titleFromPath(path),
        url,
        viewsLastWeek: summary.viewsLastWeek ?? 0,
        visitorsLastWeek: summary.visitorsLastWeek ?? 0,
        sessionsLastWeek: summary.sessionsLastWeek ?? 0,
        clicksLastWeek: summary.clicksLastWeek ?? 0,
        avgDurationMs: summary.avgDurationMs ?? 0,
        maxScrollDepth: summary.maxScrollDepth ?? 0,
        createdAt: summary.lastSeenAt || summary.createdAt || new Date().toISOString(),
      };
    });
}

function formatDiscoveryDebug(debug?: PageDiscoveryDebug, analyticsMessage?: string) {
  const details: string[] = [];
  if (debug?.destinationPath) details.push(`chemin teste: ${debug.destinationPath}`);
  if (typeof debug?.sitemapUrlsFound === "number") details.push(`URLs sitemap: ${debug.sitemapUrlsFound}`);
  if (typeof debug?.publicLinksFound === "number") details.push(`liens /ressources: ${debug.publicLinksFound}`);
  if (typeof debug?.candidateUrlsFound === "number") details.push(`candidats: ${debug.candidateUrlsFound}`);
  if (typeof debug?.rejectedNotResource === "number") details.push(`hors chemin: ${debug.rejectedNotResource}`);
  if (analyticsMessage) details.push(`stats: ${analyticsMessage}`);

  const failedFetches = (debug?.fetched ?? [])
    .filter((entry) => !entry.ok)
    .slice(0, 4)
    .map((entry) => `${entry.label} ${entry.status ?? "erreur"}: ${entry.url}`);

  if (failedFetches.length > 0) details.push(`echecs: ${failedFetches.join(" | ")}`);
  return details.length > 0 ? `Debug: ${details.join(" · ")}` : "";
}

function dedupePages(pages: ArticlePage[]) {
  const map = new Map<string, ArticlePage>();
  for (const page of pages) {
    const key = normalizePath(page.url || page.id);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, page);
      continue;
    }
    map.set(key, {
      ...existing,
      url: existing.url || page.url,
      viewsLastWeek: (existing.viewsLastWeek ?? 0) + (page.viewsLastWeek ?? 0),
      visitorsLastWeek: Math.max(existing.visitorsLastWeek ?? 0, page.visitorsLastWeek ?? 0),
      sessionsLastWeek: Math.max(existing.sessionsLastWeek ?? 0, page.sessionsLastWeek ?? 0),
      clicksLastWeek: (existing.clicksLastWeek ?? 0) + (page.clicksLastWeek ?? 0),
      avgDurationMs: Math.round(((existing.avgDurationMs ?? 0) + (page.avgDurationMs ?? 0)) / 2),
      maxScrollDepth: Math.max(existing.maxScrollDepth ?? 0, page.maxScrollDepth ?? 0),
    });
  }
  return Array.from(map.values());
}

function BlueCta({ children, onClick }: { children: string; onClick?: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        padding: 6,
        gap: 10,
        width: 286,
        height: 64,
        background: "#E1E5EE",
        boxShadow: "inset 0px 0px 2px rgba(0,0,0,0.1)",
        borderRadius: 15,
        boxSizing: "border-box",
      }}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          padding: "18px 24px",
          gap: 12,
          width: 274,
          height: 52,
          background: "linear-gradient(96.83deg, #4E7EFA 9.99%, #0147FF 82.49%)",
          border: "1px solid #2F4D9D",
          boxShadow: "0px 54px 71px rgba(0,40,54,0.16), 0px 16.2794px 21.4044px rgba(0,40,54,0.130318), 0px 6.76164px 8.8903px rgba(0,40,54,0.1), 0px 2.44555px 3.21545px rgba(0,40,54,0.0696822), inset 0px -3px 0px #0E42C8, inset 0px 2px 6px 4px rgba(0,0,0,0.08), inset 0px 3px 0px rgba(255,255,255,0.5)",
          borderRadius: 10,
          color: "#fff",
          fontFamily: "Inter, sans-serif",
          fontWeight: 500,
          fontSize: 16,
          lineHeight: "102.88%",
          whiteSpace: "nowrap",
          cursor: "pointer",
        }}
      >
        {children}
      </button>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{ height: "100%", display: "grid", placeItems: "center", color: "rgba(18,26,46,0.38)", fontSize: 13, textAlign: "center", padding: 24 }}>
      {label}
    </div>
  );
}

export default function ArticlesPage() {
  const [activeTab, setActiveTab] = useState<ArticleTab>("actions");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatActionsOpen, setChatActionsOpen] = useState(false);
  const [selectedSourceActionId, setSelectedSourceActionId] = useState("");
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [activeModel, setActiveModel] = useState(articleModelOptions[0]);
  const [articleChatLoading, setArticleChatLoading] = useState(false);
  const [detectedPages, setDetectedPages] = useState<ArticlePage[]>([]);
  const [pagesLoading, setPagesLoading] = useState(true);
  const [pagesMessage, setPagesMessage] = useState("Verification de la connexion Cloudflare...");

  const selectedSourceAction = articleSourceActions.find((action) => action.id === selectedSourceActionId) ?? null;
  const filteredModelOptions = articleModelOptions.filter((model) => model.toLowerCase().includes(modelSearch.toLowerCase()));
  const chatComposerRows = Math.min(7, Math.max(2, ...chatInput.split("\n").map((line) => Math.max(2, Math.ceil(line.length / 42)))));

  const sortedPages = useMemo(() => {
    return dedupePages([...articlePages, ...detectedPages]).sort((a, b) => (b.viewsLastWeek ?? 0) - (a.viewsLastWeek ?? 0));
  }, [detectedPages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedMessages = window.localStorage.getItem(articleChatStorageKey);
      const storedModel = window.localStorage.getItem(articleModelStorageKey);
      if (storedMessages) setChatMessages(JSON.parse(storedMessages) as ChatMessage[]);
      if (storedModel) setActiveModel(storedModel);
    } catch {
      window.localStorage.removeItem(articleChatStorageKey);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(articleChatStorageKey, JSON.stringify(chatMessages));
  }, [chatMessages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(articleModelStorageKey, activeModel);
  }, [activeModel]);

  useEffect(() => {
    async function loadCloudflarePages() {
      try {
        const { settings, connection } = await fetchRemoteArticleConfig();
        const loadTrackedPages = async (fallbackMessage?: string, cloudflareDebug?: PageDiscoveryDebug) => {
          const analyticsResponse = await fetch("/api/articles/analytics/summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              siteId: settings.analyticsSiteId || "",
              days: 90,
            }),
          });
          const analyticsData = await analyticsResponse.json();
          if (!analyticsResponse.ok || !Array.isArray(analyticsData.summaries)) {
            setDetectedPages([]);
            setPagesMessage(
              [
                fallbackMessage || analyticsData.message || "Impossible de charger les pages articles.",
              ].filter(Boolean).join(" ")
            );
            return;
          }

          const trackedPages = summariesToPages(
            analyticsData.summaries,
            settings.articleDomain,
            settings.cloudflareDestination
          );

          setDetectedPages(trackedPages);
          setPagesMessage(
            trackedPages.length > 0
              ? `${trackedPages.length} page(s) detectee(s) depuis les statistiques Framer/AgenceFlow.`
              : [
                  fallbackMessage || "Aucune page article detectee dans les statistiques.",
                  `Statistiques lues: ${analyticsData.summaries.length} page(s), mais aucune page /ressources exploitable.`,
                ].filter(Boolean).join(" ")
          );
        };

        if (!connection.cloudflareConnected || !settings.articleDomain) {
          await loadTrackedPages("Cloudflare n'est pas encore connecte pour les articles.");
          return;
        }

        const response = await fetch("/api/articles/cloudflare/pages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            articleDomain: settings.articleDomain,
            destinationPattern: settings.cloudflareDestination,
          }),
        });
        const data = await response.json();

        if (!response.ok) {
          await loadTrackedPages(data.message || "Impossible de charger les pages articles Cloudflare.", data.debug);
          return;
        }

        const cloudflarePages = (data.pages ?? []) as ArticlePage[];
        if (cloudflarePages.length === 0) {
          await loadTrackedPages(data.message || "Aucune page article detectee depuis Cloudflare.", data.debug);
          return;
        }

        setDetectedPages(cloudflarePages);
        setPagesMessage(data.message || `${cloudflarePages.length} page(s) article detectee(s).`);
      } catch {
        setPagesMessage("Impossible de lire les pages articles.");
      } finally {
        setPagesLoading(false);
      }
    }

    void loadCloudflarePages();
  }, []);

  useEffect(() => {
    async function loadAnalytics() {
      if (detectedPages.length === 0) return;

      try {
        const { settings } = await fetchRemoteArticleConfig();
        const response = await fetch("/api/articles/analytics/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            urls: detectedPages.map((page) => page.url).filter(Boolean),
            siteId: settings.analyticsSiteId || "",
          }),
        });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.summaries)) {
          setPagesMessage(data.message || "Pages detectees, mais statistiques analytics indisponibles.");
          return;
        }

        const summaries = new Map<string, Partial<ArticlePage>>(
          data.summaries.map((summary: ArticlePage & { path?: string }) => [summary.url || summary.path || "", summary])
        );

        setDetectedPages((current) => current.map((page) => {
          const summary = page.url ? summaries.get(page.url) : null;
          return summary ? { ...page, ...summary } : page;
        }));
      } catch {
        setPagesMessage("Pages detectees, mais impossible de charger les statistiques analytics.");
      }
    }

    void loadAnalytics();
  }, [detectedPages.length]);

  async function sendMessage() {
    const content = chatInput.trim();
    if (!content) return;
    const sourceLabel = selectedSourceAction?.label;
    setChatMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content, model: activeModel, source: sourceLabel },
    ]);
    setChatInput("");
    setArticleChatLoading(true);
    window.setTimeout(() => {
      setChatMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          model: activeModel,
          source: sourceLabel,
          content: sourceLabel
            ? `${sourceLabel} selectionne. Le branchement Gemini/posts/carrousels sera utilise pour produire le brief article quand l'API de generation sera raccordee.`
            : "Brief recu. Je peux transformer cette demande en plan d'article, brouillon SEO et actions de publication.",
        },
      ]);
      setArticleChatLoading(false);
    }, 250);
  }

  return (
    <main style={{ minHeight: "100vh", background: "#fbfbfb", padding: "52px 64px 56px", color: "#121a2e", ...jk }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, paddingBottom: 24, borderBottom: "1px solid rgba(18,26,46,0.12)" }}>
        <h1 style={{ margin: 0, fontSize: 34, lineHeight: "41px", fontWeight: 750, letterSpacing: "-0.04em" }}>Mes articles</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/admin/articles/parametres" style={{ minHeight: 54, padding: "0 18px", borderRadius: 10, border: "1px solid rgba(18,26,46,0.13)", background: "#fff", color: "#121a2e", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 16, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>
            <Settings size={17} />Parametres
          </Link>
          <Link href="/admin/articles/statistiques" style={{ minHeight: 54, padding: "0 25px", borderRadius: 10, border: "1px solid rgba(18,26,46,0.13)", background: "#fff", color: "#121a2e", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>
            Voir les statistiques
          </Link>
          <BlueCta>Créer une nouvelle page</BlueCta>
        </div>
      </header>

      <section style={{ marginTop: 38, height: 560, borderRadius: 13, border: "1px solid rgba(0,0,0,0.13)", background: "#fff", boxShadow: cardShadow, overflow: "hidden", display: "grid", gridTemplateColumns: "182px minmax(0, 1fr)" }}>
        <aside style={{ borderRight: "1px solid rgba(18,26,46,0.13)", padding: "20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { id: "actions" as const, label: "Action réalisé", icon: <Hammer size={17} /> },
            { id: "ai" as const, label: "IA", icon: <Sparkles size={18} /> },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} style={{ minHeight: 36, borderRadius: 11, border: 0, background: active ? "#f3f3f3" : "transparent", color: "#121a2e", display: "flex", alignItems: "center", gap: 10, padding: "0 10px", fontSize: 15, fontWeight: 550, cursor: "pointer", textAlign: "left" }}>
                <span style={{ color: "#6d82c7", display: "flex" }}>{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </aside>

        {activeTab === "actions" ? (
          <div style={{ position: "relative", minWidth: 0, overflow: "auto", padding: "46px 36px" }}>
            {actionEntries.length === 0 ? (
              <EmptyState label="Aucune action réalisée pour le moment. Les analyses, pages créées et données SEO apparaîtront ici dès que le module sera connecté." />
            ) : null}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 386px", minHeight: 0 }}>
            <div style={{ position: "relative", minWidth: 0, overflow: "hidden", padding: "40px 54px 24px", display: "flex", flexDirection: "column", background: "linear-gradient(135deg, #eef4ff 0%, #fff 48%, #e7efff 100%)" }}>
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 0 156px", display: "flex", flexDirection: "column", justifyContent: chatMessages.length ? "flex-start" : "flex-end", gap: 18 }}>
                {false ? (
                  <div style={{ maxWidth: 520, margin: "0 auto", borderRadius: 20, background: "#fff", border: "1px solid rgba(18,26,46,0.08)", padding: 24, color: "#356283", fontSize: 15, lineHeight: 1.75 }}>
                    Décris l’article SEO à créer, demande une analyse ou une idée de page. Les automatisations Framer/Cloudflare seront branchées ensuite.
                  </div>
                ) : chatMessages.map((message) => (
                  <div key={message.id} style={{ maxWidth: "75%", alignSelf: message.role === "user" ? "flex-end" : "flex-start", borderRadius: 18, background: message.role === "user" ? "#f4f4f4" : "transparent", padding: message.role === "user" ? "13px 15px" : 0, color: "#121a2e", fontSize: 14, lineHeight: 1.6 }}>
                    {message.content}
                  </div>
                ))}
              </div>
              <div style={{ position: "absolute", left: 64, right: 64, bottom: 24, minHeight: 132, borderRadius: 28, border: articleChatLoading ? "1px solid rgba(1,71,255,0.24)" : "1px solid rgba(18,26,46,0.18)", background: "#fff", boxShadow: articleChatLoading ? "0px 0px 0px 1px rgba(1,71,255,0.08), 0px 18px 48px rgba(1,71,255,0.18), 0px 12px 32px rgba(78,126,250,0.14)" : articlePanelShadow, display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "space-between", gap: 10, padding: 12 }}>
                {chatActionsOpen ? (
                  <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(100% + 10px)", borderRadius: 18, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", boxShadow: articlePanelShadow, padding: 10, display: "grid", gap: 6, zIndex: 12 }}>
                    {articleSourceActions.map((action) => {
                      const Icon = action.icon;
                      const active = selectedSourceActionId === action.id;
                      return (
                        <button key={action.id} type="button" onClick={() => { setSelectedSourceActionId(active ? "" : action.id); setChatActionsOpen(false); }} style={{ border: 0, borderRadius: 12, background: active ? "#FBFBFB" : "transparent", padding: "9px 10px", display: "flex", alignItems: "center", gap: 9, textAlign: "left", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                          <span style={{ width: 24, height: 24, borderRadius: 999, background: `${action.color}18`, color: action.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={13} /></span>
                          <span style={{ fontSize: 12, fontWeight: 750, color: "#121a2e" }}>{action.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {selectedSourceAction ? (() => {
                  const Icon = selectedSourceAction.icon;
                  return (
                    <button type="button" onClick={() => setSelectedSourceActionId("")} style={{ alignSelf: "flex-start", border: 0, borderRadius: 999, background: `${selectedSourceAction.color}14`, color: selectedSourceAction.color, minHeight: 24, padding: "0 9px", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, fontWeight: 800, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                      <Icon size={12} />{selectedSourceAction.label}
                    </button>
                  );
                })() : null}
                <textarea wrap="soft" value={chatInput} disabled={articleChatLoading} rows={chatComposerRows} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Taper un texte ici" style={{ width: "100%", minHeight: 48, maxHeight: 168, border: 0, outline: "none", color: "rgba(18,26,46,0.7)", fontSize: 16, fontWeight: 500, lineHeight: "22px", letterSpacing: "-0.2px", fontFamily: 'Inter, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif', resize: "none", overflowY: chatInput.split("\n").length > 7 || chatInput.length > 238 ? "auto" : "hidden", overflowX: "hidden", background: "transparent", padding: "0 4px", opacity: articleChatLoading ? 0.55 : 1, whiteSpace: "pre-wrap", overflowWrap: "break-word", wordBreak: "break-word" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, width: "100%", minWidth: 0, marginTop: "auto" }}>
                  <div style={{ position: "relative", minWidth: 0, display: "flex", alignItems: "center", gap: 16, border: "1px solid rgba(0,0,0,0.03)", borderRadius: 999, padding: "4px 12px 4px 4px", background: "#fff" }}>
                    <button type="button" onClick={() => setChatActionsOpen((current) => !current)} style={{ width: 40, height: 40, borderRadius: 999, border: "1px solid rgba(0,0,0,0.03)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}><Plus size={18} /></button>
                    <button type="button" onClick={() => setModelPickerOpen((current) => !current)} style={{ border: 0, background: "transparent", padding: 0, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "rgba(18,26,46,0.7)", fontSize: 14, fontWeight: 500, lineHeight: "18px", fontFamily: "Inter, sans-serif", minWidth: 0 }}>
                      <span style={{ maxWidth: 210, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeModel}</span>
                      <ChevronDown size={14} style={{ color: "rgba(18,26,46,0.52)", flexShrink: 0 }} />
                    </button>
                    {modelPickerOpen ? (
                      <div style={{ position: "absolute", left: 0, bottom: 56, width: 300, borderRadius: 18, border: "1px solid rgba(18,26,46,0.12)", background: "rgba(255,255,255,0.96)", boxShadow: articlePanelShadow, padding: 10, display: "flex", flexDirection: "column", gap: 8, zIndex: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40, borderRadius: 12, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", padding: "0 12px" }}>
                          <Search size={14} style={{ color: "#6f7887" }} />
                          <input value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} placeholder="Rechercher un modele..." style={{ flex: 1, border: 0, outline: "none", background: "transparent", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#121a2e" }} autoFocus />
                        </div>
                        <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                          {filteredModelOptions.map((model) => (
                            <button key={model} type="button" onClick={() => { setActiveModel(model); setModelPickerOpen(false); }} style={{ width: "100%", border: 0, borderRadius: 10, background: model === activeModel ? "rgba(0,0,0,0.04)" : "transparent", padding: "10px 11px", textAlign: "left", fontSize: 13, fontWeight: 500, color: "#121a2e", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                              {model}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <button type="button" onClick={() => void sendMessage()} disabled={articleChatLoading || !chatInput.trim()} style={{ width: 46, height: 46, borderRadius: 34, background: "#121a2e", color: "#fff", border: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: articleChatLoading || !chatInput.trim() ? "not-allowed" : "pointer", flexShrink: 0, opacity: articleChatLoading || !chatInput.trim() ? 0.72 : 1 }}>{articleChatLoading ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={18} />}</button>
                </div>
              </div>
            </div>
            <aside style={{ borderLeft: "1px solid rgba(18,26,46,0.12)", padding: "28px 24px", overflow: "hidden" }}>
              <h2 style={{ margin: 0, fontSize: 22, lineHeight: "28px", fontWeight: 750 }}>Récents</h2>
              <div style={{ height: 1, background: "rgba(18,26,46,0.08)", margin: "20px 0 24px" }} />
              {chatMessages.filter((message) => message.role === "user").length === 0 ? (
                <EmptyState label="Aucun échange récent." />
              ) : (
                <div style={{ display: "grid", gap: 10, overflowY: "auto", maxHeight: 430 }}>
                  {chatMessages.filter((message) => message.role === "user").slice(-8).reverse().map((message) => (
                    <button key={message.id} type="button" onClick={() => setChatInput(message.content)} style={{ border: 0, borderRadius: 14, background: "#fbfbfb", padding: 12, textAlign: "left", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                      <strong style={{ display: "block", fontSize: 12, lineHeight: "16px", color: "#121a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{message.source || "Article IA"}</strong>
                      <span style={{ marginTop: 5, fontSize: 12, lineHeight: "17px", color: "rgba(18,26,46,0.52)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{message.content}</span>
                    </button>
                  ))}
                </div>
              )}
            </aside>
          </div>
        )}
      </section>

      <section style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        <div style={{ height: 430, borderRadius: 13, border: "1px solid rgba(0,0,0,0.13)", background: "#fff", boxShadow: cardShadow, overflow: "hidden" }} />

        <article style={{ height: 430, borderRadius: 13, border: "1px solid rgba(0,0,0,0.13)", background: "#fff", boxShadow: cardShadow, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ minHeight: 66, padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(18,26,46,0.08)" }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 20, lineHeight: "26px", fontWeight: 750 }}>Toutes mes pages</h2>
              {!pagesLoading && sortedPages.length === 0 && pagesMessage ? (
                <p style={{ margin: "5px 0 0", color: "rgba(18,26,46,0.52)", fontSize: 11, lineHeight: "15px", fontFamily: "Inter, sans-serif", maxWidth: 520, whiteSpace: "normal" }}>
                  {pagesMessage}
                </p>
              ) : null}
            </div>
            <button type="button" style={{ minHeight: 42, minWidth: 186, borderRadius: 10, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", boxShadow: sortShadow, padding: "0 13px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, color: "rgba(18,26,46,0.7)", fontSize: 14, fontWeight: 500, fontFamily: "Inter, sans-serif" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Eye size={15} />Plus de vues</span>
              <ChevronDown size={15} />
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {pagesLoading ? (
              <EmptyState label="Chargement des pages articles..." />
            ) : sortedPages.length === 0 ? (
              <EmptyState label={pagesMessage} />
            ) : sortedPages.map((page) => (
              <div key={page.id} style={{ minHeight: 86, padding: "0 28px", borderBottom: "1px solid rgba(18,26,46,0.08)", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto auto", alignItems: "center", gap: 14 }}>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 15, color: "#121a2e", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{page.title}</strong>
                  {page.url ? <a href={page.url} target="_blank" rel="noopener noreferrer" style={{ marginTop: 4, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "rgba(18,26,46,0.48)", fontSize: 12, textDecoration: "none", fontFamily: "Inter, sans-serif" }}>{page.url}</a> : null}
                </div>
                <span style={{ minHeight: 40, borderRadius: 999, border: "1px solid rgba(1,71,255,0.1)", color: "#0147ff", padding: "0 16px", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontFamily: "Inter, sans-serif" }}>
                  {page.viewsLastWeek ?? 0} vues la semaine dernière <ArrowUp size={14} />
                </span>
                <span style={{ minHeight: 40, borderRadius: 999, border: "1px solid rgba(18,26,46,0.08)", color: "rgba(18,26,46,0.62)", padding: "0 14px", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontFamily: "Inter, sans-serif", whiteSpace: "nowrap" }}>
                  {page.visitorsLastWeek ?? 0} visiteurs · {formatDuration(page.avgDurationMs)}
                </span>
                {page.url ? (
                  <a href={page.url} target="_blank" rel="noopener noreferrer" style={{ minHeight: 38, borderRadius: 10, border: "1px solid rgba(18,26,46,0.1)", padding: "0 17px", color: "#121a2e", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 500 }}>
                    Ouvrir
                  </a>
                ) : (
                  <Link href={`/admin/articles/statistiques?page=${page.id}`} style={{ minHeight: 38, borderRadius: 10, border: "1px solid rgba(18,26,46,0.1)", padding: "0 17px", color: "#121a2e", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 500 }}>
                    Voir les statistiques en détail
                  </Link>
                )}
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
