-- Exécute ce script dans Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS forms (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT        NOT NULL,
  fields     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON forms USING (true) WITH CHECK (true);

-- Formulaires initiaux
INSERT INTO forms (name, fields) VALUES
(
  'Brief projet standard',
  '[
    {"id":"company","type":"text","label":"Nom de votre entreprise","required":true},
    {"id":"project_desc","type":"textarea","label":"Décrivez votre projet","required":true,"placeholder":"Ex : site vitrine pour une startup tech..."},
    {"id":"budget","type":"text","label":"Budget estimé","required":false},
    {"id":"deadline","type":"text","label":"Délai souhaité","required":false},
    {"id":"references","type":"textarea","label":"Références et inspirations","required":false}
  ]'::jsonb
),
(
  'Brief identité visuelle',
  '[
    {"id":"company","type":"text","label":"Nom de votre entreprise","required":true},
    {"id":"sector","type":"text","label":"Secteur d activité","required":true},
    {"id":"values","type":"textarea","label":"Valeurs de votre marque","required":true},
    {"id":"style","type":"select","label":"Style souhaité","required":false,"options":["Minimaliste","Coloré","Dark","Corporate","Playful"]},
    {"id":"competitors","type":"textarea","label":"Concurrents à éviter","required":false}
  ]'::jsonb
),
(
  'Brief app mobile',
  '[
    {"id":"app_name","type":"text","label":"Nom de l application","required":true},
    {"id":"description","type":"textarea","label":"Description fonctionnelle","required":true},
    {"id":"platform","type":"radio","label":"Plateforme cible","required":true,"options":["iOS","Android","Les deux"]},
    {"id":"features","type":"textarea","label":"Fonctionnalités principales","required":true},
    {"id":"budget","type":"text","label":"Budget estimé","required":false}
  ]'::jsonb
);
