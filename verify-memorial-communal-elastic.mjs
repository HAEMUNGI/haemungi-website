import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=path=>readFileSync(path,'utf8');
const sql=read('015_haemungi_communal_elastic_rooms.sql');
const communal=read('dist/memorial-communal.js');
const html=read('dist/memorial-communal.html');
const memorial=read('dist/memorial.html');
const archive=read('dist/memorial-archive.html');

// Existing shared room and active bookings must survive the migration.
assert.match(sql,/room_key = 'shared'/);
assert.doesNotMatch(sql,/drop table|truncate table/i);
assert.match(sql,/room_key ~ '\^room-\[0-9\]\{4\}\$'/);
assert.match(sql,/insert into hm_private\.hm_temporary_ritual_slot\(room_key\)/);
assert.match(sql,/v_max_rooms constant integer := 240/);
assert.match(sql,/where expires_at is null or expires_at<=v_time/);
assert.match(sql,/where owner_hash=v_hash and expires_at>v_time/);
assert.match(sql,/pg_advisory_xact_lock/);
assert.match(sql,/for update/);
assert.match(sql,/interval '10 minutes'/);
assert.match(sql,/where id=p_memorial_id and slot_index is null/);
assert.match(sql,/revoke all on hm_private\.hm_temporary_ritual_slot from public,anon,authenticated/);
assert.match(sql,/security definer set search_path=''/);

// A visitor can only return to their existing booking, never renew it by retrying.
const reuseIndex=sql.indexOf("if v_slot.room_key is not null then");
const newLeaseIndex=sql.indexOf("expires_at=v_time+interval '10 minutes'");
assert.ok(reuseIndex>=0&&newLeaseIndex>reuseIndex);

// The kiosk and premium routes clearly explain the tiers and 10-minute limit.
assert.match(html,/가족마다 독립적인 임시 제례실/);
assert.match(html,/id="ritualRoomLabel"/);
assert.match(communal,/room_key/);
assert.match(communal,/rooms_in_use/);
assert.match(communal,/setInterval\(checkRemaining,1000\)/);
assert.match(memorial,/후원 추억의 방은 별도 문의/);
assert.match(memorial,/별도 문의 · 프리미엄/);
assert.match(archive,/후원 추억의 방/);
assert.match(memorial,/mailto:say3589@naver\.com/);
assert.doesNotMatch(communal,/service_role|private\/incoming/i);
execFileSync('node',['--check','dist/memorial-communal.js']);

console.log('PASS elastic memorial: legacy room preserved, bounded auto-expand, independent 10-minute booking, premium inquiry guidance.');
