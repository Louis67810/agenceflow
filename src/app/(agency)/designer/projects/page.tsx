"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { ArrowRight, Loader2, AlertCircle, FolderKanban } from "lucide-react";

interface Project {
  id: string;
  name: string;
  status: string;
  stages: { label: string; duration_days: number; completed: boolean }[];
  current_stage_index: number;
  client_name: string | null;
  start_date: string | null;
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

export default function DesignerProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setProjects(d.projects ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="animate-spin text-indigo-500" size={28} />
    </div>
  );

  if (error) return (
    <div className="p-8">
      <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
        <AlertCircle size={16} className="mt-0.5" />
        <p className="text-sm">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mes projets</h1>
        <p className="text-gray-500 mt-1">{projects.length} projet{projects.length !== 1 ? "s" : ""} assigné{projects.length !== 1 ? "s" : ""}</p>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <FolderKanban size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Aucun projet assigné</p>
          <p className="text-gray-400 text-sm mt-1">L&apos;agence vous assignera des projets prochainement.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {projects.map((project) => {
            const currentStage = project.stages?.[project.current_stage_index];
            const completedCount = project.stages?.filter((s) => s.completed).length ?? 0;
            return (
              <Link key={project.id} href={`/designer/projects/${project.id}`}>
                <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-sm transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{project.name}</h3>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full border ${STATUS_COLORS[project.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                      {STATUS_LABELS[project.status] ?? project.status}
                    </span>
                  </div>
                  {project.client_name && (
                    <p className="text-xs text-gray-500 mb-3">Client : {project.client_name}</p>
                  )}
                  {project.stages?.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                        <span>{currentStage?.label ?? "Terminé"}</span>
                        <span>{completedCount}/{project.stages.length} étapes</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all"
                          style={{ width: `${(completedCount / project.stages.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-end">
                    <ArrowRight size={14} className="text-gray-300 group-hover:text-indigo-400 transition-colors" />
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
