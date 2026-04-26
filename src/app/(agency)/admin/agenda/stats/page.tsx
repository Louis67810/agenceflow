"use client";

import { agendaFetch } from "@/lib/agenda/fetchWithAuth";
import { useEffect, useState, type ReactNode } from "react";
import { TrendingUp, TrendingDown, Flame, CheckSquare, Target, BarChart2, AlertCircle } from "lucide-react";

interface WeeklyScore {
  week: string;
  score: number;
  count: number;
}

interface HabitStat {
  id: string;
  title: string;
  completions: number;
  rate: number;
}

interface StatsData {
  completionRate: number;
  weekTasks: number;
  weekDone: number;
  prevWeekTasks: number;
  prevWeekDone: number;
  monthlyData: Record<string, { done: number; total: number; score: number }>;
  bestStreak: number;
  currentBestStreak: number;
  avgDayScore: number;
  habitCompletionRate: number;
  thisWeekHabitsDone: number;
  thisWeekHabitsTotal: number;
  prevWeekHabitsDone: number;
  prevWeekHabitsTotal: number;
  recaps: { recap_date: string; day_score: number; tasks_completed: number; habits_done: number; points_earned: number; bonus_points: number }[];
  weeklyScores: WeeklyScore[];
  habitStats: HabitStat[];
}

