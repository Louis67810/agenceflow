import Link from "next/link";
import { FolderKanban, MessageSquare, ArrowRight, CheckCircle } from "lucide-react";
import { StageTimeline } from "@/components/shared/StageTimeline";
import { StatusBadge } from "@/components/agency/StatusBadge";

export default function ClientDashboard() {
  // Mock active project
  const project = {
    id: "1",
    name: "Site web Startup XYZ",
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

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Bonjour Martin 👋</h1>
        <p className="text-gray-500 mt-1">Voici l&apos;avancement de votre projet.</p>
      </div>

      {/* Project Status Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900">{project.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Deadline : {new Date(project.deadline).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <StatusBadge status={project.status} />
        </div>
        <StageTimeline stages={project.stages} currentStage={project.current_stage} />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Link href="/client/projects">
          <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-indigo-200 transition-all group">
            <div className="flex items-center justify-between">
              <div>
                <div className="p-2 bg-indigo-50 rounded-lg inline-block mb-3">
                  <FolderKanban size={20} className="text-indigo-600" />
                </div>
                <p className="font-semibold text-gray-900">Mon projet</p>
                <p className="text-sm text-gray-500 mt-0.5">Suivre l&apos;avancement détaillé</p>
              </div>
              <ArrowRight size={18} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
            </div>
          </div>
        </Link>
        <Link href="/client/messages">
          <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-indigo-200 transition-all group">
            <div className="flex items-center justify-between">
              <div>
                <div className="p-2 bg-blue-50 rounded-lg inline-block mb-3">
                  <MessageSquare size={20} className="text-blue-600" />
                </div>
                <p className="font-semibold text-gray-900">Messages</p>
                <p className="text-sm text-gray-500 mt-0.5">Communiquer avec l&apos;équipe</p>
              </div>
              <ArrowRight size={18} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
            </div>
          </div>
        </Link>
      </div>

      {/* Completed steps */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Étapes validées</h2>
        <div className="space-y-3">
          {project.stages.filter((s) => s.completed).map((stage) => (
            <div key={stage.stage} className="flex items-center gap-3 text-sm">
              <CheckCircle size={16} className="text-green-500 shrink-0" />
              <span className="text-gray-700 font-medium">{stage.label}</span>
              <span className="text-gray-400">— Validé</span>
            </div>
          ))}
          {project.stages.filter((s) => s.completed).length === 0 && (
            <p className="text-gray-400 text-sm">Aucune étape validée pour le moment</p>
          )}
        </div>
      </div>
    </div>
  );
}
