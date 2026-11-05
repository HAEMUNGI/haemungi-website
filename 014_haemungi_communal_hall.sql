-- HAEMUNGI: community memorial messages and the single shared 10-minute ritual room.
-- Run after 012. Existing memorial records and private applications are unchanged.
begin;

create table if not exists public.hm_memorial_hall_messages (
  id uuid primary key default gen_random_uuid(),
  author_alias text not null check (char_length(btrim(author_alias)) between 1 and 30),
  body text not null check (char_length(btrim(body)) between 2 and 300),
  visitor_hash text not null check (visitor_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
create index if not exists hm_memorial_hall_messages_approved_idx
  on public.hm_memorial_hall_messages (created_at desc) where status='approved';
create index if not exists hm_memorial_hall_messages_pending_idx
  on public.hm_memorial_hall_messages (created_at asc) where status='pending';
create index if not exists hm_memorial_hall_messages_rate_idx
  on public.hm_memorial_hall_messages (visitor_hash,created_at desc);
alter table public.hm_memorial_hall_messages enable row level security;
revoke all on public.hm_memorial_hall_messages from public,anon,authenticated;
grant select,update on public.hm_memorial_hall_messages to authenticated;
grant select on public.hm_memorial_hall_messages to anon;
create policy "hall_approved_or_admin_read" on public.hm_memorial_hall_messages
  for select to anon,authenticated using (
    status='approved' or exists(select 1 from public.hm_admins
      where user_id=(select auth.uid()))
  );
create policy "hall_admin_moderate" on public.hm_memorial_hall_messages
  for update to authenticated
  using (exists(select 1 from public.hm_admins where user_id=(select auth.uid())))
  with check (exists(select 1 from public.hm_admins where user_id=(select auth.uid())));

-- Reservation authority remains in a non-API-exposed schema. Public visitors can
-- only call narrow RPC wrappers, never update the room record directly.
create schema if not exists hm_private;
revoke all on schema hm_private from public;
create table if not exists hm_private.hm_temporary_ritual_slot (
  room_key text primary key check (room_key='shared'),
  memorial_id uuid references public.hm_memorial_public(id) on delete set null,
  owner_hash text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table hm_private.hm_temporary_ritual_slot enable row level security;
revoke all on hm_private.hm_temporary_ritual_slot from public,anon,authenticated;
insert into hm_private.hm_temporary_ritual_slot(room_key) values('shared') on conflict do nothing;

create or replace function hm_private.hall_message_submit(
  p_token text, p_alias text, p_body text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_hash text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status','invalid');
  end if;
  if char_length(btrim(coalesce(p_alias,''))) not between 1 and 30
    or char_length(btrim(coalesce(p_body,''))) not between 2 and 300 then
    return jsonb_build_object('status','invalid');
  end if;
  v_hash:=encode(sha256(decode(p_token,'hex')),'hex');
  -- Transaction-scoped lock prevents parallel requests from bypassing the per-visitor limit.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('haemungi-hall-message:'||v_hash));
  if (select count(*) from public.hm_memorial_hall_messages
      where visitor_hash=v_hash and created_at>now()-interval '24 hours')>=3 then
    return jsonb_build_object('status','rate_limited');
  end if;
  insert into public.hm_memorial_hall_messages(author_alias,body,visitor_hash)
    values (btrim(p_alias),btrim(p_body),v_hash);
  return jsonb_build_object('status','pending');
end;
$$;

create or replace function hm_private.temporary_ritual_manage(
  p_action text,p_token text,p_memorial_id uuid default null
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_slot hm_private.hm_temporary_ritual_slot%rowtype;
  v_hash text;v_time timestamptz;
begin
  if p_action not in ('status','claim','release') or
     p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status','invalid');
  end if;
  v_hash:=encode(sha256(decode(p_token,'hex')),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('haemungi-temporary-ritual-room'));
  select * into v_slot from hm_private.hm_temporary_ritual_slot
    where room_key='shared' for update;
  v_time:=clock_timestamp();
  if p_action='status' then
    if v_slot.expires_at>v_time then
      if v_slot.owner_hash=v_hash then
        return jsonb_build_object('status','active','memorial_id',v_slot.memorial_id,
          'expires_at',v_slot.expires_at);
      end if;
      return jsonb_build_object('status','occupied','expires_at',v_slot.expires_at);
    end if;
    return jsonb_build_object('status','available');
  end if;
  if p_action='release' then
    if v_slot.expires_at>v_time and v_slot.owner_hash=v_hash then
      update hm_private.hm_temporary_ritual_slot set memorial_id=null,
        owner_hash=null,expires_at=null,updated_at=v_time where room_key='shared';
      return jsonb_build_object('status','released');
    end if;
    return jsonb_build_object('status','not_owner');
  end if;
  -- A visitor cannot extend an existing 10-minute session by claiming again.
  if v_slot.expires_at>v_time then
    if v_slot.owner_hash=v_hash then
      return jsonb_build_object('status','active','memorial_id',v_slot.memorial_id,
        'expires_at',v_slot.expires_at);
    end if;
    return jsonb_build_object('status','occupied','expires_at',v_slot.expires_at);
  end if;
  if p_memorial_id is null or not exists (
    select 1 from public.hm_memorial_public
    where id=p_memorial_id and slot_index is null
  ) then
    return jsonb_build_object('status','not_eligible');
  end if;
  update hm_private.hm_temporary_ritual_slot
    set memorial_id=p_memorial_id,owner_hash=v_hash,
      expires_at=v_time+interval '10 minutes',updated_at=v_time
    where room_key='shared' returning * into v_slot;
  return jsonb_build_object('status','active','memorial_id',v_slot.memorial_id,
    'expires_at',v_slot.expires_at);
end;
$$;

-- Public RPC facade: INVOKER (never bypasses RLS itself).
create or replace function public.hm_hall_message_submit(
  p_token text,p_alias text,p_body text
) returns jsonb language sql security invoker set search_path=''
as $$select hm_private.hall_message_submit(p_token,p_alias,p_body)$$;
create or replace function public.hm_temporary_ritual_manage(
  p_action text,p_token text,p_memorial_id uuid default null
) returns jsonb language sql security invoker set search_path=''
as $$select hm_private.temporary_ritual_manage(p_action,p_token,p_memorial_id)$$;

revoke all on function hm_private.hall_message_submit(text,text,text) from public;
revoke all on function hm_private.temporary_ritual_manage(text,text,uuid) from public;
revoke all on function public.hm_hall_message_submit(text,text,text) from public;
revoke all on function public.hm_temporary_ritual_manage(text,text,uuid) from public;
grant usage on schema hm_private to anon,authenticated;
grant execute on function hm_private.hall_message_submit(text,text,text) to anon,authenticated;
grant execute on function hm_private.temporary_ritual_manage(text,text,uuid) to anon,authenticated;
grant execute on function public.hm_hall_message_submit(text,text,text) to anon,authenticated;
grant execute on function public.hm_temporary_ritual_manage(text,text,uuid) to anon,authenticated;
commit;
