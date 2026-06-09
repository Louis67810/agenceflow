import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMissingSchemaColumn } from "@/lib/supabase/postgrest";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token ?? undefined);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data } = await supabase
      .from("agenda_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    // Return defaults if no settings exist
    const defaults = {
      work_start: "09:00",
      work_end: "18:00",
      slot_duration_minutes: 30,
      pomodoro_work_minutes: 25,
      pomodoro_short_break: 5,
      pomodoro_long_break: 15,
      pomodoro_sessions_before_long: 4,
      weekly_points_goal: 500,
      auto_schedule_enabled: true,
      recap_reminder_time: "18:30",
      timezone: "Europe/Paris",
      pwa_notifications_enabled: false,
      morning_brief_enabled: true,
      morning_brief_time: "08:30",
      recap_reminder_enabled: true,
    };

    return NextResponse.json({ settings: data ?? defaults });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token ?? undefined);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const payload = { ...body, user_id: user.id, updated_at: new Date().toISOString() };

    while (true) {
      const { data, error } = await supabase
        .from("agenda_settings")
        .upsert(payload, { onConflict: "user_id" })
        .select()
        .single();

      if (!error) return NextResponse.json({ settings: data });

      const missingColumn = getMissingSchemaColumn(error);
      if (!missingColumn || !(missingColumn in payload)) throw error;
      delete (payload as Record<string, unknown>)[missingColumn];
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
