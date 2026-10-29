-- HAEMUNGI: Analytics reporting (read-only).
-- Open Supabase > haemungi-world > SQL Editor. Run ONE SELECT at a time.
-- Only data recorded AFTER installing 003 and deploying analytics.js is included.
-- sessions_estimate = anonymous 30-minute tab sessions; NOT unique visitors.

-- 01: one-row overall dashboard (total, today, 7d, 30d and engagement).
select * from public.hm_stats_dashboard;

-- 02: daily traffic for the last 30 days (Korea time).
select * from public.hm_stats_daily
where day_kst >= (now() at time zone 'Asia/Seoul')::date - 29
order by day_kst desc;

-- 03: most viewed pages, all-time.
select * from public.hm_stats_pages
order by page_views desc, page;

-- 04: goods popularity (10 official concepts).
select g.name as item, coalesce(s.views_or_actions, 0) as detail_opens,
       coalesce(s.sessions_estimate, 0) as sessions_estimate
from public.hm_goods g
left join public.hm_stats_content s
  on s.event_type = 'goods_detail' and s.item_slug = g.slug
order by detail_opens desc, g.display_order;

-- 05: official card-news artwork view rankings (9 individual pages).
select st.scene_number, st.title,
       coalesce(s.views_or_actions, 0) as card_views,
       coalesce(s.sessions_estimate, 0) as sessions_estimate
from public.hm_stories st
left join public.hm_stats_content s
  on s.event_type = 'card_view' and s.item_slug = st.slug
where st.kind = 'cardnews'
order by card_views desc, st.scene_number;

-- 06: room discovery hotspot rankings (7 objects).
select rs.label, coalesce(s.views_or_actions, 0) as opens,
       coalesce(s.sessions_estimate, 0) as sessions_estimate
from public.hm_room_spots rs
left join public.hm_stats_content s
  on s.event_type = 'room_spot' and s.item_slug = rs.slug
order by opens desc, rs.display_order;

-- 07: daily story readings (on-screen visibility, three stories).
select st.title, coalesce(s.views_or_actions, 0) as views,
       coalesce(s.sessions_estimate, 0) as sessions_estimate
from public.hm_stories st
left join public.hm_stats_content s
  on s.event_type = 'diary_view' and s.item_slug = st.slug
where st.kind = 'diary'
order by views desc, st.scene_number;

-- 08: traffic sources: Threads, Instagram, YouTube, Naver, direct, etc.
select * from public.hm_stats_sources
order by sessions_estimate desc, source_kind;

-- 09: device SCREEN classes; widths not hardware models.
select * from public.hm_stats_devices
order by page_views desc, device_kind;

-- 10: hourly interest by Korea Standard Time.
select * from public.hm_stats_hours
order by hour_kst;

-- 11: archived daily page counts, accumulated by server trigger.
select day, page, page_views from public.hm_daily_metrics
order by day desc, page;

-- Optional manual retention cleanup: DO NOT run without deciding policy.
-- delete from public.hm_view_events where happened_at < now() - interval '180 days';
