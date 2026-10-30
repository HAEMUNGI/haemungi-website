-- Applied 2026-10-30 to HAEMUNGI's own Supabase project only.
-- Preserve existing events while adding tracking scope for three public pages.
begin;
alter table public.hm_view_events
  drop constraint if exists hm_view_events_page_check;
alter table public.hm_view_events
  add constraint hm_view_events_page_check
  check (page = any (array['home','videos','cards','daily','goods','room','about','today','creator','emoticons']::text[]));
commit;
