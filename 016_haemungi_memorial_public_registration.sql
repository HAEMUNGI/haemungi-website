-- Starlight memorial: immediate archive, authenticated plaque requests, expandable wings.
-- Only one guardian-supplied photo per pet. The original memorial 001 is untouched.
begin;

alter table public.hm_memorial_requests
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists publication_source text not null default 'admin'
    check (publication_source in ('admin','self_archive'));

alter table public.hm_memorial_requests drop constraint if exists hm_memorial_requests_requested_slot_check;
alter table public.hm_memorial_requests add constraint hm_memorial_requests_requested_slot_check
  check (requested_slot between 1 and 30000);
alter table public.hm_memorial_requests drop constraint if exists hm_memorial_requests_approved_slot_check;
alter table public.hm_memorial_requests add constraint hm_memorial_requests_approved_slot_check
  check (approved_slot between 1 and 30000);
alter table public.hm_memorial_public drop constraint if exists hm_memorial_public_slot_index_check;
alter table public.hm_memorial_public add constraint hm_memorial_public_slot_index_check
  check (slot_index between 1 and 30000);

-- A pending application claims a slot until approval/rejection; public slots stay unique.
create unique index if not exists hm_memorial_pending_requested_slot_unique
  on public.hm_memorial_requests(requested_slot)
  where requested_slot is not null and status='pending';
create index if not exists hm_memorial_requests_owner_idx
  on public.hm_memorial_requests(owner_id,created_at desc) where owner_id is not null;

create policy "mem_requests_owner_apply" on public.hm_memorial_requests
  for insert to authenticated with check (
    owner_id=(select auth.uid()) and status='pending'
    and consent_declaration=true and owner_consent_verified=false
    and requested_visibility='public' and photo_path is not null
    and requested_slot between 2 and 30000 and approved_slot is null and approved_at is null
    and publication_source='admin'
    and not exists(select 1 from public.hm_memorial_public p where p.slot_index=requested_slot)
    and lower(contact_email)=lower((select auth.jwt()->>'email'))
  );
create policy "mem_requests_owner_read" on public.hm_memorial_requests
  for select to authenticated using (owner_id=(select auth.uid()));
create policy "hm_memorial_inbox_visitor_upload" on storage.objects
  for insert to authenticated with check (
    bucket_id='hm-memorial-inbox'
    and name ~ '^incoming/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
    and (select auth.uid()) is not null
  );

-- Return only non-sensitive occupancy counts to visitors. Never expose applicants/emails.
create or replace function public.hm_memorial_wings()
returns table(wing_number integer, occupied integer, pending integer, available integer)
language sql stable security definer set search_path=public,pg_temp as $$
 with highest as (
   select greatest(coalesce((select max(slot_index) from public.hm_memorial_public),0),
     coalesce((select max(requested_slot) from public.hm_memorial_requests where status='pending'),0)) as n
 ), wings as (
   select generate_series(1,least(2500,greatest(1,(select (n+11)/12 from highest)))) as w
 ), counts as (
   select w.w,
     (select count(*)::int from public.hm_memorial_public p
       where p.slot_index between ((w.w-1)*12+1) and (w.w*12)) as used,
     (select count(*)::int from public.hm_memorial_requests r
       where r.status='pending' and r.requested_slot between ((w.w-1)*12+1) and (w.w*12)) as held
     from wings w
 )
 select w as wing_number, used as occupied, held as pending, (12-used-held) as available
 from counts
 union all
 select (select max(w)+1 from counts),0,0,12
 where (select max(w) from counts)<2500
   and (select used+held from counts order by w desc limit 1)=12
 order by wing_number;
$$;
revoke all on function public.hm_memorial_wings() from public;
grant execute on function public.hm_memorial_wings() to anon,authenticated;

create or replace function public.hm_memorial_slot_status(p_wing integer)
returns table(slot_index integer, state text)
language sql stable security definer set search_path=public,pg_temp as $$
  select s as slot_index,
    case when exists(select 1 from public.hm_memorial_public p where p.slot_index=s) then 'occupied'
      when exists(select 1 from public.hm_memorial_requests r
        where r.requested_slot=s and r.status='pending') then 'pending'
      else 'available' end as state
  from generate_series((p_wing-1)*12+1,p_wing*12) s
  where p_wing between 1 and 2500 order by s;
$$;
revoke all on function public.hm_memorial_slot_status(integer) from public;
grant execute on function public.hm_memorial_slot_status(integer) to anon,authenticated;

-- A verified email owner can seek a plaque for an existing self-published archive
-- entry without duplicating or re-uploading its public photograph.
create or replace function public.hm_memorial_request_archive_plaque(p_id uuid,p_slot smallint)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid:=auth.uid();v_email text;v_confirmed timestamptz;v_row public.hm_memorial_requests%rowtype;
begin
 if v_user is null then raise exception '로그인 후 신청해주세요.' using errcode='28000';end if;
 select email,email_confirmed_at into v_email,v_confirmed from auth.users where id=v_user;
 if v_confirmed is null then raise exception '이메일 인증을 완료해주세요.' using errcode='28000';end if;
 if p_slot is null or p_slot<2 or p_slot>30000 then raise exception '신청할 호수를 확인해주세요.';end if;
 select * into v_row from public.hm_memorial_requests where id=p_id for update;
 if not found or v_row.publication_source<>'self_archive' or v_row.status<>'published'
   or lower(v_row.contact_email)<>lower(v_email) then
   raise exception '본인의 공개 기록만 명패를 신청할 수 있습니다.' using errcode='28000';
 end if;
 if not exists(select 1 from public.hm_memorial_public where id=p_id and slot_index is null) then
   raise exception '이미 명패가 배정되었거나 기록이 없습니다.';
 end if;
 if exists(select 1 from public.hm_memorial_public where slot_index=p_slot) then
   raise exception '이미 배정된 호수입니다.';
 end if;
 if exists(select 1 from public.hm_memorial_requests where requested_slot=p_slot and status='pending') then
   raise exception '다른 신청이 진행 중인 호수입니다.';
 end if;
 update public.hm_memorial_requests set owner_id=v_user,requested_slot=p_slot,status='pending'
   where id=p_id;
 return p_id;