export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    agendaFetch("/api/agenda/stats")
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setStats(data);
        }
        setLoading(false);
      })
      .catch(e => {
        setError(String(e));
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>;

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex gap-3">
          <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700 mb-1">Erreur de chargement</p>
            <p className="text-sm text-red-600">{error}</p>
            <p className="text-sm text-red-500 mt-2">
              Vérifiez que vous avez bien exécuté le fichier <code className="bg-red-100 px-1 rounded">src/lib/supabase/agenda.sql</code> dans votre projet Supabase.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const weeklyScores = stats.weeklyScores ?? [];
  const monthlyData = stats.monthlyData ?? {};
  const recaps = stats.recaps ?? [];

  const maxWeeklyScore = weeklyScores.length > 0 ? Math.max(...weeklyScores.map(w => w.score), 1) : 1;

  // Build last 30 days heatmap
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const key = d.toISOString().split("T")[0];
    return { date: key, ...(monthlyData[key] ?? { done: 0, total: 0, score: 0 }) };
  });

  const maxDayScore = Math.max(...last30.map(d => d.score), 1);

  // Weekly comparison calculations
  const taskChange = stats.prevWeekDone > 0
    ? Math.round(((stats.weekDone - stats.prevWeekDone) / stats.prevWeekDone) * 100)
    : (stats.weekDone > 0 ? 100 : 0);

  const habitChange = stats.prevWeekHabitsTotal > 0
    ? Math.round(((stats.thisWeekHabitsDone - stats.prevWeekHabitsDone) / stats.prevWeekHabitsTotal) * 100)
    : (stats.thisWeekHabitsDone > 0 ? 100 : 0);

  return (
    <div className="p-6 max-w-4xl mx-auto bg-[#fbfbfb]">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Statistiques</h1>

      {/* Weekly comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckSquare size={18} className="text-[#0147FF]" />
            <span className="text-xs text-gray-500">Tâches cette semaine</span>
          </div>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-bold text-gray-900">{stats.weekDone}</p>
            <div className={`flex items-center gap-1 text-sm font-medium mb-1 ${taskChange >= 0 ? "text-green-600" : "text-red-500"}`}>
              {taskChange >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {Math.abs(taskChange)}%
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {taskChange >= 0
              ? `Vous avez réalisé ${taskChange}% de plus de tâches que la semaine dernière`
              : `Vous avez réalisé ${Math.abs(taskChange)}% de moins de tâches que la semaine dernière`}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Flame size={18} className="text-orange-500" />
            <span className="text-xs text-gray-500">Habitudes cette semaine</span>
          </div>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-bold text-gray-900">{stats.thisWeekHabitsDone}</p>
            <div className={`flex items-center gap-1 text-sm font-medium mb-1 ${habitChange >= 0 ? "text-green-600" : "text-red-500"}`}>
              {habitChange >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {Math.abs(habitChange)}%
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {habitChange >= 0
              ? `Vous avez maintenu ${habitChange}% de plus d'habitudes que la semaine dernière`
              : `Vous avez maintenu ${Math.abs(habitChange)}% de moins d'habitudes que la semaine dernière`}
          </p>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <MetricCard icon={<CheckSquare size={18} className="text-[#0147FF]" />} label="Taux complétion" value={`${stats.completionRate ?? 0}%`} sub="toutes les tâches" />
        <MetricCard icon={<Flame size={18} className="text-orange-500" />} label="Meilleure série" value={`${stats.bestStreak ?? 0}j`} sub={`Actuelle: ${stats.currentBestStreak ?? 0}j`} />
        <MetricCard icon={<TrendingUp size={18} className="text-green-500" />} label="Score moyen" value={`${stats.avgDayScore ?? 0}/100`} sub="score journalier" />
        <MetricCard icon={<Target size={18} className="text-blue-500" />} label="Habitudes" value={`${stats.habitCompletionRate ?? 0}%`} sub="ce mois" />
      </div>

      {/* Per-habit stats */}
      {stats.habitStats && stats.habitStats.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h3 className="font-semibold text-gray-800 mb-4">Taux de complétion par habitude</h3>
          <div className="space-y-3">
            {stats.habitStats.map((habit) => (
              <div key={habit.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{habit.title}</span>
                  <span className="text-gray-500">{habit.completions} jours · {habit.rate}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-400 rounded-full transition-all"
                    style={{ width: `${Math.min(100, habit.rate)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly scores chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <BarChart2 size={16} className="text-indigo-500" />
          Score quotidien /100 (8 dernières semaines)
        </h3>
        {weeklyScores.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Pas encore de données</p>
        ) : (
          <div className="flex items-end gap-2 h-32">
            {weeklyScores.map((w, i) => {
              const pct = (w.score / maxWeeklyScore) * 100;
              const isLast = i === weeklyScores.length - 1;
              return (
                <div key={w.week} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-gray-400">{w.score > 0 ? w.score : ""}</span>
                  <div
                    className={`w-full rounded-t-md transition-all ${isLast ? "bg-[#0147FF]" : "bg-[#0147FF]/30"}`}
                    style={{ height: `${Math.max(4, pct)}%` }}
                    title={`${w.week}: ${w.score}/100 (${w.count} jours)`}
                  />
                  <span className="text-xs text-gray-400 hidden sm:block">
                    {new Date(w.week + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }).slice(0, 5)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-between text-xs text-gray-400 mt-2">
          <span>Il y a 8 semaines</span>
          <span>Cette semaine: <strong className="text-[#0147FF]">{weeklyScores.length > 0 ? weeklyScores[weeklyScores.length - 1].score : 0}/100</strong></span>
        </div>
      </div>

      {/* Activity heatmap */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="font-semibold text-gray-800 mb-4">Scores des 30 derniers jours</h3>
        <div className="flex gap-1 flex-wrap">
          {last30.map(day => {
            const intensity = maxDayScore > 0 ? day.score / maxDayScore : 0;
            const opacity = intensity === 0 ? 0.1 : 0.3 + intensity * 0.7;
            return (
              <div
                key={day.date}
                className="w-7 h-7 rounded-md flex items-center justify-center text-xs cursor-default"
                style={{ background: `rgba(1, 71, 255, ${opacity})` }}
                title={`${day.date}: ${day.score}/100, ${day.done}/${day.total} tâches`}
              >
                {day.score > 0 ? <span className="text-white text-xs font-bold">{day.score}</span> : null}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
          <div className="w-4 h-4 rounded bg-[#0147FF]/10" />
          <span>Faible</span>
          <div className="w-4 h-4 rounded bg-[#0147FF]/50" />
          <span>Moyen</span>
          <div className="w-4 h-4 rounded bg-[#0147FF]" />
          <span>Excellent</span>
        </div>
      </div>

      {/* Recent recaps */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Récaps récents</h3>
        {recaps.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun récap enregistré</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2">Date</th>
                  <th className="text-center pb-2">Score</th>
                  <th className="text-center pb-2">Tâches</th>
                  <th className="text-center pb-2">Habitudes</th>
                </tr>
              </thead>
              <tbody>
                {recaps.map(r => (
                  <tr key={r.recap_date} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 text-gray-600">
                      {new Date(r.recap_date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                    </td>
                    <td className="py-2 text-center">
                      <span className={`font-bold ${r.day_score >= 80 ? "text-green-500" : r.day_score >= 60 ? "text-yellow-500" : "text-red-400"}`}>
                        {r.day_score}/100
                      </span>
                    </td>
                    <td className="py-2 text-center text-gray-500">{r.tasks_completed}</td>
                    <td className="py-2 text-center text-gray-500">{r.habits_done}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}
