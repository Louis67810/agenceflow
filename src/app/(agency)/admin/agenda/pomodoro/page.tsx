"use client";

import { agendaFetch } from "@/lib/agenda/fetchWithAuth";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Coffee, Zap, CheckCircle2 } from "lucide-react";
import type { AgendaTask, AgendaSettings, PomodoroSessionType } from "@/types/agenda";

type PhaseType = PomodoroSessionType;

const PHASE_LABELS: Record<PhaseType, string> = {
  work: "Travail",
  short_break: "Pause courte",
  long_break: "Pause longue",
};

const PHASE_COLORS: Record<PhaseType, string> = {
  work: "from-[#0147FF] to-[#0147FF]",
  short_break: "from-green-400 to-emerald-500",
  long_break: "from-blue-400 to-cyan-500",
};

const PHASE_BG: Record<PhaseType, string> = {
  work: "bg-gray-50",
  short_break: "bg-green-50",
  long_break: "bg-blue-50",
};

export default function PomodoroPage() {
  const [settings, setSettings] = useState<Partial<AgendaSettings>>({
    pomodoro_work_minutes: 25,
    pomodoro_short_break: 5,
    pomodoro_long_break: 15,
    pomodoro_sessions_before_long: 4,
  });
  const [tasks, setTasks] = useState<AgendaTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<AgendaTask | null>(null);
  const [phase, setPhase] = useState<PhaseType>("work");
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [completedSessions, setCompletedSessions] = useState<{ type: PhaseType; task?: string }[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    agendaFetch("/api/agenda/settings").then(r => r.json()).then(d => {
      if (d.settings) {
        setSettings(d.settings);
        setTimeLeft((d.settings.pomodoro_work_minutes ?? 25) * 60);
      }
    });
    agendaFetch(`/api/agenda/tasks?date=${today}&status=todo`).then(r => r.json()).then(d => {
      setTasks(d.tasks ?? []);
    });
  }, [today]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(intervalRef.current!);
            setRunning(false);
            handleSessionComplete();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  async function handleStart() {
    if (timeLeft === 0) return;
    setRunning(true);
    startTimeRef.current = new Date();

    // Create session in DB
    const res = await agendaFetch("/api/agenda/pomodoro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_id: selectedTask?.id ?? null,
        duration_minutes: getPhaseDuration(phase),
        session_type: phase,
      }),
    });
    const data = await res.json();
    if (data.session?.id) setSessionId(data.session.id);
  }

  async function handlePause() {
    setRunning(false);
  }

  async function handleReset() {
    setRunning(false);
    setTimeLeft(getPhaseDuration(phase) * 60);
    setSessionId(null);
  }

  async function handleSessionComplete() {
    // Mark session completed in DB
    if (sessionId) {
      await agendaFetch(`/api/agenda/pomodoro/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true, ended_at: new Date().toISOString() }),
      });
    }

    if (phase === "work") {
      const newCount = sessionsCompleted + 1;
      setSessionsCompleted(newCount);
      setCompletedSessions(prev => [...prev, { type: "work", task: selectedTask?.title }]);

      const sessionsBeforeLong = settings.pomodoro_sessions_before_long ?? 4;
      if (newCount % sessionsBeforeLong === 0) {
        setPhase("long_break");
        setTimeLeft((settings.pomodoro_long_break ?? 15) * 60);
      } else {
        setPhase("short_break");
        setTimeLeft((settings.pomodoro_short_break ?? 5) * 60);
      }
    } else {
      setCompletedSessions(prev => [...prev, { type: phase }]);
      setPhase("work");
      setTimeLeft((settings.pomodoro_work_minutes ?? 25) * 60);
    }
    setSessionId(null);
  }

  function getPhaseDuration(p: PhaseType): number {
    if (p === "work") return settings.pomodoro_work_minutes ?? 25;
    if (p === "short_break") return settings.pomodoro_short_break ?? 5;
    return settings.pomodoro_long_break ?? 15;
  }

  function switchPhase(p: PhaseType) {
    if (running) return;
    setPhase(p);
    setTimeLeft(getPhaseDuration(p) * 60);
    setSessionId(null);
  }

  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const seconds = (timeLeft % 60).toString().padStart(2, "0");
  const totalDuration = getPhaseDuration(phase) * 60;
  const progress = ((totalDuration - timeLeft) / totalDuration) * 100;
  const circumference = 2 * Math.PI * 100;

  return (
    <div className="min-h-screen bg-[#fbfbfb] p-6">
      <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Pomodoro</h1>

      {/* Phase selector */}
      <div className="flex gap-2 mb-8">
        {(["work", "short_break", "long_break"] as PhaseType[]).map(p => (
          <button
            key={p}
            onClick={() => switchPhase(p)}
            className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
              phase === p ? PHASE_BG[p] + " border-2 border-current" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            } ${phase === p ? (p === "work" ? "text-indigo-600 border-indigo-300" : p === "short_break" ? "text-green-600 border-green-300" : "text-blue-600 border-blue-300") : ""}`}
            disabled={running}
          >
            {PHASE_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Timer circle */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative w-56 h-56">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 220 220">
            <circle cx="110" cy="110" r="100" fill="none" stroke="#e5e7eb" strokeWidth="12" />
            <circle
              cx="110" cy="110" r="100"
              fill="none"
              stroke="url(#timerGrad)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (circumference * progress) / 100}
              className="transition-all duration-1000"
            />
            <defs>
              <linearGradient id="timerGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={phase === "work" ? "#0147FF" : phase === "short_break" ? "#34d399" : "#38bdf8"} />
                <stop offset="100%" stopColor={phase === "work" ? "#0147FF" : phase === "short_break" ? "#10b981" : "#06b6d4"} />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-bold tabular-nums text-gray-800">{minutes}:{seconds}</span>
            <span className="text-sm text-gray-400 mt-1">{PHASE_LABELS[phase]}</span>
          </div>
        </div>

        {/* Session dots */}
        <div className="flex gap-2 mt-4">
          {Array.from({ length: settings.pomodoro_sessions_before_long ?? 4 }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-colors ${
                i < (sessionsCompleted % (settings.pomodoro_sessions_before_long ?? 4))
                  ? "bg-[#0147FF]"
                  : "bg-gray-200"
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">{sessionsCompleted} session(s) complétée(s)</p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <button
          onClick={handleReset}
          className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
        >
          <RotateCcw size={18} />
        </button>
        <button
          onClick={running ? handlePause : handleStart}
          className="w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-all hover:scale-105 bg-[#121A2E]"
        >
          {running ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
        </button>
        <div className="w-12 h-12" /> {/* Spacer */}
      </div>

      {/* Task selection */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-[#0147FF]" />
          Tâche en cours
        </h3>
        {tasks.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune tâche à faire aujourd&apos;hui</p>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => setSelectedTask(null)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                !selectedTask ? "bg-gray-50 text-gray-800 border border-gray-200" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              Sans tâche spécifique
            </button>
            {tasks.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTask(t)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                  selectedTask?.id === t.id ? "bg-gray-50 text-gray-800 border border-gray-200" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className="flex-1 truncate">{t.title}</span>
                <span className="text-xs text-[#0147FF] shrink-0">+{t.points}pts</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Session history */}
      {completedSessions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-medium text-gray-800 mb-3">Sessions de la journée</h3>
          <div className="flex flex-wrap gap-2">
            {completedSessions.map((s, i) => (
              <div
                key={i}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                  s.type === "work" ? "bg-gray-100 text-gray-700" :
                  s.type === "short_break" ? "bg-green-100 text-green-700" :
                  "bg-blue-100 text-blue-700"
                }`}
              >
                {s.type === "work" ? <Zap size={10} /> : <Coffee size={10} />}
                {s.type === "work" ? (s.task ? s.task.slice(0, 20) : "Travail") : PHASE_LABELS[s.type]}
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
