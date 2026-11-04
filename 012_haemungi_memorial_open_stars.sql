-- Starlight Memorial expansion: the first 12 physical plaques remain unchanged.
-- Additional approved pets live in the searchable/paginated "Open Stars" archive.
-- Apply to Supabase before deploying memorial-archive.js or the new admin approval button.
begin;

-- NULL means an approved public memorial without one of the twelve physical plaques.
alter table public.hm_memorial_public alter column slot_index drop not null;
alter table public.hm_memorial_public
  add column if not exists thumbnail_path text;
do $$ begin
  if not exists(
    select 1 from pg_constraint
    where conname='hm_memorial_public_thumbnail_path_check'
      and conrelid='public.hm_memorial_public'::regclass
  ) then
    alter table public.hm_memorial_public
      add constraint hm_memorial_public_thumbnail_path_check
      check (thumbnail_path is null or thumbnail_path ~ '^thumbs/[0-9a-f-]{36}\.webp$');
  end if;
end $$;

-- Stable index for keyset pagination of approved entries, regardless of total count.
create index if not exists hm_memorial_public_recent_seek_idx
  on public.hm_memorial_public (published_at desc, id desc);

-- The original owner-consent and first-occupant protection remain in force.
drop policy if exists "mem_public_admin_insert" on public.hm_memorial_public;
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
    and (slot_index is null or slot_index<>1 or exists(
      select 1 from public.hm_memorial_requests as first_friend
      where first_friend.id=hm_memorial_public.id
        and first_friend.requested_slot=1
    ))
  );

-- Only the administrator may upload immutable, small public list thumbnails.
drop policy if exists "hm_memorial_thumbs_admin_insert" on storage.objects;
create policy "hm_memorial_thumbs_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id='hm-memorial-published'
    and name ~ '^thumbs/[0-9a-f-]{36}\.webp$'
    and exists(select 1 from public.hm_admins where user_id=(select auth.uid())));
drop policy if exists "hm_memorial_thumbs_admin_update" on storage.objects;
create policy "hm_memorial_thumbs_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id='hm-memorial-published'
    and name ~ '^thumbs/[0-9a-f-]{36}\.webp$'
    and exists(select 1 from public.hm_admins where user_id=(select auth.uid())))
  with check (bucket_id='hm-memorial-published'
    and name ~ '^thumbs/[0-9a-f-]{36}\.webp$'
    and exists(select 1 from public.hm_admins where user_id=(select auth.uid())));
drop policy if exists "hm_memorial_thumbs_admin_delete" on storage.objects;
create policy "hm_memorial_thumbs_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id='hm-memorial-published'
    and name ~ '^thumbs/[0-9a-f-]{36}\.webp$'
    and exists(select 1 from public.hm_admins where user_id=(select auth.uid())));

commit;
