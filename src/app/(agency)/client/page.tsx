"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { FolderOpen, Clock, CheckCircle2, Loader2, ChevronRight } from "lucide-react";

interface Project {
  id: string;
  name: string;
  client_name: string | null;
  status: string;
  form_data: Record<string, unknown>;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente de traitement",
  in_progress: "En cours",
  review: "En révision",
  completed: "Terminé",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock size={16} className="text-yellow-500" />,
  in_progress: <Loader2 size={16} className="text-blue-500" />,
  review: <CheckCircle2 size={16} className="text-purple-500" />,
  completed: <CheckCircle2 size={16} className="text-green-500" />,
};

export default function ClientDashboard() {
  const [project, setProject]   = useState<Project | null>(null);
  const [loading, setLoading]   = useState(true);
  const [userName, setUserName] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { user } = session;

      // Fetch the project linked to this user
      const r = await fetch("/api/projects/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const d = await r.json();
      if (d.project) {
        setProject(d.project);
        setUserName(d.project.client_name ?? user.email ?? "");
      } else {
        setUserName(user.email ?? "");
      }
      setLoading(false);
    }
    load();
  }, []);

  const firstName = userName.split(" ")[0] || userName.split("@")[0];

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Bonjour {firstName} !
        </h1>
        <p className="text-gray-500 mt-1">Voici l&apos;avancement de votre projet.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-indigo-500" size={28} />
        </div>
      ) : !project ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FolderOpen size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Aucun projet en cours</p>
          <p className="text-gray-400 text-sm mt-1">Votre agence va bientôt démarrer votre projet.</p>
        </div>
      ) : (
        <>
          {/* Project card */}
          <Link href={`/client/projects/${project.id}`} className="block bg-white rounded-xl border border-gray-200 p-6 mb-6 hover:border-indigo-200 hover:shadow-sm transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">{project.name}</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  Démarré le {new Date(project.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full">
                  {STATUS_ICONS[project.status] ?? <Clock size={16} className="text-gray-400" />}
                  <span className="text-xs font-medium text-gray-700">
                    {STATUS_LABELS[project.status] ?? project.status}
                  </span>
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
              </div>
            </div>

            {/* Form data summary */}
            {Object.keys(project.form_data ?? {}).length > 0 && (
              <div className="border-t border-gray-100 pt-4 mt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Vos informations</p>
                <div className="space-y-2">
                  {Object.entries(project.form_data).slice(0, 5).map(([key, val]) => (
                    <div key={key} className="flex gap-3 text-sm">
                      <span className="text-gray-400 capitalize min-w-32 shrink-0">{key.replace(/_/g, " ")}</span>
                      <span className="text-gray-700 font-medium">{Array.isArray(val) ? val.join(", ") : String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Link>

          {/* Stages quick view */}
          {(project.stages ?? []).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Avancement</p>
              <div className="flex gap-2 flex-wrap">
                {project.stages.map((s, i) => (
                  <span key={s.id ?? i} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${
                    s.completed ? "bg-green-50 text-green-700 border-green-200"
                    : i === project.current_stage_index ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                    : "bg-gray-50 text-gray-400 border-gray-100"
                  }`}>
                    {s.completed ? <CheckCircle2 size={11} /> : i === project.current_stage_index ? <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" /> : null}
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(project.stages ?? []).length === 0 && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
              <p className="text-sm font-semibold text-indigo-800 mb-1">Prochaine étape</p>
              <p className="text-sm text-indigo-700">Votre agence analyse vos informations et vous contactera très prochainement.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
