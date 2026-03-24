import { cn } from "@/lib/utils";
import type { ProjectStatus, TaskStatus } from "@/types/agency";
import { PROJECT_STATUS_LABELS } from "@/types/agency";

const statusColors: Record<ProjectStatus, string> = {
  pending: "bg-gray-100 text-gray-700",
  onboarding: "bg-blue-100 text-blue-700",
  in_progress: "bg-indigo-100 text-indigo-700",
  review: "bg-yellow-100 text-yellow-700",
  revision: "bg-orange-100 text-orange-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const taskStatusColors: Record<TaskStatus, string> = {
  todo: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
};

const taskStatusLabels: Record<TaskStatus, string> = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Terminé",
};

interface StatusBadgeProps {
  status: ProjectStatus | TaskStatus;
  type?: "project" | "task";
  className?: string;
}

export function StatusBadge({ status, type = "project", className }: StatusBadgeProps) {
  const colors =
    type === "project"
      ? statusColors[status as ProjectStatus]
      : taskStatusColors[status as TaskStatus];

  const label =
    type === "project"
      ? PROJECT_STATUS_LABELS[status as ProjectStatus]
      : taskStatusLabels[status as TaskStatus];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        colors,
        className
      )}
    >
      {label}
    </span>
  );
}
