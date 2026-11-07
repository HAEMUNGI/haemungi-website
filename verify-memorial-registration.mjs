import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const read=(path)=>readFileSync(path,'utf8');
const html=read('dist/memorial.html'),archive=read('dist/memorial-archive.html'),kiosk=read('dist/memorial-communal.html');
const main=read('dist/memorial.js'),register=read('dist/memorial-registration.js');
const admin=read('dist/memorial-admin.js'),sql=read('016_haemungi_memorial_public_registration.sql');
const edge=read('supabase/functions/memorial-self-register/index.ts');
new Script(main);new Script(register);new Script(admin);

for(const id of ['hallWing','hallOccupancy','applicationForm','openPassportReward'])
  assert(html.includes(`id="${id}"`),`Missing UI control: ${id}`);
for(const id of ['openVisitorLogin','visitorLoginDialog','closeVisitorLogin','quickLoginForm',
  'quickLoginEmail','quickLoginPassword','quickLoginSubmit','quickSignup','quickLoginStatus',
  'quickAccountArea','quickAccountEmail','quickManageMemories','quickLogout'])
  assert(html.includes(`id="${id}"`),`Missing accessible entrance login: ${id}`);
for(const id of ['archiveAuth','archiveLogin','archiveAuthStatus'])
  assert(html.includes(`id="${id}"`),`Missing verified-email archive control: ${id}`);
assert.match(html,/aria-haspopup="dialog"/,'Header must identify the sign-in dialog');
assert.match(register,/loginDialog\.showModal\(\)/,'Header login opens a dedicated dialog');
assert.match(register,/authenticate\(false,\{email,password\}\)/,'Quick login must reuse existing Supabase Auth');
assert.match(register,/authenticate\(true,\{email,password\}\)/,'Quick signup must reuse existing account flow');
assert.match(register,/location\.hash='#apply'/,'Signed-in user can navigate to archive registration');
assert.match(register,/logout\?scope=local/,'Sign-out attempts local session revocation');
assert.match(register,/get\('login'\)==='1'/,'Deep link must open the login dialog');
assert.match(archive,/memorial\.html\?login=1#entrance/,'Archive exposes a login entry');
assert.match(kiosk,/memorial\.html\?login=1#entrance/,'Communal kiosk exposes a login entry');
for(const file of ['memorial-registration.js','memorial-privacy.html'])
  assert(html.includes('/'+file),`Missing published resource: ${file}`);
assert.match(html,/14곳을 둘러보면 안식관 명패를 선물합니다/,'Passport reward is advertised');
assert(!html.includes('value="plaque"'),'Old direct plaque booking is not available');
assert.match(html,/후원 추억의 방은 별도 문의/,'Premium remains inquiry-only');
assert.match(archive,/이메일 인증 후.*관리자 승인 없이 바로 공개됩니다/,'Archive email check and no administrator approval');
assert(!html.includes('로그인 없이'), 'Archive must no longer claim anonymous immediate publication');
assert(!kiosk.includes('로그인 없이 등록'), 'Kiosk must explain verified-email registration');
assert.match(main,/slot_index=gte\./,'Hall query bounded below');
assert.match(main,/slot_index=lte\./,'Hall query bounded above');
assert.match(main,/activeWing-1\)\*12/,'Hall wing offset preserved');
assert.match(admin,/alreadyPublished\.length/,'Archive must reuse the photo');
assert.match(admin,/limit=25&offset=/,'Admin plaque pagination');
assert.match(register,/compressImage\(file\)/,'WebP optimization');
assert.match(register,/memorial-self-register/,'Server-side public registration');
assert.match(register,/Authorization:'Bearer '\+jwt/,'Free archive must send the verified visitor token');
assert.match(register,/visitor\?\.user\?\.email\?\.toLowerCase\(\)!==email/,'Client requires matching account email');
assert.match(register,/누구나 검색하고 열람할 수 있습니다.*공개하시겠습니까/,'Explicit confirmation before irreversible public archive submission');
assert(!register.includes('hm_memorial_request_archive_plaque'),'Direct plaque RPC must not be called');
assert(!register.includes('hm-memorial-inbox'),'Old private plaque upload path must not be called');
assert.match(register,/HAEMUNGI_PASSPORT_OPEN_REWARD/,'Old plaque clicks must open passport');
assert.match(sql,/mem_requests_owner_apply/,'Owner insert RLS');
assert.match(sql,/hm_memorial_pending_requested_slot_unique/,'Pending slot uniqueness');
assert.match(sql,/hm_memorial_wings\(/,'Expandable wing availability');
assert.match(sql,/hm_memorial_self_publish\(/,'Server-owned instant registration');
assert.match(sql,/p_ip_digest/,'Abuse guard');
assert.match(sql,/revoke all on function public\.hm_memorial_self_publish/,'No anonymous privileged RPC');
assert.match(edge,/checkWebP\(bytes\)/,'File magic and size verification');
assert.match(edge,/allowedOrigins\.has\(origin\)/,'CORS gate');
assert.match(edge,/SUPABASE_SERVICE_ROLE_KEY/,'Server-only service credential');
assert.match(edge,/supabase\.auth\.getUser\(match\[1\]\)/,'Server validates each JWT independently');
assert.match(edge,/!user\.email_confirmed_at/,'Unverified email must not publish');
assert.match(edge,/user\.email\.trim\(\)\.toLowerCase\(\) !== email/,'Server blocks forged contact emails');
assert.match(edge,/authorization, content-type/,'Preflight permits authenticated submission');
assert.match(admin,/명패를 .*호에 공개하시겠습니까/,'Administrator confirms public plaque placement');
assert(!register.includes('SUPABASE_SERVICE_ROLE_KEY'),'Server credential must not appear in browser');
assert(!/레오|2025-11-10|2026-07-01/.test(html+register),'No original memorial private details in registration');
console.log('PASS memorial registration: verified email + immediate archive, authenticated owner, one photo, passport reward, premium inquiry, anti-abuse, privacy notice.');
