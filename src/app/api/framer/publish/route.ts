import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

type PublishBody = {
  site_id?: unknown;
  siteId?: unknown;
  collection?: unknown;
  title?: unknown;
  slug?: unknown;
  metaTitle?: unknown;
  meta_title?: unknown;
  metaDescription?: unknown;
  meta_description?: unknown;
  html?: unknown;
  tags?: unknown;
  authorName?: unknown;
  authorProfileUrl?: unknown;
  authorAvatarUrl?: unknown;
  author?: unknown;
  images?: unknown;
  internalLinksUsed?: unknown;
  internal_links?: unknown;
  imagePlaceholders?: unknown;
  image_placeholders?: unknown;
  status?: unknown;
};

function getSecret(req: NextRequest) {
  const authorization = req.headers.get("authorization") ?? "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return bearer || req.headers.get("x-agenceflow-secret")?.trim() || "";
}

function authorize(req: NextRequest) {
  const expected = process.env.FRAMER_PUBLISH_SECRET?.trim();
  if (!expected) return true;
  return getSecret(req) === expected;
}

function text(value: unknown, limit = 500) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, limit);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

function arrayOrEmpty(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function objectOrEmpty(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizeHtml(value: unknown) {
  const parsed = parseMaybeJson(value);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const nestedHtml = (parsed as Record<string, unknown>).html;
    if (typeof nestedHtml === "string") return nestedHtml;
  }
  return typeof value === "string" ? value : "";
}

function normalizePublishBody(body: PublishBody) {
  const nested = parseMaybeJson(body.html);
  const nestedObject = nested && typeof nested === "object" && !Array.isArray(nested)
    ? (nested as Record<string, unknown>)
    : {};

  const siteId = text(body.site_id || body.siteId, 120) || "ruff-agency";
  const collection = text(body.collection, 120) || "ressources";
  const title = text(body.title || nestedObject.title, 300);
  const slug = slugify(text(body.slug || nestedObject.slug || title, 220));
  const html = normalizeHtml(body.html || nestedObject.html);
  const status = text(body.status, 40) || "pending";

  const author = Object.keys(objectOrEmpty(body.author)).length > 0
    ? objectOrEmpty(body.author)
    : {
        name: text(body.authorName, 200) || "Ruff Agency",
        profileUrl: text(body.authorProfileUrl, 1000),
        avatarUrl: text(body.authorAvatarUrl, 1000),
      };

  return {
    site_id: siteId,
    collection,
    title,
    slug,
    meta_title: text(body.meta_title || body.metaTitle || nestedObject.metaTitle, 300) || title,
    meta_description: text(body.meta_description || body.metaDescription || nestedObject.metaDescription, 1000),
    html,
    tags: arrayOrEmpty(body.tags),
    author,
    images: arrayOrEmpty(body.images),
    internal_links: arrayOrEmpty(body.internal_links || body.internalLinksUsed || nestedObject.internalLinksUsed),
    image_placeholders: arrayOrEmpty(body.image_placeholders || body.imagePlaceholders || nestedObject.imagePlaceholders),
    status: ["pending", "draft"].includes(status) ? status : "pending",
    source_payload: body,
    updated_at: new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: PublishBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requete invalide." }, { status: 400 });
  }

  const row = normalizePublishBody(body);
  if (!row.title || !row.slug || !row.html) {
    return NextResponse.json(
      {
        ok: false,
        error: "Payload incomplet. Champs requis : title, slug et html.",
        received: {
          title: Boolean(row.title),
          slug: Boolean(row.slug),
          html: Boolean(row.html),
        },
      },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json(
      {
        ok: true,
        stored: false,
        reason: "SUPABASE_SERVICE_ROLE_KEY missing",
        item: row,
      },
      { status: 202 }
    );
  }

  const { data, error } = await supabase
    .from("framer_publish_queue")
    .upsert(row, { onConflict: "site_id,collection,slug" })
    .select("id, site_id, collection, slug, title, status, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    stored: true,
    queued: true,
    message: "Article ajoute a la file de publication Framer.",
    item: data,
  });
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY missing" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get("siteId") || searchParams.get("site_id") || "ruff-agency";
  const status = searchParams.get("status") || "pending";
  const limit = Math.min(Number(searchParams.get("limit") || "20") || 20, 100);

  const { data, error } = await supabase
    .from("framer_publish_queue")
    .select("*")
    .eq("site_id", siteId)
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY missing" }, { status: 500 });
  }

  let body: {
    id?: unknown;
    status?: unknown;
    framerItemId?: unknown;
    framerUrl?: unknown;
    errorMessage?: unknown;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requete invalide." }, { status: 400 });
  }

  const id = text(body.id, 120);
  const status = text(body.status, 40);
  if (!id || !["pending", "draft", "published", "failed"].includes(status)) {
    return NextResponse.json({ ok: false, error: "id et status valides requis." }, { status: 400 });
  }

  const patch = {
    status,
    framer_item_id: text(body.framerItemId, 300) || null,
    framer_url: text(body.framerUrl, 1000) || null,
    error_message: text(body.errorMessage, 2000) || null,
    published_at: status === "published" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("framer_publish_queue")
    .update(patch)
    .eq("id", id)
    .select("id, status, framer_item_id, framer_url, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item: data });
}
