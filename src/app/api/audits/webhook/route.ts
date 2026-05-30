import { NextRequest, NextResponse } from "next/server";
import { normalizeWebsiteUrl } from "@/lib/audits/templates";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

const NAME_KEYS = ["name", "nom", "full_name", "fullname", "prenom", "first_name", "last_name"];
const EMAIL_KEYS = ["email", "mail", "e-mail"];
const PHONE_KEYS = ["phone", "telephone", "tel", "mobile"];
const WEBSITE_KEYS = ["website", "site", "site_url", "url", "lien", "website_url"];
const DOMAIN_KEYS: string[] = [];
const BUSINESS_KEYS = ["business", "revenue", "ca", "chiffre_affaires", "chiffre d'affaires", "tranche", "salary", "salaire"];
const QUESTION_KEYS: string[] = [];

const AUDIT_STATUSES = new Set(["pending", "accepted", "refused", "audit_ready", "sent"]);

function getCorsHeaders(origin: string | null) {
  const allowed = (process.env.AUDITS_WEBHOOK_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const allowOrigin = allowed.length === 0 || (origin && allowed.includes(origin))
    ? origin ?? "*"
    : allowed[0] ?? "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function findField(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key] ?? data[key.toLowerCase()] ?? data[key.toUpperCase()];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  for (const [key, value] of Object.entries(data)) {
    if (
      typeof value === "string"
      && value.trim()
      && keys.some((candidate) => key.toLowerCase().includes(candidate.toLowerCase()))
    ) {
      return value.trim();
    }
  }

  return "";
}

function getWebhookPayload(body: unknown) {
  if (!body || typeof body !== "object") return {};
  return body as Record<string, unknown>;
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(req.headers.get("origin")),
  });
}

export async function POST(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  const expectedKey = process.env.AUDITS_WEBHOOK_API_KEY;
  if (expectedKey) {
    const authHeader = req.headers.get("authorization") ?? "";
    const apiKey = authHeader.replace("Bearer ", "").trim();

    if (apiKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }
  }

  try {
    const body = getWebhookPayload(await req.json());
    const data = body.data && typeof body.data === "object"
      ? body.data as Record<string, unknown>
      : body;

    const fullName = findField(data, NAME_KEYS);
    const email = findField(data, EMAIL_KEYS);
    const phone = findField(data, PHONE_KEYS);
    const websiteUrl = normalizeWebsiteUrl(findField(data, WEBSITE_KEYS));
    const businessDomain = findField(data, DOMAIN_KEYS);
    const businessDescription = findField(data, BUSINESS_KEYS);
    const mainQuestion = findField(data, QUESTION_KEYS);
    const requestedStatus = typeof body.status === "string" && AUDIT_STATUSES.has(body.status)
      ? body.status
      : "pending";

    if (!fullName || !email || !websiteUrl) {
      return NextResponse.json(
        { error: "name, email and website are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createServiceClient() ?? await createClient();
    const { data: audit, error } = await supabase
      .from("audit_requests")
      .insert({
        full_name: fullName,
        email,
        phone,
        website_url: websiteUrl,
        business_domain: businessDomain,
        business_description: businessDescription,
        main_question: mainQuestion,
        status: requestedStatus,
        raw_answers: body,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ audit, received: true }, { status: 201, headers: corsHeaders });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: corsHeaders });
  }
}
