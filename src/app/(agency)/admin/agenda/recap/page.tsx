"use client";

import { agendaFetch } from "@/lib/agenda/fetchWithAuth";
import { useEffect, useState } from "react";
import { CheckCircle2, ChevronRight, Star, Flame, Trophy } from "lucide-react";
import { computeDayScore, recapBonusPoints } from "@/lib/agenda/points";
import type { AgendaTask, AgendaHabit, AgendaDailyRecap } from "@/types/agenda";

type Step = 0 | 1 | 2 | 3;

const MOODS = [
  { emoji: "😴", label: "Épuisé", value: "exhausted" },
  { emoji: "😕", label: "Difficile", value: "hard" },
  { emoji: "😐", label: "Correct", value: "okay" },
  { emoji: "😊", label: "Bien", value: "good" },
  { emoji: "🚀", label: "Excellent", value: "excellent" },
];

export default function RecapPage() {
  const [step, setStep] = useState<Step>(0);
  const [tasks, setTasks] = useState<AgendaTask[]>([]);
  const [habits, setHabits] = useState<(AgendaHabit & { done_today: boolean })[]>([]);
  const [existingRecap, setExistingRecap] = useState<AgendaDailyRecap | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    mood: "",
    wins: "",
    improvements: "",
    tomorrow_priority: "",
    day_score: 0,
  });

  useEffect(() => { load(); }, []);

  async function load() {
    const [tasksRes, habitsRes, recapRes] = await Promise.all([
      agendaFetch(`/api/agenda/tasks?date=${today}`).then(r => r.json()),
      agendaFetch("/api/agenda/habits").then(r => r.json()),
      agendaFetch(`/api/agenda/recap?date=${today}`).then(r => r.json()),
    ]);

    const loadedTasks: AgendaTask[] = tasksRes.tasks ?? [];
    const loadedHabits = habitsRes.habits ?? [];

    setTasks(loadedTasks);
    setHabits(loadedHabits);
    setExistingRecap(recapRes.recap);

    if (recapRes.recap) {
      setForm({
        mood: recapRes.recap.mood ?? "",
        wins: recapRes.recap.wins ?? "",
        improvements: recapRes.recap.improvements ?? "",
        tomorrow_priority: recapRes.recap.tomorrow_priority ?? "",
        day_score: recapRes.recap.day_score ?? 0,
      });
      setSaved(true);
    } else {
      const doneTasks = loadedTasks.filter((t: AgendaTask) => t.status === "done").length;
      const doneHabits = loadedHabits.filter((h: AgendaHabit & { done_today: boolean }) => h.done_today).length;
      const computedScore = computeDayScore(doneTasks, loadedTasks.length, doneHabits, loadedHabits.length);
      setForm(f => ({ ...f, day_score: computedScore }));
    }

    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    const doneTasks = tasks.filter(t => t.status === "done").length;
    const doneHabits = habits.filter(h => h.done_today).length;

    await agendaFetch("/api/agenda/recap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recap_date: today,
        tasks_completed: doneTasks,
        tasks_planned: tasks.length,
        habits_done: doneHabits,
        habits_total: habits.length,
        points_earned: doneTasks * 30 + doneHabits * 10,
        ...form,
      }),
    });

    setSaving(false);
    setSaved(true);
    setStep(3);
  }

  const doneTasks = tasks.filter(t => t.status === "done").length;
  const doneHabits = habits.filter(h => h.done_today).length;
  const bonus = recapBonusPoints({ day_score: form.day_score });
  const todayFmt = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <p className="text-sm text-gray-400 capitalize">{todayFmt}</p>
        <h1 className="text-2xl font-bold text-gray-900">Récap du jour</h1>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-8">
        {(["Bilan", "Réflexion", "Demain", "Résultat"] as const).map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              onClick={() => !saved && setStep(i as Step)}
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                step === i ? "bg-indigo-600 text-white" :
                step > i ? "bg-green-500 text-white" :
                "bg-gray-100 text-gray-400"
              }`}
            >
              {step > i ? "✓" : i + 1}
            </button>
            <span className={`text-xs ${step === i ? "text-indigo-600 font-medium" : "text-gray-400"}`}>{label}</span>
            {i < 3 && <ChevronRight size={12} className="text-gray-300" />}
          </div>
        ))}
      </div>

      {/* Step 0: Summary */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Bilan des tâches</h2>
            {tasks.length === 0 ? (
              <p className="text-sm text-gray-400">Aucune tâche planifiée aujourd&apos;hui</p>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-500">{doneTasks}</p>
                    <p className="text-xs text-gray-400">complétées</p>
                  </div>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-400 rounded-full" style={{ width: tasks.length > 0 ? `${(doneTasks / tasks.length) * 100}%` : "0%" }} />
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-400">{tasks.length - doneTasks}</p>
                    <p className="text-xs text-gray-400">restantes</p>
                  </div>
                </div>
                <ul className="space-y-1">
                  {tasks.slice(0, 5).map(t => (
                    <li key={t.id} className="flex items-center gap-2 text-sm">
                      {t.status === "done"
                        ? <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                        : <div className="w-3.5 h-3.5 rounded-full border border-gray-200 shrink-0" />
                      }
                      <span className={t.status === "done" ? "text-gray-400 line-through" : "text-gray-600"}>{t.title}</span>
                      <span className="text-xs text-yellow-500 ml-auto">+{t.points}pts</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Bilan des habitudes</h2>
            {habits.length === 0 ? (
              <p className="text-sm text-gray-400">Aucune habitude active</p>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-3">
                  <Flame size={20} className="text-orange-400" />
                  <p className="text-sm text-gray-600">{doneHabits}/{habits.length} habitudes complétées</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {habits.map(h => (
                    <div key={h.id} className={`flex items-center gap-2 p-2 rounded-lg text-sm ${h.done_today ? "bg-green-50" : "bg-gray-50"}`}>
                      <span>{h.icon}</span>
                      <span className={h.done_today ? "text-green-700" : "text-gray-500"}>{h.title}</span>
                      {h.done_today && <CheckCircle2 size={12} className="text-green-500 ml-auto" />}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Score du jour</h2>
            <div className="flex items-center gap-4">
              <div className="flex gap-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setForm(f => ({ ...f, day_score: i + 1 }))}
                    className={`w-7 h-7 rounded text-xs font-bold transition-colors ${
                      i < form.day_score
                        ? i >= 7 ? "bg-green-500 text-white" : i >= 4 ? "bg-yellow-400 text-white" : "bg-red-400 text-white"
                        : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-800">{form.day_score}/10</p>
                {bonus > 0 && <p className="text-xs text-yellow-500">+{bonus} pts bonus</p>}
              </div>
            </div>
          </div>

          <button onClick={() => setStep(1)} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 flex items-center justify-center gap-2">
            Continuer la réflexion <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Step 1: Reflection */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Comment vous sentez-vous ?</h2>
            <div className="flex gap-3">
              {MOODS.map(m => (
                <button
                  key={m.value}
                  onClick={() => setForm(f => ({ ...f, mood: m.value }))}
                  className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-colors ${
                    form.mood === m.value ? "border-indigo-500 bg-indigo-50" : "border-gray-100 hover:border-gray-200"
                  }`}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="text-xs text-gray-500">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block font-semibold text-gray-800 mb-2">
              🏆 Quelles sont vos victoires du jour ?
            </label>
            <textarea
              value={form.wins}
              onChange={e => setForm(f => ({ ...f, wins: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none"
              rows={3}
              placeholder="Ce que j'ai accompli, les progrès réalisés..."
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block font-semibold text-gray-800 mb-2">
              🔧 Qu&apos;est-ce qui pourrait être amélioré ?
            </label>
            <textarea
              value={form.improvements}
              onChange={e => setForm(f => ({ ...f, improvements: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none"
              rows={3}
              placeholder="Ce qui n'a pas fonctionné, les obstacles rencontrés..."
            />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className="px-4 py-3 border border-gray-200 text-gray-600 rounded-xl">Retour</button>
            <button onClick={() => setStep(2)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 flex items-center justify-center gap-2">
              Planifier demain <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Tomorrow */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block font-semibold text-gray-800 mb-2">
              🎯 Quelle est votre priorité principale pour demain ?
            </label>
            <textarea
              value={form.tomorrow_priority}
              onChange={e => setForm(f => ({ ...f, tomorrow_priority: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none"
              rows={4}
              placeholder="La chose la plus importante à accomplir demain..."
            />
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <p className="text-sm font-medium text-indigo-700">Récapitulatif de la session</p>
            <ul className="mt-2 space-y-1 text-sm text-indigo-600">
              <li>• {doneTasks}/{tasks.length} tâches complétées</li>
              <li>• {doneHabits}/{habits.length} habitudes maintenues</li>
              <li>• Score du jour: {form.day_score}/10</li>
              {bonus > 0 && <li>• Bonus: +{bonus} pts 🎉</li>}
            </ul>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="px-4 py-3 border border-gray-200 text-gray-600 rounded-xl">Retour</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? "Sauvegarde..." : "Terminer le récap"} ✓
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Result */}
      {step === 3 && (
        <div className="text-center py-8">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy size={40} className="text-yellow-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Récap enregistré !</h2>
          <p className="text-gray-500 mb-6">Score du jour: <strong>{form.day_score}/10</strong></p>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-green-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-green-600">{doneTasks}</p>
              <p className="text-xs text-gray-500">tâches ✓</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-3">
              <p className="text-2xl font-bold text-orange-500">{doneHabits}</p>
              <p className="text-xs text-gray-500">habitudes 🔥</p>
            </div>
            <div className="bg-yellow-50 rounded-xl p-3">
              <div className="flex items-center justify-center gap-1">
                <p className="text-2xl font-bold text-yellow-600">{doneTasks * 30 + doneHabits * 10 + bonus}</p>
              </div>
              <p className="text-xs text-gray-500">points gagnés ⚡</p>
            </div>
          </div>

          {bonus > 0 && (
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 justify-center">
                <Star size={20} className="text-yellow-500" />
                <p className="font-semibold text-gray-800">Bonus journée !</p>
              </div>
              <p className="text-sm text-gray-600 mt-1">+{bonus} points pour votre excellent score de {form.day_score}/10</p>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <button onClick={() => window.location.href = "/admin/agenda"} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700">
              Retour au dashboard
            </button>
            <button onClick={() => window.location.href = "/admin/agenda/stats"} className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
              Voir les stats
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
