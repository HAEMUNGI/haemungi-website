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

-- A play/open action is tracked for published video media, without watch-time claims.
alter table public.hm_view_events drop constraint if exists hm_view_events_event_type_check;
alter table public.hm_view_events add constraint hm_view_events_event_type_check
  check (event_type in ('page_view','goods_detail','card_view','room_spot',
    'diary_view','artwork_open','goods_filter','goods_search','music_toggle','video_play'));
alter table public.hm_view_events drop constraint if exists hm_events_item_shape;
alter table public.hm_view_events add constraint hm_events_item_shape
  check (
    (event_type in ('page_view','goods_search') and item_slug is null)
    or (event_type = 'music_toggle' and item_slug in ('on','off'))
    or (event_type = 'goods_filter' and item_slug in ('all','fashion','living','collectible','stationery'))
    or (event_type in ('goods_detail','card_view','room_spot','diary_view',
       'artwork_open','video_play') and item_slug is not null)
  );
alter table public.hm_view_events drop constraint if exists hm_events_page_scope;
alter table public.hm_view_events add constraint hm_events_page_scope
  check (
    event_type in ('page_view','music_toggle')
    or (event_type in ('goods_detail','goods_filter','goods_search') and page = 'goods')
    or (event_type = 'card_view' and page = 'cards')
    or (event_type in ('diary_view','artwork_open') and page = 'daily')
    or (event_type = 'room_spot' and page = 'room')
    or (event_type = 'video_play' and page = 'videos')
  );

-- Keep the existing security-invoker view shape and add video play actions.
create or replace view public.hm_stats_content with (security_invoker = true) as
select event_type, page, item_slug,
  count(*)::bigint as views_or_actions,
  count(distinct session_id)::bigint as sessions_estimate,
  max(happened_at) as last_opened_at
from public.hm_view_events
where item_slug is not null and event_type in
  ('goods_detail','card_view','room_spot','diary_view','artwork_open',
    'goods_filter','music_toggle','video_play')
group by event_type, page, item_slug;

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
