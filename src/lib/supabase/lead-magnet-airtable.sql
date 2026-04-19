create table if not exists public.lead_magnet_user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.lead_magnet_user_settings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_magnet_user_settings'
      and policyname = 'Users manage their own lead_magnet_user_settings'
  ) then
    create policy "Users manage their own lead_magnet_user_settings"
      on public.lead_magnet_user_settings
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

alter table public.lead_magnets
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

alter table public.lead_magnets
  add column if not exists airtable_auto_sync boolean not null default false;

alter table public.lead_magnets
  add column if not exists airtable_table_name text;

create index if not exists idx_lead_magnets_owner_user_id on public.lead_magnets(owner_user_id);
