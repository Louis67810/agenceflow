-- Lead Magnets
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS lead_magnets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  title text NOT NULL DEFAULT 'Mon Lead Magnet',
  subtitle text DEFAULT 'Veuillez remplir les champs ci-dessous avant de recevoir votre ressource',
  image_url text,
  resource_url text NOT NULL DEFAULT '',
  timer_minutes integer, -- null = no timer
  steps jsonb NOT NULL DEFAULT '[
    {"id":"step_1","fields":[{"id":"f_firstname","type":"text","label":"Prénom","placeholder":"Votre prénom","required":true,"key":"firstname"}]},
    {"id":"step_2","fields":[{"id":"f_email","type":"email","label":"Email","placeholder":"Votre adresse email","required":true,"key":"email"}]}
  ]'::jsonb,
  cta_text text DEFAULT 'Accéder à la ressource',
  email_subject text DEFAULT '🎁 Votre ressource est prête',
  email_body text DEFAULT '<div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;background:#ffffff"><h2 style="font-size:24px;color:#0f172a;margin:0 0 8px">Bonjour {{firstname}} 👋</h2><p style="color:#475569;line-height:1.6;margin:0 0 32px">Merci ! Votre ressource est prête à être consultée.</p><div style="text-align:center;margin:0 0 32px"><a href="{{resource_link}}" style="display:inline-block;background:linear-gradient(161deg,#4e7dfa,#0147ff);color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:500;font-size:16px">Accéder à la ressource →</a></div><p style="color:#94a3b8;font-size:12px;margin:0">Si le bouton ne fonctionne pas : <a href="{{resource_link}}" style="color:#6b7280">{{resource_link}}</a></p></div>',
  from_name text DEFAULT 'AgenceFlow',
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Leads collected from each lead magnet
CREATE TABLE IF NOT EXISTS lead_magnet_leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_magnet_id uuid REFERENCES lead_magnets(id) ON DELETE CASCADE NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  email text,
  email_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lead_magnets_slug ON lead_magnets(slug);
CREATE INDEX IF NOT EXISTS idx_lead_magnet_leads_magnet_id ON lead_magnet_leads(lead_magnet_id);
CREATE INDEX IF NOT EXISTS idx_lead_magnet_leads_email ON lead_magnet_leads(email);
CREATE INDEX IF NOT EXISTS idx_lead_magnets_status ON lead_magnets(status);
