import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const read=(path)=>readFileSync(path,'utf8');
const html=read('dist/memorial.html'),archive=read('dist/memorial-archive.html');
const main=read('dist/memorial.js'),register=read('dist/memorial-registration.js');
const admin=read('dist/memorial-admin.js'),sql=read('016_haemungi_memorial_public_registration.sql');
const edge=read('supabase/functions/memorial-self-register/index.ts');
new Script(main);new Script(register);new Script(admin);

for(const id of ['hallWing','hallOccupancy','plaqueApplication','plaqueWing','plaqueSlotPicker',
  'visitorPassword','visitorLogin','visitorSignup','visitorLogout','upgradeArchiveBox',
  'myArchiveRecords','upgradeArchive','applicationForm'])
  assert(html.includes(`id="${id}"`),`Missing UI control: ${id}`);
for(const file of ['memorial-registration.js','memorial-privacy.html'])
  assert(html.includes('/'+file),`Missing published resource: ${file}`);
assert.match(html,/value="archive" checked/,'Archive-first, no admin approval');
assert.match(html,/value="plaque"/,'Separate login and admin approval');
assert.match(html,/후원 추억의 방은 별도 문의/,'Premium remains inquiry-only');
assert.match(archive,/승인 없이 바로 공개됩니다/,'Archive transparency');
assert.match(main,/slot_index=gte\./,'Hall query bounded below');
assert.match(main,/slot_index=lte\./,'Hall query bounded above');
assert.match(main,/activeWing-1\)\*12/,'Hall wing offset preserved');
assert.match(admin,/alreadyPublished\.length/,'Archive must reuse the photo');
assert.match(admin,/limit=25&offset=/,'Admin plaque pagination');
assert.match(register,/compressImage\(file\)/,'WebP optimization');
assert.match(register,/memorial-self-register/,'Server-side public registration');
assert.match(register,/session_token/,'Authenticated plaque submission');
assert.match(register,/hm_memorial_request_archive_plaque/,'No duplicate photo for archive upgrade');
assert.match(register,/sequence!==slotLoadSeq/,'Concurrent slot loads must not duplicate controls');
assert.match(register,/skipWingLoad:true/,'Selecting a plaque must not launch duplicate wing fetches');
assert.match(sql,/mem_requests_owner_apply/,'Owner insert RLS');
assert.match(sql,/hm_memorial_pending_requested_slot_unique/,'Pending slot uniqueness');
assert.match(sql,/hm_memorial_wings\(/,'Expandable wing availability');
assert.match(sql,/hm_memorial_self_publish\(/,'Server-owned instant registration');
assert.match(sql,/p_ip_digest/,'Abuse guard');
assert.match(sql,/revoke all on function public\.hm_memorial_self_publish/,'No anonymous privileged RPC');
assert.match(edge,/checkWebP\(bytes\)/,'File magic and size verification');
assert.match(edge,/allowedOrigins\.has\(origin\)/,'CORS gate');
assert.match(edge,/SUPABASE_SERVICE_ROLE_KEY/,'Server-only service credential');
assert(!register.includes('SUPABASE_SERVICE_ROLE_KEY'),'Server credential must not appear in browser');
assert(!/레오|2025-11-10|2026-07-01/.test(html+register),'No original memorial private details in registration');
console.log('PASS memorial registration: archive immediate, 12/wing availability, authenticated owner/RLS, one photo, admin archive upgrade, premium inquiry, anti-abuse, privacy notice.');
