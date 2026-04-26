import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token ?? undefined);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const today = new Date().toISOString().split("T")[0];
    const weekStart = getWeekStart();
    const monthStart = today.slice(0, 7) + "-01";

    // Parallel fetches
    const [tasksRes, recapsRes, habitsRes, habitLogsRes] = await Promise.all([
      supabase.from("agenda_tasks").select("status, date, importance").eq("user_id", user.id),
      supabase.from("agenda_daily_recap").select("*").eq("user_id", user.id).order("recap_date", { ascending: false }).limit(60),
      supabase.from("agenda_habits").select("id, title, streak_current, streak_best").eq("user_id", user.id).eq("active", true),
      supabase.from("agenda_habit_logs").select("habit_id, logged_date").eq("user_id", user.id).gte("logged_date", monthStart),
    ]);

    const tasks = tasksRes.data ?? [];
    const recaps = recapsRes.data ?? [];
    const habits = habitsRes.data ?? [];
    const habitLogs = habitLogsRes.data ?? [];

    // Task completion rates
    const doneTasks = tasks.filter((t: { status: string }) => t.status === "done");
    const completionRate = tasks.length > 0
      ? Math.round((doneTasks.length / tasks.length) * 100)
      : 0;

    // Weekly task stats
    const weekTasks = tasks.filter((t: { date?: string }) => t.date && t.date >= weekStart && t.date <= today);
    const weekDone = weekTasks.filter((t: { status: string }) => t.status === "done").length;

    // Previous week task stats
    const prevWeekStart = getPreviousWeekStart();
    const prevWeekEnd = getWeekStart();
    const prevWeekTasks = tasks.filter((t: { date?: string }) => t.date && t.date >= prevWeekStart && t.date < prevWeekEnd);
    const prevWeekDone = prevWeekTasks.filter((t: { status: string }) => t.status === "done").length;

    // Monthly data by day (for heatmap)
    const monthlyData: Record<string, { done: number; total: number; score: number }> = {};
    for (const recap of recaps.filter((r: { recap_date: string }) => r.recap_date >= monthStart)) {
      if (!monthlyData[recap.recap_date]) {
        monthlyData[recap.recap_date] = { done: 0, total: 0, score: 0 };
      }
      monthlyData[recap.recap_date].done += recap.tasks_completed ?? 0;
      monthlyData[recap.recap_date].total += recap.tasks_planned ?? 0;
      monthlyData[recap.recap_date].score = recap.day_score ?? 0;
    }
    // Fill days with tasks but no recap
    for (const task of tasks.filter((t: { date?: string }) => t.date && t.date >= monthStart)) {
      if (!task.date) continue;
      if (!monthlyData[task.date]) {
        monthlyData[task.date] = { done: 0, total: 0, score: 0 };
      }
      monthlyData[task.date].total++;
      if (task.status === "done") {
        monthlyData[task.date].done++;
      }
    }

    // Best streaks
    const bestStreak = habits.reduce((max: number, h: { streak_best: number }) => Math.max(max, h.streak_best), 0);
    const currentBestStreak = habits.reduce((max: number, h: { streak_current: number }) => Math.max(max, h.streak_current), 0);

    // Average day score
    const avgDayScore = recaps.length > 0
      ? Math.round(recaps.reduce((s: number, r: { day_score: number }) => s + r.day_score, 0) / recaps.length * 10) / 10
      : 0;

    // Habit completion this month
    const habitDoneThisMonth = habitLogs.length;
    const habitPossibleThisMonth = habits.length * new Date().getDate();

    // Previous week habit completion from recaps
    const prevWeekRecaps = recaps.filter((r: { recap_date: string }) => r.recap_date >= prevWeekStart && r.recap_date < prevWeekEnd);
    const prevWeekHabitsDone = prevWeekRecaps.reduce((s: number, r: { habits_done?: number }) => s + (r.habits_done ?? 0), 0);
    const prevWeekHabitsTotal = prevWeekRecaps.reduce((s: number, r: { habits_total?: number }) => s + (r.habits_total ?? 0), 0);

    const thisWeekRecaps = recaps.filter((r: { recap_date: string }) => r.recap_date >= weekStart && r.recap_date <= today);
    const thisWeekHabitsDone = thisWeekRecaps.reduce((s: number, r: { habits_done?: number }) => s + (r.habits_done ?? 0), 0);
    const thisWeekHabitsTotal = thisWeekRecaps.reduce((s: number, r: { habits_total?: number }) => s + (r.habits_total ?? 0), 0);

    // Daily scores by week (last 8 weeks)
    const weeklyScores = getWeeklyScores(recaps);

    // Per-habit stats
    const habitStats = habits.map((habit: { id: string; title: string }) => {
      const logs = habitLogs.filter((l: { habit_id: string }) => l.habit_id === habit.id);
      const daysInMonth = new Date().getDate();
      const rate = daysInMonth > 0 ? Math.round((logs.length / daysInMonth) * 100) : 0;
      return {
        id: habit.id,
        title: habit.title,
        completions: logs.length,
        rate,
      };
    });

    return NextResponse.json({
      completionRate,
      weekTasks: weekTasks.length,
      weekDone,
      prevWeekTasks: prevWeekTasks.length,
      prevWeekDone,
      monthlyData,
      bestStreak,
      currentBestStreak,
      avgDayScore,
      habitCompletionRate: habitPossibleThisMonth > 0
        ? Math.round((habitDoneThisMonth / habitPossibleThisMonth) * 100)
        : 0,
      thisWeekHabitsDone,
      thisWeekHabitsTotal,
      prevWeekHabitsDone,
      prevWeekHabitsTotal,
      recaps: recaps.slice(0, 14),
      weeklyScores,
      habitStats,
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

function getPreviousWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) - 7;
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

function getWeeklyScores(recaps: { recap_date: string; day_score: number }[]) {
  const result: { week: string; score: number; count: number }[] = [];
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

    const weekRecaps = recaps.filter(
      (r) => r.recap_date.slice(0, 10) >= weekStart && r.recap_date.slice(0, 10) <= weekEnd
    );
    const totalScore = weekRecaps.reduce((s, r) => s + (r.day_score ?? 0), 0);
    const count = weekRecaps.length;
    const avgScore = count > 0 ? Math.round(totalScore / count) : 0;

    result.push({ week: weekStart, score: avgScore, count });
  }
  return result;
}
