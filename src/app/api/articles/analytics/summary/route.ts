import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

type AnalyticsRow = {
  site_id: string;
  visitor_id: string | null;
  session_id: string | null;
  event_name: string;
  event_time: string;
  url: string | null;
  path: string | null;
  metadata: Record<string, unknown> | null;
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

type DailyStat = {
  date: string;
  views: number;
  visitors: number;
  clicks: number;
  formSubmits: number;
  avgDurationMs: number;
  avgScrollDepth: number;
  maxScrollDepth: number;
};

const MAX_REASONABLE_DURATION_MS = 30 * 60 * 1000;

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

function canonicalUrl(value: string | null | undefined, fallbackPath: string) {
  if (!value) return fallbackPath;
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    url.pathname = canonicalPath(url.pathname);
    return url.toString().replace(/\/$/, "");
  } catch {
    return canonicalPath(value || fallbackPath);
  }
}

function numberFromMetadata(metadata: Record<string, unknown> | null, key: string) {
  const properties = metadata?.properties;
  if (!properties || typeof properties !== "object") return 0;
  const value = (properties as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function boundedDurationMs(value: number) {
  if (!value || !Number.isFinite(value) || value <= 0) return 0;
  if (value > MAX_REASONABLE_DURATION_MS) return 0;
  return Math.round(value);
}

function boundedScrollDepth(value: number) {
  if (!value || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Math.round(value), 100);
}

function emptySummary(url: string, path: string): PageSummary {
  return {
    url,
    path,
    viewsLastWeek: 0,
    visitorsLastWeek: 0,
    sessionsLastWeek: 0,
    clicksLastWeek: 0,
    formSubmitsLastWeek: 0,
    avgDurationMs: 0,
    maxScrollDepth: 0,
    lastSeenAt: null,
    dailyStats: [],
  };
}

function dateKey(value: string) {
  return value.slice(0, 10);
}

function getLastDays(days: number) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    return date.toISOString().slice(0, 10);
  });
}

