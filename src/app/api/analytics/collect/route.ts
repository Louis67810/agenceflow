import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

type TrackingEvent = {
  name?: unknown;
  time?: unknown;
  siteId?: unknown;
  visitorId?: unknown;
  sessionId?: unknown;
  page?: unknown;
  properties?: unknown;
};

const MAX_EVENTS = 50;
const MAX_BODY_BYTES = 128_000;

function getCorsHeaders(origin: string | null) {
  const allowed = (process.env.ANALYTICS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const allowOrigin = allowed.length === 0 || (origin && allowed.includes(origin)) ? origin ?? "*" : allowed[0] ?? "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function text(value: unknown, limit = 500) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, limit);
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeEvent(event: TrackingEvent, fallbackSiteId: string, request: NextRequest) {
  const page = objectOrEmpty(event.page);
  return {
    site_id: text(event.siteId, 120) || fallbackSiteId,
    visitor_id: text(event.visitorId, 120),
    session_id: text(event.sessionId, 120),
    event_name: text(event.name, 120) || "unknown",
    event_time: typeof event.time === "string" ? event.time : new Date().toISOString(),
    url: text(page.url, 2000),
    path: text(page.path, 600),
    referrer: text(page.referrer, 2000),
    user_agent: text(request.headers.get("user-agent"), 1000),
    ip_hash: null,
    metadata: {
      page,
      properties: objectOrEmpty(event.properties),
      received_at: new Date().toISOString(),
    },
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(req.headers.get("origin")) });
}

export async function POST(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413, headers: corsHeaders });
    }

    const body = await req.json();
    const fallbackSiteId = text(body?.siteId, 120);
    const events = Array.isArray(body?.events) ? body.events.slice(0, MAX_EVENTS) : [];

    if (!fallbackSiteId || events.length === 0) {
      return NextResponse.json({ ok: false, error: "Invalid analytics payload" }, { status: 400, headers: corsHeaders });
    }

    const rows = events.map((event: TrackingEvent) => normalizeEvent(event, fallbackSiteId, req));
    const supabase = createServiceClient();

    if (!supabase) {
      return NextResponse.json({ ok: true, stored: false, reason: "SUPABASE_SERVICE_ROLE_KEY missing", received: rows.length }, { headers: corsHeaders });
    }

    const { error } = await supabase.from("analytics_events").insert(rows);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message, received: rows.length }, { status: 500, headers: corsHeaders });
    }

    return NextResponse.json({ ok: true, stored: true, received: rows.length }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500, headers: corsHeaders });
  }
}
