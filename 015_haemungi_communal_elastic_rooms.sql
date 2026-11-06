-- HAEMUNGI: on-demand parallel temporary ritual rooms.
-- Keeps the original shared room and any still-active 10-minute booking.
-- All rooms reuse the same approved scene image; no new media storage per room.
-- Run after 014_haemungi_communal_hall.sql.
begin;

alter table hm_private.hm_temporary_ritual_slot
  drop constraint if exists hm_temporary_ritual_slot_room_key_check;
alter table hm_private.hm_temporary_ritual_slot
  add constraint hm_temporary_ritual_slot_room_key_check
  check (room_key = 'shared' or room_key ~ '^room-[0-9]{4}$');

create index if not exists hm_temporary_ritual_slot_owner_active_idx
  on hm_private.hm_temporary_ritual_slot(owner_hash,expires_at desc)
  where owner_hash is not null;
create index if not exists hm_temporary_ritual_slot_memorial_idx
  on hm_private.hm_temporary_ritual_slot(memorial_id)
  where memorial_id is not null;

-- Every claim is serialized briefly to prevent duplicate room assignment.
-- An occupied room is never overwritten; released and expired rooms are reused.
-- The pool grows only on demand, up to the initial safety ceiling of 240 rooms.
-- This ceiling can be revisited after measuring actual concurrent usage.
create or replace function hm_private.temporary_ritual_manage(
  p_action text,p_token text,p_memorial_id uuid default null
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_slot hm_private.hm_temporary_ritual_slot%rowtype;
  v_hash text;
  v_time timestamptz;
  v_count integer;
  v_busy integer;
  v_soonest timestamptz;
  v_max_rooms constant integer := 240;
begin
  if p_action not in ('status','claim','release') or
     p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status','invalid');
  end if;

  v_hash := encode(sha256(decode(p_token,'hex')),'hex');
  -- A short transaction lock coordinates claims, releases and resume checks.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('haemungi-temporary-ritual-room')
  );
  v_time := clock_timestamp();
  select * into v_slot
    from hm_private.hm_temporary_ritual_slot
    where owner_hash=v_hash and expires_at>v_time
    order by expires_at desc limit 1 for update;

  if p_action='release' then
    if v_slot.room_key is null then
      return jsonb_build_object('status','not_owner');
    end if;
    update hm_private.hm_temporary_ritual_slot
      set memorial_id=null,owner_hash=null,expires_at=null,updated_at=v_time
      where room_key=v_slot.room_key;
    return jsonb_build_object('status','released');
  end if;

  -- The same visitor cannot extend or switch an active reservation by claiming again.
  if v_slot.room_key is not null then
    return jsonb_build_object('status','active',
      'room_key',v_slot.room_key,'memorial_id',v_slot.memorial_id,
      'expires_at',v_slot.expires_at);
  end if;

  select count(*),count(*) filter(where expires_at>v_time),
         min(expires_at) filter(where expires_at>v_time)
    into v_count,v_busy,v_soonest
    from hm_private.hm_temporary_ritual_slot;

  if p_action='status' then
    if v_busy < v_count or v_count < v_max_rooms then
      return jsonb_build_object('status','available',
        'rooms_in_use',v_busy,'rooms_total',v_count);
    end if;
    return jsonb_build_object('status','occupied','expires_at',v_soonest,
      'rooms_in_use',v_busy,'rooms_total',v_count);
  end if;

  -- Only published, public records without a fixed niche can use these rooms.
  if p_memorial_id is null or not exists(
    select 1 from public.hm_memorial_public
    where id=p_memorial_id and slot_index is null
  ) then
    return jsonb_build_object('status','not_eligible');
  end if;

  select * into v_slot
    from hm_private.hm_temporary_ritual_slot
    where expires_at is null or expires_at<=v_time
    order by room_key limit 1 for update;

  if v_slot.room_key is null then
    if v_count>=v_max_rooms then
      return jsonb_build_object('status','occupied','expires_at',v_soonest,
        'rooms_in_use',v_busy,'rooms_total',v_count);
    end if;
    insert into hm_private.hm_temporary_ritual_slot(room_key)
      values('room-'||lpad((v_count+1)::text,4,'0'))
      returning * into v_slot;
  end if;

  update hm_private.hm_temporary_ritual_slot
    set memorial_id=p_memorial_id,owner_hash=v_hash,
        expires_at=v_time+interval '10 minutes',updated_at=v_time
    where room_key=v_slot.room_key returning * into v_slot;

  return jsonb_build_object('status','active',
    'room_key',v_slot.room_key,'memorial_id',v_slot.memorial_id,
    'expires_at',v_slot.expires_at);
end;
$$;

-- Keep the private table inaccessible to the browser; only the existing
-- narrow public RPC can manage a booking.
revoke all on hm_private.hm_temporary_ritual_slot from public,anon,authenticated;
revoke all on function hm_private.temporary_ritual_manage(text,text,uuid) from public;
grant execute on function hm_private.temporary_ritual_manage(text,text,uuid) to anon,authenticated;
commit;
