-- Fix: Désactiver RLS sur les tables agenda pour correspondre au pattern de l'app
-- À exécuter si vous avez encore des erreurs "Unauthorized" sur les routes /api/agenda/*
-- La sécurité des données est assurée au niveau applicatif (filtrage par user_id)

ALTER TABLE agenda_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_objectives DISABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_habits DISABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_habit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_blocked_slots DISABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_pomodoro_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_daily_recap DISABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_points_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_settings DISABLE ROW LEVEL SECURITY;
