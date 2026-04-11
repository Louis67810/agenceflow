import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLevelFromPoints } from "@/lib/agenda/points";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const today = new Date().toISOString().split("T")[0];
    const weekStart = getWeekStart();
    const monthStart = today.slice(0, 7) + "-01";

    // Parallel fetches
    const [tasksRes, recapsRes, pointsRes, habitsRes, habitLogsRes] = await Promise.all([
      supabase.from("agenda_tasks").select("status, date, importance, points").eq("user_id", user.id),
      supabase.from("agenda_daily_recap").select("*").eq("user_id", user.id).order("recap_date", { ascending: false }).limit(30),
      supabase.from("agenda_points_log").select("points, earned_at").eq("user_id", user.id),
      supabase.from("agenda_habits").select("id, title, streak_current, streak_best, points").eq("user_id", user.id).eq("active", true),
      supabase.from("agenda_habit_logs").select("habit_id, logged_date").eq("user_id", user.id).gte("logged_date", monthStart),
    ]);

    const tasks = tasksRes.data ?? [];
    const recaps = recapsRes.data ?? [];
    const pointsLogs = pointsRes.data ?? [];
    const habits = habitsRes.data ?? [];
    const habitLogs = habitLogsRes.data ?? [];

    // Total points
    const totalPoints = pointsLogs.reduce((s, p) => s + p.points, 0);
    const levelInfo = getLevelFromPoints(totalPoints);

    // Week points
    const weekPoints = pointsLogs
      .filter(p => p.earned_at >= weekStart)
      .reduce((s, p) => s + p.points, 0);

    // Task completion rates
    const doneTasks = tasks.filter(t => t.status === "done");
    const completionRate = tasks.length > 0
      ? Math.round((doneTasks.length / tasks.length) * 100)
      : 0;

    // Weekly task stats
    const weekTasks = tasks.filter(t => t.date >= weekStart && t.date <= today);
    const weekDone = weekTasks.filter(t => t.status === "done").length;

    // Monthly task stats by day
    const monthlyData: Record<string, { done: number; total: number; points: number }> = {};
    for (const task of tasks.filter(t => t.date >= monthStart)) {
      if (!monthlyData[task.date]) monthlyData[task.date] = { done: 0, total: 0, points: 0 };
      monthlyData[task.date].total++;
      if (task.status === "done") {
        monthlyData[task.date].done++;
        monthlyData[task.date].points += task.points ?? 0;
      }
    }

    // Best streaks
    const bestStreak = habits.reduce((max, h) => Math.max(max, h.streak_best), 0);
    const currentBestStreak = habits.reduce((max, h) => Math.max(max, h.streak_current), 0);

    // Average day score
    const avgDayScore = recaps.length > 0
      ? Math.round(recaps.reduce((s, r) => s + r.day_score, 0) / recaps.length * 10) / 10
      : 0;

    // Habit completion this month
    const habitDoneThisMonth = habitLogs.length;
    const habitPossibleThisMonth = habits.length * new Date().getDate();

    // Points by week (last 8 weeks)
    const weeklyPoints = getWeeklyPoints(pointsLogs);

    return NextResponse.json({
      totalPoints,
      weekPoints,
      levelInfo,
      completionRate,
      weekTasks: weekTasks.length,
      weekDone,
      monthlyData,
      bestStreak,
      currentBestStreak,
      avgDayScore,
      habitCompletionRate: habitPossibleThisMonth > 0
        ? Math.round((habitDoneThisMonth / habitPossibleThisMonth) * 100)
        : 0,
      recaps: recaps.slice(0, 14),
      weeklyPoints,
    });
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

function getWeeklyPoints(logs: { points: number; earned_at: string }[]) {
  const result: { week: string; points: number }[] = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const weekDate = new Date(now);
    weekDate.setDate(weekDate.getDate() - i * 7);
    const day = weekDate.getDay();
    const start = new Date(weekDate);
    start.setDate(weekDate.getDate() - day + (day === 0 ? -6 : 1));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const weekStart = start.toISOString().split("T")[0];
    const weekEnd = end.toISOString().split("T")[0];
    const pts = logs
      .filter(l => l.earned_at.slice(0, 10) >= weekStart && l.earned_at.slice(0, 10) <= weekEnd)
      .reduce((s, l) => s + l.points, 0);

    result.push({ week: weekStart, points: pts });
  }
  return result;
}
