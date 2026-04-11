import type { AgendaTask, AgendaHabit, AgendaDailyRecap } from "@/types/agenda";

/**
 * Points pour une tâche individuelle (indicatif, affiché dans l'UI).
 * La vraie récompense est calculée en pondérant par rapport aux autres tâches du jour.
 */
export function taskPoints(task: AgendaTask): number {
  return task.importance * 10;
}

export function habitPoints(habit: AgendaHabit): number {
  return habit.points;
}

/**
 * Calcule les points pondérés pour une tâche complétée,
 * en fonction de son poids relatif parmi toutes les tâches du jour.
 *
 * Ex : 6 tâches, tâche complétée avec importance 5, total_importance = 10
 * → points = (5/10) × pool = 50% × pool
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

export function recapBonusPoints(recap: Partial<AgendaDailyRecap>): number {
  const score = recap.day_score ?? 0;
  if (score >= 9) return 50;
  if (score >= 8) return 30;
  if (score >= 7) return 15;
  if (score >= 6) return 5;
  return 0;
}

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

export function getStreakBonus(streak: number): number {
  if (streak >= 30) return 3;
  if (streak >= 14) return 2;
  if (streak >= 7) return 1.5;
  return 1;
}
