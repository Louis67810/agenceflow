-- Exécute ce script dans Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS access_keys (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  key         TEXT        UNIQUE NOT NULL,
  name        TEXT        NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'client',
  form_fields JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_by  UUID,
  used_at     TIMESTAMPTZ,
  form_data   JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE access_keys ENABLE ROW LEVEL SECURITY;

-- Accès total via service_role (toutes les opérations passent par les API routes serveur)
CREATE POLICY "allow_all" ON access_keys USING (true) WITH CHECK (true);