async function fetchAnalyticsRows(supabase: ReturnType<typeof createServiceClient>, since: string, siteId?: string) {
  if (!supabase) return { rows: [] as AnalyticsRow[], error: null, capped: false };

  const pageSize = 1000;
  const maxRows = 50000;
  const rows: AnalyticsRow[] = [];

  for (let offset = 0; offset < maxRows; offset += pageSize) {
    let query = supabase
      .from("analytics_events")
      .select("site_id, visitor_id, session_id, event_name, event_time, url, path, metadata")
      .gte("event_time", since)
      .order("event_time", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (siteId) query = query.eq("site_id", siteId);

    const { data, error } = await query;
    if (error) return { rows, error, capped: false };

    const pageRows = (data ?? []) as AnalyticsRow[];
    rows.push(...pageRows);
    if (pageRows.length < pageSize) return { rows, error: null, capped: false };
  }

  return { rows, error: null, capped: true };
}

export async function POST(req: NextRequest) {
  let body: { urls?: string[]; siteId?: string; days?: number };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Requete invalide." }, { status: 400 });
  }

  const urls = Array.isArray(body.urls) ? body.urls.filter((url): url is string => typeof url === "string" && url.length > 0) : [];
  const paths = Array.from(new Set(urls.map(normalizePath)));
  const days = typeof body.days === "number" && Number.isFinite(body.days) ? Math.min(Math.max(Math.round(body.days), 7), 90) : 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const supabase = createServiceClient();

  if (!supabase) {
    return NextResponse.json({
      ok: true,
      stored: false,
      message: "SUPABASE_SERVICE_ROLE_KEY manque cote serveur, donc AgenceFlow ne peut pas lire les analytics.",
      summaries: urls.map((url) => emptySummary(url, normalizePath(url))),
    });
  }

  const siteId = body.siteId?.trim();
  const { rows, error, capped } = await fetchAnalyticsRows(supabase, since, siteId);
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const summaries = new Map<string, PageSummary>();
  const visitors = new Map<string, Set<string>>();
  const sessions = new Map<string, Set<string>>();
  const durations = new Map<string, number[]>();
  const dailyVisitors = new Map<string, Map<string, Set<string>>>();
  const dailyDurations = new Map<string, Map<string, number[]>>();
  const scrollDepths = new Map<string, number[]>();
  const dailyScrollDepths = new Map<string, Map<string, number[]>>();

  for (const url of urls) {
    const path = normalizePath(url);
    summaries.set(path, emptySummary(canonicalUrl(url, path), path));
    visitors.set(path, new Set());
    sessions.set(path, new Set());
    durations.set(path, []);
    scrollDepths.set(path, []);
    dailyVisitors.set(path, new Map());
    dailyDurations.set(path, new Map());
    dailyScrollDepths.set(path, new Map());
  }

  for (const row of rows) {
    const rowPath = normalizePath(row.path || row.url || "");
    const path = paths.length > 0 ? paths.find((candidate) => candidate === rowPath) : rowPath;
    if (!path) continue;
    if (!summaries.has(path)) {
      summaries.set(path, emptySummary(canonicalUrl(row.url, rowPath), path));
      visitors.set(path, new Set());
      sessions.set(path, new Set());
      durations.set(path, []);
      scrollDepths.set(path, []);
      dailyVisitors.set(path, new Map());
      dailyDurations.set(path, new Map());
      dailyScrollDepths.set(path, new Map());
    }

    const summary = summaries.get(path)!;
    if (!summary.url || summary.url === path) summary.url = canonicalUrl(row.url, path);
    const day = dateKey(row.event_time);
    let daily = summary.dailyStats.find((entry) => entry.date === day);
    if (!daily) {
      daily = { date: day, views: 0, visitors: 0, clicks: 0, formSubmits: 0, avgDurationMs: 0, avgScrollDepth: 0, maxScrollDepth: 0 };
      summary.dailyStats.push(daily);
    }

    if (row.event_name === "page_view") {
      summary.viewsLastWeek += 1;
      daily.views += 1;
    }
    if (row.event_name === "click") summary.clicksLastWeek += 1;
    if (row.event_name === "click") daily.clicks += 1;
    if (row.event_name === "form_submit") {
      summary.formSubmitsLastWeek += 1;
      daily.formSubmits += 1;
    }
    if (row.visitor_id) {
      visitors.get(path)?.add(row.visitor_id);
      if (!dailyVisitors.get(path)?.has(day)) dailyVisitors.get(path)?.set(day, new Set());
      dailyVisitors.get(path)?.get(day)?.add(row.visitor_id);
    }
    if (row.session_id) sessions.get(path)?.add(row.session_id);

    const durationMs = boundedDurationMs(numberFromMetadata(row.metadata, "durationMs"));
    if (durationMs > 0) {
      durations.get(path)?.push(durationMs);
      if (!dailyDurations.get(path)?.has(day)) dailyDurations.get(path)?.set(day, []);
      dailyDurations.get(path)?.get(day)?.push(durationMs);
    }
    const scrollDepth = boundedScrollDepth(numberFromMetadata(row.metadata, "maxScrollDepth") || numberFromMetadata(row.metadata, "depth"));
    if (scrollDepth > 0) {
      scrollDepths.get(path)?.push(scrollDepth);
      if (!dailyScrollDepths.get(path)?.has(day)) dailyScrollDepths.get(path)?.set(day, []);
      dailyScrollDepths.get(path)?.get(day)?.push(scrollDepth);
    }
    summary.maxScrollDepth = Math.max(summary.maxScrollDepth, scrollDepth);
    daily.maxScrollDepth = Math.max(daily.maxScrollDepth, scrollDepth);
    if (!summary.lastSeenAt || row.event_time > summary.lastSeenAt) summary.lastSeenAt = row.event_time;
  }

  const lastDays = getLastDays(days);
  const result = Array.from(summaries.entries()).map(([path, summary]) => {
    const durationValues = durations.get(path) ?? [];
    const scrollValues = scrollDepths.get(path) ?? [];
    const visitorCount = visitors.get(path)?.size ?? 0;
    const sessionCount = sessions.get(path)?.size ?? 0;
    const fallbackViews = summary.viewsLastWeek > 0 ? summary.viewsLastWeek : Math.max(visitorCount, sessionCount);
    return {
      ...summary,
      viewsLastWeek: fallbackViews,
      visitorsLastWeek: visitorCount,
      sessionsLastWeek: sessionCount,
      avgDurationMs: durationValues.length > 0
        ? Math.round(durationValues.reduce((total, value) => total + value, 0) / durationValues.length)
        : 0,
      maxScrollDepth: scrollValues.length > 0
        ? Math.round(scrollValues.reduce((total, value) => total + value, 0) / scrollValues.length)
        : summary.maxScrollDepth,
      dailyStats: lastDays.map((day) => {
        const existing = summary.dailyStats.find((entry) => entry.date === day);
        const dayDurations = dailyDurations.get(path)?.get(day) ?? [];
        const dayScrollDepths = dailyScrollDepths.get(path)?.get(day) ?? [];
        const views = existing?.views ?? 0;
        const visitorsForDay = dailyVisitors.get(path)?.get(day)?.size ?? 0;
        return {
          date: day,
          views: views > 0 ? views : visitorsForDay,
          visitors: visitorsForDay,
          clicks: existing?.clicks ?? 0,
          formSubmits: existing?.formSubmits ?? 0,
          avgDurationMs: dayDurations.length > 0 ? Math.round(dayDurations.reduce((total, value) => total + value, 0) / dayDurations.length) : 0,
          avgScrollDepth: dayScrollDepths.length > 0 ? Math.round(dayScrollDepths.reduce((total, value) => total + value, 0) / dayScrollDepths.length) : 0,
          maxScrollDepth: existing?.maxScrollDepth ?? 0,
        };
      }),
    };
  });

  return NextResponse.json({
    ok: true,
    stored: true,
    message: `${rows.length} evenement(s) analytics lu(s)${capped ? " (limite 50000 atteinte)" : ""}.`,
    summaries: result,
  });
}
