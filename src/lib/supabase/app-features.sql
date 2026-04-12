-- ═══════════════════════════════════════════════════════════════
-- APP FEATURES MIGRATION
-- Tables: app_settings, notes, freelancer_tests, test_submissions
-- ═══════════════════════════════════════════════════════════════

-- ── Paramètres globaux de l'app (IA, mémoire business) ──────────
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  business_context TEXT DEFAULT '',
  ai_models JSONB DEFAULT '{
    "copywriting": "openai/gpt-4o-mini",
    "linkedin_posts": "openai/gpt-4o-mini",
    "linkedin_ideas": "openai/gpt-4o-mini",
    "leads": "openai/gpt-4o-mini",
    "coach": "openai/gpt-4o-mini"
  }'::jsonb,
  openrouter_api_key TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Notes & Idées ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Sans titre',
  content TEXT DEFAULT '',
  color TEXT DEFAULT '#ffffff',
  tags TEXT[] DEFAULT '{}',
  pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes(user_id);
CREATE INDEX IF NOT EXISTS notes_updated_at_idx ON notes(updated_at DESC);

-- ── Tests prestataires ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS freelancer_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  instructions TEXT DEFAULT '',
  skills TEXT[] DEFAULT '{}',
  deadline_days INT DEFAULT 7,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Soumissions de tests
CREATE TABLE IF NOT EXISTS test_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID REFERENCES freelancer_tests(id) ON DELETE CASCADE,
  designer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  designer_email TEXT,
  designer_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'accepted', 'rejected')),
  submission_url TEXT,
  submission_notes TEXT,
  admin_feedback TEXT,
  submitted_at TIMESTAMPTZ,
  evaluated_at TIMESTAMPTZ,
  deadline DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS test_submissions_test_id_idx ON test_submissions(test_id);
CREATE INDEX IF NOT EXISTS test_submissions_designer_id_idx ON test_submissions(designer_id);

-- ── Coach IA: historique des conversations ───────────────────────
CREATE TABLE IF NOT EXISTS coach_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'Nouvelle conversation',
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS coach_conversations_user_id_idx ON coach_conversations(user_id);

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE freelancer_tests DISABLE ROW LEVEL SECURITY;
ALTER TABLE test_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE coach_conversations DISABLE ROW LEVEL SECURITY;
