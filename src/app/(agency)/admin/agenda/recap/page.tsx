"use client";

import { agendaFetch } from "@/lib/agenda/fetchWithAuth";
import { calculateDayScore } from "@/lib/agenda/points";
import type { AgendaDailyRecap, AgendaHabit, AgendaTask, AgendaTaskReviewOutcome } from "@/types/agenda";
import { Check, CheckCircle2, ChevronRight, Flame, ShieldCheck, Target, Trophy, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import ClientBlueButton from "@/components/shared/ClientBlueButton";

type Step = 0 | 1 | 2 | 3;
type TaskReviewState = Record<string, { outcome: AgendaTaskReviewOutcome; justification: string }>;

const MOODS = [
  { label: "Epuise", value: "exhausted", color: "#ff5a61" },
  { label: "Difficile", value: "hard", color: "#ff8b5b" },
  { label: "Correct", value: "okay", color: "#ffc957" },
  { label: "Bien", value: "good", color: "#93d95e" },
  { label: "Excellent", value: "excellent", color: "#4dc84a" },
];

export default function RecapPage() {
  const [step, setStep] = useState<Step>(0);
  const [tasks, setTasks] = useState<AgendaTask[]>([]);
  const [habits, setHabits] = useState<(AgendaHabit & { done_today: boolean })[]>([]);
  const [existingRecap, setExistingRecap] = useState<AgendaDailyRecap | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [taskReviews, setTaskReviews] = useState<TaskReviewState>({});
  const [form, setForm] = useState({
    mood: "",
    wins: "",
    improvements: "",
    tomorrow_priority: "",
  });

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const [tasksRes, habitsRes, recapRes] = await Promise.all([
      agendaFetch(`/api/agenda/tasks?date=${today}`).then((response) => response.json()),
      agendaFetch("/api/agenda/habits").then((response) => response.json()),
      agendaFetch(`/api/agenda/recap?date=${today}`).then((response) => response.json()),
    ]);

    const loadedTasks: AgendaTask[] = tasksRes.tasks ?? [];
    const loadedHabits = habitsRes.habits ?? [];
    const defaultReviews = Object.fromEntries(
      loadedTasks.map((task) => [
        task.id,
        { outcome: task.status === "done" ? "done" : "missed", justification: "" },
      ])
    ) as TaskReviewState;

    setTasks(loadedTasks);
    setHabits(loadedHabits);
    setExistingRecap(recapRes.recap ?? null);
    setTaskReviews(defaultReviews);

    if (recapRes.recap) {
      setForm({
        mood: recapRes.recap.mood ?? "",
        wins: recapRes.recap.wins ?? "",
        improvements: recapRes.recap.improvements ?? "",
        tomorrow_priority: recapRes.recap.tomorrow_priority ?? "",
      });
      if (recapRes.recap.task_reviews) {
        setTaskReviews(
          Object.fromEntries(
            recapRes.recap.task_reviews.map((review: { task_id: string; outcome: AgendaTaskReviewOutcome; justification?: string }) => [
              review.task_id,
              { outcome: review.outcome, justification: review.justification ?? "" },
            ])
          ) as TaskReviewState
        );
      }
      setSaved(true);
    }

    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    const reviewedTasks = tasks.map((task) => ({
      task_id: task.id,
      outcome: taskReviews[task.id]?.outcome ?? (task.status === "done" ? "done" : "missed"),
      justification: taskReviews[task.id]?.justification?.trim() ?? "",
      points_awarded: 0,
    }));
    const doneTasksCount = reviewedTasks.filter((task) => task.outcome === "done").length;
    const doneHabitsCount = habits.filter((habit) => habit.done_today).length;
    const dayScore = calculateDayScore(doneTasksCount, tasks.length, doneHabitsCount, habits.length);

    try {
      const response = await agendaFetch("/api/agenda/recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recap_date: today,
          tasks_completed: doneTasksCount,
          tasks_planned: tasks.length,
          habits_done: doneHabitsCount,
          habits_total: habits.length,
          task_reviews: reviewedTasks,
          day_score: dayScore,
          ...form,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossible d'enregistrer le recap.");
      setExistingRecap(payload.recap);
      setSaved(true);
      setStep(3);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Impossible d'enregistrer le recap.");
    } finally {
      setSaving(false);
    }
  }

  const doneTasks = tasks.filter((task) => (taskReviews[task.id]?.outcome ?? (task.status === "done" ? "done" : "missed")) === "done").length;
  const doneHabits = habits.filter((habit) => habit.done_today).length;
  const computedScore = calculateDayScore(doneTasks, tasks.length, doneHabits, habits.length);
  const todayFmt = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>;

  return (
    <div className="min-h-screen bg-[#fbfbfb] p-6">
      <main className="mx-auto max-w-2xl">
        <div className="mb-6">
          <p className="text-sm text-gray-400 capitalize">{todayFmt}</p>
          <h1 className="text-2xl font-bold text-gray-900">Recap du jour</h1>
        </div>

        <div className="mb-8 flex items-center gap-2">
          {(["Bilan", "Humeur", "Demain", "Resultat"] as const).map((label, index) => (
            <div key={label} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => !saved && setStep(index as Step)}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  step === index ? "bg-[#121A2E] text-white" : step > index ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400"
                }`}
              >
                {step > index ? <Check size={14} /> : index + 1}
              </button>
              <span className={`text-xs ${step === index ? "font-medium text-[#0147FF]" : "text-gray-400"}`}>{label}</span>
              {index < 3 ? <ChevronRight size={12} className="text-gray-300" /> : null}
            </div>
          ))}
        </div>

        {step === 0 ? (
          <div className="space-y-4">
            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 font-semibold text-gray-800">Bilan des taches</h2>
              {tasks.length === 0 ? (
                <p className="text-sm text-gray-400">Aucune tache planifiee aujourd&apos;hui</p>
              ) : (
                <ul className="space-y-2">
                  {tasks.map((task) => {
                    const outcome = taskReviews[task.id]?.outcome ?? (task.status === "done" ? "done" : "missed");
                    return (
                      <li key={task.id} className="rounded-xl border border-gray-100 p-3 text-sm">
                        <div className="flex items-center gap-2">
                          {outcome === "done" ? (
                            <CheckCircle2 size={14} className="shrink-0 text-green-500" />
                          ) : outcome === "justified" ? (
                            <ShieldCheck size={14} className="shrink-0 text-amber-500" />
                          ) : (
                            <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-gray-200" />
                          )}
                          <span className="text-gray-700">{task.title}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {([
                            ["done", "Faite"],
                            ["justified", "Justifiee"],
                            ["missed", "Non faite"],
                          ] as const).map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() =>
                                setTaskReviews((current) => ({
                                  ...current,
                                  [task.id]: {
                                    outcome: value,
                                    justification: value === "justified" ? current[task.id]?.justification ?? "" : "",
                                  },
                                }))
                              }
                              className={`rounded-full px-3 py-1 text-xs font-medium ${
                                outcome === value ? "bg-[#121A2E] text-white" : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        {outcome === "justified" ? (
                          <textarea
                            value={taskReviews[task.id]?.justification ?? ""}
                            onChange={(event) =>
                              setTaskReviews((current) => ({
                                ...current,
                                [task.id]: { outcome: "justified", justification: event.target.value },
                              }))
                            }
                            rows={2}
                            className="mt-3 w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
                            placeholder="Explique rapidement pourquoi ce report etait justifie"
                          />
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 font-semibold text-gray-800">Bilan des habitudes</h2>
              <div className="mb-3 flex items-center gap-3">
                <Flame size={20} className="text-orange-400" />
                <p className="text-sm text-gray-600">{doneHabits}/{habits.length} habitudes completees</p>
              </div>
              <p className="text-sm font-medium text-[#0147FF]">Score calcule automatiquement: {computedScore}/100</p>
            </section>

            <ClientBlueButton type="button" onClick={() => setStep(1)} icon={<ChevronRight size={16} />} wrapperStyle={{ width: "100%" }} style={{ width: "100%", minHeight: 52, fontSize: 14 }}>
              Continuer vers l&apos;humeur
            </ClientBlueButton>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="mb-3 font-semibold text-gray-800">Comment vous sentez-vous ?</h2>
              <div className="grid grid-cols-5 gap-3">
                {MOODS.map((mood) => (
                  <button
                    key={mood.value}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, mood: mood.value }))}
                    className={`rounded-xl border-2 p-3 text-xs font-semibold transition-colors ${
                      form.mood === mood.value ? "border-[#0147FF] bg-[#0147FF]/5 text-[#121A2E]" : "border-gray-100 text-gray-500 hover:border-gray-200"
                    }`}
                  >
                    <span className="mx-auto mb-2 block h-5 w-5 rounded" style={{ background: mood.color }} />
                    {mood.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <label className="mb-2 flex items-center gap-2 font-semibold text-gray-800">
                <Trophy size={16} className="text-[#0147FF]" /> Victoires du jour
              </label>
              <textarea value={form.wins} onChange={(event) => setForm((current) => ({ ...current, wins: event.target.value }))} className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm" rows={3} />
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <label className="mb-2 flex items-center gap-2 font-semibold text-gray-800">
                <Wrench size={16} className="text-[#0147FF]" /> Points a ameliorer
              </label>
              <textarea value={form.improvements} onChange={(event) => setForm((current) => ({ ...current, improvements: event.target.value }))} className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm" rows={3} />
            </section>

            <div className="flex gap-3">
              <button onClick={() => setStep(0)} className="rounded-full border border-gray-200 px-4 py-3 text-gray-600">Retour</button>
              <ClientBlueButton type="button" onClick={() => setStep(2)} icon={<ChevronRight size={16} />} wrapperStyle={{ flex: 1 }} style={{ width: "100%", minHeight: 48, fontSize: 14 }}>
                Planifier demain
              </ClientBlueButton>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <label className="mb-2 flex items-center gap-2 font-semibold text-gray-800">
                <Target size={16} className="text-[#0147FF]" /> Priorite principale pour demain
              </label>
              <textarea value={form.tomorrow_priority} onChange={(event) => setForm((current) => ({ ...current, tomorrow_priority: event.target.value }))} className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm" rows={4} />
            </section>

            {saveError ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{saveError}</p> : null}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="rounded-full border border-gray-200 px-4 py-3 text-gray-600">Retour</button>
              <ClientBlueButton type="button" onClick={handleSave} disabled={saving || !form.mood} loading={saving} icon={<Check size={16} />} wrapperStyle={{ flex: 1 }} style={{ width: "100%", minHeight: 48, fontSize: 14 }}>
                Terminer le recap
              </ClientBlueButton>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-gray-200 bg-white">
              <Trophy size={40} className="text-[#0147FF]" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-gray-800">Recap enregistre</h2>
            <p className="mb-6 text-gray-500">Score calcule: <strong>{existingRecap?.day_score ?? computedScore}/100</strong></p>
            <button onClick={() => { window.location.href = "/admin/agenda"; }} className="rounded-full bg-[#121A2E] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1a2540]">
              Retour au dashboard
            </button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
