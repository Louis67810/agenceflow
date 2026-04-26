"use client";

import { agendaFetch } from "@/lib/agenda/fetchWithAuth";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { CheckSquare, Flame, Star, TrendingUp, ChevronRight, Circle, CheckCircle2, Calendar, Target, PenLine, Timer } from "lucide-react";
import type { AgendaTask, AgendaHabit } from "@/types/agenda";
import { calculateDayScore } from "@/lib/agenda/points";

interface DashboardData {
  todayTasks: AgendaTask[];
  habits: (AgendaHabit & { done_today: boolean })[];
  recentRecap?: { day_score: number; recap_date: string };
}

interface DailyScore {
  date: string;
  score: number;
  done: number;
  total: number;
}

interface HabitLog {
  habit_id: string;
  logged_date: string;
}

interface StatsData {
  monthlyData: Record<string, { done: number; total: number; score: number }>;
  habitLogs: HabitLog[];
  recaps: { recap_date: string; day_score: number; tasks_completed: number; habits_done: number; points_earned: number; bonus_points: number }[];
}

function scoreToColor(score: number): string {
  const alpha = score / 100 * 0.9 + 0.05;
  return `rgba(1, 71, 255, ${alpha})`;
}

function getWeeksForHeatmap(days: number) {
  const weeks: { date: Date; key: string }[][] = [];
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days + 1);

  // Adjust start to Monday
  const startDay = start.getDay();
  const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
  start.setDate(start.getDate() + mondayOffset);

  let current = new Date(start);
  while (current <= end) {
    const week: { date: Date; key: string }[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: new Date(current), key: current.toISOString().split("T")[0] });
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function getMonthLabels(weeks: { date: Date; key: string }[][]) {
  const labels: { month: string; weekIndex: number }[] = [];
  let lastMonth = "";
  weeks.forEach((week, i) => {
    const mid = week[3];
    const month = mid.date.toLocaleDateString("fr-FR", { month: "short" });
    if (month !== lastMonth) {
      labels.push({ month, weekIndex: i });
      lastMonth = month;
    }
  });
  return labels;
}

