import assert from 'node:assert/strict';
import {readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';
const root=process.cwd();
const get=p=>readFileSync(join(root,p),'utf8');
const html=get('dist/temple.html');
const js=get('dist/temple.js');
const css=get('dist/temple.css');
const audio=get('dist/temple-audio.js');
const home=get('dist/index.html');
const admin=get('dist/admin.js');
const managed=get('dist/managed-content.js');
const locations=['haesu','daewoong','lantern','kitchen','wish','rest','trail'];
assert.equal((html.match(/class="map-spot/g)||[]).length,7,'seven map hotspots');
for(const location of locations){
  assert.ok(html.includes('href="#'+location+'"'),location+' hotspot missing');
  assert.ok(js.includes(location+":{name:"),location+' scene missing');
  assert.ok(statSync(join(root,'dist/assets/temple-'+location+'.webp')).size>10000,location+' artwork missing');
}
assert.ok(statSync(join(root,'dist/assets/temple-map.webp')).size>10000,'main map artwork missing');
assert.match(home,/href="\/temple\.html"[^>]*><small>13<\/small>/,'homepage menu link');
assert.match(html,/id="templeVideo"/);
assert.match(css,/\.temple-video\{position:absolute/);
assert.match(js,/youtube-nocookie\.com\/embed\//,'whitelisted youtube embed');
assert.match(js,/hm_media_public\?select=/,'published owner settings');
assert.match(admin,/video-temple', '파도가 들리는 법당/,'video admin slot');
assert.match(managed,/row\.slot !== 'video-temple'/,'temple video excluded from Shorts grid');
assert.match(html,/id="wishDialog"/);
assert.match(html,/id="wishText" maxlength="300"/);
assert.match(js,/localStorage\.setItem\(wishKey/,'wish persistence');
assert.doesNotMatch(js,/innerHTML\s*=\s*.*wish/,'wish insertion must use textContent');
assert.match(css,/@media\(max-width:420px\)/,'mobile layout');
assert.match(css, /prefers-reduced-motion:reduce/,'reduced motion support');
assert.match(js,/hP-8B7sHJt4/,'owner-approved YouTube fallback');
assert.match(html,/id="templeVideoDialog"/,'large visible YouTube player');
assert.match(css,/min-height:200px/,'YouTube player minimum visible height');
assert.match(html,/id="templeVideoCredit"/,'YouTube copyright credit');
assert.match(html,/반야의 쉼터/,'verified owner-selected YouTube channel attribution');
assert.match(html,/id="templeAudioCredit"/,'audio copyright attribution');
assert.match(html,/src="\/temple-audio\.js"/,'audio controller included');
assert.match(audio,/window\.AudioContext/,'original Web Audio soundscape');
assert.doesNotMatch(audio,/youtube-nocookie|\/embed\//,'YouTube not hidden as audio');
for(const location of locations){
  assert.match(audio,new RegExp('^  '+location+':\\{name:', 'm'),location+' ambient program missing');
  assert.ok(admin.includes("'music-temple-"+location+"'"),location+' admin audio slot missing');
}
assert.match(admin,/저작자·출처·이용허락/,'admin copyright attribution required');
console.log('temple: seven scenes, original audio, licensed replacement slots, visible YouTube screen, credits and private wishes PASS');
