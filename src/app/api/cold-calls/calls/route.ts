import { NextRequest, NextResponse } from "next/server";
import { getRouteAuthenticatedUser } from "@/lib/supabase/route-client";

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await getRouteAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    if (!body.lead_id) return NextResponse.json({ error: "lead_id requis" }, { status: 400 });
    const attempt = { user_id: user.id, lead_id: body.lead_id, script_id: body.script_id || null, outcome: body.outcome || "connected", summary: body.summary || null, transcript: body.transcript || null, recording_url: body.recording_url || null, coaching_notes: body.coaching_notes || null, duration_seconds: body.duration_seconds || null, external_call_id: body.external_call_id || null, ended_at: body.ended_at || new Date().toISOString() };
    const { data, error } = await supabase.from("cold_call_attempts").insert(attempt).select().single();
    if (error) throw error;
    await supabase.from("cold_call_leads").update({ status: body.outcome === "connected" ? "qualified" : body.outcome || "no_answer", last_called_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", body.lead_id).eq("user_id", user.id);
    if (body.script_id) {
      const { data: script } = await supabase.from("cold_call_scripts").select("calls_count, connected_count, meetings_count").eq("id", body.script_id).eq("user_id", user.id).single();
      if (script) await supabase.from("cold_call_scripts").update({ calls_count: script.calls_count + 1, connected_count: script.connected_count + (body.outcome !== "no_answer" ? 1 : 0), meetings_count: script.meetings_count + (body.outcome === "meeting_booked" ? 1 : 0), updated_at: new Date().toISOString() }).eq("id", body.script_id).eq("user_id", user.id);
    }
    return NextResponse.json({ attempt: data }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: String(error) }, { status: 500 }); }
}
