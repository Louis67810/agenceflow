ALTER TABLE agenda_tasks
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6366f1';

ALTER TABLE agenda_daily_recap
  ADD COLUMN IF NOT EXISTS justified_tasks_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS task_reviews JSONB DEFAULT '[]'::jsonb;

ALTER TABLE agenda_settings
  ADD COLUMN IF NOT EXISTS daily_points_pool INT DEFAULT 100;
