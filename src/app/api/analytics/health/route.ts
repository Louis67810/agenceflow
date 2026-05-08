import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

type LatestEvent = {
  site_id: string | null;
  event_name: string | null;
  event_time: string | null;
  url: string | null;
  path: string | null;
};

function getAllowedOrigins() {
  return (process.env.ANALYTICS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeOrigin(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) return "";
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function isOriginAllowed(origin: string, allowedOrigins: string[]) {
  return allowedOrigins.length === 0 || (origin.length > 0 && allowedOrigins.includes(origin));
}

async function inspectDatabase(siteId: string) {
  const supabase = createServiceClient();
  if (!supabase) {
    return {
      serviceRoleConfigured: false,
      tableReadable: false,
      totalEvents: 0,
      recentEvents24h: 0,
      recentEvents7d: 0,
      latestEvents: [] as LatestEvent[],
      error: "SUPABASE_SERVICE_ROLE_KEY manque cote serveur.",
    };
  }

  let totalQuery = supabase.from("analytics_events").select("id", { count: "exact", head: true });
  let lastDayQuery = supabase
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .gte("event_time", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  let lastWeekQuery = supabase
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .gte("event_time", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
  let latestQuery = supabase
    .from("analytics_events")
    .select("site_id,event_name,event_time,url,path")
    .order("event_time", { ascending: false })
    .limit(8);

  if (siteId) {
    totalQuery = totalQuery.eq("site_id", siteId);
    lastDayQuery = lastDayQuery.eq("site_id", siteId);
    lastWeekQuery = lastWeekQuery.eq("site_id", siteId);
    latestQuery = latestQuery.eq("site_id", siteId);
  }

  const [total, lastDay, lastWeek, latest] = await Promise.all([totalQuery, lastDayQuery, lastWeekQuery, latestQuery]);
  const firstError = total.error || lastDay.error || lastWeek.error || latest.error;

  if (firstError) {
    return {
      serviceRoleConfigured: true,
      tableReadable: false,
      totalEvents: 0,
      recentEvents24h: 0,
      recentEvents7d: 0,
      latestEvents: [] as LatestEvent[],
      error: firstError.message,
    };
  }

  return {
    serviceRoleConfigured: true,
    tableReadable: true,
    totalEvents: total.count ?? 0,
    recentEvents24h: lastDay.count ?? 0,
    recentEvents7d: lastWeek.count ?? 0,
    latestEvents: (latest.data ?? []) as LatestEvent[],
    error: "",
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const siteId = typeof body.siteId === "string" ? body.siteId.trim() : "";
  const articleOrigin = normalizeOrigin(body.articleDomain);
  const allowedOrigins = getAllowedOrigins();
  const db = await inspectDatabase(siteId);
  const appOrigin = req.nextUrl.origin;
  const scriptUrl = new URL("/agenceflow-track.js?v=2", appOrigin).toString();
  const collectUrl = new URL("/api/analytics/collect", appOrigin).toString();
  const scriptTag = `<script async src="${scriptUrl}" data-site-id="${siteId || "ruff-agency"}" data-endpoint="${collectUrl}" data-debug="true"></script>`;
  const recommendations: string[] = [];

  if (!db.serviceRoleConfigured) {
    recommendations.push("Ajoute SUPABASE_SERVICE_ROLE_KEY dans Vercel puis redeploie.");
  }
  if (db.serviceRoleConfigured && !db.tableReadable) {
    recommendations.push("Verifie que la migration Supabase analytics_events a bien ete appliquee.");
  }
  if (articleOrigin && !isOriginAllowed(articleOrigin, allowedOrigins)) {
    recommendations.push(`Ajoute ${articleOrigin} dans ANALYTICS_ALLOWED_ORIGINS sur Vercel, ou laisse cette variable vide pour autoriser les domaines articles.`);
  }
  if (db.tableReadable && db.recentEvents7d === 0) {
    recommendations.push("Aucun evenement recent trouve: verifie que le src et data-endpoint du script pointent vers le domaine AgenceFlow deploye, pas vers le domaine du site article.");
  }

  return NextResponse.json({
    ok: db.serviceRoleConfigured && db.tableReadable,
    appOrigin,
    scriptUrl,
    collectUrl,
    scriptTag,
    checkedAt: new Date().toISOString(),
    siteId,
    cors: {
      articleOrigin,
      allowedOrigins,
      allowed: articleOrigin ? isOriginAllowed(articleOrigin, allowedOrigins) : allowedOrigins.length === 0,
      mode: allowedOrigins.length === 0 ? "open" : "restricted",
    },
    env: {
      supabaseUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      serviceRoleConfigured: db.serviceRoleConfigured,
      allowedOriginsConfigured: allowedOrigins.length > 0,
    },
    db,
    recommendations,
  });
}
