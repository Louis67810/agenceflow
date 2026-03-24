import Link from "next/link";
import { Calendar, User, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/agency/StatusBadge";
import { calculateProgress, formatDateShort, daysUntil, isOverdue } from "@/lib/utils";
import type { Project } from "@/types/agency";

interface ProjectCardProps {
  project: Project;
  basePath: string;
}

export function ProjectCard({ project, basePath }: ProjectCardProps) {
  const progress = calculateProgress(project.stages);
  const deadlineDays = project.deadline ? daysUntil(project.deadline) : null;
  const overdue = project.deadline ? isOverdue(project.deadline) : false;

  return (
    <Link href={`${basePath}/${project.id}`}>
      <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-indigo-200 transition-all group">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
              {project.name}
            </h3>
            {project.description && (
              <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-3 shrink-0">
            <StatusBadge status={project.status} />
            <ChevronRight size={16} className="text-gray-400 group-hover:text-indigo-500 transition-colors" />
          </div>
        </div>

        {/* Progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Avancement</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-indigo-500 h-1.5 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-3">
            {project.client && (
              <span className="flex items-center gap-1">
                <User size={12} />
                {project.client.name}
              </span>
            )}
            {project.designer && (
              <span className="flex items-center gap-1">
                <User size={12} className="text-indigo-400" />
                {project.designer.name}
              </span>
            )}
          </div>
          {project.deadline && (
            <span
              className={`flex items-center gap-1 ${
                overdue
                  ? "text-red-500 font-medium"
                  : deadlineDays !== null && deadlineDays <= 7
                  ? "text-orange-500"
                  : ""
              }`}
            >
              <Calendar size={12} />
              {overdue
                ? `Retard ${Math.abs(deadlineDays!)}j`
                : deadlineDays !== null
                ? `${deadlineDays}j restants`
                : formatDateShort(project.deadline)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
