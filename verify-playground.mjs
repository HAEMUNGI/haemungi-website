import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const index=readFileSync('dist/index.html','utf8');
const html=readFileSync('dist/playground.html','utf8');
const script=readFileSync('dist/playground.js','utf8');
const css=readFileSync('dist/playground.css','utf8');
assert.match(index,/href="playground.html".*헤뭉이 놀이터/);
assert.match(html,/assets\/playground-main\.jpg/);
assert.equal((html.match(/class="pg-scene-pick pg-scene-pick-/g)||[]).length,3);
for(const game of ['tarot','pet','rps']){
 assert.match(html,new RegExp('id="pg-game-'+game+'"'));
 assert.match(html,new RegExp('data-enter="'+game+'"'));
}
for(const id of ['tarot-card','pet-level','pet-full','rps-result','rps-wins'])assert.match(html,new RegExp('id="'+id+'"'));
assert.ok(css.includes('prefers-reduced-motion'));
new Function(script);
assert.ok(script.includes('localStorage'));
assert.ok(script.includes('Asia/Seoul'));
assert.equal((script.match(/no:"\d\d"/g)||[]).length,5);
const hero=readFileSync('dist/assets/playground-main.jpg');
assert.ok(hero.length>100000);
assert.equal(hero.subarray(0,3).toString('hex'),'ffd8ff');
for(let n=0;n<5;n++){
 const name='dist/assets/tarot-'+String(n).padStart(2,'0')+'.png';
 const data=readFileSync(name);
 assert.ok(data.length>100000,name+' has no high-resolution art');
 assert.equal(data.subarray(1,4).toString(),'PNG',name);
}
const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'Duplicate HTML IDs');
// Second-generation minigame regression guards: original save keys and tarot remain.
for(const id of ['pet-touch','pet-bond','pet-quest','pet-butterfly','pet-memory-list','pet-decoration','rps-character','rps-match-you','rps-again','rps-best','rps-sound']){
 assert.match(html,new RegExp('id="'+id+'"'), 'Missing v2 control: '+id);
}
for(const marker of ['hm_playground_tarot_v1','hm_playground_pet_v1','hm_playground_rps_v1','pet.careDay.count<3','questDate','rpsMatch.done','is-revealing']){
 assert.ok(script.includes(marker),'Missing preservation/gameplay marker: '+marker);
}
for(const selector of ['.pg-pet-affection','.pg-pet-mission','.pg-rps-matchtop','.pg-rps-character.is-cheering']){
 assert.ok(css.includes(selector),'Missing game presentation: '+selector);
}
assert.equal((html.match(/data-rps="(?:rock|paper|scissors)"/g)||[]).length,3);
assert.equal((html.match(/data-care="(?:feed|play|rest)"/g)||[]).length,3);
assert.ok(!html.includes('id="pet-stage" id='),'Invalid pet stage');
// Third-generation living-room regression: original arts and saves stay intact.
const living=readFileSync('dist/pet-living.js','utf8');
const livingCss=readFileSync('dist/pet-living.css','utf8');
assert.match(html,/pet-living\.js/);
assert.match(html,/pet-living\.css/);
assert.doesNotMatch(html,/pet-motion\.js/,'Old shaking engine must not be loaded');
new Function(living);
for(const marker of ['requestAnimationFrame','hm-living-world','hm-living-actor','haemungi-living-room.jpg','haemungi-3d-idle.png','haemungi-3d-play.png','hm_playground_pet_v1']){
 assert.ok(living.includes(marker)||script.includes(marker),'Missing living room integration: '+marker);
}
for(const marker of ['.hm-living-actor','.hm-living-caption','@media(max-width:700px)','prefers-reduced-motion']){
 assert.ok(livingCss.includes(marker),'Missing responsive living room CSS: '+marker);
}
for(const name of ['haemungi-living-room.jpg','haemungi-3d-reference.jpg']){
 const data=readFileSync('dist/assets/'+name);
 assert.ok(data.length>100000,name+' missing');
 assert.equal(data.subarray(0,3).toString('hex'),'ffd8ff',name+' must be JPEG');
}
for(const pose of ['idle','walk','feed','play','sleep']){
 const name='dist/assets/haemungi-3d-'+pose+'.png';
 const data=readFileSync(name);
 assert.ok(data.length>400000,name+' must be high-resolution');
 assert.equal(data.subarray(1,4).toString(),'PNG',name+' not PNG');
 assert.equal(data[25],6,name+' must be RGBA; no opaque JPEG fallback');
}
// Fourth-generation pet interactions must preserve daily tarot and the original pet storage.
for(const marker of ['hm-living-pet-target','pointerdown','pointermove','pointerup','pointercancel',
  'completePet','chooseAutonomy','greetVisitor','hm_living_visit_v1','pet-bond-bar',
  'hm-living-call','requestAnimationFrame']){
  assert.ok(living.includes(marker),'Missing pet interaction: '+marker);
}
for(const marker of ['.hm-living-pet-target','touch-action:none','hm3dCuddle',
  '.hm-living-call','prefers-reduced-motion']){
  assert.ok(livingCss.includes(marker),'Missing accessible interaction style: '+marker);
}
assert.doesNotMatch(livingCss.match(/\.hm-living-actor\[data-pose=petted\] img\{[^}]*\}/)?.[0]||'',/clip-path/, 'Cuddle sprite must never crop the character');
assert.ok(!living.includes('localStorage.removeItem'),'Pet upgrades may not clear any saves');
console.log('HAEMUNGI playground preservation, pet strokes, autonomous routines and affinity responses: PASS');
