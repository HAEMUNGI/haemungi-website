import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {WALK_IDENTITY_KEY,FELT_AVATARS,MAX_WALK_NICKNAME,
  cleanWalkNickname,cleanWalkIdentity,genderForTone} from './dist/memorial-walk-identity.mjs';

assert.equal(WALK_IDENTITY_KEY,'haemungi-walk-identity-v1');
assert.equal(MAX_WALK_NICKNAME,12);
assert.deepEqual(Object.keys(FELT_AVATARS),['male','female']);
assert.equal(cleanWalkNickname('  별빛  산책자  '),'별빛 산책자');
assert.equal(cleanWalkNickname('<script>태그</script>'),'script태그/scr');
assert.equal(cleanWalkNickname('가'.repeat(30)),'가'.repeat(12));
assert.equal(cleanWalkNickname(null),'');
assert.equal(cleanWalkIdentity({gender:'female',nickname:' 꽃길 '} ).nickname,'꽃길');
assert.equal(cleanWalkIdentity({gender:'male',nickname:'별빛'}).gender,'male');
assert.equal(cleanWalkIdentity({gender:'constructor',nickname:'X'}),null);
assert.equal(cleanWalkIdentity({gender:'female',nickname:'  '}),null);
assert.equal(genderForTone(1),'female');
assert.equal(genderForTone(3),'female');
assert.equal(genderForTone(0),'male');

for(const item of Object.values(FELT_AVATARS)){
  for(const src of [item.idle,item.step]){
    const local='dist'+src;
    const bytes=readFileSync(local);
    assert.equal(bytes.toString('ascii',0,4),'RIFF');
    assert.equal(bytes.toString('ascii',8,12),'WEBP');
    assert.ok(statSync(local).size>10_000&&statSync(local).size<100_000);
  }
}
const html=readFileSync('dist/memorial-walk.html','utf8');
const js=readFileSync('dist/memorial-walk.js','utf8');
const css=readFileSync('dist/memorial-walk.css','utf8');
const relay=readFileSync('dist/memorial-walk-realtime.mjs','utf8');
assert.match(html,/<dialog id="walkIdentityDialog"/);
assert.match(html,/aria-labelledby="walkIdentityTitle"/);
assert.match(html,/name="walkGender" value="male"/);
assert.match(html,/name="walkGender" value="female"/);
assert.match(html,/id="walkNickname"[^>]*maxlength="12"/);
assert.match(html,/id="walkCustomize"/);
assert.match(js,/identityDialog\.showModal\(\)/);
assert.match(js,/identityDialog\.close\(\)/);
assert.match(js,/applyFeltAvatar\(self,selected\.gender,selected\.nickname\)/);
assert.match(js,/\.textContent=nickname/);
assert.match(js,/localStorage\.setItem\(WALK_IDENTITY_KEY/);
assert.match(js,/genderForTone\(visitor\.tone\)/);
assert.match(js,/newRelay\(\)/);
assert.doesNotMatch(relay,/nickname|WALK_IDENTITY_KEY/);
assert.match(css,/\.walk-identity-dialog::backdrop/);
assert.match(css,/backdrop-filter:blur\(24px\)/);
assert.match(css,/\.avatar-felt-alt/);
assert.match(css,/prefers-reduced-motion:reduce/);
console.log('FELT WALK IDENTITY PASS: 2 avatar types × 2 alpha WebP frames, local nickname, glass dialog, motion, XSS and realtime privacy.');
