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
console.log('HAEMUNGI playground source and five original card arts: PASS');