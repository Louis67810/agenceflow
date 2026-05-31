-- Exécute ce script dans Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS access_keys (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  key         TEXT        UNIQUE NOT NULL,
  name        TEXT        NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'client',
  form_fields JSONB       NOT NULL DEFAULT '[]'::jsonb,
  form_pages  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  service_type_id UUID,
  created_by  UUID,
  used_at     TIMESTAMPTZ,
  form_data   JSONB,
  banner_url  TEXT,
  whatsapp_group_name TEXT,
  whatsapp_group_profile_url TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE access_keys ADD COLUMN IF NOT EXISTS form_pages JSONB DEFAULT '[]'::jsonb;
ALTER TABLE access_keys ADD COLUMN IF NOT EXISTS service_type_id UUID;
ALTER TABLE access_keys ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE access_keys ADD COLUMN IF NOT EXISTS whatsapp_group_name TEXT;
ALTER TABLE access_keys ADD COLUMN IF NOT EXISTS whatsapp_group_profile_url TEXT;

ALTER TABLE access_keys ENABLE ROW LEVEL SECURITY;

-- Accès total via service_role (toutes les opérations passent par les API routes serveur)
CREATE POLICY "allow_all" ON access_keys USING (true) WITH CHECK (true);
