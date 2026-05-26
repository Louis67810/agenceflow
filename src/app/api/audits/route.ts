import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeWebsiteUrl } from "@/lib/audits/templates";

const NAME_KEYS = ["name", "nom", "full_name", "fullname", "prenom", "prénom"];
const EMAIL_KEYS = ["email", "mail", "e-mail"];
const PHONE_KEYS = ["phone", "telephone", "téléphone", "tel", "mobile"];
const WEBSITE_KEYS = ["website", "site", "site_url", "url", "lien", "website_url"];
const DOMAIN_KEYS = ["domain", "domaine", "activity", "activite", "activité", "industry", "secteur"];
const BUSINESS_KEYS = ["business", "entreprise", "description", "offer", "offre", "metier", "métier"];
const QUESTION_KEYS = ["question", "objectif", "problem", "probleme", "problème", "besoin"];

function findField(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key] ?? data[key.toLowerCase()] ?? data[key.toUpperCase()];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  for (const [key, value] of Object.entries(data)) {
    if (
      typeof value === "string" &&
      value.trim() &&
      keys.some((candidate) => key.toLowerCase().includes(candidate.toLowerCase()))
    ) {
      return value.trim();
    }
  }

  return "";
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("audit_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ audits: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const raw: Record<string, unknown> = body?.data && typeof body.data === "object" ? body.data : body ?? {};

    const fullName = findField(raw, NAME_KEYS);
    const email = findField(raw, EMAIL_KEYS);
    const phone = findField(raw, PHONE_KEYS);
    const websiteUrl = normalizeWebsiteUrl(findField(raw, WEBSITE_KEYS));
    const businessDomain = findField(raw, DOMAIN_KEYS);
    const businessDescription = findField(raw, BUSINESS_KEYS);
    const mainQuestion = findField(raw, QUESTION_KEYS);

    if (!fullName || !email || !websiteUrl) {
      return NextResponse.json(
        { error: "Nom, email et lien du site requis" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient() ?? await createClient();
    const { data, error } = await supabase
      .from("audit_requests")
      .insert({
        full_name: fullName,
        email,
        phone,
        website_url: websiteUrl,
        business_domain: businessDomain,
        business_description: businessDescription,
        main_question: mainQuestion,
        raw_answers: raw,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ audit: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

