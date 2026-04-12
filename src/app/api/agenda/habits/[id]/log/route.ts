import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token ?? undefined);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const logDate = body.date ?? new Date().toISOString().split("T")[0];

    // Fetch habit for points
    const { data: habit } = await supabase
      .from("agenda_habits")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!habit) return NextResponse.json({ error: "Habit not found" }, { status: 404 });

    // Try to insert log (upsert)
    const { data: log, error } = await supabase
      .from("agenda_habit_logs")
      .upsert({ habit_id: id, user_id: user.id, logged_date: logDate, note: body.note }, { onConflict: "habit_id,logged_date" })
      .select()
      .single();

    if (error) throw error;

    // Update streak
    const streak = await computeStreak(supabase, id, user.id, logDate);
    await supabase.from("agenda_habits").update({
      streak_current: streak,
      streak_best: Math.max(habit.streak_best, streak),
    }).eq("id", id);

    // Log points
    await supabase.from("agenda_points_log").insert({
      user_id: user.id,
      points: habit.points,
      reason: `Habitude: ${habit.title}`,
      entity_type: "habit",
      entity_id: id,
    });

    return NextResponse.json({ log, streak });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token ?? undefined);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const logDate = body.date ?? new Date().toISOString().split("T")[0];

    await supabase
      .from("agenda_habit_logs")
      .delete()
      .eq("habit_id", id)
      .eq("user_id", user.id)
      .eq("logged_date", logDate);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function computeStreak(supabase: any, habitId: string, userId: string, today: string): Promise<number> {
  const { data: logs } = await supabase
    .from("agenda_habit_logs")
    .select("logged_date")
    .eq("habit_id", habitId)
    .eq("user_id", userId)
    .order("logged_date", { ascending: false })
    .limit(60);

  if (!logs || logs.length === 0) return 0;

  const dates = new Set(logs.map((l: { logged_date: string }) => l.logged_date));
  let streak = 0;
  const cur = new Date(today);

  while (dates.has(cur.toISOString().split("T")[0])) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }

  return streak;
}
