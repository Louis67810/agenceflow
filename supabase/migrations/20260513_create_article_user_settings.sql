create table if not exists public.article_user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  connection jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.article_user_settings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'article_user_settings'
      and policyname = 'Users manage their own article_user_settings'
  ) then
    create policy "Users manage their own article_user_settings"
      on public.article_user_settings
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
