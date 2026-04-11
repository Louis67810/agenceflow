import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/leads/webhook
 * Endpoint pour les agents externes (OpenClaw, scrapers, etc.)
 *
 * Headers requis:
 *   Authorization: Bearer <LEADS_WEBHOOK_API_KEY>
 *
 * Body:
 * {
 *   source: "google_maps" | "webhook" | ...,
 *   leads: [
 *     {
 *       email?, name?, company?, sector?, phone?,
 *       channel_preference?: "email" | "whatsapp" | "linkedin_dm",
 *       metadata?: {}   // données brutes de la source
 *     }
 *   ]
 * }
 *
 * Retourne: { inserted: number, skipped: number (doublons email) }
 */
export async function POST(req: NextRequest) {
  // Auth
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKey = authHeader.replace("Bearer ", "").trim();
  const expectedKey = process.env.LEADS_WEBHOOK_API_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const source: string = body.source ?? "webhook";
    const rawLeads: Record<string, unknown>[] = body.leads ?? [];

    if (!Array.isArray(rawLeads) || rawLeads.length === 0) {
      return NextResponse.json({ error: "leads array required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Dédoublonnage par email (on récupère les emails déjà existants)
    const emails = rawLeads.map((l) => l.email).filter(Boolean) as string[];
    const { data: existing } = await supabase
      .from("leads")
      .select("email")
      .in("email", emails);

    const existingEmails = new Set((existing ?? []).map((l) => l.email));

    const toInsert = rawLeads
      .filter((l) => !l.email || !existingEmails.has(l.email as string))
      .map((l) => ({
        email: (l.email as string) || null,
        name: (l.name as string) || null,
        company: (l.company as string) || null,
        sector: (l.sector as string) || null,
        phone: (l.phone as string) || null,
        source,
        source_ref: (l.source_ref as string) || null,
        channel_preference: (l.channel_preference as string) || "email",
        metadata: (l.metadata as Record<string, unknown>) || {},
        status: "new",
      }));

    let inserted = 0;
    if (toInsert.length > 0) {
      const { data, error } = await supabase
        .from("leads")
        .insert(toInsert)
        .select("id");
      if (error) throw error;
      inserted = data?.length ?? 0;
    }

    return NextResponse.json({
      inserted,
      skipped: rawLeads.length - inserted,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
