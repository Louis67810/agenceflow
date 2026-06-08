import { NextRequest, NextResponse } from "next/server";
import { getRouteAuthenticatedUser } from "@/lib/supabase/route-client";
import { COLD_CALL_STATUSES } from "@/types/cold-calls";

const allowed = new Set(["first_name","last_name","company","phone","email","business_description","sector","has_website","website_url","audit_sent","audit_url","status","notes","next_call_at","last_called_at","selected_script_id","metadata"]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, user } = await getRouteAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const [key, value] of Object.entries(body)) if (allowed.has(key)) patch[key] = value;
    if (patch.status && !COLD_CALL_STATUSES.includes(patch.status as never)) delete patch.status;
    const { data, error } = await supabase.from("cold_call_leads").update(patch).eq("id", id).eq("user_id", user.id).select("*, cold_call_attempts(*)").single();
    if (error) throw error;
    return NextResponse.json({ lead: data });
  } catch (error) { return NextResponse.json({ error: String(error) }, { status: 500 }); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, user } = await getRouteAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { error } = await supabase.from("cold_call_leads").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: String(error) }, { status: 500 }); }
}
