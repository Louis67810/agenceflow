"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, Clock3, ExternalLink, Eye, MousePointerClick, Users, X } from "lucide-react";

type DailyStat = {
  date: string;
  views: number;
  visitors: number;
  clicks: number;
  formSubmits: number;
  avgDurationMs: number;
  maxScrollDepth: number;
};

type PageSummary = {
  url: string;
  path: string;
  viewsLastWeek: number;
  visitorsLastWeek: number;
  sessionsLastWeek: number;
  clicksLastWeek: number;
  formSubmitsLastWeek: number;
  avgDurationMs: number;
  maxScrollDepth: number;
  lastSeenAt: string | null;
  dailyStats: DailyStat[];
};

const jk = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;
const cardShadow = "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)";
const SETTINGS_STORAGE_KEY = "agenceflow.articlePublishingSettings.v1";
const DATE_RANGES = [
  { label: "7 jours", value: 7 },
  { label: "30 jours", value: 30 },
  { label: "90 jours", value: 90 },
];

function formatDuration(ms: number) {
  if (!ms) return "0s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function titleFromPath(path: string) {
  const slug = path.split("/").filter(Boolean).pop() || path;
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function dedupeSummaries(pages: PageSummary[]) {
  const map = new Map<string, PageSummary>();
  for (const page of pages) {
    const key = page.path || page.url;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, page);
      continue;
    }
    map.set(key, {
      ...existing,
      url: existing.url || page.url,
      viewsLastWeek: existing.viewsLastWeek + page.viewsLastWeek,
      visitorsLastWeek: Math.max(existing.visitorsLastWeek, page.visitorsLastWeek),
      sessionsLastWeek: Math.max(existing.sessionsLastWeek, page.sessionsLastWeek),
      clicksLastWeek: existing.clicksLastWeek + page.clicksLastWeek,
      formSubmitsLastWeek: existing.formSubmitsLastWeek + page.formSubmitsLastWeek,
      avgDurationMs: Math.max(existing.avgDurationMs, page.avgDurationMs),
      maxScrollDepth: Math.max(existing.maxScrollDepth, page.maxScrollDepth),
      lastSeenAt: existing.lastSeenAt && page.lastSeenAt ? (existing.lastSeenAt > page.lastSeenAt ? existing.lastSeenAt : page.lastSeenAt) : existing.lastSeenAt || page.lastSeenAt,
      dailyStats: mergeDailyStats(existing.dailyStats, page.dailyStats),
    });
  }
  return Array.from(map.values()).sort((a, b) => b.viewsLastWeek - a.viewsLastWeek);
}

