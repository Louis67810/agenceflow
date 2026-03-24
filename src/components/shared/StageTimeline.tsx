import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectStageConfig } from "@/types/agency";
import { PROJECT_STAGE_LABELS } from "@/types/agency";

interface StageTimelineProps {
  stages: ProjectStageConfig[];
  currentStage: string;
  onValidateStage?: () => void;
}

export function StageTimeline({
  stages,
  currentStage,
  onValidateStage,
}: StageTimelineProps) {
  const totalDays = stages.reduce((sum, s) => sum + s.duration_days, 0);
  const completedStages = stages.filter((s) => s.completed).length;

  return (
    <div>
      {/* Step indicators */}
      <div className="flex items-start gap-0 overflow-x-auto pb-2">
        {stages.map((stage, index) => {
          const isCurrent = stage.stage === currentStage;
          const isCompleted = stage.completed;
          const isLast = index === stages.length - 1;

          return (
            <div key={stage.stage} className="flex items-start shrink-0">
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
                  {isCompleted ? (
                    <Check size={14} />
                  ) : isCurrent ? (
                    <Clock size={14} />
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs mt-1.5 font-medium whitespace-nowrap",
                    isCompleted
                      ? "text-green-600"
                      : isCurrent
                        ? "text-indigo-600"
                        : "text-gray-400"
                  )}
                >
                  {PROJECT_STAGE_LABELS[stage.stage as keyof typeof PROJECT_STAGE_LABELS] ?? stage.label}
                </span>
                <span
                  className={cn(
                    "text-xs mt-0.5 whitespace-nowrap",
                    isCompleted
                      ? "text-green-500"
                      : isCurrent
                        ? "text-indigo-400"
                        : "text-gray-300"
                  )}
                >
                  {stage.duration_days}j
                </span>
                {(stage.completed_at || stage.end_date) && (
                  <span className="text-xs text-gray-400 mt-0.5 whitespace-nowrap">
                    {new Date(
                      stage.completed_at ?? stage.end_date!
                    ).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                )}
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "h-0.5 w-12 mx-1 mt-4",
                    isCompleted ? "bg-green-400" : "bg-gray-200"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Duration bar (Gantt-style) */}
      <div className="mt-4 flex rounded-full overflow-hidden h-2 bg-gray-100">
        {stages.map((stage) => {
          const isCompleted = stage.completed;
          const isCurrent = stage.stage === currentStage;
          const widthPct = (stage.duration_days / totalDays) * 100;
          return (
            <div
              key={stage.stage}
              style={{ width: `${widthPct}%` }}
              className={cn(
                "h-full transition-all",
                isCompleted
                  ? "bg-green-400"
                  : isCurrent
                    ? "bg-indigo-400"
                    : "bg-gray-200"
              )}
              title={`${PROJECT_STAGE_LABELS[stage.stage as keyof typeof PROJECT_STAGE_LABELS] ?? stage.label} — ${stage.duration_days}j`}
            />
          );
        })}
      </div>

      {/* Summary + validate action */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {completedStages}/{stages.length} étapes · {totalDays} jours au total
        </span>
        {onValidateStage && (
          <button
            onClick={onValidateStage}
            className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Check size={12} />
            Valider l&apos;étape
          </button>
        )}
      </div>
    </div>
  );
}
