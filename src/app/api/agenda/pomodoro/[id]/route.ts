import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { data, error } = await supabase
      .from("agenda_pomodoro_sessions")
      .update({
        completed: body.completed,
        ended_at: body.ended_at ?? new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;

    // Award points for completed work session
    if (body.completed && data?.session_type === "work") {
      await supabase.from("agenda_points_log").insert({
        user_id: user.id,
        points: 20,
        reason: `Session Pomodoro complétée (${data.duration_minutes} min)`,
        entity_type: "pomodoro",
        entity_id: id,
      });
    }

    return NextResponse.json({ session: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
