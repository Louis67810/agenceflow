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
