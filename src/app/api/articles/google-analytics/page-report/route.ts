import { createSign } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ServiceAccount = {
  client_email?: string;
  private_key?: string;
  token_uri?: string;
};

type RequestBody = {
  propertyId?: string;
  serviceAccountJson?: string;
  paths?: string[];
  days?: number;
};

type PageStats = {
  path: string;
  activeUsers: number;
  sessions: number;
  views: number;
  engagedSessions: number;
  avgSessionDuration: number;
  engagementRate: number;
  bounceRate: number;
  organicUsers: number;
  organicSessions: number;
  organicViews: number;
  organicEngagedSessions: number;
};

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function parseServiceAccount(value: string) {
  try {
    const parsed = JSON.parse(value) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
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
      // Normalize the raw value below.
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

function pathVariants(path: string) {
  const canonical = canonicalPath(path);
  const variants = new Set<string>([canonical]);
  if (canonical !== "/") {
    variants.add(`${canonical}/`);
    variants.add(`${canonical}.html`);
    variants.add(`${canonical}/index.html`);
  }
  if (canonical.startsWith("/ressources/")) {
    variants.add(canonical.replace(/^\/ressources\//, "/ressources/ressources/"));
    variants.add(`${canonical.replace(/^\/ressources\//, "/ressources/ressources/")}/`);
  }
  return Array.from(variants);
}

async function getAccessToken(serviceAccount: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: serviceAccount.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));
  const unsignedJwt = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedJwt);
  signer.end();
  const signature = base64Url(signer.sign(serviceAccount.private_key!.replace(/\\n/g, "\n")));
  const jwt = `${unsignedJwt}.${signature}`;

  const response = await fetch(serviceAccount.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "OAuth Google refuse le service account.");
  }
  return data.access_token as string;
}

function emptyStats(path: string): PageStats {
  return {
    path,
    activeUsers: 0,
    sessions: 0,
    views: 0,
    engagedSessions: 0,
    avgSessionDuration: 0,
    engagementRate: 0,
    bounceRate: 0,
    organicUsers: 0,
    organicSessions: 0,
    organicViews: 0,
    organicEngagedSessions: 0,
  };
}

function addWeightedAverage(current: number, currentWeight: number, next: number, nextWeight: number) {
  const weight = currentWeight + nextWeight;
  if (weight <= 0) return 0;
  return ((current * currentWeight) + (next * nextWeight)) / weight;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as RequestBody | null;
  if (!body) {
    return NextResponse.json({ ok: false, message: "Requete invalide." }, { status: 400 });
  }

  const propertyId = body.propertyId?.trim();
  const serviceAccountJson = body.serviceAccountJson?.trim();
  const paths = Array.from(new Set((body.paths ?? []).filter(Boolean).map(normalizePath))).slice(0, 100);
  const requestedPathVariants = Array.from(new Set(paths.flatMap(pathVariants))).slice(0, 300);
  const days = typeof body.days === "number" && Number.isFinite(body.days) ? Math.min(Math.max(Math.round(body.days), 7), 90) : 30;

  if (!propertyId || !serviceAccountJson) {
    return NextResponse.json({ ok: false, message: "Ajoute le Property ID GA4 et le Service Account JSON pour lire les stats SEO." }, { status: 400 });
  }

  const serviceAccount = parseServiceAccount(serviceAccountJson);
  if (!serviceAccount) {
    return NextResponse.json({ ok: false, message: "Service Account JSON invalide." }, { status: 400 });
  }

  try {
    const accessToken = await getAccessToken(serviceAccount);
    const bodyPayload: Record<string, unknown> = {
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
      dimensions: [{ name: "pagePath" }, { name: "sessionDefaultChannelGroup" }],
      metrics: [
        { name: "activeUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "engagedSessions" },
        { name: "averageSessionDuration" },
        { name: "engagementRate" },
        { name: "bounceRate" },
      ],
      limit: 10000,
    };

    if (requestedPathVariants.length > 0) {
      bodyPayload.dimensionFilter = {
        filter: {
          fieldName: "pagePath",
          inListFilter: { values: requestedPathVariants },
        },
      };
    }

    const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyPayload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error?.message || "La Data API Google Analytics a refuse la requete.");
    }

    const stats = new Map<string, PageStats>();
    for (const path of paths) stats.set(path, emptyStats(path));

    for (const row of data.rows ?? []) {
      const path = normalizePath(row.dimensionValues?.[0]?.value || "");
      const channel = String(row.dimensionValues?.[1]?.value || "");
      if (!path) continue;
      const current = stats.get(path) ?? emptyStats(path);
      const values = row.metricValues ?? [];
      const activeUsers = Number(values[0]?.value || 0);
      const sessions = Number(values[1]?.value || 0);
      const views = Number(values[2]?.value || 0);
      const engagedSessions = Number(values[3]?.value || 0);
      const avgDuration = Number(values[4]?.value || 0);
      const engagementRate = Number(values[5]?.value || 0);
      const bounceRate = Number(values[6]?.value || 0);
      const previousSessions = current.sessions;

      current.activeUsers += activeUsers;
      current.sessions += sessions;
      current.views += views;
      current.engagedSessions += engagedSessions;
      current.avgSessionDuration = addWeightedAverage(current.avgSessionDuration, previousSessions, avgDuration, sessions);
      current.engagementRate = addWeightedAverage(current.engagementRate, previousSessions, engagementRate, sessions);
      current.bounceRate = addWeightedAverage(current.bounceRate, previousSessions, bounceRate, sessions);

      if (channel.toLowerCase().includes("organic")) {
        current.organicUsers += activeUsers;
        current.organicSessions += sessions;
        current.organicViews += views;
        current.organicEngagedSessions += engagedSessions;
      }
      stats.set(path, current);
    }

    const matchedRows = Array.isArray(data.rows) ? data.rows.length : 0;
    return NextResponse.json({
      ok: true,
      message: matchedRows > 0
        ? `${stats.size} page(s) GA4 analysee(s), ${matchedRows} ligne(s) GA4 matchee(s).`
        : `Google Analytics est connecte, mais aucune ligne GA4 ne matche les ${paths.length} chemin(s) demandes. Variantes testees: ${requestedPathVariants.slice(0, 8).join(", ")}${requestedPathVariants.length > 8 ? "..." : ""}`,
      debug: {
        requestedPaths: paths,
        testedPathVariants: requestedPathVariants,
        matchedRows,
      },
      pages: Array.from(stats.values()),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de lire Google Analytics.";
    return NextResponse.json({ ok: false, message }, { status: 502 });
  }
}
