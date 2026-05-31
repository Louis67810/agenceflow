alter table public.access_keys
  add column if not exists whatsapp_group_name text,
  add column if not exists whatsapp_group_profile_url text;

alter table public.projects
  add column if not exists whatsapp_group_jid text,
  add column if not exists whatsapp_group_name text,
  add column if not exists whatsapp_group_profile_url text,
  add column if not exists notif_whatsapp_group text,
  add column if not exists notif_whatsapp_phone text,
  add column if not exists notif_whatsapp_enabled boolean default false;
