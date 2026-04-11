import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/leads?source=&status=&search=&limit=&offset=
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const source = searchParams.get("source");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") ?? "50");
    const offset = parseInt(searchParams.get("offset") ?? "0");

    const supabase = await createClient();

    let query = supabase
      .from("leads")
      .select("*, outreach_attempts(count)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (source) query = query.eq("source", source);
    if (status) query = query.eq("status", status);
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;
    if (error) throw error;

    // Stats agrégées
    const { data: stats } = await supabase
      .from("leads")
      .select("source, status");

    const bySource: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    (stats ?? []).forEach((l) => {
      bySource[l.source] = (bySource[l.source] ?? 0) + 1;
      byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
    });

    return NextResponse.json({
      leads: data ?? [],
      total: count ?? 0,
      bySource,
      byStatus,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/leads — créer un lead manuellement
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("leads")
      .insert({
        email: body.email || null,
        name: body.name || null,
        company: body.company || null,
        sector: body.sector || null,
        phone: body.phone || null,
        source: body.source ?? "manual",
        source_ref: body.source_ref ?? null,
        status: "new",
        channel_preference: body.channel_preference ?? "email",
        metadata: body.metadata ?? {},
        notes: body.notes ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ lead: data }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
