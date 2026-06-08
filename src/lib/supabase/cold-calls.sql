-- Fondations Appel à froid — exécuter dans Supabase SQL Editor
CREATE TABLE IF NOT EXISTS cold_call_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Nouvelle accroche',
  content text NOT NULL DEFAULT 'Bonjour {{prenom}}, je vous appelle au sujet de {{entreprise}}.',
  active boolean NOT NULL DEFAULT true,
  calls_count integer NOT NULL DEFAULT 0,
  connected_count integer NOT NULL DEFAULT 0,
  meetings_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cold_call_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  company text NOT NULL,
  phone text,
  email text,
  business_description text,
  sector text,
  has_website boolean NOT NULL DEFAULT false,
  website_url text,
  audit_sent boolean NOT NULL DEFAULT false,
  audit_url text,
  status text NOT NULL DEFAULT 'not_contacted' CHECK (status IN ('not_contacted','audit_to_send','audit_sent','call_planned','no_answer','callback','qualified','meeting_booked','refused','won')),
  source text NOT NULL DEFAULT 'csv',
  source_ref text,
  notes text,
  next_call_at timestamptz,
  last_called_at timestamptz,
  selected_script_id uuid REFERENCES cold_call_scripts(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cold_call_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES cold_call_leads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  script_id uuid REFERENCES cold_call_scripts(id) ON DELETE SET NULL,
  outcome text NOT NULL DEFAULT 'connected',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  summary text,
  transcript text,
  recording_url text,
  coaching_notes text,
  external_call_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cold_call_leads_user_status_idx ON cold_call_leads(user_id, status);
CREATE INDEX IF NOT EXISTS cold_call_leads_user_company_idx ON cold_call_leads(user_id, company);
CREATE INDEX IF NOT EXISTS cold_call_attempts_lead_idx ON cold_call_attempts(lead_id, started_at DESC);
CREATE INDEX IF NOT EXISTS cold_call_scripts_user_idx ON cold_call_scripts(user_id, active);

ALTER TABLE cold_call_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE cold_call_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cold_call_scripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own cold call leads" ON cold_call_leads;
CREATE POLICY "Users manage own cold call leads" ON cold_call_leads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users manage own cold call attempts" ON cold_call_attempts;
CREATE POLICY "Users manage own cold call attempts" ON cold_call_attempts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users manage own cold call scripts" ON cold_call_scripts;
CREATE POLICY "Users manage own cold call scripts" ON cold_call_scripts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