function mergeDailyStats(left: DailyStat[], right: DailyStat[]) {
  const map = new Map<string, DailyStat>();
  for (const stat of [...left, ...right]) {
    const existing = map.get(stat.date);
    map.set(stat.date, existing ? {
      date: stat.date,
      views: existing.views + stat.views,
      visitors: Math.max(existing.visitors, stat.visitors),
      clicks: existing.clicks + stat.clicks,
      formSubmits: existing.formSubmits + stat.formSubmits,
      avgDurationMs: Math.max(existing.avgDurationMs, stat.avgDurationMs),
      maxScrollDepth: Math.max(existing.maxScrollDepth, stat.maxScrollDepth),
    } : stat);
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function MiniLineChart({
  data,
  metric,
  color,
}: {
  data: DailyStat[];
  metric: keyof Pick<DailyStat, "views" | "visitors" | "clicks" | "avgDurationMs" | "maxScrollDepth">;
  color: string;
}) {
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; label: string; value: string } | null>(null);
  const max = Math.max(...data.map((item) => Number(item[metric]) || 0), 1);
  const coordinates = data.map((item, index) => {
    const value = Number(item[metric]) || 0;
    const x = data.length <= 1 ? 58 : 58 + (index / Math.max(data.length - 1, 1)) * 820;
    const y = 220 - (value / max) * 170;
    const formattedValue = metric === "avgDurationMs" ? formatDuration(value) : metric === "maxScrollDepth" ? `${value}%` : formatNumber(value);
    return {
      x,
      y,
      date: new Date(`${item.date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
      value: formattedValue,
    };
  });
  const points = coordinates.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div onMouseLeave={() => setHoveredPoint(null)} style={{ position: "relative", minHeight: 238, padding: "6px 0 28px" }}>
      {hoveredPoint ? (
        <div style={{ position: "absolute", left: `${(hoveredPoint.x / 920) * 100}%`, top: `${(hoveredPoint.y / 285) * 100}%`, transform: "translate(-50%, -118%)", zIndex: 3, borderRadius: 10, background: "#121a2e", color: "#fff", padding: "8px 10px", boxShadow: "0 12px 28px rgba(18,26,46,0.2)", pointerEvents: "none", minWidth: 92, textAlign: "center" }}>
          <strong style={{ display: "block", fontSize: 13, lineHeight: "16px", fontFamily: "Inter, sans-serif" }}>{hoveredPoint.value}</strong>
          <span style={{ display: "block", marginTop: 2, fontSize: 11, lineHeight: "14px", color: "rgba(255,255,255,0.72)", fontFamily: "Inter, sans-serif" }}>{hoveredPoint.label}</span>
        </div>
      ) : null}
      <svg viewBox="0 0 920 250" preserveAspectRatio="none" style={{ width: "100%", height: 210, display: "block", overflow: "visible" }}>
        {[0, 1, 2, 3, 4].map((line) => (
          <line key={line} x1="46" x2="890" y1={48 + line * 43} y2={48 + line * 43} stroke="rgba(18,26,46,0.055)" strokeWidth="1" />
        ))}
        <defs>
          <linearGradient id={`articleChartFill-${metric}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {points ? (
          <>
            <polyline points={`58,230 ${points} 878,230`} fill={`url(#articleChartFill-${metric})`} stroke="none" />
            <polyline points={points} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : null}
        {coordinates.map((point) => (
          <circle
            key={`point-${point.date}-${metric}`}
            cx={point.x}
            cy={point.y}
            r="9"
            fill="#fff"
            stroke={color}
            strokeWidth="4"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHoveredPoint({ x: point.x, y: point.y, label: point.date, value: point.value })}
          />
        ))}
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "space-between", color: "rgba(18,26,46,0.48)", fontSize: 12, lineHeight: "16px", fontFamily: "Inter, sans-serif" }}>
        {coordinates.filter((_, index) => index % Math.max(Math.ceil(coordinates.length / 5), 1) === 0 || index === coordinates.length - 1).map((point, index) => (
          <span key={`${point.date}-${index}`}>{point.date}</span>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <div style={{ borderRadius: 13, border: "1px solid rgba(0,0,0,0.1)", background: "#fff", boxShadow: cardShadow, padding: 20 }}>
      <span style={{ width: 38, height: 38, borderRadius: 11, background: "#e8edff", color: "#0147ff", display: "grid", placeItems: "center", marginBottom: 14 }}>{icon}</span>
      <strong style={{ display: "block", fontSize: 26, color: "#121a2e", letterSpacing: "-0.03em" }}>{value}</strong>
      <span style={{ display: "block", marginTop: 4, fontSize: 13, color: "rgba(18,26,46,0.52)", fontFamily: "Inter, sans-serif" }}>{label}</span>
    </div>
  );
}

export default function ArticleStatsPage() {
  const [summaries, setSummaries] = useState<PageSummary[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(7);
  const [message, setMessage] = useState("Chargement des statistiques...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      try {
        const rawSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
        const settings = rawSettings ? JSON.parse(rawSettings) as { analyticsSiteId?: string } : {};
        const response = await fetch("/api/articles/analytics/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteId: settings.analyticsSiteId || "", days: dateRange }),
        });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.summaries)) {
          setMessage(data.message || "Impossible de charger les statistiques articles.");
          return;
        }
        setSummaries(data.summaries as PageSummary[]);
        setMessage(data.message || "Statistiques chargees.");
      } catch {
        setMessage("Impossible de charger les statistiques articles.");
      } finally {
        setLoading(false);
      }
    }

    void loadStats();
  }, [dateRange]);

  const uniqueSummaries = useMemo(() => dedupeSummaries(summaries), [summaries]);
  const selectedPage = uniqueSummaries.find((page) => page.path === selectedPath) ?? null;

  const totals = useMemo(() => {
    return uniqueSummaries.reduce(
      (acc, page) => ({
        views: acc.views + page.viewsLastWeek,
        visitors: acc.visitors + page.visitorsLastWeek,
        clicks: acc.clicks + page.clicksLastWeek,
        duration: acc.duration + page.avgDurationMs,
      }),
      { views: 0, visitors: 0, clicks: 0, duration: 0 }
    );
  }, [uniqueSummaries]);

  const avgDuration = uniqueSummaries.length > 0 ? Math.round(totals.duration / uniqueSummaries.length) : 0;

  return (
    <main style={{ minHeight: "100vh", background: "#fbfbfb", padding: "52px 64px", color: "#121a2e", ...jk }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, paddingBottom: 24, borderBottom: "1px solid rgba(18,26,46,0.12)" }}>
        <div>
          <Link href="/admin/articles" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "rgba(18,26,46,0.62)", textDecoration: "none", fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
            <ArrowLeft size={15} /> Retour aux articles
          </Link>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: "41px", fontWeight: 750, letterSpacing: "-0.04em" }}>Statistiques articles</h1>
        </div>
      </header>

      <section style={{ marginTop: 34, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
        <MetricCard label={`Vues sur ${dateRange} jours`} value={totals.views} icon={<Eye size={18} />} />
        <MetricCard label="Visiteurs uniques" value={totals.visitors} icon={<Users size={18} />} />
        <MetricCard label="Clics suivis" value={totals.clicks} icon={<MousePointerClick size={18} />} />
        <MetricCard label="Temps moyen" value={formatDuration(avgDuration)} icon={<Clock3 size={18} />} />
      </section>

      {selectedPage ? (
        <div role="dialog" aria-modal="true" onClick={() => setSelectedPath(null)} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(18,26,46,0.32)", backdropFilter: "blur(8px)", display: "grid", placeItems: "center", padding: 28 }}>
          <section onClick={(event) => event.stopPropagation()} style={{ width: "min(1180px, 96vw)", maxHeight: "90vh", borderRadius: 16, border: "1px solid rgba(0,0,0,0.13)", background: "#fff", boxShadow: "0 28px 80px rgba(18,26,46,0.24)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ minHeight: 72, padding: "0 24px 0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, borderBottom: "1px solid rgba(18,26,46,0.08)" }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 21, lineHeight: "27px", fontWeight: 750, color: "#121a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titleFromPath(selectedPage.path)}</h2>
              <span style={{ display: "block", marginTop: 4, color: "rgba(18,26,46,0.48)", fontSize: 12, fontFamily: "Inter, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedPage.url || selectedPage.path}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "inline-flex", alignItems: "center", padding: 3, borderRadius: 999, background: "#f0f0f0" }}>
                {DATE_RANGES.map((range) => (
                  <button key={range.value} type="button" onClick={() => setDateRange(range.value)} style={{ minHeight: 32, borderRadius: 999, border: dateRange === range.value ? "1px solid rgba(0,0,0,0.12)" : 0, background: dateRange === range.value ? "#fff" : "transparent", padding: "0 13px", color: dateRange === range.value ? "#121a2e" : "rgba(18,26,46,0.52)", fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                    {range.label}
                  </button>
                ))}
              </div>
              {selectedPage.url ? (
                <a href={selectedPage.url} target="_blank" rel="noopener noreferrer" style={{ minHeight: 38, borderRadius: 10, border: "1px solid rgba(18,26,46,0.1)", padding: "0 14px", color: "#121a2e", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif" }}>
                  <ExternalLink size={14} /> Ouvrir
                </a>
              ) : null}
              <button type="button" onClick={() => setSelectedPath(null)} style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", color: "rgba(18,26,46,0.62)", display: "grid", placeItems: "center", cursor: "pointer" }}>
                <X size={16} />
              </button>
            </div>
          </div>

          <div style={{ padding: 24, display: "grid", gap: 18, overflowY: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 }}>
              {[
                { label: "Vues", value: formatNumber(selectedPage.viewsLastWeek) },
                { label: "Visiteurs", value: formatNumber(selectedPage.visitorsLastWeek) },
                { label: "Clics", value: formatNumber(selectedPage.clicksLastWeek) },
                { label: "Temps moyen", value: formatDuration(selectedPage.avgDurationMs) },
                { label: "Scroll max", value: `${selectedPage.maxScrollDepth}%` },
              ].map((metric) => (
                <div key={metric.label} style={{ borderRadius: 12, border: "1px solid rgba(18,26,46,0.08)", background: "#fbfbfb", padding: 14 }}>
                  <span style={{ display: "block", fontSize: 12, color: "rgba(18,26,46,0.48)", fontFamily: "Inter, sans-serif" }}>{metric.label}</span>
                  <strong style={{ display: "block", marginTop: 6, fontSize: 20, color: "#121a2e" }}>{metric.value}</strong>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <article style={{ borderRadius: 13, border: "1px solid rgba(18,26,46,0.08)", background: "#fff", padding: 20 }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 750, color: "#121a2e" }}>Visiteurs</h3>
                <MiniLineChart data={selectedPage.dailyStats ?? []} metric="visitors" color="#168b64" />
              </article>
              <article style={{ borderRadius: 13, border: "1px solid rgba(18,26,46,0.08)", background: "#fff", padding: 20 }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 750, color: "#121a2e" }}>Clics</h3>
                <MiniLineChart data={selectedPage.dailyStats ?? []} metric="clicks" color="#f97316" />
              </article>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <article style={{ borderRadius: 13, border: "1px solid rgba(18,26,46,0.08)", background: "#fff", padding: 20 }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 750, color: "#121a2e" }}>Temps sur page</h3>
                <MiniLineChart data={selectedPage.dailyStats ?? []} metric="avgDurationMs" color="#7c3aed" />
              </article>
              <article style={{ borderRadius: 13, border: "1px solid rgba(18,26,46,0.08)", background: "#fff", padding: 20 }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 750, color: "#121a2e" }}>Profondeur de scroll</h3>
                <MiniLineChart data={selectedPage.dailyStats ?? []} metric="maxScrollDepth" color="#0147ff" />
              </article>
            </div>
          </div>
          </section>
        </div>
      ) : null}

      <section style={{ marginTop: 18, minHeight: 520, borderRadius: 13, border: "1px solid rgba(0,0,0,0.13)", background: "#fff", boxShadow: cardShadow, overflow: "hidden" }}>
        <div style={{ minHeight: 66, padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(18,26,46,0.08)" }}>
          <h2 style={{ margin: 0, fontSize: 20, lineHeight: "26px", fontWeight: 750 }}>Performance par page</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "inline-flex", alignItems: "center", padding: 3, borderRadius: 999, background: "#f0f0f0" }}>
              {DATE_RANGES.map((range) => (
                <button key={range.value} type="button" onClick={() => setDateRange(range.value)} style={{ minHeight: 32, borderRadius: 999, border: dateRange === range.value ? "1px solid rgba(0,0,0,0.12)" : 0, background: dateRange === range.value ? "#fff" : "transparent", padding: "0 13px", color: dateRange === range.value ? "#121a2e" : "rgba(18,26,46,0.52)", fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
                  {range.label}
                </button>
              ))}
            </div>
            <span style={{ color: "rgba(18,26,46,0.48)", fontSize: 13, fontFamily: "Inter, sans-serif" }}>{message}</span>
          </div>
        </div>

        {loading ? (
          <div style={{ minHeight: 420, display: "grid", placeItems: "center", color: "rgba(18,26,46,0.42)", fontSize: 14 }}>Chargement...</div>
        ) : uniqueSummaries.length === 0 ? (
          <div style={{ minHeight: 420, display: "grid", placeItems: "center", textAlign: "center", padding: 32 }}>
            <div style={{ maxWidth: 480 }}>
              <span style={{ width: 54, height: 54, borderRadius: 16, background: "#f3f3f3", color: "#6d82c7", display: "grid", placeItems: "center", margin: "0 auto 18px" }}>
                <BarChart3 size={24} />
              </span>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 750 }}>Aucune donnee tracking disponible</h2>
              <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.7, color: "rgba(18,26,46,0.52)" }}>
                Verifie que le script pointe vers le domaine AgenceFlow deploye et que `SUPABASE_SERVICE_ROLE_KEY` est configure sur Vercel.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            {uniqueSummaries.map((page) => (
              <button key={page.path} type="button" onClick={() => setSelectedPath(page.path)} style={{ width: "100%", minHeight: 76, padding: "0 28px", border: 0, borderBottom: "1px solid rgba(18,26,46,0.08)", background: "#fff", display: "grid", gridTemplateColumns: "minmax(260px, 1fr) repeat(5, auto)", gap: 18, alignItems: "center", fontFamily: "Inter, sans-serif", textAlign: "left", cursor: "pointer" }}>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", color: "#121a2e", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titleFromPath(page.path)}</strong>
                  <span style={{ display: "block", marginTop: 4, color: "rgba(18,26,46,0.46)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{page.url || page.path}</span>
                </div>
                <strong>{page.viewsLastWeek} vues</strong>
                <span>{page.visitorsLastWeek} visiteurs</span>
                <span>{page.clicksLastWeek} clics</span>
                <span>{formatDuration(page.avgDurationMs)}</span>
                <span>{page.maxScrollDepth}% scroll</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
