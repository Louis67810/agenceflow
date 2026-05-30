-- Make auth user profile creation tolerant of invitation roles and duplicate profiles.

create or replace function public.handle_new_user()
returns trigger as $$
declare
  raw_role text;
  profile_role text;
begin
  raw_role := coalesce(
    nullif(new.raw_user_meta_data->>'role', ''),
    nullif(new.raw_app_meta_data->>'role', ''),
    'client'
  );

  profile_role := case
    when raw_role = 'admin' then 'admin'
    when raw_role in ('designer', 'developer') then 'designer'
    else 'client'
  end;

  insert into public.agency_profiles (id, email, name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Utilisateur'
    ),
    profile_role
  )
  on conflict (id) do update set
    email = excluded.email,
    name = excluded.name,
    role = excluded.role;

  return new;
end;
$$ language plpgsql security definer set search_path = public, auth;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
