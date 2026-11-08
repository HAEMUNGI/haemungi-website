-- HAEMUNGI community v1: user-owned profiles, public boards, authenticated
-- room chat, moderation and reports. Existing memorial data is not touched.
-- Apply once to haemungi-world; all exposed tables use RLS.
begin;

create table public.hm_community_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 2 and 14),
  avatar_gender text not null check (avatar_gender in ('male','female')),
  terms_version text not null default '2026-11-09' check (terms_version='2026-11-09'),
  terms_accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index hm_community_profiles_nickname_unique on public.hm_community_profiles(lower(nickname));
alter table public.hm_community_profiles enable row level security;
revoke all on public.hm_community_profiles from public,anon,authenticated;
grant select on public.hm_community_profiles to authenticated;
grant insert(user_id,nickname,avatar_gender,terms_version) on public.hm_community_profiles to authenticated;
grant update(nickname,avatar_gender) on public.hm_community_profiles to authenticated;
create policy hm_community_profile_self_read on public.hm_community_profiles
 for select to authenticated using (user_id=(select auth.uid()));
create policy hm_community_profile_self_create on public.hm_community_profiles
 for insert to authenticated with check (user_id=(select auth.uid()));
create policy hm_community_profile_self_update on public.hm_community_profiles
 for update to authenticated using (user_id=(select auth.uid()))
 with check (user_id=(select auth.uid()));

create table public.hm_community_posts (
  id uuid primary key default gen_random_uuid(),
  board text not null check (board in ('free','qna','notice','guide')),
  title text not null check (char_length(btrim(title)) between 2 and 120),
  body text not null check (char_length(btrim(body)) between 2 and 6000),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_nickname text not null check (char_length(btrim(author_nickname)) between 2 and 14),
  avatar_gender text not null check (avatar_gender in ('male','female')),
  created_at timestamptz not null default now()
);
create index hm_community_posts_board_idx on public.hm_community_posts(board,created_at desc,id desc);
alter table public.hm_community_posts enable row level security;
revoke all on public.hm_community_posts from public,anon,authenticated;
grant select on public.hm_community_posts to anon,authenticated;
grant insert(board,title,body,author_id,author_nickname,avatar_gender) on public.hm_community_posts to authenticated;
grant delete on public.hm_community_posts to authenticated;
create policy hm_community_posts_public on public.hm_community_posts
 for select to anon,authenticated using (true);
create policy hm_community_posts_verified_writer on public.hm_community_posts
 for insert to authenticated with check (
   author_id=(select auth.uid())
   and (board in ('free','qna') or exists(select 1 from public.hm_admins a where a.user_id=(select auth.uid())))
   and exists(select 1 from public.hm_community_profiles p
     where p.user_id=(select auth.uid()) and p.nickname=author_nickname and p.avatar_gender=avatar_gender)
 );
create policy hm_community_posts_delete_owner_or_admin on public.hm_community_posts
 for delete to authenticated using (author_id=(select auth.uid())
  or exists(select 1 from public.hm_admins a where a.user_id=(select auth.uid())));

create table public.hm_community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.hm_community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_nickname text not null check (char_length(btrim(author_nickname)) between 2 and 14),
  avatar_gender text not null check (avatar_gender in ('male','female')),
  body text not null check (char_length(btrim(body)) between 1 and 1500),
  created_at timestamptz not null default now()
);
create index hm_community_comments_post_idx on public.hm_community_comments(post_id,created_at,id);
alter table public.hm_community_comments enable row level security;
revoke all on public.hm_community_comments from public,anon,authenticated;
grant select on public.hm_community_comments to anon,authenticated;
grant insert(post_id,author_id,author_nickname,avatar_gender,body) on public.hm_community_comments to authenticated;
grant delete on public.hm_community_comments to authenticated;
create policy hm_community_comments_public on public.hm_community_comments
 for select to anon,authenticated using (true);
create policy hm_community_comments_verified_writer on public.hm_community_comments
 for insert to authenticated with check (
   author_id=(select auth.uid()) and exists(
     select 1 from public.hm_community_profiles p
       where p.user_id=(select auth.uid()) and p.nickname=author_nickname and p.avatar_gender=avatar_gender)
 );
create policy hm_community_comments_delete_owner_or_admin on public.hm_community_comments
 for delete to authenticated using (author_id=(select auth.uid())
  or exists(select 1 from public.hm_admins a where a.user_id=(select auth.uid())));

