"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { Loader2, AlertCircle, CheckSquare, Clock, CheckCircle2, CalendarDays } from "lucide-react";

interface Stage {
  id: string;
  label: string;
  duration_days: number;
  completed: boolean;
  completed_at: string | null;
  assigned_to_designer?: boolean;
  image_url?: string;
}

interface Project {
  id: string;
  name: string;
  status: string;
  stages: Stage[];
  current_stage_index: number;
  start_date: string | null;
  created_at: string;
}

interface TaskItem {
  stageLabel: string;
  stageIdx: number;
  stageImage?: string;
  projectId: string;
  projectName: string;
  deadline: Date;
  status: "done" | "current" | "upcoming";
}

function computeDeadline(project: Project, stageIdx: number): Date {
  const base = new Date(project.start_date ?? project.created_at);
  for (let i = 0; i <= stageIdx; i++) {
    base.setDate(base.getDate() + (project.stages[i]?.duration_days ?? 0));
  }
  return base;
}

const STATUS_LABELS = { done: "Terminé", current: "En cours", upcoming: "À venir" };
const STATUS_COLORS = {
  done: "bg-green-50 text-green-700 border-green-200",
  current: "bg-purple-50 text-purple-700 border-purple-200",
  upcoming: "bg-gray-50 text-gray-500 border-gray-200",
};

export default function DesignerTasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "current" | "upcoming" | "done">("all");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Non connecté"); setLoading(false); return; }

      const r = await fetch("/api/projects/designer-me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Erreur"); setLoading(false); return; }

      const allTasks: TaskItem[] = [];
      for (const project of (d.projects ?? []) as Project[]) {
        const stages = project.stages ?? [];
        stages.forEach((stage, idx) => {
          if (!stage.assigned_to_designer) return;
          const isDone = stage.completed;
          const isCurrent = !isDone && idx === project.current_stage_index;
          const status: TaskItem["status"] = isDone ? "done" : isCurrent ? "current" : "upcoming";
          allTasks.push({
            stageLabel: stage.label,
            stageIdx: idx,
            stageImage: stage.image_url,
            projectId: project.id,
            projectName: project.name,
            deadline: computeDeadline(project, idx),
            status,
          });
        });
      }

      // Sort: current first, then upcoming by deadline, then done
      allTasks.sort((a, b) => {
        const order = { current: 0, upcoming: 1, done: 2 };
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        return a.deadline.getTime() - b.deadline.getTime();
      });

      setTasks(allTasks);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);
  const counts = {
    all: tasks.length,
    current: tasks.filter((t) => t.status === "current").length,
    upcoming: tasks.filter((t) => t.status === "upcoming").length,
    done: tasks.filter((t) => t.status === "done").length,
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="animate-spin text-indigo-500" size={28} />
    </div>
  );

  if (error) return (
    <div className="p-8">
      <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
        <AlertCircle size={16} className="mt-0.5" /><p className="text-sm">{error}</p>
      </div>
    </div>
  );

  const isOverdue = (t: TaskItem) => t.status !== "done" && t.deadline < new Date();

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mes tâches</h1>
        <p className="text-gray-500 mt-1">{tasks.length} tâche{tasks.length !== 1 ? "s" : ""} assignée{tasks.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(["all", "current", "upcoming", "done"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            {f === "all" ? "Toutes" : STATUS_LABELS[f]}
            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${filter === f ? "bg-white/20" : "bg-gray-100"}`}>
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <CheckSquare size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Aucune tâche</p>
          <p className="text-gray-400 text-sm mt-1">
            {filter === "all" ? "L'agence vous assignera des tâches dans vos projets." : `Aucune tâche "${STATUS_LABELS[filter].toLowerCase()}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((task, i) => {
            const overdue = isOverdue(task);
            return (
              <Link key={i} href={`/designer/projects/${task.projectId}`}>
                <div className={`bg-white rounded-xl border p-5 hover:shadow-sm transition-all group ${
                  task.status === "current" ? "border-purple-200" : overdue ? "border-red-200" : "border-gray-200"
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="shrink-0 mt-0.5">
                        {task.stageImage ? (
                          <img src={task.stageImage} alt="" className="w-8 h-8 rounded-lg object-cover" />
                        ) : task.status === "done" ? (
                          <CheckCircle2 size={20} className="text-green-500" />
                        ) : task.status === "current" ? (
                          <div className="w-5 h-5 rounded-full bg-purple-500 animate-pulse mt-0.5" />
                        ) : (
                          <Clock size={20} className="text-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm truncate group-hover:text-indigo-600 transition-colors ${task.status === "done" ? "line-through text-gray-400" : "text-gray-900"}`}>
                          {task.stageLabel}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{task.projectName}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className={`flex items-center gap-1.5 text-xs font-medium ${overdue && task.status !== "done" ? "text-red-600" : "text-gray-400"}`}>
                        <CalendarDays size={13} />
                        {task.deadline.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        {overdue && task.status !== "done" && <span className="text-red-500 font-semibold">— En retard</span>}
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[task.status]}`}>
                        {STATUS_LABELS[task.status]}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
