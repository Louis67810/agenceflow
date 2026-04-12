import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    };

    return NextResponse.json({ settings: data ?? defaults });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { data, error } = await supabase
      .from("agenda_settings")
      .upsert({ ...body, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ settings: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
