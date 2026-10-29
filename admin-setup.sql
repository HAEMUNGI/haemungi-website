-- HAEMUNGI owner CMS schema. Apply ONLY to the HAEMUNGI Supabase project.
-- Do not apply to BSBKTV bookfair or NEWIT STUDIO.
-- Run this in the project's SQL Editor after verifying the project URL.
-- Then create the owner's email/password in Authentication -> Users and run:
--   insert into public.hm_admins (user_id)
--   select id from auth.users where email = 'YOUR_OWNER_EMAIL';
-- The owner's email is NEVER included in the static website.

begin;

create table if not exists public.hm_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.hm_media_public (
  slot text primary key check (slot ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  kind text not null check (kind in ('image','video','audio')),
  title text not null default '' check (char_length(title) <= 150),
  description text not null default '' check (char_length(description) <= 1000),
  alt_text text not null default '' check (char_length(alt_text) <= 300),
  source_path text,
  source_url text,
  is_published boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint hm_media_public_one_source check
    (num_nonnulls(source_path, source_url) = 1),
  constraint hm_media_public_source_path check
    (source_path is null or source_path ~ '^(image|video|audio)/[a-z0-9-]+\.(png|jpg|jpeg|webp|avif|mp4|webm|mp3|ogg|wav|m4a)$'),
  constraint hm_media_public_source_url check
    (source_url is null or source_url ~ '^https://[^[:space:]]+$')
);

create table if not exists public.hm_media_drafts (
  slot text primary key check (slot ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  kind text not null check (kind in ('image','video','audio')),
  title text not null default '' check (char_length(title) <= 150),
  description text not null default '' check (char_length(description) <= 1000),
  alt_text text not null default '' check (char_length(alt_text) <= 300),
  source_path text,
  source_url text,
  updated_at timestamptz not null default now(),
  constraint hm_media_drafts_one_source check
    (num_nonnulls(source_path, source_url) = 1),
  constraint hm_media_drafts_source_path check
    (source_path is null or source_path ~ '^(image|video|audio)/[a-z0-9-]+\.(png|jpg|jpeg|webp|avif|mp4|webm|mp3|ogg|wav|m4a)$'),
  constraint hm_media_drafts_source_url check
    (source_url is null or source_url ~ '^https://[^[:space:]]+$')
);

alter table public.hm_admins enable row level security;
alter table public.hm_media_public enable row level security;
alter table public.hm_media_drafts enable row level security;

revoke all on public.hm_admins, public.hm_media_public, public.hm_media_drafts
  from public, anon, authenticated;
grant select on public.hm_admins to authenticated;
grant select on public.hm_media_public to anon, authenticated;
grant insert, update, delete on public.hm_media_public to authenticated;
grant select, insert, update, delete on public.hm_media_drafts to authenticated;

drop policy if exists hm_admins_self on public.hm_admins;
create policy hm_admins_self on public.hm_admins for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists hm_media_public_read on public.hm_media_public;
create policy hm_media_public_read on public.hm_media_public for select to anon, authenticated
  using (is_published or exists (
    select 1 from public.hm_admins a where a.user_id = (select auth.uid())
  ));
drop policy if exists hm_media_public_insert on public.hm_media_public;
create policy hm_media_public_insert on public.hm_media_public for insert to authenticated
  with check (exists (select 1 from public.hm_admins a where a.user_id = (select auth.uid())));
drop policy if exists hm_media_public_update on public.hm_media_public;
create policy hm_media_public_update on public.hm_media_public for update to authenticated
  using (exists (select 1 from public.hm_admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.hm_admins a where a.user_id = (select auth.uid())));
drop policy if exists hm_media_public_delete on public.hm_media_public;
create policy hm_media_public_delete on public.hm_media_public for delete to authenticated
  using (exists (select 1 from public.hm_admins a where a.user_id = (select auth.uid())));

drop policy if exists hm_media_drafts_select on public.hm_media_drafts;
create policy hm_media_drafts_select on public.hm_media_drafts for select to authenticated
  using (exists (select 1 from public.hm_admins a where a.user_id = (select auth.uid())));
drop policy if exists hm_media_drafts_insert on public.hm_media_drafts;
create policy hm_media_drafts_insert on public.hm_media_drafts for insert to authenticated
  with check (exists (select 1 from public.hm_admins a where a.user_id = (select auth.uid())));
drop policy if exists hm_media_drafts_update on public.hm_media_drafts;
create policy hm_media_drafts_update on public.hm_media_drafts for update to authenticated
  using (exists (select 1 from public.hm_admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.hm_admins a where a.user_id = (select auth.uid())));
drop policy if exists hm_media_drafts_delete on public.hm_media_drafts;
create policy hm_media_drafts_delete on public.hm_media_drafts for delete to authenticated
  using (exists (select 1 from public.hm_admins a where a.user_id = (select auth.uid())));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hm-media','hm-media',true,41943040,
  array['image/png','image/jpeg','image/webp','image/avif',
    'video/mp4','video/webm','audio/mpeg','audio/ogg','audio/wav','audio/mp4'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists hm_media_storage_insert on storage.objects;
create policy hm_media_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'hm-media' and exists (
    select 1 from public.hm_admins a where a.user_id = (select auth.uid())
  ));
drop policy if exists hm_media_storage_select on storage.objects;
create policy hm_media_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'hm-media' and exists (
    select 1 from public.hm_admins a where a.user_id = (select auth.uid())
  ));
drop policy if exists hm_media_storage_update on storage.objects;
create policy hm_media_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'hm-media' and exists (
    select 1 from public.hm_admins a where a.user_id = (select auth.uid())
  ))
  with check (bucket_id = 'hm-media' and exists (
    select 1 from public.hm_admins a where a.user_id = (select auth.uid())
  ));
drop policy if exists hm_media_storage_delete on storage.objects;
create policy hm_media_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'hm-media' and exists (
    select 1 from public.hm_admins a where a.user_id = (select auth.uid())
  ));

commit;
