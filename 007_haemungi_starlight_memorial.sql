-- HAEMUNGI Starlight Memorial: private applications, approved public plaques and moderated letters.
-- The original HAEMUNGI media tables and assets remain unchanged.
begin;

create table if not exists public.hm_memorial_requests (
  id uuid primary key default gen_random_uuid(),
  pet_name text not null check (char_length(btrim(pet_name)) between 1 and 60),
  photo_path text check (photo_path is null or photo_path ~ '^incoming/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'),
  born_on date,
  passed_on date,
  story text not null check (char_length(btrim(story)) between 1 and 900),
  farewell text not null default '' check (char_length(farewell) <= 500),
  contact_email text check (contact_email is null or char_length(contact_email) <= 254),
  requested_visibility text not null default 'public' check (requested_visibility in ('public','private')),
  requested_slot smallint check (requested_slot between 1 and 12),
  status text not null default 'pending' check (status in ('pending','rejected','published','approved_private')),
  consent_declaration boolean not null default false,
  owner_consent_verified boolean not null default false,
  approved_slot smallint check (approved_slot between 1 and 12),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists hm_memorial_requests_pending_idx on public.hm_memorial_requests (status,created_at);

create table if not exists public.hm_memorial_public (
  id uuid primary key references public.hm_memorial_requests(id) on delete restrict,
  slot_index smallint not null unique check (slot_index between 1 and 12),
  pet_name text not null check (char_length(btrim(pet_name)) between 1 and 60),
  born_on date,
  passed_on date,
  story text not null check (char_length(story) between 1 and 900),
  farewell text not null default '' check (char_length(farewell) <= 500),
  photo_path text not null check (photo_path ~ '^approved/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'),
  published_at timestamptz not null default now()
);
create index if not exists hm_memorial_public_published_idx on public.hm_memorial_public (published_at desc);

create table if not exists public.hm_memorial_letters (
  id uuid primary key default gen_random_uuid(),
  memorial_id uuid not null references public.hm_memorial_public(id) on delete cascade,
  author_alias text not null check (char_length(btrim(author_alias)) between 1 and 30),
  body text not null check (char_length(btrim(body)) between 1 and 500),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
create index if not exists hm_memorial_letters_visible_idx
  on public.hm_memorial_letters (memorial_id,created_at desc) where status='approved';
create index if not exists hm_memorial_letters_pending_idx
  on public.hm_memorial_letters (created_at) where status='pending';

alter table public.hm_memorial_requests enable row level security;
alter table public.hm_memorial_public enable row level security;
alter table public.hm_memorial_letters enable row level security;

grant select,insert,update,delete on public.hm_memorial_requests to authenticated;
grant insert on public.hm_memorial_requests to anon;
grant select,insert,update,delete on public.hm_memorial_public to authenticated;
grant select on public.hm_memorial_public to anon;
grant select,insert,update,delete on public.hm_memorial_letters to authenticated;
grant select,insert on public.hm_memorial_letters to anon;

create policy "mem_requests_anon_apply" on public.hm_memorial_requests
  for insert to anon with check (
    status='pending' and consent_declaration=true and owner_consent_verified=false
    and photo_path is not null and contact_email is not null and position('@' in contact_email)>1
    and approved_slot is null and approved_at is null and requested_slot is null
  );
create policy "mem_requests_admin_read" on public.hm_memorial_requests
  for select to authenticated
  using (exists(select 1 from public.hm_admins where user_id=(select auth.uid())));
create policy "mem_requests_admin_insert" on public.hm_memorial_requests
  for insert to authenticated
  with check (exists(select 1 from public.hm_admins where user_id=(select auth.uid())));
create policy "mem_requests_admin_update" on public.hm_memorial_requests
  for update to authenticated
  using (exists(select 1 from public.hm_admins where user_id=(select auth.uid())))
  with check (exists(select 1 from public.hm_admins where user_id=(select auth.uid())));
create policy "mem_requests_admin_delete" on public.hm_memorial_requests
  for delete to authenticated
  using (exists(select 1 from public.hm_admins where user_id=(select auth.uid())));

create policy "mem_public_read" on public.hm_memorial_public
  for select to anon,authenticated using (true);
create policy "mem_public_admin_insert" on public.hm_memorial_public
  for insert to authenticated
  with check (
    exists(select 1 from public.hm_admins where user_id=(select auth.uid()))
    and exists(
      select 1 from public.hm_memorial_requests as request
      where request.id=hm_memorial_public.id
        and request.owner_consent_verified=true
        and request.requested_visibility='public'
        and request.photo_path is not null
    )
    and (slot_index<>1 or exists(
      select 1 from public.hm_memorial_requests as first_friend
      where first_friend.id=hm_memorial_public.id
        and first_friend.requested_slot=1
    ))
  );
create policy "mem_public_admin_update" on public.hm_memorial_public
  for update to authenticated
  using (exists(select 1 from public.hm_admins where user_id=(select auth.uid())))
  with check (exists(select 1 from public.hm_admins where user_id=(select auth.uid())));
create policy "mem_public_admin_delete" on public.hm_memorial_public
  for delete to authenticated
  using (exists(select 1 from public.hm_admins where user_id=(select auth.uid())));

create policy "mem_letters_public_read" on public.hm_memorial_letters
  for select to anon,authenticated
  using (status='approved' or exists(select 1 from public.hm_admins where user_id=(select auth.uid())));
create policy "mem_letters_anon_submit" on public.hm_memorial_letters
  for insert to anon with check (status='pending');
create policy "mem_letters_admin_update" on public.hm_memorial_letters
  for update to authenticated
  using (exists(select 1 from public.hm_admins where user_id=(select auth.uid())))
  with check (exists(select 1 from public.hm_admins where user_id=(select auth.uid())));
create policy "mem_letters_admin_delete" on public.hm_memorial_letters
  for delete to authenticated
  using (exists(select 1 from public.hm_admins where user_id=(select auth.uid())));

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('hm-memorial-inbox','hm-memorial-inbox',false,5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('hm-memorial-published','hm-memorial-published',true,5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "hm_memorial_inbox_anon_upload" on storage.objects
  for insert to anon
  with check (bucket_id='hm-memorial-inbox'
    and name ~ '^incoming/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$');
create policy "hm_memorial_inbox_admin_read" on storage.objects
  for select to authenticated
  using (bucket_id='hm-memorial-inbox'
    and exists(select 1 from public.hm_admins where user_id=(select auth.uid())));
create policy "hm_memorial_inbox_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id='hm-memorial-inbox'
    and name ~ '^incoming/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
    and exists(select 1 from public.hm_admins where user_id=(select auth.uid())));
create policy "hm_memorial_inbox_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id='hm-memorial-inbox'
    and exists(select 1 from public.hm_admins where user_id=(select auth.uid())))
  with check (bucket_id='hm-memorial-inbox'
    and exists(select 1 from public.hm_admins where user_id=(select auth.uid())));
create policy "hm_memorial_inbox_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id='hm-memorial-inbox'
    and exists(select 1 from public.hm_admins where user_id=(select auth.uid())));

create policy "hm_memorial_published_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id='hm-memorial-published'
    and name ~ '^approved/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
    and exists(select 1 from public.hm_admins where user_id=(select auth.uid())));
create policy "hm_memorial_published_admin_select" on storage.objects
  for select to authenticated
  using (bucket_id='hm-memorial-published'
    and exists(select 1 from public.hm_admins where user_id=(select auth.uid())));
create policy "hm_memorial_published_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id='hm-memorial-published'
    and exists(select 1 from public.hm_admins where user_id=(select auth.uid())))
  with check (bucket_id='hm-memorial-published'
    and exists(select 1 from public.hm_admins where user_id=(select auth.uid())));
create policy "hm_memorial_published_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id='hm-memorial-published'
    and exists(select 1 from public.hm_admins where user_id=(select auth.uid())));

-- Slot 001 is allocated privately by the operator after guardian authorization.

commit;