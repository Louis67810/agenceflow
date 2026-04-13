"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import {
  FolderOpen, Clock, CheckCircle2, Loader2, ChevronRight,
  MessageSquare, ArrowRight, CalendarDays,
} from "lucide-react";

interface Stage {
  id: string;
  label: string;
  duration_days: number;
  completed: boolean;
}

interface Project {
  id: string;
  name: string;
  client_name: string | null;
  status: string;
  stages: Stage[];
  current_stage_index: number;
  form_data: Record<string, unknown>;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  in_progress: "En cours",
  review: "En révision",
  completed: "Terminé",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  review: "bg-violet-50 text-violet-700 border-violet-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
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
      setUserName(session.user.email?.split("@")[0] ?? "");

      const r = await fetch("/api/projects/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const d = await r.json();
      const projects: Project[] = d.projects ?? [];
      if (projects.length > 0) {
        setProject(projects[0]);
        setUserName(projects[0].client_name ?? session.user.email?.split("@")[0] ?? "");
      }
      setLoading(false);
    }
    load();
  }, []);

  const firstName = (userName.split(" ")[0] || userName);
  const stages = project?.stages ?? [];
  const currentIdx = project?.current_stage_index ?? 0;
  const doneCount = stages.filter((s) => s.completed).length;
  const progress = stages.length > 0 ? Math.round((doneCount / stages.length) * 100) : 0;

  return (
    <div className="p-6 lg:p-10 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-sm text-gray-400 mb-1">
          {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">
          Bonjour {firstName} 👋
        </h1>
        <p className="text-gray-500 mt-1 text-sm">Voici l&apos;état de votre projet.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-indigo-500" size={28} />
        </div>
      ) : !project ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-14 text-center">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FolderOpen size={24} className="text-gray-300" />
          </div>
          <p className="text-gray-700 font-semibold mb-1">Aucun projet en cours</p>
          <p className="text-gray-400 text-sm">Votre agence va bientôt démarrer votre projet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Main project card */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* Card header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1">
                  <h2 className="text-lg font-bold text-gray-900 truncate">{project.name}</h2>
                  <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[project.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                    {STATUS_LABELS[project.status] ?? project.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Démarré le {new Date(project.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
              <Link
                href={`/client/projects/${project.id}`}
                className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                Voir le détail <ChevronRight size={14} />
              </Link>
            </div>

            {/* Progress */}
            {stages.length > 0 && (
              <div className="px-6 py-5 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-sm font-medium text-gray-700">Avancement global</p>
                  <span className="text-sm font-bold text-indigo-600">{progress}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Stage timeline */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {stages.map((s, i) => {
                    const isDone = s.completed;
                    const isCurrent = i === currentIdx;
                    return (
                      <div key={s.id ?? i} className={`shrink-0 flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
                        isDone
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : isCurrent
                          ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                          : "bg-gray-50 border-gray-100 text-gray-400"
                      }`}>
                        <div className="flex items-center gap-1">
                          {isDone
                            ? <CheckCircle2 size={11} />
                            : isCurrent
                            ? <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                            : <Clock size={11} />}
                          {s.label}
                        </div>
                        <span className="text-[10px] opacity-60">{s.duration_days}j</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Brief summary */}
            {Object.keys(project.form_data ?? {}).length > 0 && (
              <div className="px-6 py-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Brief</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {Object.entries(project.form_data).slice(0, 4).map(([key, val]) => (
                    <div key={key}>
                      <p className="text-xs text-gray-400 capitalize">{key.replace(/_/g, " ")}</p>
                      <p className="text-sm text-gray-800 font-medium truncate">{Array.isArray(val) ? val.join(", ") : String(val ?? "")}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/client/messages"
              className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 hover:border-indigo-200 hover:shadow-sm transition-all group"
            >
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                <MessageSquare size={18} className="text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Conversation</p>
                <p className="text-xs text-gray-400">Envoyer un message</p>
              </div>
              <ArrowRight size={15} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
            </Link>

            <Link
              href={`/client/projects/${project.id}`}
              className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 hover:border-indigo-200 hover:shadow-sm transition-all group"
            >
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                <CalendarDays size={18} className="text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Suivi du projet</p>
                <p className="text-xs text-gray-400">
                  {stages.length > 0 ? `Étape ${Math.min(currentIdx + 1, stages.length)}/${stages.length}` : "Voir le détail"}
                </p>
              </div>
              <ArrowRight size={15} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
            </Link>
          </div>

          {/* No stages info box */}
          {stages.length === 0 && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0 animate-pulse" />
              <div>
                <p className="text-sm font-semibold text-indigo-800 mb-0.5">Prochaine étape</p>
                <p className="text-sm text-indigo-700">Votre agence analyse vos informations et vous contactera très prochainement.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
