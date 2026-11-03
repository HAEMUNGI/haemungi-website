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
const daylightHero = 'dist/memorial/spring-garden-20261104.jpg';
const mediaAdminSql=text('009_haemungi_memorial_media_admin.sql');
const gardenAdminSql=text('010_haemungi_memorial_garden_backdrop.sql');
const approvedFirstPortrait = 'dist/memorial/leo-tribute.jpg';
assert(existsSync(new URL(daylightHero,import.meta.url)), 'Daylight entrance asset missing');
assert(existsSync(new URL(approvedFirstPortrait,import.meta.url)), 'Approved first memorial image missing');
assert.equal(createHash('sha256').update(file(approvedFirstPortrait)).digest('hex'),
  '28ebd10967e14169a543b4bfbc4d94344e8ced04a5483d1e6cf1f87bd4ab870e',
  'Approved tribute artwork changed');
assert.equal(createHash('sha256').update(file(daylightHero)).digest('hex'),
  'a02ad35d9123b1bdfccdb95f49772cd80ef2018720495e8b49ecff5fe191041a',
  'Approved spring garden asset changed');
assert(text('dist/memorial.css').includes("url('/memorial/spring-garden-20261104.jpg')"),'Surrounding spring garden background not connected');
assert(text('dist/memorial.css').includes("url('/memorial/entrance-daylight.png')"),'Approved entrance building must remain centered');
assert(html.includes('poster="/memorial/entrance-daylight.png"'),'Original entrance poster changed');
assert(js.includes('refreshSceneArt()') && js.includes('hm_memorial_scene_settings?select='),'Dynamic scene rendering absent');
assert(adminJs.includes('renderSceneSettings') && adminJs.includes('uploadPublicImage'),'Admin scene asset controls absent');
assert(adminJs.includes('frame_focus_x') && js.includes('pet.frame_focus_x'),'Public frame editing absent');
assert(mediaAdminSql.includes('enable row level security') && mediaAdminSql.includes('mem_scene_admin_insert') &&
  mediaAdminSql.includes('mem_scene_storage_admin_insert'),'Scene authorization missing');
assert(gardenAdminSql.includes('garden_backdrop'),'Garden admin setting missing');
const interactions=text('008_haemungi_memorial_interactions.sql');
assert(html.includes('id="altarFlowers"') && html.includes('id="offeringStatus"'),'Offering UI absent');
assert(html.includes('data-flower-kind="white"') && html.includes('data-flower-kind="peach"') && html.includes('data-flower-kind="gold"'),'Flower options absent');
assert(js.includes('nicheArtCorners') && js.includes('paintNicheArt') && js.includes('publicPhoto(pet.photo_path)'),'Projected artwork must bind public photo');
assert(js.includes("artwork.width=0;artwork.height=0") && js.includes("frameInverse(frameHomography(q))"),'Canvas projection must be initialized safely');
assert(!js.includes('niche-portrait') && !text('dist/memorial.css').includes('.niche-portrait'),'Floating rectangular photo overlay must stay removed');
assert(js.includes("hm_memorial_offerings?select=") && js.includes("restPOST('hm_memorial_offerings'"),'Offering read and write absent');
assert(text('dist/memorial.css').includes('.niche-art-canvas') && text('dist/memorial.css').includes('.altar-flowers'),'Scene overlays missing');
assert(interactions.includes('alter table public.hm_memorial_offerings enable row level security;'),'Offerings RLS missing');
assert(interactions.includes("to anon using (status='approved')"),'Anonymous letter policy regression');
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
for(const id of ['requestList','publishedList','letterAdminList','sceneSettings','offeringAdminList'])
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
console.log('PASS: 6 original media hashes, approved tribute and new garden hashes, JS syntax, scene controls, frame editing, RLS, privacy gates.');
