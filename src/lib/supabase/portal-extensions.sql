-- ============================================
-- AgenceFlow — Extensions portail client
-- Exécuter dans Supabase SQL Editor
-- ============================================

-- Bannière projet (image fixe côté client)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Configuration notifications client
ALTER TABLE projects ADD COLUMN IF NOT EXISTS notif_email_enabled   BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS notif_whatsapp_phone  TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS notif_whatsapp_group  TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS notif_whatsapp_enabled BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS whatsapp_group_jid TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS whatsapp_group_name TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS whatsapp_group_profile_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS notif_slack_webhook   TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS notif_slack_team_id   TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS notif_slack_channel_id TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS notif_slack_enabled   BOOLEAN DEFAULT false;

-- ============================================
-- REVIEWS (Tâches à review)
-- ============================================
CREATE TABLE IF NOT EXISTS stage_reviews (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage_index   INTEGER NOT NULL,
  stage_label   TEXT NOT NULL,
  message       TEXT,
  link_url      TEXT,
  thumbnail_url TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  validated_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS stage_reviews_project_id_idx ON stage_reviews(project_id);
CREATE INDEX IF NOT EXISTS stage_reviews_status_idx ON stage_reviews(status);

ALTER TABLE stage_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON stage_reviews
  FOR ALL USING (true) WITH CHECK (true);
