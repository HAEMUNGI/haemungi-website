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
const motion=readFileSync('dist/pet-motion.js','utf8');
const motionCss=readFileSync('dist/pet-motion.css','utf8');
assert.match(html,/pet-motion\.js/);
assert.match(html,/pet-motion\.css/);
new Function(motion);
for(const marker of ['requestAnimationFrame','extractPose','walkTo','react("touch")','hm-pet-actor','haemungi-sheet.webp'])assert.ok(motion.includes(marker),marker);
assert.match(motionCss,/\.hm-pet-actor/);
assert.match(motionCss,/prefers-reduced-motion/);
const sheet=readFileSync('dist/assets/haemungi-sheet.webp');
assert.ok(sheet.length>100000,'Character sheet missing');
console.log('HAEMUNGI playground source and five original card arts and live sprite-based pet: PASS');