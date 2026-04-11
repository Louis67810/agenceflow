-- Agenda / Organisation personnelle gamifiée

-- Tâches
CREATE TABLE IF NOT EXISTS agenda_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  date DATE,
  start_time TIME,
  end_time TIME,
  duration_minutes INT,
  importance INT DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done','cancelled')),
  objective_id UUID,
  parent_task_id UUID,
  recurrence TEXT,
  recurrence_end DATE,
  tags TEXT[],
  points INT GENERATED ALWAYS AS (importance * 10) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Objectifs (arborescence)
CREATE TABLE IF NOT EXISTS agenda_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES agenda_objectives(id) ON DELETE SET NULL,
  target_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','archived')),
  progress INT DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ajouter la contrainte FK après création
ALTER TABLE agenda_tasks ADD CONSTRAINT fk_agenda_tasks_objective
  FOREIGN KEY (objective_id) REFERENCES agenda_objectives(id) ON DELETE SET NULL;

ALTER TABLE agenda_tasks ADD CONSTRAINT fk_agenda_tasks_parent
  FOREIGN KEY (parent_task_id) REFERENCES agenda_tasks(id) ON DELETE SET NULL;

-- Habitudes
CREATE TABLE IF NOT EXISTS agenda_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT DEFAULT 'daily' CHECK (frequency IN ('daily','weekly','custom')),
  frequency_days INT[],
  target_per_period INT DEFAULT 1,
  points INT DEFAULT 10,
  color TEXT DEFAULT '#10b981',
  icon TEXT DEFAULT '⚡',
  active BOOLEAN DEFAULT TRUE,
  streak_current INT DEFAULT 0,
  streak_best INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Logs des habitudes
CREATE TABLE IF NOT EXISTS agenda_habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID REFERENCES agenda_habits(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(habit_id, logged_date)
);

-- Créneaux bloqués
CREATE TABLE IF NOT EXISTS agenda_blocked_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  recurrence TEXT CHECK (recurrence IN ('none','daily','weekly','monthly')),
  recurrence_end DATE,
  color TEXT DEFAULT '#ef4444',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions Pomodoro
CREATE TABLE IF NOT EXISTS agenda_pomodoro_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES agenda_tasks(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_minutes INT DEFAULT 25,
  completed BOOLEAN DEFAULT FALSE,
  session_type TEXT DEFAULT 'work' CHECK (session_type IN ('work','short_break','long_break'))
);

-- Récap journalier
CREATE TABLE IF NOT EXISTS agenda_daily_recap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recap_date DATE NOT NULL DEFAULT CURRENT_DATE,
  tasks_completed INT DEFAULT 0,
  tasks_planned INT DEFAULT 0,
  habits_done INT DEFAULT 0,
  habits_total INT DEFAULT 0,
  day_score INT DEFAULT 0 CHECK (day_score BETWEEN 0 AND 10),
  mood TEXT,
  wins TEXT,
  improvements TEXT,
  tomorrow_priority TEXT,
  points_earned INT DEFAULT 0,
  bonus_points INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, recap_date)
);

-- Log des points
CREATE TABLE IF NOT EXISTS agenda_points_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  points INT NOT NULL,
  reason TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  earned_at TIMESTAMPTZ DEFAULT NOW()
);

-- Paramètres agenda
CREATE TABLE IF NOT EXISTS agenda_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  work_start TIME DEFAULT '09:00',
  work_end TIME DEFAULT '18:00',
  slot_duration_minutes INT DEFAULT 30,
  pomodoro_work_minutes INT DEFAULT 25,
  pomodoro_short_break INT DEFAULT 5,
  pomodoro_long_break INT DEFAULT 15,
  pomodoro_sessions_before_long INT DEFAULT 4,
  weekly_points_goal INT DEFAULT 500,
  auto_schedule_enabled BOOLEAN DEFAULT TRUE,
  recap_reminder_time TIME DEFAULT '18:30',
  timezone TEXT DEFAULT 'Europe/Paris',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE agenda_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_blocked_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_pomodoro_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_daily_recap ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_points_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own agenda_tasks" ON agenda_tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage their own agenda_objectives" ON agenda_objectives FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage their own agenda_habits" ON agenda_habits FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage their own agenda_habit_logs" ON agenda_habit_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage their own agenda_blocked_slots" ON agenda_blocked_slots FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage their own agenda_pomodoro_sessions" ON agenda_pomodoro_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage their own agenda_daily_recap" ON agenda_daily_recap FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage their own agenda_points_log" ON agenda_points_log FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage their own agenda_settings" ON agenda_settings FOR ALL USING (auth.uid() = user_id);
