"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUp,
  BarChart3,
  ChevronDown,
  Eye,
  FileBarChart,
  Hammer,
  Plus,
  Send,
  Settings,
  Sparkles,
} from "lucide-react";

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
};

const jk = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;
const cardShadow = "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)";
const sortShadow = "0px 4.71px 3px rgba(0,0,0,0.02), 0px 2.12px 2.12px rgba(0,0,0,0.03), 0px 0.47px 1.18px rgba(0,0,0,0.03)";

const articlePages: ArticlePage[] = [];
const actionEntries: ActionEntry[] = [];
const SETTINGS_STORAGE_KEY = "agenceflow.articlePublishingSettings.v1";
const CONNECTION_STORAGE_KEY = "agenceflow.articlePublishingConnection.v1";

function formatDuration(ms?: number) {
  if (!ms) return "0s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
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
        width: 247,
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
          width: 235,
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
  const [detectedPages, setDetectedPages] = useState<ArticlePage[]>([]);
  const [pagesLoading, setPagesLoading] = useState(true);
  const [pagesMessage, setPagesMessage] = useState("Verification de la connexion Cloudflare...");

  const sortedPages = useMemo(() => {
    return [...articlePages, ...detectedPages].sort((a, b) => (b.viewsLastWeek ?? 0) - (a.viewsLastWeek ?? 0));
  }, [detectedPages]);

  useEffect(() => {
    async function loadCloudflarePages() {
      const rawConnection = window.localStorage.getItem(CONNECTION_STORAGE_KEY);
      const rawSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);

      if (!rawConnection || !rawSettings) {
        setPagesLoading(false);
        setPagesMessage("Connecte Cloudflare dans Parametres pour afficher automatiquement les pages articles.");
        return;
      }

      try {
        const connection = JSON.parse(rawConnection) as { cloudflareConnected?: boolean };
        const settings = JSON.parse(rawSettings) as { articleDomain?: string; cloudflareDestination?: string };
        if (!connection.cloudflareConnected || !settings.articleDomain) {
          setPagesLoading(false);
          setPagesMessage("Cloudflare n'est pas encore connecte pour les articles.");
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
          setPagesMessage(data.message || "Impossible de charger les pages articles Cloudflare.");
          setDetectedPages([]);
          return;
        }

        setDetectedPages((data.pages ?? []) as ArticlePage[]);
        setPagesMessage(data.message || `${data.pages?.length ?? 0} page(s) article detectee(s).`);
      } catch {
        setPagesMessage("Impossible de lire la connexion Cloudflare locale.");
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
        const rawSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
        const settings = rawSettings ? JSON.parse(rawSettings) as { analyticsSiteId?: string } : {};
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

  function sendMessage() {
    const content = chatInput.trim();
    if (!content) return;
    setChatMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content },
      { id: crypto.randomUUID(), role: "assistant", content: "Je peux analyser tes donnees SEO et proposer des articles des que les statistiques sont connectees." },
    ]);
    setChatInput("");
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
            <div style={{ position: "relative", minWidth: 0, overflow: "hidden", padding: "40px 54px 28px", display: "flex", flexDirection: "column" }}>
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 0 110px", display: "flex", flexDirection: "column", justifyContent: chatMessages.length ? "flex-start" : "center", gap: 24 }}>
                {chatMessages.length === 0 ? (
                  <div style={{ maxWidth: 520, margin: "0 auto", borderRadius: 20, background: "#fff", border: "1px solid rgba(18,26,46,0.08)", padding: 24, color: "#356283", fontSize: 15, lineHeight: 1.75 }}>
                    Décris l’article SEO à créer, demande une analyse ou une idée de page. Les automatisations Framer/Cloudflare seront branchées ensuite.
                  </div>
                ) : chatMessages.map((message) => (
                  <div key={message.id} style={{ maxWidth: "75%", alignSelf: message.role === "user" ? "flex-end" : "flex-start", borderRadius: 18, background: message.role === "user" ? "#f4f4f4" : "transparent", padding: message.role === "user" ? "13px 15px" : 0, color: "#121a2e", fontSize: 14, lineHeight: 1.6 }}>
                    {message.content}
                  </div>
                ))}
              </div>
              <div style={{ position: "absolute", left: 88, right: 88, bottom: 28, minHeight: 66, borderRadius: 34, border: "1px solid rgba(18,26,46,0.18)", background: "#fff", boxShadow: cardShadow, display: "flex", alignItems: "center", gap: 14, padding: "10px 12px 10px 20px" }}>
                <Plus size={19} />
                <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") sendMessage(); }} placeholder="Analyser les posts LinkedIn" style={{ flex: 1, border: 0, outline: "none", background: "transparent", fontSize: 14, color: "#121a2e", fontFamily: "Inter, sans-serif" }} />
                <span style={{ fontSize: 12, color: "rgba(18,26,46,0.62)", fontFamily: "Inter, sans-serif" }}>Sonnet 4.6</span>
                <button type="button" onClick={sendMessage} style={{ width: 34, height: 34, borderRadius: 999, border: 0, background: "#121a2e", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}>
                  <Send size={15} />
                </button>
              </div>
            </div>
            <aside style={{ borderLeft: "1px solid rgba(18,26,46,0.12)", padding: "28px 24px", overflow: "hidden" }}>
              <h2 style={{ margin: 0, fontSize: 22, lineHeight: "28px", fontWeight: 750 }}>Récents</h2>
              <div style={{ height: 1, background: "rgba(18,26,46,0.08)", margin: "20px 0 24px" }} />
              <EmptyState label="Aucun échange récent." />
            </aside>
          </div>
        )}
      </section>

      <section style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        <div style={{ height: 430, borderRadius: 13, border: "1px solid rgba(0,0,0,0.13)", background: "#fff", boxShadow: cardShadow, overflow: "hidden" }} />

        <article style={{ height: 430, borderRadius: 13, border: "1px solid rgba(0,0,0,0.13)", background: "#fff", boxShadow: cardShadow, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ minHeight: 66, padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(18,26,46,0.08)" }}>
            <h2 style={{ margin: 0, fontSize: 20, lineHeight: "26px", fontWeight: 750 }}>Toutes mes pages</h2>
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
