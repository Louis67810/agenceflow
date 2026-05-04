export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type ObjectiveStatus = "active" | "completed" | "archived";
export type HabitFrequency = "daily" | "weekly" | "custom";
export type PomodoroSessionType = "work" | "short_break" | "long_break";

export interface AgendaTask {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  importance: number;
  status: TaskStatus;
  objective_id?: string;
  parent_task_id?: string;
  recurrence?: string;
  recurrence_end?: string;
  tags?: string[];
  color?: string;
  /** @deprecated Use day_score instead */
  points: number;
  created_at: string;
  updated_at: string;
  // Relations
  subtasks?: AgendaTask[];
  objective?: AgendaObjective;
}

export interface AgendaObjective {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  parent_id?: string;
  target_date?: string;
  status: ObjectiveStatus;
  progress: number;
  color: string;
  icon?: string;
  created_at: string;
  updated_at: string;
  // Relations
  children?: AgendaObjective[];
  tasks?: AgendaTask[];
}

export interface AgendaHabit {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  frequency: HabitFrequency;
  frequency_days?: number[];
  target_per_period: number;
  importance: number;
  /** @deprecated Use importance instead */
  points: number;
  color: string;
  icon: string;
  active: boolean;
  streak_current: number;
  streak_best: number;
  created_at: string;
  // Computed
  done_today?: boolean;
  done_this_week?: number;
}

export interface AgendaHabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  logged_date: string;
  note?: string;
  created_at: string;
}

export interface AgendaBlockedSlot {
  id: string;
  user_id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  recurrence?: "none" | "daily" | "weekly" | "monthly";
  recurrence_end?: string;
  color: string;
  created_at: string;
}

export interface AgendaPomodoroSession {
  id: string;
  user_id: string;
  task_id?: string;
  started_at: string;
  ended_at?: string;
  duration_minutes: number;
  completed: boolean;
  session_type: PomodoroSessionType;
}

export interface AgendaDailyRecap {
  id: string;
  user_id: string;
  recap_date: string;
  tasks_completed: number;
  tasks_planned: number;
  habits_done: number;
  habits_total: number;
  day_score: number;
  mood?: string;
  wins?: string;
  improvements?: string;
  tomorrow_priority?: string;
  points_earned: number;
  bonus_points: number;
  justified_tasks_count?: number;
  task_reviews?: AgendaTaskReview[];
  created_at: string;
}

export type AgendaTaskReviewOutcome = "done" | "missed" | "justified";

export interface AgendaTaskReview {
  task_id: string;
  outcome: AgendaTaskReviewOutcome;
  justification?: string;
  points_awarded: number;
}

/** @deprecated Points system replaced by day_score out of 100 */
export interface AgendaPointsLog {
  id: string;
  user_id: string;
  points: number;
  reason: string;
  entity_type?: string;
  entity_id?: string;
  earned_at: string;
}

export interface AgendaSettings {
  id: string;
  user_id: string;
  work_start: string;
  work_end: string;
  slot_duration_minutes: number;
  pomodoro_work_minutes: number;
  pomodoro_short_break: number;
  pomodoro_long_break: number;
  pomodoro_sessions_before_long: number;
  /** @deprecated */
  weekly_points_goal: number;
  /** @deprecated */
  daily_points_pool?: number;
  auto_schedule_enabled: boolean;
  recap_reminder_time: string;
  timezone: string;
}

export interface DashboardStats {
  todayTasks: AgendaTask[];
  todayDone: number;
  weekPoints: number;
  weekGoal: number;
  streakDays: number;
  habitsToday: { habit: AgendaHabit; done: boolean }[];
  nextTask?: AgendaTask;
  recentRecap?: AgendaDailyRecap;
}
