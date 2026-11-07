import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {createHash} from 'node:crypto';

const read=path=>readFileSync(path,'utf8');
const passport=read('dist/world-passport.js');
const css=read('dist/world-passport.css');
const sql=read('019_haemungi_world_passport.sql');
const sqlService=read('020_haemungi_world_passport_service_permissions.sql');
const edge=read('supabase/functions/world-passport/index.ts');
const memorial=read('dist/memorial-registration.js');
const privacy=read('dist/memorial-privacy.html');
new Script(passport);
new Script(memorial);

const stops=['home','videos','cards','daily','goods','room','about','today','creator','emoticons','playground','memorial','temple','christmas'];
for(const id of stops){
  assert.match(passport,new RegExp(`\\['${id}',`),`Passport missing ${id}`);
  assert(edge.includes(`'${id}'`),`Edge allowlist missing ${id}`);
  assert(sql.includes(`'${id}'`),`DB allowlist missing ${id}`);
}
const menu=read('dist/index.html');
for(const id of stops.slice(0,10))assert(menu.includes(`data-page="${id}"`),`Missing site route ${id}`);
for(const id of stops.slice(10))assert(menu.includes(`${id}.html`),`Missing linked site route ${id}`);
for(const name of ['index','playground','memorial','temple','christmas']){
  const html=read(`dist/${name}.html`);
  for(const asset of ['world-passport.css','world-passport.js','content-config.js'])
    assert(html.includes(asset),`Missing ${asset} on ${name}`);
}
assert.match(passport,/haemungi:visitor/,'Passport reflects login state');
assert.match(memorial,/dispatchEvent\(new Event\('haemungi:visitor'\)\)/,'Registration publishes login changes');
assert.match(passport,/setTimeout\(\(\)=>\{if\(currentStop\(\)===stop\)stampStop\(stop\);\},4000\)/,'Only sustained visits are stamped');
assert.match(passport,/document\.visibilityState==='hidden'/,'Hidden tab cannot earn a stamp');
assert.match(passport,/request\('claim',\{memorial_id:select\.value,consent:true\},jwt\)/,'Claims carry verified email session and consent');
assert.match(passport,/window\.HAEMUNGI_PASSPORT_OPEN_REWARD/,'Legacy plaque route opens passport reward');
const passportArt=[
  ['01_cover.png','f6d8194cdd8f571b21757fc2fa5cb56f2609ce9864cd42aebe8c377aa5334afe'],
  ['02_guide.png','1a54c3c5962a89a9c07d5598c8e25048cb7bf6ca7a95f224eefb0b394c220ec8'],
  ['03_visit_01.png','0cfe8ab0de228c57443f96dcc0680216ef9ddfb90b9327a1e90ea6a519997c4c'],
  ['04_visit_02.png','df288511c4b58c50f44934620dc4068a437217969880b9ba56a5a9df72b993ac'],
  ['05_visit_03.png','6d1a5b00f364299216e62e644048cdf808c581ccdd098d8aacd34b360e7215e3'],
  ['06_visit_04.png','00873d93fe626afab6693a532241257f9320b32091c2950f6177bff6db4aee53'],
  ['07_visit_05.png','3ddc66bf7ff19e1962a90b55a8221e92c8dd5d51f128d465ba911659320b23ce'],
  ['08_visit_06.png','ed7d98acf160e2041f3a14f87afa6a4a75e38a3157b36288e14d7da5424a7b4c'],
  ['09_visit_07.png','b242d92b1d426a5f06abb51b960c826a0b415409935082f864726dec7bae81f9'],
  ['10_visit_08.png','fa2a560f22467dddb96ca0965d367841e997fba180fdbc040dfa22da902a4a58'],
  ['11_visit_09.png','f64943db1635e0d60dc677ab809a5ea33c48a21eb7b47a59d04e6fe044080601'],
  ['12_visit_10.png','5fcf4fb47bcaaf2710d14a63f8d3ed000cbad891b34afcf4cc1a5f2025f2aac8'],
  ['13_visit_11.png','fb3b828f5215f7a45dd02d810bf8fa49481db81cf59a8ea12b65aa9bc5c93dbd'],
  ['14_visit_12.png','8921796aa9db379b7614382a463675f1d631212ca5977641811f079c3e07c0c2'],
  ['15_visit_13.png','1933688c932f4ae6de16e228f2c3bca7a74be7c3f2baeeb599bf0583f1ff5efb'],
  ['16_visit_14.png','aaced8ead849d26d89e740df81645ec9364d9add5c6e68bfff498f590611b3f1'],
  ['17_final.png','7bf227de5eb98d12f1cfc3c5e50e2c679aecdf7dc93c7dc38038ba85e4893e82'],
];
assert.equal(passportArt.length,17,'Exactly 17 illustrated passport pages');
for(const [name,expected] of passportArt){
  assert(passport.includes(`'${name}'`),`Client missing illustrated page ${name}`);
  const png=readFileSync(`dist/assets/world-passport/${name}`);
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a',`${name} PNG signature`);
  assert.equal(png.readUInt32BE(16),900,`${name} width`);
  assert.equal(png.readUInt32BE(20),1350,`${name} height`);
  assert.equal(createHash('sha256').update(png).digest('hex'),expected,`${name} original artwork bytes`);
}
assert.match(passport,/hm-passport-art-stamp/,'Dynamic stamps overlay the original artwork');
assert.match(passport,/hm-passport-art-link/,'Illustrated visit buttons remain interactive');
assert.match(passport,/hm-passport-final-count/,'Static final page 0\/14 replaced with actual progress');
assert.match(passport,/hm-passport-art-pagination/,'Static page progress replaced with real counts');
const introArtwork=readFileSync('dist/assets/haemungi-passport-intro.jpg');
assert.equal(createHash('sha256').update(introArtwork).digest('hex'),'77e79f483f0b087605670da5bf26b413b449e85ff562bf3df1a3f0489b765026','Original separate intro artwork bytes');
assert.match(menu,/id="page-about"[\s\S]*?id="hmPassportAboutOpen"/,'About page provides passport invitation');
assert(menu.includes('/assets/haemungi-passport-intro.jpg'),'Separate landscape image appears in the HAEMUNGI introduction');
assert.match(css,/\.hm-passport-book\{/,'Passport is a bounded book rather than a scroll of stamps');
assert.match(css,/object-fit:contain/,'Page artwork displayed uncropped');
assert.match(edge,/allowedOrigins\.has\(origin\)/,'CORS origin allowlist');
assert.match(edge,/supabase\.auth\.getUser\(match\[1\]\)/,'JWT validated by Auth backend');
assert.match(edge,/user\.email_confirmed_at/,'Verified email required');
assert.match(edge,/body\.consent!==true/,'Explicit public consent required');
assert.match(edge,/crypto\.subtle\.sign\('HMAC'/,'Passport token is HMAC hashed server side');
assert.match(sql,/enable row level security/,'RLS enabled');
assert.match(sql,/revoke all on public\.hm_world_passports from public,anon,authenticated/,'Passport records cannot be queried by visitors');
assert.match(sql,/jsonb_object_keys\(v_pass\.stamps\)\)<>14/,'Exactly fourteen server-side stamps required');
assert.match(sql,/email_confirmed_at/,'Email verified inside transaction');
assert.match(sql,/lower\(v_request\.contact_email\)<>lower\(v_email\)/,'Cannot claim another guardian’s record');
assert.match(sql,/v_request\.consent_declaration is distinct from true/,'Only consented archive records qualify');
assert.match(sql,/pg_advisory_xact_lock\(46821002\)/,'Slot reservation is serialized');
assert.match(sql,/generate_series\(2,30000\)/,'Reserved 001 slot is never auto allocated');
assert.match(sql,/r\.status='pending'/,'Existing pending plaque requests are protected');
assert.match(sql,/hm_world_passports_one_reward_per_account/,'One reward per verified account');
assert.match(sql,/drop policy if exists "mem_requests_owner_apply"/,'Old direct booking policy disabled');
assert.match(sql,/revoke execute on function public\.hm_memorial_request_archive_plaque/,'Old direct booking RPC disabled');
assert.match(sqlService,/revoke all on function public\.hm_world_passport_stamp\(uuid,text,text\) from public,anon,authenticated/,'Stamp is server-only after the live permission fix');
assert.match(sqlService,/grant execute on function public\.hm_world_passport_claim\(uuid,text,uuid,uuid\) to service_role/,'Only server may allocate plaques');
assert(!sqlService.includes("current_setting('request.jwt.claim.role'"),'Supabase secret-key service calls must not rely on a missing JWT role claim');
assert(!memorial.includes('hm_memorial_request_archive_plaque'),'Old client path is gone');
assert(!read('dist/memorial.html').includes('value="plaque"'),'Manual plaque booking no longer offered');
assert(privacy.includes('14개 방문 도장'),'Public privacy disclosure describes passport');
console.log('PASS world passport: 14 real menu stops, book/map/stamps, 4-second visit, authenticated consent, server-only atomic plaque reward, 001/pending protection, no legacy self-booking.');
