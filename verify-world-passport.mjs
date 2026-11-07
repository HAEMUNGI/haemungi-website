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
// All 17 printable pages are one shared cover, one atlas, 14 un-cropped
// destination photographs and a dynamic completion certificate.
for(const name of ['luxury-cover.webp','luxury-paper.webp','luxury-atlas.webp']){
  const image=readFileSync(`dist/assets/world-passport/${name}`);
  assert.equal(image.subarray(0,4).toString('ascii'),'RIFF',`${name} is a RIFF WebP`);
  assert.equal(image.subarray(8,12).toString('ascii'),'WEBP',`${name} WebP signature`);
  assert(image.length>100000,`${name} premium detailed art is present`);
  assert(passport.includes(`'${name}'`),`Shared page renderer uses ${name}`);
}
assert.match(passport,/if\(index===0\)return coverArtwork\(\)/,'Passport front uses the canonical cover');
assert.match(passport,/aboutPreview\.innerHTML=coverArtwork\(\)/,'About preview reuses exactly the same cover markup');
assert.match(passport,/if\(index===16\)/,'The final printable page exists');
assert.match(passport,/const stop=stops\[index-2\]/,'Exactly 14 destination pages are generated');
for(const id of stops)assert.match(passport,new RegExp(`${id}:'`),`Uncropped source art mapping for ${id}`);
assert(passport.includes("christmas:'christmas-square.jpg'"),'Christmas passport page uses the browser-tested warm JPEG, not the unreliable WebP');
assert(read('dist/christmas.js').includes("img:'/assets/christmas-square.jpg'"),'Christmas destination matches the same proven site artwork');
assert.match(passport,/hm-premium-seal-earned/,'Real stamps replace printed static placeholders');
assert.match(passport,/hm-premium-visit-link/,'Each destination opens its real page');
assert.match(passport,/hm-premium-final-count/,'Completion total derives from live server stamps');
assert.match(menu,/id="page-about"[\s\S]*?id="hmPassportAboutOpen"/,'About page provides passport invitation');
assert(menu.includes('id="hmPassportAboutCover"'),'About page features canonical passport cover');
assert(menu.includes('/assets/world-passport/luxury-atlas.webp'),'About page previews same world atlas');
assert(!menu.includes('haemungi-passport-intro.jpg'),'Outdated inconsistent intro illustration removed');
assert.match(css,/\.hm-passport-book\{/,'Passport is a bounded book rather than a scroll of stamps');
assert.match(css,/\.hm-premium-picture img\{[^}]*object-fit:contain/,'All destination artwork displayed uncropped');
assert.match(css,/\.hm-premium-cover>img\{[^}]*object-fit:contain/,'Cover is full-height, not cropped');
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
