"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, FolderOpen, CheckCircle2, Clock, ChevronRight, ArrowRight } from "lucide-react";

interface Stage {
  id: string;
  label: string;
  duration_days: number;
  completed: boolean;
}

interface Project {
  id: string;
  name: string;
  status: string;
  stages: Stage[];
  current_stage_index: number;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  in_progress: "En cours",
  review: "En révision",
  completed: "Terminé",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  review: "bg-purple-50 text-purple-700 border-purple-200",
  completed: "bg-green-50 text-green-700 border-green-200",
};

export default function ClientProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const r = await fetch("/api/projects/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const d = await r.json();
      setProjects(d.projects ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mes projets</h1>
        <p className="text-gray-500 mt-1">Suivez l&apos;avancement de vos projets</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-indigo-500" size={28} />
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FolderOpen size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Aucun projet pour l&apos;instant</p>
          <p className="text-gray-400 text-sm mt-1">Votre agence va bientôt démarrer votre projet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => {
            const stages = project.stages ?? [];
            const done = stages.filter((s) => s.completed).length;
            const progress = stages.length > 0 ? Math.round((done / stages.length) * 100) : 0;
            const currentStage = stages[project.current_stage_index];

            return (
              <Link key={project.id} href={`/client/projects/${project.id}`}>
                <div className="bg-white rounded-xl border border-gray-200 p-6 hover:border-indigo-200 hover:shadow-sm transition-all group">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                        {project.name}
                      </h2>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Créé le {new Date(project.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[project.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                        {STATUS_LABELS[project.status] ?? project.status}
                      </span>
                      <ArrowRight size={16} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
                    </div>
                  </div>

                  {/* Progress bar */}
                  {stages.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                        <span>{currentStage ? `Étape en cours : ${currentStage.label}` : "Toutes les étapes terminées"}</span>
                        <span className="font-semibold text-gray-600">{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-indigo-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Stage pills */}
                  {stages.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {stages.map((s, i) => (
                        <span key={s.id ?? i} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                          s.completed
                            ? "bg-green-50 text-green-600"
                            : i === project.current_stage_index
                            ? "bg-indigo-50 text-indigo-600 font-medium"
                            : "bg-gray-50 text-gray-400"
                        }`}>
                          {s.completed ? <CheckCircle2 size={10} /> : i === project.current_stage_index ? <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" /> : <Clock size={10} />}
                          {s.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
