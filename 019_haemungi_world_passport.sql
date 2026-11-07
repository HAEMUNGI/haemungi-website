-- World Passport: fourteen verified server-side visit stamps, one self-published
-- memorial plaque reward per verified account. No legacy plaques are rewritten.
begin;

create table if not exists public.hm_world_passports (
  id uuid primary key,
  secret_digest text not null check (secret_digest ~ '^[0-9a-f]{64}$'),
  ip_digest text check (ip_digest ~ '^[0-9a-f]{64}$'),
  stamps jsonb not null default '{}'::jsonb check (jsonb_typeof(stamps)='object'),
  created_at timestamptz not null default now(),
  last_stamp_at timestamptz,
  claimed_user_id uuid references auth.users(id) on delete set null,
  claimed_memorial_id uuid references public.hm_memorial_public(id) on delete set null,
  claimed_slot smallint check (claimed_slot between 2 and 30000),
  claimed_at timestamptz,
  consent_at timestamptz
);
create index if not exists hm_world_passports_ip_recent
  on public.hm_world_passports(ip_digest,created_at desc) where ip_digest is not null;
create unique index if not exists hm_world_passports_one_reward_per_account
  on public.hm_world_passports(claimed_user_id) where claimed_user_id is not null;
create unique index if not exists hm_world_passports_one_reward_per_memorial
  on public.hm_world_passports(claimed_memorial_id) where claimed_memorial_id is not null;
alter table public.hm_world_passports enable row level security;
revoke all on public.hm_world_passports from public,anon,authenticated;
grant select,insert,update,delete on public.hm_world_passports to service_role;

create or replace function public.hm_world_passport_stamp(
  p_id uuid,p_digest text,p_stop text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_pass public.hm_world_passports%rowtype;v_today text;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception '서버에서만 방문 도장을 발급할 수 있습니다.' using errcode='28000';
  end if;
  if p_stop is null or not (p_stop=any(array[
      'home','videos','cards','daily','goods','room','about','today','creator','emoticons',
      'playground','memorial','temple','christmas'])) then
    raise exception '알 수 없는 방문 장소입니다.';
  end if;
  select * into v_pass from public.hm_world_passports
    where id=p_id and secret_digest=p_digest for update;
  if not found then raise exception '여권을 확인할 수 없습니다.' using errcode='28000';end if;
  if v_pass.stamps ? p_stop then return v_pass.stamps;end if;
  if v_pass.claimed_at is not null then
    raise exception '이미 완주한 여권입니다.';
  end if;
  if v_pass.last_stamp_at is not null and v_pass.last_stamp_at>now()-interval '2 seconds' then
    raise exception '다음 장소로 조금 더 천천히 여행해주세요.';
  end if;
  v_today:=to_char(now() at time zone 'Asia/Seoul','YYYY-MM-DD');
  update public.hm_world_passports set
    stamps=stamps||jsonb_build_object(p_stop,v_today),last_stamp_at=now()
    where id=p_id returning stamps into v_pass.stamps;
  return v_pass.stamps;
end;$$;
revoke all on function public.hm_world_passport_stamp(uuid,text,text) from public,anon,authenticated;
grant execute on function public.hm_world_passport_stamp(uuid,text,text) to service_role;

create or replace function public.hm_world_passport_claim(
  p_id uuid,p_digest text,p_user uuid,p_memorial uuid)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_pass public.hm_world_passports%rowtype;v_email text;v_confirmed timestamptz;
  v_request public.hm_memorial_requests%rowtype;v_slot integer;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception '명패는 안전한 인증 경로에서만 배정할 수 있습니다.' using errcode='28000';
  end if;
  select * into v_pass from public.hm_world_passports
    where id=p_id and secret_digest=p_digest for update;
  if not found then raise exception '여권을 확인할 수 없습니다.' using errcode='28000';end if;
  if v_pass.claimed_at is not null then raise exception '이미 명패를 받은 여권입니다.';end if;
  if (select count(*) from jsonb_object_keys(v_pass.stamps))<>14 then
    raise exception '14개 장소의 방문 도장을 모두 모아주세요.';
  end if;
  select email,email_confirmed_at into v_email,v_confirmed from auth.users where id=p_user;
  if v_email is null or v_confirmed is null then
    raise exception '이메일 인증을 완료해주세요.' using errcode='28000';
  end if;
  if exists(select 1 from public.hm_world_passports where claimed_user_id=p_user) then
    raise exception '이미 이 계정으로 여권 명패를 발급받았습니다.';
  end if;
  select * into v_request from public.hm_memorial_requests where id=p_memorial for update;
  if not found or v_request.status<>'published' or v_request.publication_source<>'self_archive'
      or v_request.consent_declaration is distinct from true
      or lower(v_request.contact_email)<>lower(v_email) then
    raise exception '본인이 공개한 별들의 기록만 명패로 받을 수 있습니다.' using errcode='28000';
  end if;
  if not exists(select 1 from public.hm_memorial_public
      where id=p_memorial and slot_index is null) then
    raise exception '해당 아이에게 이미 명패가 배정되었습니다.';
  end if;
  -- Serialize auto-allocation against other reward claims; public unique index
  -- and pending-request unique index are the final conflict guards.
  perform pg_advisory_xact_lock(46821002);
  select s into v_slot from generate_series(2,30000) as s
    where not exists(select 1 from public.hm_memorial_public p where p.slot_index=s)
      and not exists(select 1 from public.hm_memorial_requests r
          where r.requested_slot=s and r.status='pending')
    order by s limit 1;
  if v_slot is null then raise exception '현재 비어 있는 안식관 자리가 없습니다.';end if;
  update public.hm_memorial_public set slot_index=v_slot where id=p_memorial;
  update public.hm_memorial_requests set
    owner_id=p_user,requested_slot=null,approved_slot=v_slot,approved_at=now(),
    owner_consent_verified=true where id=p_memorial;
  update public.hm_world_passports set
    claimed_user_id=p_user,claimed_memorial_id=p_memorial,claimed_slot=v_slot,
    claimed_at=now(),consent_at=now() where id=p_id;
  return v_slot;
end;$$;
revoke all on function public.hm_world_passport_claim(uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.hm_world_passport_claim(uuid,text,uuid,uuid) to service_role;

-- Stop direct self-service plaque reservation. Old pending requests remain
-- available to administrators; authorized reward claims now use the RPC above.
drop policy if exists "mem_requests_owner_apply" on public.hm_memorial_requests;
drop policy if exists "hm_memorial_inbox_visitor_upload" on storage.objects;
revoke execute on function public.hm_memorial_request_archive_plaque(uuid,smallint) from authenticated;

commit;