export default function AgendaDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedHabitId, setSelectedHabitId] = useState<string>("");
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    async function load() {
      const [tasksRes, habitsRes, recapRes, statsRes] = await Promise.all([
        agendaFetch(`/api/agenda/tasks?date=${today}`).then(r => r.json()),
        agendaFetch("/api/agenda/habits").then(r => r.json()),
        agendaFetch(`/api/agenda/recap?date=${today}`).then(r => r.json()),
        agendaFetch("/api/agenda/stats").then(r => r.json()).catch(() => null),
      ]);

      setData({
        todayTasks: tasksRes.tasks ?? [],
        habits: habitsRes.habits ?? [],
        recentRecap: recapRes.recap ? { day_score: recapRes.recap.day_score, recap_date: recapRes.recap.recap_date } : undefined,
      });

      if (statsRes && !statsRes.error) {
        setStats({
          monthlyData: statsRes.monthlyData ?? {},
          habitLogs: statsRes.habitLogs ?? [],
          recaps: statsRes.recaps ?? [],
        });
      }

      if (habitsRes.habits?.length > 0) {
        setSelectedHabitId(habitsRes.habits[0].id);
      }

      setLoading(false);
    }
    load();
  }, [today]);

  const handleToggleTask = async (task: AgendaTask) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    await agendaFetch(`/api/agenda/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setData(prev => prev ? {
      ...prev,
      todayTasks: prev.todayTasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t),
    } : prev);
  };

  const handleToggleHabit = async (habit: AgendaHabit & { done_today: boolean }) => {
    if (habit.done_today) {
      await agendaFetch(`/api/agenda/habits/${habit.id}/log`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today }),
      });
    } else {
      await agendaFetch(`/api/agenda/habits/${habit.id}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today }),
      });
    }
    setData(prev => prev ? {
      ...prev,
      habits: prev.habits.map(h => h.id === habit.id ? { ...h, done_today: !h.done_today } : h),
    } : prev);
  };

  if (loading) {
    return <div className="p-8 text-gray-400">Chargement...</div>;
  }

  const doneTasks = data?.todayTasks.filter(t => t.status === "done").length ?? 0;
  const totalTasks = data?.todayTasks.length ?? 0;
  const doneHabits = data?.habits.filter(h => h.done_today).length ?? 0;
  const totalHabits = data?.habits.length ?? 0;
  const taskPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const currentDayScore = data?.recentRecap?.day_score ?? calculateDayScore(doneTasks, totalTasks, doneHabits, totalHabits);

  const todayFmt = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  // Heatmap data (~90 days)
  const heatmapWeeks = getWeeksForHeatmap(91);
  const monthLabels = getMonthLabels(heatmapWeeks);

  // Habit evolution data (last 30 days)
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().split("T")[0];
  });

  const habitLogsForSelected = stats?.habitLogs?.filter(l => l.habit_id === selectedHabitId) ?? [];
  const habitLogSet = new Set(habitLogsForSelected.map(l => l.logged_date));

  return (
    <div className="p-6 max-w-4xl mx-auto bg-[#fbfbfb] min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm text-gray-500 capitalize">{todayFmt}</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Bonjour</h1>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
        <StatCard
          icon={<CheckSquare size={20} className="text-[#0147FF]" />}
          label="Tâches aujourd'hui"
          value={`${doneTasks}/${totalTasks}`}
          sub={`${taskPct}% complétées`}
        />
        <StatCard
          icon={<Flame size={20} className="text-orange-500" />}
          label="Habitudes"
          value={`${doneHabits}/${totalHabits}`}
          sub={totalHabits > 0 ? `${Math.round((doneHabits / totalHabits) * 100)}% faites` : "Aucune habitude"}
        />
        <StatCard
          icon={<Star size={20} className="text-yellow-500" />}
          label="Score du jour"
          value={`${currentDayScore}/100`}
          sub={data?.recentRecap ? "Récap enregistré" : "En cours"}
        />
        <StatCard
          icon={<TrendingUp size={20} className="text-green-500" />}
          label="Série active"
          value={`${Math.max(...(data?.habits.map(h => h.streak_current) ?? [0]), 0)}j`}
          sub="meilleure série"
        />
      </div>

      {/* Day score progress bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Score du jour</span>
          <span className="text-sm text-[#0147FF] font-semibold">{currentDayScore}/100</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              currentDayScore >= 80 ? "bg-green-500" : currentDayScore >= 60 ? "bg-yellow-400" : "bg-red-400"
            }`}
            style={{ width: `${currentDayScore}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {doneTasks}/{totalTasks} tâches · {doneHabits}/{totalHabits} habitudes
        </p>
      </div>

      {/* Heatmap */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h2 className="font-semibold text-gray-800 mb-3">Activité des 3 derniers mois</h2>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Month labels */}
            <div className="flex mb-1" style={{ paddingLeft: 20 }}>
              {monthLabels.map((m, i) => (
                <span
                  key={i}
                  className="text-[10px] text-gray-400 uppercase tracking-wide absolute"
                  style={{ marginLeft: `${m.weekIndex * (12 + 2)}px` }}
                >
                  {m.month}
                </span>
              ))}
            </div>
            <div className="flex gap-[2px]">
              {heatmapWeeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[2px]">
                  {week.map((day, di) => {
                    const dayData = stats?.monthlyData?.[day.key];
                    const score = dayData?.score ?? 0;
                    const isFuture = day.key > today;
                    return (
                      <div
                        key={di}
                        className="rounded-sm"
                        style={{
                          width: 12,
                          height: 12,
                          background: isFuture ? "#f3f4f6" : scoreToColor(score),
                        }}
                        title={`${day.key}: ${score}/100`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
          <span>Moins</span>
          {[0, 25, 50, 75, 100].map(s => (
            <div
              key={s}
              className="rounded-sm"
              style={{ width: 12, height: 12, background: scoreToColor(s) }}
            />
          ))}
          <span>Plus</span>
        </div>
      </div>

      {/* Habit evolution chart */}
      {data?.habits && data.habits.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Suivi d'habitude (30 jours)</h2>
            <select
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0147FF]/20"
              value={selectedHabitId}
              onChange={e => setSelectedHabitId(e.target.value)}
            >
              {data.habits.map(h => (
                <option key={h.id} value={h.id}>{h.title}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-[3px] h-24">
            {last30Days.map(date => {
              const isDone = habitLogSet.has(date);
              const isToday = date === today;
              return (
                <div key={date} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-sm transition-all ${isToday ? "ring-1 ring-[#0147FF]" : ""}`}
                    style={{
                      height: "100%",
                      background: isDone ? "#0147FF" : "#f3f4f6",
                      minHeight: 4,
                    }}
                    title={`${date}: ${isDone ? "Fait" : "Non fait"}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>{new Date(last30Days[0]).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
            <span>Aujourd'hui</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Today's tasks */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Tâches du jour</h2>
            <Link href="/admin/agenda/tasks" className="text-xs text-[#0147FF] hover:underline flex items-center gap-0.5">
              Voir tout <ChevronRight size={12} />
            </Link>
          </div>
          {data?.todayTasks.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Aucune tâche pour aujourd&apos;hui</p>
          ) : (
            <ul className="space-y-2">
              {data?.todayTasks.slice(0, 5).map(task => (
                <li
                  key={task.id}
                  className="flex items-center gap-3 cursor-pointer group"
                  onClick={() => handleToggleTask(task)}
                >
                  {task.status === "done"
                    ? <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                    : <Circle size={18} className="text-gray-300 group-hover:text-[#0147FF] shrink-0 transition-colors" />
                  }
                  <span className={`text-sm flex-1 ${task.status === "done" ? "line-through text-gray-400" : "text-gray-700"}`}>
                    {task.title}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/admin/agenda/tasks"
            className="mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-full bg-[#121A2E] text-white text-sm font-medium hover:bg-[#1a2540] transition-colors"
          >
            + Ajouter une tâche
          </Link>
        </div>

        {/* Habits */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Habitudes du jour</h2>
            <Link href="/admin/agenda/habits" className="text-xs text-[#0147FF] hover:underline flex items-center gap-0.5">
              Gérer <ChevronRight size={12} />
            </Link>
          </div>
          {data?.habits.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Aucune habitude configurée</p>
          ) : (
            <ul className="space-y-2">
              {data?.habits.map(habit => (
                <li
                  key={habit.id}
                  className="flex items-center gap-3 cursor-pointer group"
                  onClick={() => handleToggleHabit(habit)}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-all ${
                      habit.done_today ? "opacity-100 scale-100" : "opacity-50 scale-95 group-hover:opacity-75"
                    }`}
                    style={{ background: habit.done_today ? habit.color + "20" : "#f3f4f6" }}
                  >
                    {habit.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${habit.done_today ? "text-gray-500 line-through" : "text-gray-700"}`}>
                      {habit.title}
                    </p>
                    {habit.streak_current > 0 && (
                      <p className="text-xs text-orange-500 flex items-center gap-1"><Flame size={12} /> {habit.streak_current} jours</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickAction href="/admin/agenda/calendar" icon={<Calendar size={20} />} label="Calendrier" />
        <QuickAction href="/admin/agenda/objectives" icon={<Target size={20} />} label="Objectifs" />
        <QuickAction href="/admin/agenda/recap" icon={<PenLine size={20} />} label="Récap du jour" />
        <QuickAction href="/admin/agenda/pomodoro" icon={<Timer size={20} />} label="Pomodoro" />
      </div>

      {data?.recentRecap && (
        <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
          <TrendingUp size={24} className="text-[#0147FF] shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-700">Dernier récap · {new Date(data.recentRecap.recap_date).toLocaleDateString("fr-FR")}</p>
            <p className="text-xs text-gray-500">Score de la journée: <strong>{data.recentRecap.day_score}/100</strong></p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub }: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white border border-gray-200 hover:border-[#0147FF] hover:text-[#0147FF] transition-colors"
    >
      <span className="text-[#0147FF]">{icon}</span>
      <span className="text-xs font-medium text-gray-600">{label}</span>
    </Link>
  );
}
