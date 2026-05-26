"use client";

import { agendaFetch } from "@/lib/agenda/fetchWithAuth";
import { useEffect, useState } from "react";
import { Plus, Trash2, Flame, CheckCircle2, Circle, Star } from "lucide-react";
import type { AgendaHabit } from "@/types/agenda";
import { SqlMissingBanner } from "@/components/agenda/SqlMissingBanner";
import ClientBlueButton from "@/components/shared/ClientBlueButton";

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
    importance: 3,
    color: "#10b981",
    target_per_period: 1,
  });

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res = await agendaFetch("/api/agenda/habits").then(r => r.json());
      if (res.error) { setPageError(res.error); setLoading(false); return; }
      setHabits(res.habits ?? []);
    } catch (e) { setPageError(String(e)); }
    setLoading(false);
  }

  async function handleToggle(habit: HabitWithMeta) {
    const method = habit.done_today ? "DELETE" : "POST";
    await agendaFetch(`/api/agenda/habits/${habit.id}/log`, {
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
      const res = await agendaFetch("/api/agenda/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.error) { setFormError(data.error); return; }
      if (data.habit) {
        load();
        setForm({ title: "", description: "", frequency: "daily", points: 10, importance: 3, color: "#10b981", target_per_period: 1 });
        setShowForm(false);
      }
    } catch (e) { setFormError(String(e)); }
  }

  async function handleDelete(id: string) {
    await agendaFetch(`/api/agenda/habits/${id}`, { method: "DELETE" });
    setHabits(prev => prev.filter(h => h.id !== id));
  }

  const doneToday = habits.filter(h => h.done_today).length;
  const totalToday = habits.length;

  if (loading) return <div className="p-4 text-gray-400 sm:p-8">Chargement...</div>;

  return (
    <div className="habit-responsive-page mx-auto min-h-screen max-w-3xl bg-[#fbfbfb] px-4 py-4 sm:px-6 sm:py-6">
      {pageError && <SqlMissingBanner error={pageError} />}
      <div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[1.65rem] font-bold leading-tight text-gray-900 sm:text-2xl">Habitudes</h1>
          <p className="text-sm text-gray-400 mt-0.5">{doneToday}/{totalToday} complétées aujourd&apos;hui</p>
        </div>
        <div className="w-full sm:w-auto">
          <ClientBlueButton
            type="button"
            onClick={() => setShowForm(s => !s)}
            icon={<Plus size={16} />}
            wrapperStyle={{ width: "100%" }}
            style={{ minHeight: 48, padding: "0 18px", fontSize: 14, width: "100%" }}
          >
            Nouvelle habitude
          </ClientBlueButton>
        </div>
      </div>

      {/* Progress */}
      {totalToday > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progression du jour</span>
            <span className="text-sm font-bold text-[#0147FF]">{Math.round((doneToday / totalToday) * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0147FF] rounded-full transition-all"
              style={{ width: `${(doneToday / totalToday) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Nouvelle habitude</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Titre *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Ex: Méditation, Sport, Lecture..." />
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
              <label className="block text-xs text-gray-500 mb-1">Importance (1-5)</label>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(i => (
                  <button
                    key={i}
                    onClick={() => setForm(f => ({ ...f, importance: i }))}
                    className={`flex-1 py-1.5 rounded text-xs font-medium border transition-colors ${
                      form.importance === i ? "bg-[#121A2E] text-white border-[#121A2E]" : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {form.importance === 1 ? "Faible" : form.importance === 2 ? "Moyen" : form.importance === 3 ? "Important" : form.importance === 4 ? "Urgent" : "Critique"}
                {" "}· poids dans le score du jour
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500">Annuler</button>
            <div className="w-full sm:w-auto">
              <ClientBlueButton type="button" onClick={handleCreate} wrapperStyle={{ width: "100%" }} style={{ minHeight: 44, padding: "0 18px", fontSize: 13, width: "100%" }}>Créer</ClientBlueButton>
            </div>
          </div>
          {formError && <p className="text-red-500 text-xs mt-2">{formError}</p>}
        </div>
      )}

      {habits.length > 0 && (
        <div className="mb-4 grid gap-3 md:hidden">
          {habits.map(habit => (
            <HabitMobileCard
              key={habit.id}
              habit={habit}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Week grid header */}
      {habits.length > 0 && (
        <div className="mb-4 hidden overflow-hidden rounded-xl border border-gray-200 bg-white md:block">
          <div className="grid border-b border-gray-100" style={{ gridTemplateColumns: "1fr repeat(7, 36px)" }}>
            <div className="p-3 text-xs text-gray-400 font-medium">Habitude</div>
            {WEEK_DAYS.map((d, i) => {
              const isToday = d === today;
              return (
                <div key={d} className={`p-2 text-center text-xs ${isToday ? "bg-gray-50 text-gray-900 font-bold" : "text-gray-400"}`}>
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
          <p>Aucune habitude configurée</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-[#0147FF] hover:underline">
            + Créer votre première habitude
          </button>
        </div>
      )}
    </div>
  );
}

function HabitMobileCard({ habit, onToggle, onDelete }: {
  habit: HabitWithMeta;
  onToggle: (h: HabitWithMeta) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="mt-1 h-12 w-1.5 shrink-0 rounded-full" style={{ background: habit.color }} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-gray-900">{habit.title}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {habit.streak_current > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-600">
                <Flame size={12} /> {habit.streak_current}j
              </span>
            )}
            <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-50 px-2 py-1 text-xs text-gray-500">
              {Array.from({ length: habit.importance ?? 3 }).map((_, i) => (
                <Star key={i} size={10} className="fill-current text-yellow-500" />
              ))}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDelete(habit.id)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-gray-100 text-gray-300 transition-colors hover:border-red-100 hover:text-red-400"
          aria-label={`Supprimer ${habit.title}`}
        >
          <Trash2 size={16} />
        </button>
      </div>
      <button
        type="button"
        onClick={() => onToggle(habit)}
        className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors ${
          habit.done_today
            ? "border-green-100 bg-green-50 text-green-700"
            : "border-gray-200 bg-gray-50 text-gray-700 hover:border-green-200 hover:bg-green-50 hover:text-green-700"
        }`}
      >
        {habit.done_today ? <CheckCircle2 size={18} /> : <Circle size={18} />}
        {habit.done_today ? "Fait aujourd'hui" : "Marquer comme fait"}
      </button>
    </article>
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
        <div className="w-2.5 self-stretch rounded-full" style={{ background: habit.color }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{habit.title}</p>
          <div className="flex items-center gap-2">
            {habit.streak_current > 0 && (
              <span className="text-xs text-orange-500 flex items-center gap-0.5">
                <Flame size={10} /> {habit.streak_current}j
              </span>
            )}
            <span className="text-xs text-gray-400 flex items-center gap-0.5">
              {Array.from({ length: habit.importance ?? 3 }).map((_, i) => (
                <Star key={i} size={8} className="fill-current text-yellow-500" />
              ))}
            </span>
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
