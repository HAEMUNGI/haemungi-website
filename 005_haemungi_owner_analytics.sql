-- HAEMUNGI owner-only analytics read access; additive only.
-- The public analytics event collector keeps its existing write-only policy.
-- Views already use security_invoker=true; no public visitor receives SELECT.
grant select on public.hm_view_events to authenticated;
create policy hm_events_owner_read
  on public.hm_view_events
  for select to authenticated
  using (exists (
    select 1 from public.hm_admins
    where user_id = (select auth.uid())
  ));
grant select on
  public.hm_stats_dashboard,
  public.hm_stats_daily,
  public.hm_stats_pages,
  public.hm_stats_content,
  public.hm_stats_sources,
  public.hm_stats_devices,
  public.hm_stats_hours
to authenticated;
