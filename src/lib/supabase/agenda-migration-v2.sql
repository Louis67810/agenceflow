-- Migration v2 : ajout des colonnes manquantes à agenda_settings

ALTER TABLE agenda_settings
  ADD COLUMN IF NOT EXISTS daily_points_pool INT DEFAULT 100,
  ADD COLUMN IF NOT EXISTS google_access_token TEXT,
  ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS google_token_expiry TIMESTAMPTZ;
