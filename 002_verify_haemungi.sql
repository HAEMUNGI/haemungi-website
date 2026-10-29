-- Run AFTER 001_haemungi_world.sql, in HAEMUNGI > haemungi-world.
-- All statements are read-only. Expected counts: 4, 26, 10, 9, 3, 7, 3.

select 'categories' as item, count(*) as actual, 4 as expected from public.hm_categories
union all select 'assets', count(*), 26 from public.hm_assets
union all select 'goods', count(*), 10 from public.hm_goods
union all select 'cardnews', count(*), 9 from public.hm_stories where kind = 'cardnews'
union all select 'diaries', count(*), 3 from public.hm_stories where kind = 'diary'
union all select 'room_spots', count(*), 7 from public.hm_room_spots
union all select 'settings', count(*), 3 from public.hm_site_settings;

select c.relname as table_name, c.relrowsecurity as rls_enabled,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_can_select,
       has_table_privilege('anon', c.oid, 'INSERT') as anon_can_insert,
       has_table_privilege('anon', c.oid, 'UPDATE') as anon_can_update,
       has_table_privilege('anon', c.oid, 'DELETE') as anon_can_delete
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname like 'hm_%'
  and c.relkind = 'r'
order by c.relname;

-- Expect the 6 content tables to have one SELECT policy each.
-- hm_daily_metrics and hm_social_drafts must have zero public policies.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename like 'hm_%'
order by tablename, policyname;

-- All referenced paths must resolve to files in the Site bundle.
-- Verify path existence on the Site separately; PostgreSQL cannot inspect it.
select g.slug, g.name, a.path
from public.hm_goods g
join public.hm_assets a on a.slug = g.asset_slug
order by g.display_order;
