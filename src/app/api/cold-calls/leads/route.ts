import { NextRequest, NextResponse } from "next/server";
import { getRouteAuthenticatedUser } from "@/lib/supabase/route-client";
import { COLD_CALL_STATUSES } from "@/types/cold-calls";

const allowedStatuses = new Set<string>(COLD_CALL_STATUSES);

function cleanLead(input: Record<string, unknown>, userId: string) {
  const status = typeof input.status === "string" && allowedStatuses.has(input.status) ? input.status : "not_contacted";
  const websiteUrl = String(input.website_url ?? "").trim() || null;
  return {
    user_id: userId,
    first_name: String(input.first_name ?? "").trim() || null,
    last_name: String(input.last_name ?? "").trim() || null,
    company: String(input.company ?? "").trim() || "Entreprise sans nom",
    phone: String(input.phone ?? "").trim() || null,
    email: String(input.email ?? "").trim() || null,
    business_description: String(input.business_description ?? "").trim() || null,
    sector: String(input.sector ?? "").trim() || null,
    has_website: Boolean(input.has_website ?? websiteUrl),
    website_url: websiteUrl,
    audit_sent: Boolean(input.audit_sent),
    audit_url: String(input.audit_url ?? "").trim() || null,
    status,
    source: String(input.source ?? "csv").trim() || "csv",
    source_ref: String(input.source_ref ?? "").trim() || null,
    notes: String(input.notes ?? "").trim() || null,
    metadata: typeof input.metadata === "object" && input.metadata ? input.metadata : {},
  };
}

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await getRouteAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data, error } = await supabase.from("cold_call_leads").select("*, cold_call_attempts(*)").eq("user_id", user.id).order("updated_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ leads: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await getRouteAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const rawLeads = Array.isArray(body.leads) ? body.leads : [body];
    if (rawLeads.length === 0 || rawLeads.length > 1000) return NextResponse.json({ error: "Import limité à 1000 leads par fichier." }, { status: 400 });
    const rows = rawLeads.map((lead: Record<string, unknown>) => cleanLead(lead, user.id));
    const { data, error } = await supabase.from("cold_call_leads").insert(rows).select();
    if (error) throw error;
    return NextResponse.json({ leads: data ?? [], imported: data?.length ?? 0 }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
