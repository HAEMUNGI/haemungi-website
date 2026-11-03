-- Memorial scene artwork and editable public frame presentation.
-- Keep all approved photos and original film/still assets untouched.
alter table public.hm_memorial_public
  add column if not exists frame_style text not null default 'ivory'
    check (frame_style in ('ivory','brass','walnut'));
alter table public.hm_memorial_public
  add column if not exists frame_focus_x numeric(3,2)
    check (frame_focus_x between 0 and 1);
alter table public.hm_memorial_public
  add column if not exists frame_focus_y numeric(3,2)
    check (frame_focus_y between 0 and 1);

create table if not exists public.hm_memorial_scene_settings (
  scene_key text primary key
    check (scene_key in ('entrance_cover','hall_cover','ritual_cover')),
  image_path text not null
    check (image_path ~ '^scene/[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$'),
  updated_at timestamptz not null default now()
);
alter table public.hm_memorial_scene_settings enable row level security;
grant select on public.hm_memorial_scene_settings to anon;
grant select,insert,update,delete on public.hm_memorial_scene_settings to authenticated;

create policy "mem_scene_public_read" on public.hm_memorial_scene_settings
  for select to anon,authenticated using (true);
create policy "mem_scene_admin_insert" on public.hm_memorial_scene_settings
  for insert to authenticated
  with check (exists(select 1 from public.hm_admins where user_id=(select auth.uid())));
create policy "mem_scene_admin_update" on public.hm_memorial_scene_settings
  for update to authenticated
  using (exists(select 1 from public.hm_admins where user_id=(select auth.uid())))
  with check (exists(select 1 from public.hm_admins where user_id=(select auth.uid())));
create policy "mem_scene_admin_delete" on public.hm_memorial_scene_settings
  for delete to authenticated
  using (exists(select 1 from public.hm_admins where user_id=(select auth.uid())));

-- New unique file paths preserve approved images and avoid stale CDN responses.
create policy "mem_scene_storage_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id='hm-memorial-published'
    and name ~ '^scene/[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$'
    and exists(select 1 from public.hm_admins where user_id=(select auth.uid())));
create policy "mem_scene_storage_admin_select" on storage.objects
  for select to authenticated
  using (bucket_id='hm-memorial-published'
    and name ~ '^scene/[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$'
    and exists(select 1 from public.hm_admins where user_id=(select auth.uid())));
