-- Run in Supabase → SQL Editor

-- 1. Add pages column to forms table
ALTER TABLE forms ADD COLUMN IF NOT EXISTS pages JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Migrate existing forms: wrap fields into a single page
UPDATE forms
SET pages = jsonb_build_array(
  jsonb_build_object(
    'id', replace(gen_random_uuid()::text, '-', ''),
    'title', 'Page 1',
    'fields', COALESCE(fields, '[]'::jsonb)
  )
)
WHERE pages = '[]'::jsonb;

-- 3. Remove old seed data and replace with pages-based seed
DELETE FROM forms;

INSERT INTO forms (name, pages) VALUES
(
  'Brief projet standard',
  '[{"id":"p1","title":"Vos informations","fields":[{"id":"company","type":"text","label":"Nom de votre entreprise","required":true},{"id":"email","type":"email","label":"Email","required":true}]},{"id":"p2","title":"Votre projet","fields":[{"id":"project_desc","type":"textarea","label":"Décrivez votre projet","required":true,"placeholder":"Ex : site vitrine pour une startup tech..."},{"id":"budget","type":"text","label":"Budget estimé","required":false},{"id":"deadline","type":"text","label":"Délai souhaité","required":false}]}]'::jsonb
),
(
  'Brief identité visuelle',
  '[{"id":"p1","title":"Votre entreprise","fields":[{"id":"company","type":"text","label":"Nom de votre entreprise","required":true},{"id":"sector","type":"text","label":"Secteur d activité","required":true},{"id":"values","type":"textarea","label":"Valeurs de votre marque","required":true}]},{"id":"p2","title":"Style","fields":[{"id":"style","type":"radio","label":"Style souhaité","required":false,"options":["Minimaliste","Coloré","Dark","Corporate","Playful"]},{"id":"competitors","type":"textarea","label":"Concurrents à éviter","required":false}]}]'::jsonb
),
(
  'Brief app mobile',
  '[{"id":"p1","title":"L application","fields":[{"id":"app_name","type":"text","label":"Nom de l application","required":true},{"id":"description","type":"textarea","label":"Description fonctionnelle","required":true}]},{"id":"p2","title":"Détails techniques","fields":[{"id":"platform","type":"radio","label":"Plateforme cible","required":true,"options":["iOS","Android","Les deux"]},{"id":"features","type":"textarea","label":"Fonctionnalités principales","required":true},{"id":"budget","type":"text","label":"Budget estimé","required":false}]}]'::jsonb
);

-- 4. Add form_pages column to access_keys
ALTER TABLE access_keys ADD COLUMN IF NOT EXISTS form_pages JSONB DEFAULT '[]'::jsonb;
