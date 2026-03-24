import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectStageConfig } from "@/types/agency";
import { PROJECT_STAGE_LABELS } from "@/types/agency";

interface StageTimelineProps {
  stages: ProjectStageConfig[];
  currentStage: string;
}

export function StageTimeline({ stages, currentStage }: StageTimelineProps) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto">
      {stages.map((stage, index) => {
        const isCurrent = stage.stage === currentStage;
        const isCompleted = stage.completed;
        const isLast = index === stages.length - 1;

        return (
          <div key={stage.stage} className="flex items-center shrink-0">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                  isCompleted
                    ? "bg-green-500 border-green-500 text-white"
                    : isCurrent
                    ? "bg-indigo-500 border-indigo-500 text-white"
                    : "bg-white border-gray-300 text-gray-400"
                )}
              >
                {isCompleted ? <Check size={14} /> : isCurrent ? <Clock size={14} /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-xs mt-1 font-medium whitespace-nowrap",
                  isCompleted
                    ? "text-green-600"
                    : isCurrent
                    ? "text-indigo-600"
                    : "text-gray-400"
                )}
              >
                {PROJECT_STAGE_LABELS[stage.stage]}
              </span>
              {stage.end_date && (
                <span className="text-xs text-gray-400 mt-0.5">
                  {new Date(stage.end_date).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
              )}
            </div>
            {!isLast && (
              <div
                className={cn(
                  "h-0.5 w-12 mx-1 mb-4",
                  isCompleted ? "bg-green-400" : "bg-gray-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
