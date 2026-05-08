create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  visitor_id text,
  session_id text,
  event_name text not null,
  event_time timestamptz not null default now(),
  url text,
  path text,
  referrer text,
  user_agent text,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_site_time_idx on public.analytics_events (site_id, event_time desc);
create index if not exists analytics_events_name_time_idx on public.analytics_events (event_name, event_time desc);
create index if not exists analytics_events_session_idx on public.analytics_events (session_id);
create index if not exists analytics_events_metadata_gin_idx on public.analytics_events using gin (metadata);

alter table public.analytics_events enable row level security;

drop policy if exists "analytics_events_service_role_all" on public.analytics_events;
create policy "analytics_events_service_role_all"
  on public.analytics_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
