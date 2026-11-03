import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';

const file=name=>readFileSync(new URL(name,import.meta.url));
const text=name=>file(name).toString('utf8');
const html=text('dist/memorial.html');
const admin=text('dist/memorial-admin.html');
const js=text('dist/memorial.js');
const adminJs=text('dist/memorial-admin.js');
const sql=text('007_haemungi_starlight_memorial.sql');
const index=text('dist/index.html');
const adminHome=text('dist/admin.html');
const translations=text('dist/translations.js');
const files=[
  [
    "dist/memorial/entrance.mp4",
    "745654a68b808b478994055059ea02f4471976553f5e0554fb85389b0fbca807"
  ],
  [
    "dist/memorial/hall.mp4",
    "0c6e80887450290ee029896a854af413dc1267a6f87b245a5e26eee0e80d0331"
  ],
  [
    "dist/memorial/ritual.mp4",
    "e5a55a4b023a36bc2335ed4760d2ea1e270e26780ee97193ec910fe3f7bd89a3"
  ],
  [
    "dist/memorial/entrance-last.jpg",
    "8882c78aee2e20c91dbe48b96c6f9c036b1bb7211a8478de3c651e18f6ccb8af"
  ],
  [
    "dist/memorial/hall-last.jpg",
    "959e6d2f55ad2eac7d946646068d91bb7aef11ebe03e509d66587490021b7098"
  ],
  [
    "dist/memorial/ritual-last.jpg",
    "7e9bc43cc03969fb6f160da35ee5fa6dc76052ea2ee339d342158cdf97d73065"
  ]
];
for(const [path,hash] of files){
  assert(existsSync(new URL(path,import.meta.url)), 'Missing '+path);
  assert.equal(createHash('sha256').update(file(path)).digest('hex'),hash,'Original media changed: '+path);
}
for(const [name,code] of [['memorial.js',js],['memorial-admin.js',adminJs]])
  assert.doesNotThrow(()=>new Script(code,{filename:name}),name+' syntax');
for(const id of ['entranceVideo','hallVideo','ritualVideo','hallSlots','memorialMonitor','applicationForm','letterForm'])
  assert(html.includes('id="'+id+'"'),'Missing visitor UI '+id);
for(const id of ['requestList','publishedList','letterAdminList'])
  assert(admin.includes('id="'+id+'"'),'Missing admin UI '+id);
for(const path of ['memorial.css','memorial.js','memorial/entrance.mp4','memorial/hall.mp4','memorial/ritual.mp4'])
  assert(html.includes('/'+path),'Missing reference '+path);
assert(index.includes('href="/memorial.html"'),'Official home menu');
assert(adminHome.includes('href="/memorial-admin.html"'),'Owner administration menu');
assert(translations.includes('["별빛 추모관","Starlight Memorial"'),'Locale entry');
for(const table of ['hm_memorial_requests','hm_memorial_public','hm_memorial_letters'])
  assert(sql.includes('alter table public.'+table+' enable row level security;'),'Missing RLS '+table);
assert(sql.includes("status='pending' and consent_declaration=true"),'Pending-only anonymous applications');
assert(sql.includes("owner_consent_verified=false"),'Consent gate');
assert(!/레오|2025-11-10|2026-07-01/.test(html+js+admin+adminJs+sql),'Private memorial identity exposed in public code');
assert(!/sb_secret_|service_role/i.test(html+js+admin+adminJs),'No privileged browser secret');
console.log('PASS: 6 media hashes, 2 JS syntax, 7 visitor controls, 3 admin controls, privacy gates, and original assets preserved.');
