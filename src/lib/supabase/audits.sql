-- Audit requests
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS audit_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  website_url text NOT NULL DEFAULT '',
  business_domain text NOT NULL DEFAULT '',
  business_description text NOT NULL DEFAULT '',
  main_question text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'refused', 'audit_ready', 'sent')),
  access_key text UNIQUE,
  decision_note text,
  audit_url text,
  audit_summary text,
  whatsapp_message text,
  whatsapp_sent_at timestamptz,
  raw_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_requests_status ON audit_requests(status);
CREATE INDEX IF NOT EXISTS idx_audit_requests_created_at ON audit_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_requests_email ON audit_requests(email);
CREATE INDEX IF NOT EXISTS idx_audit_requests_access_key ON audit_requests(access_key);

