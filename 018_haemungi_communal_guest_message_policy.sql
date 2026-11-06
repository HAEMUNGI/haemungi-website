-- Split public approved-message reads from administrator-only review.
-- An anonymous SELECT must not read the restricted hm_admins table.
-- No memorial records, messages or review status are changed.
begin;
drop policy if exists "hall_approved_or_admin_read" on public.hm_memorial_hall_messages;
drop policy if exists "hall_public_approved_read" on public.hm_memorial_hall_messages;
create policy "hall_public_approved_read" on public.hm_memorial_hall_messages
  for select to anon using (status='approved');
drop policy if exists "hall_authenticated_review_read" on public.hm_memorial_hall_messages;
create policy "hall_authenticated_review_read" on public.hm_memorial_hall_messages
  for select to authenticated using (
    status='approved' or exists(
      select 1 from public.hm_admins where user_id=(select auth.uid())
    )
  );
commit;
