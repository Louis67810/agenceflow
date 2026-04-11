"use client";

import { useEffect, useState, type ReactNode } from "react";
import { TrendingUp, Star, Flame, CheckSquare, Target, BarChart2 } from "lucide-react";
import { getLevelFromPoints } from "@/lib/agenda/points";

interface StatsData {
  totalPoints: number;
  weekPoints: number;
  levelInfo: ReturnType<typeof getLevelFromPoints>;
  completionRate: number;
  weekTasks: number;
  weekDone: number;
  monthlyData: Record<string, { done: number; total: number; points: number }>;
  bestStreak: number;
  currentBestStreak: number;
  avgDayScore: number;
  habitCompletionRate: number;
  recaps: { recap_date: string; day_score: number; tasks_completed: number; habits_done: number; points_earned: number; bonus_points: number }[];
  weeklyPoints: { week: string; points: number }[];
}

export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agenda/stats")
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false); });
  }, []);

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>;
  if (!stats) return <div className="p-8 text-red-400">Erreur de chargement</div>;

  const levelInfo = getLevelFromPoints(stats.totalPoints);
  const maxWeeklyPoints = Math.max(...stats.weeklyPoints.map(w => w.points), 1);

  // Build last 30 days heatmap
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const key = d.toISOString().split("T")[0];
    return { date: key, ...(stats.monthlyData[key] ?? { done: 0, total: 0, points: 0 }) };
  });

  const maxDayPoints = Math.max(...last30.map(d => d.points), 1);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Statistiques</h1>

      {/* Level card */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-sm">Niveau actuel</p>
            <h2 className="text-3xl font-bold mt-1">{levelInfo.label}</h2>
            <p className="text-indigo-200 text-sm mt-1">Niveau {levelInfo.level} · {stats.totalPoints} points</p>
          </div>
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <Star size={32} className="text-yellow-300" />
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-indigo-200 mb-1">
            <span>Progression vers le niveau {levelInfo.level + 1}</span>
            <span>{levelInfo.progress}%</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${levelInfo.progress}%` }}
            />
          </div>
          <p className="text-xs text-indigo-200 mt-1">Encore {levelInfo.nextLevelPoints} points</p>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <MetricCard icon={<CheckSquare size={18} className="text-indigo-500" />} label="Taux complétion" value={`${stats.completionRate}%`} sub="toutes les tâches" />
        <MetricCard icon={<Flame size={18} className="text-orange-500" />} label="Meilleure série" value={`${stats.bestStreak}j`} sub={`Actuelle: ${stats.currentBestStreak}j`} />
        <MetricCard icon={<TrendingUp size={18} className="text-green-500" />} label="Score moyen" value={`${stats.avgDayScore}/10`} sub="score journalier" />
        <MetricCard icon={<Target size={18} className="text-blue-500" />} label="Habitudes" value={`${stats.habitCompletionRate}%`} sub="ce mois" />
      </div>

      {/* Weekly points chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <BarChart2 size={16} className="text-indigo-500" />
          Points par semaine (8 dernières semaines)
        </h3>
        <div className="flex items-end gap-2 h-32">
          {stats.weeklyPoints.map((w, i) => {
            const pct = (w.points / maxWeeklyPoints) * 100;
            const isLast = i === stats.weeklyPoints.length - 1;
            return (
              <div key={w.week} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-400">{w.points > 0 ? w.points : ""}</span>
                <div
                  className={`w-full rounded-t-md transition-all ${isLast ? "bg-indigo-500" : "bg-indigo-200"}`}
                  style={{ height: `${Math.max(4, pct)}%` }}
                  title={`${w.week}: ${w.points} pts`}
                />
                <span className="text-xs text-gray-400 hidden sm:block">
                  {new Date(w.week + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }).slice(0, 5)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-2">
          <span>Il y a 8 semaines</span>
          <span>Cette semaine: <strong className="text-indigo-600">{stats.weekPoints} pts</strong></span>
        </div>
      </div>

      {/* Activity heatmap */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="font-semibold text-gray-800 mb-4">Activité des 30 derniers jours</h3>
        <div className="flex gap-1 flex-wrap">
          {last30.map(day => {
            const intensity = maxDayPoints > 0 ? day.points / maxDayPoints : 0;
            const opacity = intensity === 0 ? 0.1 : 0.3 + intensity * 0.7;
            return (
              <div
                key={day.date}
                className="w-7 h-7 rounded-md flex items-center justify-center text-xs cursor-default"
                style={{ background: `rgba(99, 102, 241, ${opacity})` }}
                title={`${day.date}: ${day.points}pts, ${day.done}/${day.total} tâches`}
              >
                {day.done > 0 ? <span className="text-white text-xs font-bold">{day.done}</span> : null}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
          <div className="w-4 h-4 rounded bg-indigo-100" />
          <span>Peu actif</span>
          <div className="w-4 h-4 rounded bg-indigo-500" />
          <span>Très actif</span>
        </div>
      </div>

      {/* Recent recaps */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Récaps récents</h3>
        {stats.recaps.length === 0 ? (
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
                  <th className="text-right pb-2">Points</th>
                </tr>
              </thead>
              <tbody>
                {stats.recaps.map(r => (
                  <tr key={r.recap_date} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 text-gray-600">
                      {new Date(r.recap_date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                    </td>
                    <td className="py-2 text-center">
                      <span className={`font-bold ${
                        r.day_score >= 8 ? "text-green-500" :
                        r.day_score >= 6 ? "text-yellow-500" : "text-red-400"
                      }`}>{r.day_score}/10</span>
                    </td>
                    <td className="py-2 text-center text-gray-500">{r.tasks_completed}</td>
                    <td className="py-2 text-center text-gray-500">{r.habits_done}</td>
                    <td className="py-2 text-right">
                      <span className="text-yellow-500 font-medium">
                        +{r.points_earned + r.bonus_points}
                        {r.bonus_points > 0 && <span className="text-xs text-green-400 ml-1">(+{r.bonus_points})</span>}
                      </span>
                    </td>
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
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}
