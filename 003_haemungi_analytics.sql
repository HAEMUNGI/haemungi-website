-- HAEMUNGI / haemungi-world ONLY. Run after 001_haemungi_world.sql.
-- Independent from NEWIT STUDIO and BSBKTV. Safe to re-run.
-- No raw IP address, user-agent string, email, search query or URL is stored.
-- session_id is a random tab-scoped UUID (approximate sessions, NOT unique people).
-- Anonymous visitors can INSERT validated events but cannot read or edit metrics.
begin;

create table if not exists public.hm_view_events (
  id uuid primary key default gen_random_uuid(),
  happened_at timestamptz not null default now(),
  session_id uuid not null,
  event_type text not null check (event_type in (
    'page_view', 'goods_detail', 'card_view', 'room_spot', 'diary_view',
    'artwork_open', 'goods_filter', 'goods_search', 'music_toggle'
  )),
  page text not null check (page in (
    'home', 'videos', 'cards', 'daily', 'goods', 'room', 'about'
  )),
  item_slug text check (item_slug ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  device_kind text not null check (device_kind in ('mobile', 'tablet', 'desktop')),
  source_kind text not null check (source_kind in (
    'direct','threads','instagram','youtube','naver','google',
    'facebook','kakao','tiktok','other'
  )),
  constraint hm_events_item_shape check (
    (event_type in ('page_view', 'goods_search') and item_slug is null) or
    (event_type = 'music_toggle' and item_slug is not null
      and item_slug in ('on','off')) or
    (event_type = 'goods_filter' and item_slug is not null and item_slug in (
      'all','fashion','living','collectible','stationery')) or
    (event_type in ('goods_detail','card_view','room_spot',
                    'diary_view','artwork_open') and item_slug is not null)
  ),
  constraint hm_events_page_scope check (
    event_type in ('page_view','music_toggle') or
    (event_type in ('goods_detail','goods_filter','goods_search') and page = 'goods') or
    (event_type = 'card_view' and page = 'cards') or
    (event_type in ('diary_view','artwork_open') and page = 'daily') or
    (event_type = 'room_spot' and page = 'room')
  )
);

create index if not exists hm_view_events_time_idx
  on public.hm_view_events (happened_at desc);
create index if not exists hm_view_events_type_time_idx
  on public.hm_view_events (event_type, happened_at desc);
create index if not exists hm_view_events_item_time_idx
  on public.hm_view_events (event_type, item_slug, happened_at desc);

alter table public.hm_view_events enable row level security;
revoke all on public.hm_view_events from public, anon, authenticated;
-- Only the five user-generated columns are insertable. Server owns id/time.
grant insert (session_id, event_type, page, item_slug, device_kind, source_kind)
  on public.hm_view_events to anon, authenticated;
drop policy if exists hm_events_write_only on public.hm_view_events;
create policy hm_events_write_only on public.hm_view_events
  for insert to anon, authenticated with check (true);

-- Daily page counter already existed in 001, but was not connected to traffic.
-- The function is private, and cannot be directly invoked via the Data API.
create schema if not exists hm_private;
revoke all on schema hm_private from public, anon, authenticated;
create or replace function hm_private.hm_rollup_page_view()
returns trigger language plpgsql security definer
set search_path = pg_catalog
as $$
begin
  if new.event_type = 'page_view' then
    insert into public.hm_daily_metrics(day, page, page_views)
      values ((new.happened_at at time zone 'Asia/Seoul')::date, new.page, 1)
    on conflict (day, page) do update
      set page_views = public.hm_daily_metrics.page_views + 1;
  end if;
  return new;
end;
$$;
revoke all on function hm_private.hm_rollup_page_view()
  from public, anon, authenticated;
drop trigger if exists hm_rollup_page_view_trigger on public.hm_view_events;
create trigger hm_rollup_page_view_trigger
  after insert on public.hm_view_events
  for each row execute function hm_private.hm_rollup_page_view();

-- Owner-only SQL Editor reporting views. No REST SELECT grants to visitors.
-- security_invoker also prevents accidental bypass of underlying RLS.
create or replace view public.hm_stats_daily with (security_invoker = true) as
select
  (happened_at at time zone 'Asia/Seoul')::date as day_kst,
  count(*) filter (where event_type = 'page_view')::bigint as page_views,
  count(distinct session_id) filter (where event_type = 'page_view')::bigint as sessions_estimate,
  count(*) filter (where event_type = 'goods_detail')::bigint as goods_opens,
  count(*) filter (where event_type = 'card_view')::bigint as card_views,
  count(*) filter (where event_type = 'room_spot')::bigint as room_discoveries,
  count(*) filter (where event_type = 'diary_view')::bigint as diary_views,
  count(*) filter (where event_type = 'artwork_open')::bigint as artwork_opens,
  count(*) filter (where event_type = 'goods_search')::bigint as goods_searches
from public.hm_view_events
group by 1;

create or replace view public.hm_stats_pages with (security_invoker = true) as
select
  page,
  count(*)::bigint as page_views,
  count(distinct session_id)::bigint as sessions_estimate,
  max(happened_at) as last_viewed_at
from public.hm_view_events where event_type = 'page_view'
group by page;

create or replace view public.hm_stats_content with (security_invoker = true) as
select
  event_type, page, item_slug,
  count(*)::bigint as views_or_actions,
  count(distinct session_id)::bigint as sessions_estimate,
  max(happened_at) as last_opened_at
from public.hm_view_events
where item_slug is not null and event_type in
  ('goods_detail','card_view','room_spot','diary_view','artwork_open',
   'goods_filter','music_toggle')
group by event_type, page, item_slug;

create or replace view public.hm_stats_devices with (security_invoker = true) as
select
  device_kind,
  count(*) filter (where event_type = 'page_view')::bigint as page_views,
  count(distinct session_id) filter (where event_type = 'page_view')::bigint
    as sessions_estimate
from public.hm_view_events
group by device_kind;

create or replace view public.hm_stats_sources with (security_invoker = true) as
select
  source_kind,
  count(*) filter (where event_type = 'page_view')::bigint as page_views,
  count(distinct session_id) filter (where event_type = 'page_view')::bigint
    as sessions_estimate
from public.hm_view_events
group by source_kind;

create or replace view public.hm_stats_hours with (security_invoker = true) as
select
  extract(hour from happened_at at time zone 'Asia/Seoul')::integer as hour_kst,
  count(*)::bigint as page_views
from public.hm_view_events
where event_type = 'page_view'
group by 1;

create or replace view public.hm_stats_dashboard with (security_invoker = true) as
select
  count(*) filter (where event_type = 'page_view')::bigint as total_page_views,
  count(distinct session_id) filter (where event_type = 'page_view')::bigint
    as total_sessions_estimate,
  count(*) filter (where event_type = 'page_view'
    and (happened_at at time zone 'Asia/Seoul')::date =
        (now() at time zone 'Asia/Seoul')::date)::bigint as today_page_views,
  count(*) filter (where event_type = 'page_view'
    and happened_at >= now() - interval '7 days')::bigint as last7_page_views,
  count(*) filter (where event_type = 'page_view'
    and happened_at >= now() - interval '30 days')::bigint as last30_page_views,
  count(distinct session_id) filter (where event_type = 'page_view'
    and happened_at >= now() - interval '30 days')::bigint as last30_sessions_estimate,
  count(*) filter (where event_type = 'goods_detail')::bigint as goods_opens,
  count(*) filter (where event_type = 'card_view')::bigint as card_views,
  count(*) filter (where event_type = 'room_spot')::bigint as room_discoveries,
  count(*) filter (where event_type = 'diary_view')::bigint as diary_views,
  count(*) filter (where event_type = 'artwork_open')::bigint as artwork_opens,
  max(happened_at) as last_event_at
from public.hm_view_events;

revoke all on public.hm_stats_daily, public.hm_stats_pages,
  public.hm_stats_content, public.hm_stats_devices,
  public.hm_stats_sources, public.hm_stats_hours, public.hm_stats_dashboard
  from public, anon, authenticated;
commit;
