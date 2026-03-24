-- ============================================
-- AgenceFlow - Schéma de base de données
-- Exécuter dans Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CLIENTS
-- ============================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  company TEXT,
  phone TEXT,
  avatar_url TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DESIGNERS
-- ============================================
CREATE TABLE IF NOT EXISTS designers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  speciality TEXT,
  hourly_rate NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROJECTS
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'onboarding', 'in_progress', 'review', 'revision', 'completed', 'cancelled')),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  designer_id UUID REFERENCES designers(id) ON DELETE SET NULL,
  current_stage TEXT NOT NULL DEFAULT 'copywriting' CHECK (current_stage IN ('copywriting', 'wireframe', 'design', 'development', 'revision', 'delivery')),
  stages JSONB NOT NULL DEFAULT '[]'::JSONB,
  budget NUMERIC(10, 2),
  start_date DATE,
  deadline DATE,
  figma_url TEXT,
  google_doc_url TEXT,
  framer_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TASKS
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  assigned_to UUID REFERENCES designers(id) ON DELETE SET NULL,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_name TEXT NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'client', 'designer')),
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'whatsapp', 'figma', 'framer', 'email')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster message queries
CREATE INDEX IF NOT EXISTS messages_project_id_idx ON messages(project_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at);

-- ============================================
-- PROJECT FILES
-- ============================================
CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other' CHECK (type IN ('figma', 'google_doc', 'image', 'pdf', 'other')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FORMS (Dynamic form builder)
-- ============================================
CREATE TABLE IF NOT EXISTS project_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  fields JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FORM RESPONSES
-- ============================================
CREATE TABLE IF NOT EXISTS form_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  form_id UUID NOT NULL REFERENCES project_forms(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}'::JSONB,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE designers ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Admin has full access (using service role or custom claim)
-- For development, allow all authenticated users - restrict in production

CREATE POLICY "Allow all for authenticated users" ON clients
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON designers
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON projects
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON tasks
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON messages
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON project_files
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON project_forms
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON form_responses
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON notifications
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- REALTIME (Enable for live messaging)
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;

-- ============================================
-- SAMPLE DATA (optionnel - pour tester)
-- ============================================

-- Insérer un client exemple
INSERT INTO clients (name, email, company, phone, payment_status)
VALUES ('Martin Dupont', 'martin@startupxyz.com', 'Startup XYZ', '+33 6 12 34 56 78', 'paid')
ON CONFLICT (email) DO NOTHING;

-- Insérer un designer exemple
INSERT INTO designers (name, email, speciality, hourly_rate)
VALUES ('Sarah Kimura', 'sarah@agency.com', 'UI/UX Design', 65)
ON CONFLICT (email) DO NOTHING;

-- Insérer un formulaire par défaut
INSERT INTO project_forms (name, fields)
VALUES (
  'Brief projet standard',
  '[
    {"id": "f1", "type": "text", "label": "Nom de votre entreprise", "required": true, "order": 1},
    {"id": "f2", "type": "textarea", "label": "Décrivez votre projet", "required": true, "order": 2},
    {"id": "f3", "type": "select", "label": "Secteur d''activité", "options": ["Tech / SaaS", "E-commerce", "Consulting", "Santé", "Autre"], "required": true, "order": 3},
    {"id": "f4", "type": "radio", "label": "Avez-vous une charte graphique ?", "options": ["Oui, complète", "Partielle", "Non, à créer"], "required": true, "order": 4},
    {"id": "f5", "type": "inspiration", "label": "Styles d''inspiration", "required": false, "order": 5}
  ]'::JSONB
);