end;$$;
revoke all on function public.hm_memorial_request_archive_plaque(uuid,smallint) from public;
grant execute on function public.hm_memorial_request_archive_plaque(uuid,smallint) to authenticated;

create or replace function public.hm_memorial_my_archive_entries()
returns table(id uuid,pet_name text,created_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select r.id,r.pet_name,r.created_at from public.hm_memorial_requests r
 join public.hm_memorial_public p on p.id=r.id and p.slot_index is null
 join auth.users u on u.id=auth.uid() and u.email_confirmed_at is not null
 where r.publication_source='self_archive' and r.status='published'
   and lower(r.contact_email)=lower(u.email)
 order by r.created_at desc limit 100;
$$;
revoke all on function public.hm_memorial_my_archive_entries() from public;
grant execute on function public.hm_memorial_my_archive_entries() to authenticated;

-- Only the Edge Function's server-side service role can create instant public records.
create table if not exists public.hm_memorial_self_publish_limits (
  id bigint generated always as identity primary key,
  identity_kind text not null check(identity_kind in ('ip','email','global')),
  identity_digest text not null check(char_length(identity_digest)=64),
  created_at timestamptz not null default now()
);
create index if not exists hm_memorial_self_publish_limits_lookups
  on public.hm_memorial_self_publish_limits(identity_kind,identity_digest,created_at desc);
alter table public.hm_memorial_self_publish_limits enable row level security;
revoke all on public.hm_memorial_self_publish_limits from anon,authenticated;

create or replace function public.hm_memorial_self_publish(
 p_id uuid,p_name text,p_born date,p_passed date,p_story text,p_farewell text,
 p_email text,p_photo_path text,p_ip_digest text,p_email_digest text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_utc timestamptz:=now();v_global text:=repeat('0',64);
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
   raise exception '공개 등록은 안전한 접수 경로만 허용합니다.' using errcode='28000';
 end if;
 if p_id is null or p_name is null or p_story is null or p_email is null
  or btrim(p_name)='' or char_length(btrim(p_name))>60
  or char_length(btrim(p_story)) not between 1 and 900 or char_length(p_farewell)>500
  or char_length(p_email)>254 or p_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  or p_photo_path <> ('approved/'||p_id::text||'.webp')
  or p_ip_digest !~ '^[0-9a-f]{64}$' or p_email_digest !~ '^[0-9a-f]{64}$'
  or (p_born is not null and p_passed is not null and p_born>p_passed)
 then raise exception '등록 내용이 올바르지 않습니다.';end if;
 -- Serialize acceptance across invocations, including a global emergency brake.
 perform pg_advisory_xact_lock(46821001);
 if (select count(*) from public.hm_memorial_self_publish_limits
     where identity_kind='global' and created_at>v_utc-interval '1 day')>=400 then
   raise exception '하루 공개 등록 가능 건수를 초과했습니다. 내일 다시 이용해주세요.';
 end if;
 if exists(select 1 from public.hm_memorial_self_publish_limits
     where identity_kind='ip' and identity_digest=p_ip_digest
     and created_at>v_utc-interval '90 seconds')
   or (select count(*) from public.hm_memorial_self_publish_limits
     where identity_kind='ip' and identity_digest=p_ip_digest
     and created_at>v_utc-interval '1 day')>=12
   or (select count(*) from public.hm_memorial_self_publish_limits
     where identity_kind='email' and identity_digest=p_email_digest
     and created_at>v_utc-interval '1 day')>=3 then
   raise exception '짧은 시간에 너무 많은 기록을 등록했습니다. 잠시 후 다시 이용해주세요.';
 end if;
 insert into public.hm_memorial_requests
   (id,pet_name,born_on,passed_on,story,farewell,contact_email,requested_visibility,
    status,consent_declaration,publication_source)
 values (p_id,btrim(p_name),p_born,p_passed,btrim(p_story),coalesce(p_farewell,''),lower(btrim(p_email)),
    'public','published',true,'self_archive');
 insert into public.hm_memorial_public
   (id,slot_index,pet_name,born_on,passed_on,story,farewell,photo_path)
 values (p_id,null,btrim(p_name),p_born,p_passed,btrim(p_story),coalesce(p_farewell,''),p_photo_path);
 insert into public.hm_memorial_self_publish_limits(identity_kind,identity_digest)
 values ('ip',p_ip_digest),('email',p_email_digest),('global',v_global);
 return p_id;
end;$$;
revoke all on function public.hm_memorial_self_publish(uuid,text,date,date,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.hm_memorial_self_publish(uuid,text,date,date,text,text,text,text,text,text) to service_role;

commit;
