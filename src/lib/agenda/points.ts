import type { AgendaTask, AgendaHabit, AgendaDailyRecap } from "@/types/agenda";

/** @deprecated Points system replaced by day_score out of 100 */
export function taskPoints(task: AgendaTask): number {
  return task.importance * 10;
}

/** @deprecated Points system replaced by day_score out of 100 */
export function habitPoints(habit: AgendaHabit): number {
  return habit.points;
}

/**
 * @deprecated Use calculateDayScore instead
 */
export function computeWeightedTaskPoints(
  taskImportance: number,
  allTasksImportances: number[],
  dailyPool: number = 100
): number {
  const totalImportance = allTasksImportances.reduce((s, i) => s + i, 0);
  if (totalImportance === 0) return Math.round(dailyPool / Math.max(1, allTasksImportances.length));
  return Math.max(1, Math.round((taskImportance / totalImportance) * dailyPool));
}

/** @deprecated Points system replaced by day_score out of 100 */
export function recapBonusPoints(_: Partial<AgendaDailyRecap>): number {
  return 0;
}

/**
 * Calculate a daily score out of 100 based on task and habit completion.
 * 60% from tasks completion + 40% from habits completion.
 */
export function calculateDayScore(
  tasksDone: number,
  tasksTotal: number,
  habitsDone: number,
  habitsTotal: number,
  habitImportances?: number[] // array of importances for done habits
): number {
  if (tasksTotal === 0 && habitsTotal === 0) return 0;

  const taskRate = tasksTotal > 0 ? tasksDone / tasksTotal : 1;

  // Habits weighted by importance
  let habitRate = 1;
  if (habitsTotal > 0) {
    if (habitImportances && habitImportances.length > 0) {
      const totalWeight = habitImportances.reduce((s, i) => s + i, 0);
      const maxWeight = habitsTotal * 5; // max importance is 5
      habitRate = totalWeight / maxWeight;
    } else {
      habitRate = habitsDone / habitsTotal;
    }
  }

  const raw = taskRate * 60 + habitRate * 40;
  return Math.round(Math.min(100, raw));
}

/**
 * @deprecated Old score was out of 10. Use calculateDayScore (out of 100) instead.
 */
export function computeDayScore(
  tasksCompleted: number,
  tasksPlanned: number,
  habitsDone: number,
  habitsTotal: number
): number {
  if (tasksPlanned === 0 && habitsTotal === 0) return 0;

  const taskRate = tasksPlanned > 0 ? tasksCompleted / tasksPlanned : 1;
  const habitRate = habitsTotal > 0 ? habitsDone / habitsTotal : 1;

  const raw = (taskRate * 0.6 + habitRate * 0.4) * 10;
  return Math.min(10, Math.round(raw));
}

export function resolveTaskColor(task: Pick<AgendaTask, "color">, objectiveColor?: string | null): string {
  return objectiveColor || task.color || "#6366f1";
}

/** @deprecated Points system replaced by day_score out of 100 */
export function getLevelFromPoints(totalPoints: number): {
  level: number;
  label: string;
  nextLevelPoints: number;
  progress: number;
} {
  const thresholds = [0, 200, 500, 1000, 2000, 3500, 5500, 8000, 11000, 15000];
  const labels = [
    "Débutant", "Apprenti", "Pratiquant", "Confirmé",
    "Expert", "Maître", "Grand Maître", "Légende", "Mythique", "Transcendant"
  ];

  const pts = totalPoints ?? 0;
  let level = 0;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (pts >= thresholds[i]) { level = i; break; }
  }

  const currentThreshold = thresholds[level];
  const nextThreshold = thresholds[level + 1] ?? currentThreshold + 5000;
  const progress = Math.round(((pts - currentThreshold) / (nextThreshold - currentThreshold)) * 100);

  return {
    level: level + 1,
    label: labels[level],
    nextLevelPoints: Math.max(0, nextThreshold - pts),
    progress: Math.min(100, Math.max(0, progress)),
  };
}

/** @deprecated Points system replaced by day_score out of 100 */
export function getStreakBonus(streak: number): number {
  if (streak >= 30) return 3;
  if (streak >= 14) return 2;
  if (streak >= 7) return 1.5;
  return 1;
}
