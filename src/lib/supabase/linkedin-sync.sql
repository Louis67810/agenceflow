create extension if not exists pgcrypto;

create table if not exists public.linkedin_user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.linkedin_user_settings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'linkedin_user_settings'
      and policyname = 'Users manage their own linkedin_user_settings'
  ) then
    create policy "Users manage their own linkedin_user_settings"
      on public.linkedin_user_settings
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

create table if not exists public.linkedin_user_workspace (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.linkedin_user_workspace enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'linkedin_user_workspace'
      and policyname = 'Users manage their own linkedin_user_workspace'
  ) then
    create policy "Users manage their own linkedin_user_workspace"
      on public.linkedin_user_workspace
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

create table if not exists public.linkedin_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_post_id text not null,
  content text not null,
  type text not null check (type in ('post', 'carousel')),
  slides jsonb,
  source_type text not null check (source_type in ('manual', 'url', 'youtube', 'idea')),
  source_url text,
  source_title text,
  style_id text,
  style_name text,
  scheduled_at timestamptz,
  published_at timestamptz,
  likes integer not null default 0,
  comments integer not null default 0,
  impressions integer not null default 0,
  post_url text,
  analytics jsonb not null default '{}'::jsonb,
  status text not null check (status in ('draft', 'scheduled', 'published')),
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_post_id)
);

create index if not exists linkedin_posts_user_id_idx on public.linkedin_posts(user_id);
create index if not exists linkedin_posts_status_idx on public.linkedin_posts(user_id, status);
create index if not exists linkedin_posts_published_at_idx on public.linkedin_posts(user_id, published_at desc);

create or replace function public.set_linkedin_posts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists linkedin_posts_set_updated_at on public.linkedin_posts;
create trigger linkedin_posts_set_updated_at
before update on public.linkedin_posts
for each row
execute function public.set_linkedin_posts_updated_at();

alter table public.linkedin_posts enable row level security;

drop policy if exists "Users can read their linkedin posts" on public.linkedin_posts;
create policy "Users can read their linkedin posts"
on public.linkedin_posts
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their linkedin posts" on public.linkedin_posts;
create policy "Users can insert their linkedin posts"
on public.linkedin_posts
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their linkedin posts" on public.linkedin_posts;
create policy "Users can update their linkedin posts"
on public.linkedin_posts
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their linkedin posts" on public.linkedin_posts;
create policy "Users can delete their linkedin posts"
on public.linkedin_posts
for delete
using (auth.uid() = user_id);

create table if not exists public.linkedin_style_examples (
  id uuid primary key default gen_random_uuid(),
  style_id text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_linkedin_style_examples_style_id
  on public.linkedin_style_examples(style_id);
