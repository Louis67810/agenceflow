"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { CheckSquare, Flame, Star, TrendingUp, ChevronRight, Circle, CheckCircle2, Zap } from "lucide-react";
import type { AgendaTask, AgendaHabit } from "@/types/agenda";
import { getLevelFromPoints } from "@/lib/agenda/points";

interface DashboardData {
  todayTasks: AgendaTask[];
  habits: (AgendaHabit & { done_today: boolean })[];
  weekPoints: number;
  totalPoints: number;
  weekGoal: number;
  recentRecap?: { day_score: number; recap_date: string };
}

export default function AgendaDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    async function load() {
      const [tasksRes, habitsRes, statsRes, settingsRes] = await Promise.all([
        fetch(`/api/agenda/tasks?date=${today}`).then(r => r.json()),
        fetch("/api/agenda/habits").then(r => r.json()),
        fetch("/api/agenda/stats").then(r => r.json()),
        fetch("/api/agenda/settings").then(r => r.json()),
      ]);

      setData({
        todayTasks: tasksRes.tasks ?? [],
        habits: habitsRes.habits ?? [],
        weekPoints: statsRes.weekPoints ?? 0,
        totalPoints: statsRes.totalPoints ?? 0,
        weekGoal: settingsRes.settings?.weekly_points_goal ?? 500,
        recentRecap: statsRes.recaps?.[0],
      });
      setLoading(false);
    }
    load();
  }, [today]);

  const handleToggleTask = async (task: AgendaTask) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    await fetch(`/api/agenda/tasks/${task.id}`, {
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
      await fetch(`/api/agenda/habits/${habit.id}/log`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today }),
      });
    } else {
      await fetch(`/api/agenda/habits/${habit.id}/log`, {
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
  const weekPct = data ? Math.min(100, Math.round((data.weekPoints / data.weekGoal) * 100)) : 0;
  const levelInfo = getLevelFromPoints(data?.totalPoints ?? 0);
  const taskPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const todayFmt = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <p className="text-sm text-gray-500 capitalize">{todayFmt}</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Bonjour 👋</h1>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
        <StatCard
          icon={<CheckSquare size={20} className="text-indigo-500" />}
          label="Tâches aujourd'hui"
          value={`${doneTasks}/${totalTasks}`}
          sub={`${taskPct}% complétées`}
          color="indigo"
        />
        <StatCard
          icon={<Flame size={20} className="text-orange-500" />}
          label="Habitudes"
          value={`${doneHabits}/${totalHabits}`}
          sub={totalHabits > 0 ? `${Math.round((doneHabits / totalHabits) * 100)}% faites` : "Aucune habitude"}
          color="orange"
        />
        <StatCard
          icon={<Zap size={20} className="text-yellow-500" />}
          label="Points cette semaine"
          value={String(data?.weekPoints ?? 0)}
          sub={`Objectif: ${data?.weekGoal ?? 500} pts`}
          color="yellow"
        />
        <StatCard
          icon={<Star size={20} className="text-purple-500" />}
          label="Niveau"
          value={levelInfo.label}
          sub={`${data?.totalPoints ?? 0} pts total`}
          color="purple"
        />
      </div>

      {/* Week progress bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Progression semaine</span>
          <span className="text-sm text-indigo-600 font-semibold">{weekPct}%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
            style={{ width: `${weekPct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">{data?.weekPoints ?? 0} / {data?.weekGoal ?? 500} points — Niveau: {levelInfo.label} (Niv. {levelInfo.level})</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Today's tasks */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Tâches du jour</h2>
            <Link href="/admin/agenda/tasks" className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5">
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
                    : <Circle size={18} className="text-gray-300 group-hover:text-indigo-400 shrink-0 transition-colors" />
                  }
                  <span className={`text-sm flex-1 ${task.status === "done" ? "line-through text-gray-400" : "text-gray-700"}`}>
                    {task.title}
                  </span>
                  <span className="text-xs text-yellow-500 font-medium">+{task.points}pts</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/admin/agenda/tasks"
            className="mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-50 text-indigo-600 text-sm font-medium hover:bg-indigo-100 transition-colors"
          >
            + Ajouter une tâche
          </Link>
        </div>

        {/* Habits */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Habitudes du jour</h2>
            <Link href="/admin/agenda/habits" className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5">
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
                      <p className="text-xs text-orange-500">🔥 {habit.streak_current} jours</p>
                    )}
                  </div>
                  <span className="text-xs text-yellow-500 font-medium">+{habit.points}pts</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickAction href="/admin/agenda/calendar" icon="📅" label="Calendrier" />
        <QuickAction href="/admin/agenda/objectives" icon="🎯" label="Objectifs" />
        <QuickAction href="/admin/agenda/recap" icon="✍️" label="Récap du jour" />
        <QuickAction href="/admin/agenda/pomodoro" icon="🍅" label="Pomodoro" />
      </div>

      {data?.recentRecap && (
        <div className="mt-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-4 flex items-center gap-4">
          <TrendingUp size={24} className="text-indigo-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-700">Dernier récap · {new Date(data.recentRecap.recap_date).toLocaleDateString("fr-FR")}</p>
            <p className="text-xs text-gray-500">Score de la journée: <strong>{data.recentRecap.day_score}/10</strong></p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  const bg: Record<string, string> = {
    indigo: "bg-indigo-50",
    orange: "bg-orange-50",
    yellow: "bg-yellow-50",
    purple: "bg-purple-50",
  };
  return (
    <div className={`${bg[color] ?? "bg-gray-50"} rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

function QuickAction({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white border border-gray-200 hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-medium text-gray-600">{label}</span>
    </Link>
  );
}
