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
  maxScrollDepth: number;
};

function normalizePath(value: string) {
  try {
    const url = value.startsWith("http") ? new URL(value) : null;
    const path = url ? url.pathname : value;
    return path.replace(/\/$/, "") || "/";
  } catch {
    return value.replace(/\/$/, "") || "/";
  }
}

function numberFromMetadata(metadata: Record<string, unknown> | null, key: string) {
  const properties = metadata?.properties;
  if (!properties || typeof properties !== "object") return 0;
  const value = (properties as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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

function getLastSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });
}

export async function POST(req: NextRequest) {
  let body: { urls?: string[]; siteId?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Requete invalide." }, { status: 400 });
  }

  const urls = Array.isArray(body.urls) ? body.urls.filter((url): url is string => typeof url === "string" && url.length > 0) : [];
  const paths = Array.from(new Set(urls.map(normalizePath)));
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = createServiceClient();

  if (!supabase) {
    return NextResponse.json({
      ok: true,
      stored: false,
      message: "SUPABASE_SERVICE_ROLE_KEY manque cote serveur, donc AgenceFlow ne peut pas lire les analytics.",
      summaries: urls.map((url) => emptySummary(url, normalizePath(url))),
    });
  }

  let query = supabase
    .from("analytics_events")
    .select("site_id, visitor_id, session_id, event_name, event_time, url, path, metadata")
    .gte("event_time", since)
    .order("event_time", { ascending: false })
    .limit(10000);

  const siteId = body.siteId?.trim();
  if (siteId) query = query.eq("site_id", siteId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as AnalyticsRow[];
  const summaries = new Map<string, PageSummary>();
  const visitors = new Map<string, Set<string>>();
  const sessions = new Map<string, Set<string>>();
  const durations = new Map<string, number[]>();
  const dailyVisitors = new Map<string, Map<string, Set<string>>>();
  const dailyDurations = new Map<string, Map<string, number[]>>();

  for (const url of urls) {
    const path = normalizePath(url);
    summaries.set(path, emptySummary(url, path));
    visitors.set(path, new Set());
    sessions.set(path, new Set());
    durations.set(path, []);
    dailyVisitors.set(path, new Map());
    dailyDurations.set(path, new Map());
  }

  for (const row of rows) {
    const rowPath = normalizePath(row.path || row.url || "");
    const path = paths.length > 0 ? paths.find((candidate) => candidate === rowPath || rowPath.startsWith(`${candidate}/`)) : rowPath;
    if (!path) continue;
    if (!summaries.has(path)) {
      summaries.set(path, emptySummary(row.url || rowPath, path));
      visitors.set(path, new Set());
      sessions.set(path, new Set());
      durations.set(path, []);
      dailyVisitors.set(path, new Map());
      dailyDurations.set(path, new Map());
    }

    const summary = summaries.get(path)!;
    const day = dateKey(row.event_time);
    let daily = summary.dailyStats.find((entry) => entry.date === day);
    if (!daily) {
      daily = { date: day, views: 0, visitors: 0, clicks: 0, formSubmits: 0, avgDurationMs: 0, maxScrollDepth: 0 };
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

    const durationMs = numberFromMetadata(row.metadata, "durationMs");
    if (durationMs > 0) {
      durations.get(path)?.push(durationMs);
      if (!dailyDurations.get(path)?.has(day)) dailyDurations.get(path)?.set(day, []);
      dailyDurations.get(path)?.get(day)?.push(durationMs);
    }
    const scrollDepth = numberFromMetadata(row.metadata, "maxScrollDepth") || numberFromMetadata(row.metadata, "depth");
    summary.maxScrollDepth = Math.max(summary.maxScrollDepth, scrollDepth);
    daily.maxScrollDepth = Math.max(daily.maxScrollDepth, scrollDepth);
    if (!summary.lastSeenAt || row.event_time > summary.lastSeenAt) summary.lastSeenAt = row.event_time;
  }

  const lastSevenDays = getLastSevenDays();
  const result = Array.from(summaries.entries()).map(([path, summary]) => {
    const durationValues = durations.get(path) ?? [];
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
      dailyStats: lastSevenDays.map((day) => {
        const existing = summary.dailyStats.find((entry) => entry.date === day);
        const dayDurations = dailyDurations.get(path)?.get(day) ?? [];
        const views = existing?.views ?? 0;
        const visitorsForDay = dailyVisitors.get(path)?.get(day)?.size ?? 0;
        return {
          date: day,
          views: views > 0 ? views : visitorsForDay,
          visitors: visitorsForDay,
          clicks: existing?.clicks ?? 0,
          formSubmits: existing?.formSubmits ?? 0,
          avgDurationMs: dayDurations.length > 0 ? Math.round(dayDurations.reduce((total, value) => total + value, 0) / dayDurations.length) : 0,
          maxScrollDepth: existing?.maxScrollDepth ?? 0,
        };
      }),
    };
  });

  return NextResponse.json({
    ok: true,
    stored: true,
    message: `${rows.length} evenement(s) analytics lu(s).`,
    summaries: result,
  });
}
