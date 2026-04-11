"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Flame, CheckCircle2, Circle, Repeat } from "lucide-react";
import type { AgendaHabit } from "@/types/agenda";
import { SqlMissingBanner } from "@/components/agenda/SqlMissingBanner";

type HabitWithMeta = AgendaHabit & { done_today: boolean; done_this_week: number };

const DAYS_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const WEEK_DAYS = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + i;
  d.setDate(diff);
  return d.toISOString().split("T")[0];
});

export default function HabitsPage() {
  const [habits, setHabits] = useState<HabitWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    frequency: "daily",
    points: 10,
    color: "#10b981",
    icon: "⚡",
    target_per_period: 1,
  });

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res = await fetch("/api/agenda/habits").then(r => r.json());
      if (res.error) { setPageError(res.error); setLoading(false); return; }
      setHabits(res.habits ?? []);
    } catch (e) { setPageError(String(e)); }
    setLoading(false);
  }

  async function handleToggle(habit: HabitWithMeta) {
    const method = habit.done_today ? "DELETE" : "POST";
    await fetch(`/api/agenda/habits/${habit.id}/log`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today }),
    });
    setHabits(prev => prev.map(h => h.id === habit.id ? {
      ...h,
      done_today: !h.done_today,
      streak_current: habit.done_today ? Math.max(0, h.streak_current - 1) : h.streak_current + 1,
    } : h));
  }

  async function handleCreate() {
    if (!form.title.trim()) return;
    setFormError("");
    try {
      const res = await fetch("/api/agenda/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.error) { setFormError(data.error); return; }
      if (data.habit) {
        load();
        setForm({ title: "", description: "", frequency: "daily", points: 10, color: "#10b981", icon: "⚡", target_per_period: 1 });
        setShowForm(false);
      }
    } catch (e) { setFormError(String(e)); }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/agenda/habits/${id}`, { method: "DELETE" });
    setHabits(prev => prev.filter(h => h.id !== id));
  }

  const doneToday = habits.filter(h => h.done_today).length;
  const totalToday = habits.length;

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {pageError && <SqlMissingBanner error={pageError} />}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Habitudes</h1>
          <p className="text-sm text-gray-400 mt-0.5">{doneToday}/{totalToday} complétées aujourd&apos;hui</p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          <Plus size={16} />
          Nouvelle habitude
        </button>
      </div>

      {/* Progress */}
      {totalToday > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progression du jour</span>
            <span className="text-sm font-bold text-green-600">{Math.round((doneToday / totalToday) * 100)}%</span>
          </div>
          <div className="h-2 bg-green-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all"
              style={{ width: `${(doneToday / totalToday) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-indigo-200 rounded-xl p-5 mb-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">Nouvelle habitude</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Titre *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Ex: Méditation, Sport, Lecture..." />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Icône</label>
              <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="⚡" maxLength={2} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Couleur</label>
              <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="w-full h-10 border border-gray-200 rounded-lg cursor-pointer" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fréquence</label>
              <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="daily">Quotidienne</option>
                <option value="weekly">Hebdomadaire</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Points par complétion</label>
              <input type="number" value={form.points} onChange={e => setForm(f => ({ ...f, points: parseInt(e.target.value) || 10 }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" min={1} max={100} />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500">Annuler</button>
            <button onClick={handleCreate} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">Créer (+{form.points} pts/jour)</button>
          </div>
          {formError && <p className="text-red-500 text-xs mt-2">{formError}</p>}
        </div>
      )}

      {/* Week grid header */}
      {habits.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
          <div className="grid border-b border-gray-100" style={{ gridTemplateColumns: "1fr repeat(7, 36px)" }}>
            <div className="p-3 text-xs text-gray-400 font-medium">Habitude</div>
            {WEEK_DAYS.map((d, i) => {
              const isToday = d === today;
              return (
                <div key={d} className={`p-2 text-center text-xs ${isToday ? "bg-indigo-50 text-indigo-600 font-bold" : "text-gray-400"}`}>
                  {DAYS_LABELS[new Date(d + "T12:00:00").getDay()]}
                  <br />
                  <span className="text-xs">{new Date(d + "T12:00:00").getDate()}</span>
                </div>
              );
            })}
          </div>

          {habits.map(habit => (
            <HabitRow
              key={habit.id}
              habit={habit}
              today={today}
              weekDays={WEEK_DAYS}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {habits.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Repeat size={40} className="mx-auto mb-3 opacity-30" />
          <p>Aucune habitude configurée</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-indigo-500 hover:underline">
            + Créer votre première habitude
          </button>
        </div>
      )}
    </div>
  );
}

function HabitRow({ habit, today, weekDays, onToggle, onDelete }: {
  habit: HabitWithMeta;
  today: string;
  weekDays: string[];
  onToggle: (h: HabitWithMeta) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="grid border-b border-gray-100 last:border-0 hover:bg-gray-50/50" style={{ gridTemplateColumns: "1fr repeat(7, 36px)" }}>
      <div className="p-3 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{ background: habit.color + "20" }}>
          {habit.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{habit.title}</p>
          <div className="flex items-center gap-2">
            {habit.streak_current > 0 && (
              <span className="text-xs text-orange-500 flex items-center gap-0.5">
                <Flame size={10} /> {habit.streak_current}j
              </span>
            )}
            <span className="text-xs text-yellow-500">+{habit.points}pts</span>
          </div>
        </div>
        <button onClick={() => onDelete(habit.id)} className="text-gray-200 hover:text-red-400 transition-colors shrink-0">
          <Trash2 size={13} />
        </button>
      </div>
      {weekDays.map(day => {
        const isToday = day === today;
        const isFuture = day > today;
        const isDone = isToday ? habit.done_today : false; // for simplicity
        return (
          <div
            key={day}
            className={`flex items-center justify-center border-l border-gray-100 ${isToday && !isFuture ? "cursor-pointer hover:bg-green-50" : ""}`}
            onClick={isToday ? () => onToggle(habit) : undefined}
          >
            {isToday ? (
              isDone
                ? <CheckCircle2 size={18} className="text-green-500" />
                : <Circle size={18} className="text-gray-200 hover:text-green-300 transition-colors" />
            ) : isFuture ? (
              <div className="w-4 h-4 rounded-full border border-gray-100" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-gray-100" />
            )}
          </div>
        );
      })}
    </div>
  );
}
