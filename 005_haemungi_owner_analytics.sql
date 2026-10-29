-- HAEMUNGI owner-only analytics dashboard access.
-- Existing 003 analytics event collector remains INSERT-only for visitors.
-- Public visitors must never see individual events or aggregate reports.
begin;
alter table public.hm_view_events enable row level security;

grant select on public.hm_view_events to authenticated;
drop policy if exists hm_events_owner_read on public.hm_view_events;
create policy hm_events_owner_read
  on public.hm_view_events for select to authenticated
  using (
    exists (
      select 1 from public.hm_admins
      where user_id = (select auth.uid())
    )
  );

-- Analytics views were created as security_invoker=true in 003.
-- This grant is useful only for owners passing hm_events_owner_read.
grant select on
  public.hm_stats_dashboard,
  public.hm_stats_daily,
  public.hm_stats_pages,
  public.hm_stats_content,
  public.hm_stats_sources,
  public.hm_stats_devices,
  public.hm_stats_hours
to authenticated;
revoke all on
  public.hm_stats_dashboard,
  public.hm_stats_daily,
  public.hm_stats_pages,
  public.hm_stats_content,
  public.hm_stats_sources,
  public.hm_stats_devices,
  public.hm_stats_hours
from anon;
commit;
