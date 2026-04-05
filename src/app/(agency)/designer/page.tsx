"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { FolderKanban, Clock, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface Stage {
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
  client_name: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  in_progress: "En cours",
  review: "En révision",
  completed: "Terminé",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700",
  in_progress: "bg-blue-50 text-blue-700",
  review: "bg-purple-50 text-purple-700",
  completed: "bg-green-50 text-green-700",
};

export default function DesignerDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [designerName, setDesignerName] = useState("");
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
      setDesignerName(d.designer?.name ?? "");
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

  const activeProjects = projects.filter((p) => p.status !== "completed");
  const doneProjects = projects.filter((p) => p.status === "completed");

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Bonjour{designerName ? ` ${designerName.split(" ")[0]}` : ""} !
        </h1>
        <p className="text-gray-500 mt-1">Voici vos projets assignés.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 rounded-lg inline-block mb-3 bg-indigo-50 text-indigo-600">
            <FolderKanban size={20} />
          </div>
          <p className="text-2xl font-bold text-gray-900">{activeProjects.length}</p>
          <p className="text-sm text-gray-500">Projets actifs</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 rounded-lg inline-block mb-3 bg-green-50 text-green-600">
            <CheckCircle2 size={20} />
          </div>
          <p className="text-2xl font-bold text-gray-900">{doneProjects.length}</p>
          <p className="text-sm text-gray-500">Projets terminés</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="p-2 rounded-lg inline-block mb-3 bg-orange-50 text-orange-600">
            <Clock size={20} />
          </div>
          <p className="text-2xl font-bold text-gray-900">{projects.length}</p>
          <p className="text-sm text-gray-500">Total projets</p>
        </div>
      </div>

      {/* Projects */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Mes projets</h2>
          <Link href="/designer/projects" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            Voir tout
          </Link>
        </div>

        {projects.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">Aucun projet assigné pour l&apos;instant.</p>
        ) : (
          <div className="space-y-3">
            {projects.slice(0, 5).map((project) => {
              const currentStage = project.stages?.[project.current_stage_index];
              return (
                <Link key={project.id} href={`/designer/projects/${project.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group">
                    <div>
                      <p className="font-medium text-gray-900 text-sm group-hover:text-indigo-600 transition-colors">
                        {project.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {project.client_name && `Client : ${project.client_name} · `}
                        {currentStage ? `Étape : ${currentStage.label}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[project.status] ?? "bg-gray-50 text-gray-600"}`}>
                        {STATUS_LABELS[project.status] ?? project.status}
                      </span>
                      <ArrowRight size={14} className="text-gray-300 group-hover:text-indigo-400 transition-colors" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
