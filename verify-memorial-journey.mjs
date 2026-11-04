import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {LAST_STEP,PUBLIC_STAR_PAGE_SIZE,clampStep,sceneForStep,sceneProgress,
  sceneForRelayY,relayYForStep,cleanPublicStar,starPosition,publicStarsUrl} from './dist/memorial-journey-core.mjs';

assert.equal(LAST_STEP,11);
assert.equal(clampStep(-99),0);
assert.equal(clampStep(500),11);
assert.deepEqual(Array.from({length:12},(_,i)=>sceneForStep(i)),[
  ...Array(6).fill('garden'),...Array(5).fill('trail'),'shore']);
assert.equal(sceneProgress(0),0);
assert.ok(sceneProgress(4)>sceneProgress(3));
assert.equal(sceneProgress(6),0);
assert.ok(sceneProgress(10)>sceneProgress(8));
assert.equal(sceneProgress(11),1);
for(let i=0;i<=LAST_STEP;i++)assert.equal(sceneForRelayY(relayYForStep(i)),sceneForStep(i));
const uid='65123d76-a511-47cb-8125-7d4863eac0ab';
assert.deepEqual(cleanPublicStar({id:uid,pet_name:' 레오 ',published_at:'2026-11-04T12:00:00Z'}),
  {id:uid,name:'레오',published_at:'2026-11-04T12:00:00Z'});
assert.equal(cleanPublicStar({id:uid,pet_name:''}),null);
assert.equal(cleanPublicStar({id:'not-a-uuid',pet_name:'Unknown'}),null);
assert.deepEqual(starPosition({id:uid},7),starPosition({id:uid},7));
assert.equal(new Set(Array.from({length:PUBLIC_STAR_PAGE_SIZE},(_,i)=>{
  const {x,y}=starPosition({id:uid},i);assert.ok(x>=5&&x<=71);assert.ok(y>=12&&y<52);return `${x}:${y}`;
})).size,PUBLIC_STAR_PAGE_SIZE);
const url=new URL(publicStarsUrl('https://example.supabase.co',null));
assert.equal(url.pathname,'/rest/v1/hm_memorial_public');
assert.equal(url.searchParams.get('select'),'id,pet_name,published_at');
assert.equal(url.searchParams.get('limit'),String(PUBLIC_STAR_PAGE_SIZE+1));
assert.equal(url.searchParams.get('or'),null);
const cursorUrl=new URL(publicStarsUrl('https://example.supabase.co',
  {id:uid,published_at:'2026-11-04T12:00:00Z'}));
assert.match(cursorUrl.searchParams.get('or'),/published_at\.lt\./);
assert.equal(new URL(publicStarsUrl('https://example.supabase.co',{id:'broken',published_at:'broken'})).searchParams.get('or'),null);

const html=readFileSync('dist/memorial-walk.html','utf8');
const css=readFileSync('dist/memorial-walk.css','utf8');
const js=readFileSync('dist/memorial-walk.js','utf8');
const relay=readFileSync('dist/memorial-walk-realtime.mjs','utf8');
for(const id of ['walkStage','walkForward','walkBack','shoreActions','floatBoat',
  'morningButton','nightButton','starSky','starActions','nextStars','boatField'])
  assert.match(html,new RegExp(`id="${id}"`));
for(const className of ['art-garden','art-trail','art-shore','scene-night-wash','scene-sun',
  'walk-controls','boat-field','scene-stars'])assert.match(html,new RegExp(`class="[^"]*\\b${className}\\b`));
assert.match(css,/scene-trail \.art-trail/);
assert.match(css,/scene-shore \.art-shore/);
assert.match(css,/\.walk-stage\{[^}]*overflow:clip/); // A clipped stage must not become a focus-scroll container.
assert.match(css,/@keyframes boat-voyage/);
assert.match(css,/prefers-reduced-motion/);
assert.match(css,/height:calc\(100dvh - 141px\)/); // Mobile buttons inside viewport.
assert.match(js,/sceneForStep\(step\)/);
assert.match(js,/scene-shore/);
assert.match(js,/relay\?\.sendMoment\('boat'\)/);
assert.match(relay,/onMoment/);
assert.match(js,/cleanPublicStar/);
assert.match(js,/createElement\('button'\)/);
assert.match(js,/\.textContent=row\.name/);
assert.doesNotMatch(js,/service_role|hm_memorial_requests|contact_email/);
assert.doesNotMatch(relay,/hm_memorial_public|pet_name|contact_email/);
for(const file of ['dist/memorial/spring-garden-20261104.jpg','dist/assets/temple-trail.webp',
  'dist/assets/temple-rest.webp'])assert.ok(existsSync(file));
console.log('MEMORIAL JOURNEY PASS: 11 walking steps; linked 3 scenes; mobile controls; paper boat voyage; morning/night; public-approved paged stars; no personal data in realtime.');
