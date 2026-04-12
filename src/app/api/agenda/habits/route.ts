import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const today = new Date().toISOString().split("T")[0];
    const weekStart = getWeekStart();

    const [habitsRes, logsRes] = await Promise.all([
      supabase.from("agenda_habits").select("*").eq("user_id", user.id).eq("active", true).order("created_at"),
      supabase.from("agenda_habit_logs").select("habit_id, logged_date").eq("user_id", user.id).gte("logged_date", weekStart),
    ]);

    const habits = habitsRes.data ?? [];
    const logs = logsRes.data ?? [];

    const todayLogs = new Set(logs.filter(l => l.logged_date === today).map(l => l.habit_id));
    const weekCounts: Record<string, number> = {};
    for (const log of logs) {
      weekCounts[log.habit_id] = (weekCounts[log.habit_id] ?? 0) + 1;
    }

    const enriched = habits.map(h => ({
      ...h,
      done_today: todayLogs.has(h.id),
      done_this_week: weekCounts[h.id] ?? 0,
    }));

    return NextResponse.json({ habits: enriched });
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
      .from("agenda_habits")
      .insert({ ...body, user_id: user.id })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ habit: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}
