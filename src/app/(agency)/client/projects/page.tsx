import Link from "next/link";
import { ArrowRight, Calendar, CheckCircle } from "lucide-react";
import { StatusBadge } from "@/components/agency/StatusBadge";
import { StageTimeline } from "@/components/shared/StageTimeline";
import { calculateProgress } from "@/lib/utils";

export default function ClientProjectsPage() {
  const project = {
    id: "1",
    name: "Site web Startup XYZ",
    description: "Refonte complète du site vitrine avec animations Framer",
    status: "in_progress" as const,
    current_stage: "design" as const,
    stages: [
      { stage: "copywriting" as const, label: "Copywriting", duration_days: 5, completed: true },
      { stage: "wireframe" as const, label: "Wireframe", duration_days: 7, completed: true },
      { stage: "design" as const, label: "Design", duration_days: 14, completed: false },
      { stage: "development" as const, label: "Développement", duration_days: 10, completed: false },
      { stage: "revision" as const, label: "Révisions", duration_days: 5, completed: false },
    ],
    deadline: "2026-03-28",
  };

  const progress = calculateProgress(project.stages);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mes projets</h1>
        <p className="text-gray-500 mt-1">Suivez l&apos;avancement de vos projets en temps réel</p>
      </div>

      <Link href={`/client/projects/${project.id}`}>
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md hover:border-indigo-200 transition-all group">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                  {project.name}
                </h2>
                <StatusBadge status={project.status} />
              </div>
              <p className="text-sm text-gray-500">{project.description}</p>
            </div>
            <ArrowRight size={18} className="text-gray-300 group-hover:text-indigo-500 transition-colors mt-1" />
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>Avancement global</span>
              <span className="font-semibold text-gray-700">{progress}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <StageTimeline stages={project.stages} currentStage={project.current_stage} />

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              {project.stages.filter((s) => s.completed).map((s) => (
                <div key={s.stage} className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle size={12} />
                  {s.label}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Calendar size={12} />
              Deadline : {new Date(project.deadline).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
