import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {cleanPetQuery,photoForPublicPet,formatRemaining,isRoomEligible} from './dist/memorial-communal-core.mjs';

const read=path=>readFileSync(path,'utf8');
const html=read('dist/memorial-communal.html');
const js=read('dist/memorial-communal.js');
const css=read('dist/memorial-communal.css');
const sql=read('014_haemungi_communal_hall.sql');
const entry=read('dist/memorial.html');
const admin=read('dist/memorial-admin.js');

assert.match(entry,/href="\/memorial-communal\.html\?tour=1"/);
for(const id of ['hallTour','hallPoster','hallEntry','kioskHotspot','kioskDialog',
  'hallMessageForm','hallMessageList','petSearchForm','petSearchResults',
  'reserveRoom','ritualView','temporaryPetPhoto','ritualRemaining','endRitual']){
  assert.match(html,new RegExp('id="'+id+'"'),'Missing '+id);
}
assert.match(html,/src="\/memorial\/communal-hall\.mp4"/);
assert.match(html,/src="\/memorial\/ritual-last\.jpg"/);
assert.match(css,/\.temporary-monitor\{position:absolute;left:18%;top:31\.1%;width:64%;height:20%/);
for(const name of ['communal-hall.mp4','communal-hall-poster.webp','communal-hall-final.webp']){
  assert.ok(statSync('dist/memorial/'+name).size>60000,'Missing or empty '+name);
}
const video=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries',
  'format=duration:stream=width,height','-of','json','dist/memorial/communal-hall.mp4'],{encoding:'utf8'}));
assert.ok(Math.abs(Number(video.format.duration)-10)<.2,'Video must run for 10 seconds');
assert.equal(video.streams.find(s=>s.width)?.width,720);
assert.equal(video.streams.find(s=>s.height)?.height,1280);
assert.equal(cleanPetQuery('<script>레오_%'), 'script레오');
assert.equal(formatRemaining(600000),'10:00');
assert.equal(formatRemaining(-2000),'00:00');
assert.equal(isRoomEligible({id:'a',slot_index:null}),true);
assert.equal(isRoomEligible({id:'a',slot_index:1}),false);
assert.equal(photoForPublicPet({photo_path:'../../secret.jpg'},'https://example.supabase.co'),'');
assert.equal(photoForPublicPet({photo_path:'approved/65123d76-a511-47cb-8125-7d4863eac0ab.jpg'},''),'/memorial/leo-tribute.jpg');

assert.match(js,/hm_memorial_public\?/);
assert.match(js,/photoForPublicPet/);
assert.match(js,/isRoomEligible/);
assert.match(js,/hm_temporary_ritual_manage/);
assert.match(js,/hm_hall_message_submit/);
assert.match(js,/setInterval\(checkRemaining,1000\)/);
assert.match(js,/if\(left<=0\)/);
assert.match(js,/status:'pending'|status!=='pending'/);
assert.match(admin,/hm_memorial_hall_messages/);
assert.match(sql,/interval '10 minutes'/);
assert.match(sql,/perform pg_catalog.pg_advisory_xact_lock/);
assert.match(sql,/where id=p_memorial_id and slot_index is null/);
assert.match(sql,/if v_slot.expires_at>v_time then/);
assert.match(sql,/owner_hash=v_hash/);
assert.match(sql,/create policy "hall_approved_or_admin_read"/);
assert.match(sql,/security definer set search_path=''/);
assert.match(sql,/create schema if not exists hm_private/);
assert.match(sql,/revoke all on hm_private.hm_temporary_ritual_slot from public,anon,authenticated/);
assert.ok(!/service_role|private\/incoming/i.test(js),'Browser code must not use privileged keys or pending uploads');
console.log('PASS communal memorial hall: exact 10-second video, source stills, public-only search, moderated messages, transactional 10-minute booking, existing ritual image.');
