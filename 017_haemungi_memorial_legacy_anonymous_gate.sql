-- Finalize the new three-tier workflow. Free archive publication must go through
-- the rate-limited Edge Function; all new plaque applications require Auth.
-- Existing pending requests and approved public records are preserved.
begin;
drop policy if exists "mem_requests_anon_apply" on public.hm_memorial_requests;
revoke insert on public.hm_memorial_requests from anon;
drop policy if exists "hm_memorial_inbox_anon_upload" on storage.objects;
commit;
