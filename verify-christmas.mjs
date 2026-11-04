import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';

const read = path => readFileSync(resolve('dist',path),'utf8');
const page = read('christmas.html');
const script = read('christmas.js');
const css = read('christmas.css');
const home = read('index.html');

const assets = ['map','square','market','parade','sled','fishing','stage','garden'];
for (const name of assets){
  const path = resolve('dist/assets/christmas-'+name+'.webp');
  assert.ok(existsSync(path),'Missing artwork: '+name);
  const data=readFileSync(path);
  assert.equal(data.toString('ascii',0,4),'RIFF','Incorrect WebP RIFF header for '+name);
  assert.equal(data.toString('ascii',8,12),'WEBP','Incorrect WebP payload for '+name);
  assert.equal(data.readUInt32LE(4)+8,data.length,'Invalid WebP RIFF payload length for '+name);
  assert.ok(data.length>30_000,'Artwork is suspiciously small: '+name);
  assert.ok(script.includes('/assets/christmas-'+name+'.jpg'),'Warm JPEG not linked in scene data: '+name);
}
const spots=['market','sled','square','parade','fishing','stage'];
for (const name of spots){
  assert.ok(page.includes('href="#'+name+'" class="map-spot spot-'+name+'"'),'Missing map hotspot '+name);
  assert.ok(css.includes('.spot-'+name+'{'),'Missing mapped hitbox '+name);
}
assert.equal((page.match(/class="map-spot /g)||[]).length,6,'Exactly six image-labelled hotspots should exist');
assert.ok(script.includes("garden: {name:'겨울 정원'"),'Winter garden must remain available without inventing a map sign');
assert.ok(script.includes("window.addEventListener('hashchange',render)"),'Deep links must update scene');
assert.ok(page.includes('aria-live="polite"'),'Scene changes must be announced');
assert.ok(home.includes('<a href="/christmas.html"><small>14</small>'),'Homepage navigation not wired');
assert.ok(css.includes('@media(max-width:420px)'),'Mobile styles missing');
assert.ok(css.includes('color-scheme:light'),'Warm light theme missing');
assert.ok(page.includes('id="sceneStatus"')&&page.includes('id="retryScene"'),'Image loading and retry UI missing');
assert.ok(page.includes('/assets/christmas-map.jpg'),'Warm JPEG not prioritized');
assert.ok(css.includes('prefers-reduced-motion'),'Reduced-motion fallback missing');
assert.ok(!page.includes('<audio')&&!page.includes('<iframe'),'Unapproved music or video embed');
console.log('Christmas village PASS — 8 artwork assets, 6 map hotspots, 7 scenes, navigation, accessibility');
