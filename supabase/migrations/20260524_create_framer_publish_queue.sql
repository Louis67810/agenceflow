create table if not exists framer_publish_queue (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  collection text not null default 'ressources',
  slug text not null,
  title text not null,
  meta_title text,
  meta_description text,
  html text not null,
  tags jsonb not null default '[]'::jsonb,
  author jsonb not null default '{}'::jsonb,
  images jsonb not null default '[]'::jsonb,
  internal_links jsonb not null default '[]'::jsonb,
  image_placeholders jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  framer_item_id text,
  framer_url text,
  error_message text,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create unique index if not exists framer_publish_queue_site_collection_slug_idx
  on framer_publish_queue (site_id, collection, slug);

create index if not exists framer_publish_queue_status_created_at_idx
  on framer_publish_queue (status, created_at desc);
