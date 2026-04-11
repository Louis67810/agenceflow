-- ─────────────────────────────────────────────
-- Central Leads CRM
-- ─────────────────────────────────────────────

-- Sources possibles : lead_magnet | linkedin | google_maps | manual | webhook
-- Statuts : new | contacted | responded | meeting | converted | lost

CREATE TABLE IF NOT EXISTS leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Identité
  email text,
  name text,
  company text,
  sector text,
  phone text,
  -- Source
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('lead_magnet', 'linkedin', 'google_maps', 'manual', 'webhook')),
  source_ref text,               -- ex: lead_magnet_id, URL LinkedIn, nom du fichier import
  -- Statut CRM
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'responded', 'meeting', 'converted', 'lost')),
  channel_preference text DEFAULT 'email'
    CHECK (channel_preference IN ('email', 'whatsapp', 'linkedin_dm')),
  -- Données brutes de la source
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Notes libres
  notes text,
  -- Dates clés
  last_contact_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS leads_source_idx ON leads(source);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status);
CREATE INDEX IF NOT EXISTS leads_email_idx ON leads(email);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads(created_at DESC);

-- ─────────────────────────────────────────────
-- Tentatives d'outreach (emails, WhatsApp, LinkedIn DM)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS outreach_attempts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  channel text NOT NULL DEFAULT 'email'
    CHECK (channel IN ('email', 'whatsapp', 'linkedin_dm')),
  subject text,
  content text NOT NULL DEFAULT '',
  -- IA
  model_used text,
  prompt_context jsonb DEFAULT '{}'::jsonb,
  -- Statut
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'opened', 'clicked', 'responded', 'bounced')),
  -- Tracking
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  responded_at timestamptz,
  -- Résend message id pour tracking
  external_id text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS outreach_lead_idx ON outreach_attempts(lead_id);
CREATE INDEX IF NOT EXISTS outreach_status_idx ON outreach_attempts(status);

-- ─────────────────────────────────────────────
-- Règles d'automatisation outreach
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS outreach_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL DEFAULT 'Nouvelle règle',
  -- Filtres déclencheur
  source_filter text,            -- null = toutes sources
  sector_filter text,            -- null = tous secteurs
  -- Action
  channel text NOT NULL DEFAULT 'email'
    CHECK (channel IN ('email', 'whatsapp', 'linkedin_dm')),
  delay_hours integer NOT NULL DEFAULT 0,
  -- Prompt AI pour personnaliser le message
  ai_system_prompt text,
  -- Actif ou non
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- ─────────────────────────────────────────────
-- API key pour le webhook agent externe (OpenClaw, etc.)
-- ─────────────────────────────────────────────
-- Stocker dans les variables d'environnement : LEADS_WEBHOOK_API_KEY
-- Le webhook accepte POST /api/leads/webhook avec header Authorization: Bearer <key>
