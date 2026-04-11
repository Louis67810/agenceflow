-- ─────────────────────────────────────────────
-- Templates de messages générés par l'IA (A/B testing)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS message_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Segment cible
  source_filter text,        -- null = tous ; 'lead_magnet', 'linkedin', etc.
  channel text NOT NULL DEFAULT 'email'
    CHECK (channel IN ('email', 'whatsapp', 'linkedin_dm')),
  sector_filter text,        -- null = tous ; 'Marketing', 'Tech', etc.
  status_filter text,        -- statut CRM cible : 'new', 'contacted', etc.

  -- Clé de segment (calculée : source|channel|sector|status pour lookup rapide)
  segment_key text NOT NULL DEFAULT '',

  -- Contenu
  subject text,              -- objet email (null pour DM)
  content text NOT NULL,

  -- Variables utilisées dans le contenu : {{name}}, {{company}}, {{sector}}
  variables_used jsonb DEFAULT '[]'::jsonb,

  -- A/B Testing
  variant_group text NOT NULL DEFAULT gen_random_uuid()::text, -- regroupe les variantes d'un même run
  variant_label text DEFAULT 'A',   -- 'A', 'B', 'C'...

  -- Performance
  sent_count integer NOT NULL DEFAULT 0,
  open_count integer NOT NULL DEFAULT 0,
  reply_count integer NOT NULL DEFAULT 0,
  score numeric GENERATED ALWAYS AS (
    CASE WHEN sent_count = 0 THEN 0
    ELSE (open_count + reply_count * 2.0) / sent_count
    END
  ) STORED,

  -- Statut
  active boolean NOT NULL DEFAULT true,
  deprecated boolean NOT NULL DEFAULT false,

  -- Contexte IA
  ai_hypothesis text,        -- pourquoi l'IA a créé ce template
  created_by_run uuid,       -- référence à ai_analysis_runs

  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS mt_segment_key_idx ON message_templates(segment_key);
CREATE INDEX IF NOT EXISTS mt_channel_idx ON message_templates(channel);
CREATE INDEX IF NOT EXISTS mt_active_idx ON message_templates(active, deprecated);

-- ─────────────────────────────────────────────
-- Journal des runs d'analyse IA
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_analysis_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  triggered_at timestamptz DEFAULT now() NOT NULL,

  -- État des données au moment du run
  total_leads integer NOT NULL DEFAULT 0,
  total_attempts integer NOT NULL DEFAULT 0,
  new_data_since_last integer NOT NULL DEFAULT 0, -- combien de nouveaux events depuis le dernier run

  -- Résultats de l'analyse
  insights text,             -- observations de l'IA
  hypotheses text,           -- nouvelles hypothèses testées
  templates_created integer NOT NULL DEFAULT 0,

  -- Config au moment du run
  threshold_config integer NOT NULL DEFAULT 10,
  model_used text,

  status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('running', 'completed', 'failed')),
  error text
);

-- ─────────────────────────────────────────────
-- Config globale du système d'analyse
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leads_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

INSERT INTO leads_config (key, value) VALUES
  ('analysis_threshold', '10'),   -- déclencher une analyse tous les N nouveaux events
  ('min_sample_size', '5'),       -- minimum d'envois pour qu'un template soit "fiable"
  ('exploration_rate', '0.20'),   -- 20% d'exploration (tester les nouveaux templates)
  ('auto_analysis_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