create table public.hm_avatar_chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_no integer not null check (room_no between 1 and 8),
  avatar_session_id uuid not null,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_nickname text not null check (char_length(btrim(author_nickname)) between 2 and 14),
  avatar_gender text not null check (avatar_gender in ('male','female')),
  body text not null check (char_length(btrim(body)) between 1 and 250),
  created_at timestamptz not null default now()
);
create index hm_avatar_chat_room_idx on public.hm_avatar_chat_messages(room_no,created_at desc,id desc);
alter table public.hm_avatar_chat_messages enable row level security;
revoke all on public.hm_avatar_chat_messages from public,anon,authenticated;
grant select on public.hm_avatar_chat_messages to authenticated;
grant insert(room_no,avatar_session_id,author_id,author_nickname,avatar_gender,body) on public.hm_avatar_chat_messages to authenticated;
grant delete on public.hm_avatar_chat_messages to authenticated;
create policy hm_avatar_chat_members_read on public.hm_avatar_chat_messages
 for select to authenticated using (true);
create policy hm_avatar_chat_verified_writer on public.hm_avatar_chat_messages
 for insert to authenticated with check (
   author_id=(select auth.uid()) and exists(
     select 1 from public.hm_community_profiles p
       where p.user_id=(select auth.uid()) and p.nickname=author_nickname and p.avatar_gender=avatar_gender)
 );
create policy hm_avatar_chat_delete_owner_or_admin on public.hm_avatar_chat_messages
 for delete to authenticated using (author_id=(select auth.uid())
  or exists(select 1 from public.hm_admins a where a.user_id=(select auth.uid())));

create table public.hm_community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_kind text not null check (target_kind in ('post','comment','chat')),
  target_id uuid not null,
  reason text not null check (char_length(btrim(reason)) between 2 and 300),
  created_at timestamptz not null default now(),
  unique(reporter_id,target_kind,target_id)
);
create index hm_community_reports_new_idx on public.hm_community_reports(created_at desc);
alter table public.hm_community_reports enable row level security;
revoke all on public.hm_community_reports from public,anon,authenticated;
grant select on public.hm_community_reports to authenticated;
grant insert(reporter_id,target_kind,target_id,reason) on public.hm_community_reports to authenticated;
grant delete on public.hm_community_reports to authenticated;
create policy hm_community_reports_admin_read on public.hm_community_reports
 for select to authenticated using (exists(
   select 1 from public.hm_admins a where a.user_id=(select auth.uid())));
create policy hm_community_reports_writer on public.hm_community_reports
 for insert to authenticated with check (reporter_id=(select auth.uid()));
create policy hm_community_reports_admin_clear on public.hm_community_reports
 for delete to authenticated using (exists(
   select 1 from public.hm_admins a where a.user_id=(select auth.uid())));

-- Use database time and a transaction-level lock; direct REST requests cannot
-- bypass the same-author rate caps by disabling client-side buttons.
create function public.hm_community_write_guard() returns trigger
language plpgsql security invoker set search_path=public,pg_catalog as $$
declare v_interval interval;v_daily_limit integer;v_recent integer;v_daily integer;
begin
  if auth.uid() is null or new.author_id is distinct from auth.uid() then
    raise exception '계정을 확인해주세요.' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('hm-community:'||tg_table_name||':'||new.author_id::text)::bigint);
  if tg_table_name='hm_avatar_chat_messages' then
    v_interval:=interval '2 seconds';v_daily_limit:=250;
    select count(*) filter(where created_at>now()-v_interval),
      count(*) filter(where created_at>now()-interval '24 hours')
      into v_recent,v_daily from public.hm_avatar_chat_messages where author_id=new.author_id;
  elsif tg_table_name='hm_community_posts' then
    v_interval:=interval '20 seconds';v_daily_limit:=15;
    select count(*) filter(where created_at>now()-v_interval),
      count(*) filter(where created_at>now()-interval '24 hours')
      into v_recent,v_daily from public.hm_community_posts where author_id=new.author_id;
  else
    v_interval:=interval '4 seconds';v_daily_limit:=100;
    select count(*) filter(where created_at>now()-v_interval),
      count(*) filter(where created_at>now()-interval '24 hours')
      into v_recent,v_daily from public.hm_community_comments where author_id=new.author_id;
  end if;
  if v_recent>0 or v_daily>=v_daily_limit then
    raise exception '잠시 후 다시 등록해주세요. 반복 등록은 제한됩니다.' using errcode='P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.hm_community_write_guard() from public,anon,authenticated;
create trigger hm_community_posts_guard before insert on public.hm_community_posts
  for each row execute function public.hm_community_write_guard();
create trigger hm_community_comments_guard before insert on public.hm_community_comments
  for each row execute function public.hm_community_write_guard();
create trigger hm_avatar_chat_guard before insert on public.hm_avatar_chat_messages
  for each row execute function public.hm_community_write_guard();

commit;
