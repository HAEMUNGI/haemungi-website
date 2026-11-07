import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const read=path=>readFileSync(path,'utf8');
const passport=read('dist/world-passport.js');
const css=read('dist/world-passport.css');
const sql=read('019_haemungi_world_passport.sql');
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
assert.match(passport,/role="img" aria-label="가운데 헤뭉이 마을/,'Accessible map is inside passport');
assert.match(css,/\.hm-passport-book\{/,'Passport is a bounded book rather than a scroll of stamps');
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
assert(!memorial.includes('hm_memorial_request_archive_plaque'),'Old client path is gone');
assert(!read('dist/memorial.html').includes('value="plaque"'),'Manual plaque booking no longer offered');
assert(privacy.includes('14개 방문 도장'),'Public privacy disclosure describes passport');
console.log('PASS world passport: 14 real menu stops, book/map/stamps, 4-second visit, authenticated consent, server-only atomic plaque reward, 001/pending protection, no legacy self-booking.');
