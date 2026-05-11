alter table public.linkedin_posts
  add column if not exists editor_history jsonb not null default '[]'::jsonb,
  add column if not exists editor_chat jsonb not null default '[]'::jsonb,
  add column if not exists editor_snapshots jsonb not null default '[]'::jsonb;
