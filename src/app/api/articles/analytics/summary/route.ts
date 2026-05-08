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
  };
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

  for (const url of urls) {
    const path = normalizePath(url);
    summaries.set(path, emptySummary(url, path));
    visitors.set(path, new Set());
    sessions.set(path, new Set());
    durations.set(path, []);
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
    }

    const summary = summaries.get(path)!;
    if (row.event_name === "page_view") summary.viewsLastWeek += 1;
    if (row.event_name === "click") summary.clicksLastWeek += 1;
    if (row.event_name === "form_submit") summary.formSubmitsLastWeek += 1;
    if (row.visitor_id) visitors.get(path)?.add(row.visitor_id);
    if (row.session_id) sessions.get(path)?.add(row.session_id);

    const durationMs = numberFromMetadata(row.metadata, "durationMs");
    if (durationMs > 0) durations.get(path)?.push(durationMs);
    summary.maxScrollDepth = Math.max(summary.maxScrollDepth, numberFromMetadata(row.metadata, "maxScrollDepth"));
    if (!summary.lastSeenAt || row.event_time > summary.lastSeenAt) summary.lastSeenAt = row.event_time;
  }

  const result = Array.from(summaries.entries()).map(([path, summary]) => {
    const durationValues = durations.get(path) ?? [];
    return {
      ...summary,
      visitorsLastWeek: visitors.get(path)?.size ?? 0,
      sessionsLastWeek: sessions.get(path)?.size ?? 0,
      avgDurationMs: durationValues.length > 0
        ? Math.round(durationValues.reduce((total, value) => total + value, 0) / durationValues.length)
        : 0,
    };
  });

  return NextResponse.json({
    ok: true,
    stored: true,
    message: `${rows.length} evenement(s) analytics lu(s).`,
    summaries: result,
  });
}
