import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {LAST_STEP,PUBLIC_STAR_PAGE_SIZE,clampStep,sceneForStep,sceneProgress,
  sceneForRelayY,relayYForStep,cleanPublicStar,starPosition,publicStarsUrl} from './dist/memorial-journey-core.mjs';
import {advancePose,advanceShorePose,movementScene,movementSceneProgress,
  tapDestination,shoreTapDestination,projectedWalkPosition,pathPoint,shorePoint} from './dist/memorial-walk-motion.mjs';

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
assert.equal(movementScene(0),'garden');
assert.equal(movementScene(6),'trail');
assert.equal(movementScene(10.9),'trail');
assert.equal(movementScene(11),'shore');
assert.ok(movementSceneProgress(5.2)>movementSceneProgress(3.4));
let walking={distance:0,lane:.5};
for(let i=0;i<40;i++)walking=advancePose(walking,{x:.35,y:-.8},.016);
assert.ok(walking.distance>.5&&walking.distance<1.2); // Continuous movement, no step jumping.
assert.ok(walking.lane>.5&&walking.lane<.79); // Horizontal steering while walking.
assert.deepEqual(advancePose({distance:11,lane:.79},{x:1,y:-1},.05),{distance:11,lane:.79});
// Walk targets are screen coordinates, including both depth and lateral lane.
const gardenNear=tapDestination(0,.5,.55,.90);
assert.equal(gardenNear.distance,0);
assert.equal(gardenNear.lane,.5);
const gardenMid=tapDestination(0,.5,.55,.75);
assert.ok(gardenMid.distance>2&&gardenMid.distance<4);
assert.equal(tapDestination(0,.5,.49,.60).distance,6); // Far end triggers trail.
assert.equal(tapDestination(6,.5,.88,.46).distance,11); // Far end triggers sea.
assert.ok(tapDestination(0,.5,.8,.7).lane>.5); // Touching the right lane moves right.
assert.ok(projectedWalkPosition(5.8,.5).y<projectedWalkPosition(1,.5).y);
assert.ok(pathPoint('trail',1,.5).x>pathPoint('trail',0,.5).x); // The coast path bends right.
assert.ok(pathPoint('garden',1,.5).scale<pathPoint('garden',0,.5).scale);
assert.deepEqual(shoreTapDestination(.5,.735),{depth:1,lane:.5});
assert.equal(shorePoint(1,.5).y,.735);
let deck={depth:0,lane:.5};
for(let i=0;i<40;i++)deck=advanceShorePose(deck,{x:0,y:-1},.06);
assert.equal(deck.depth,1); // The avatar can actually walk to the railing.
let transition={distance:0,lane:.5};
for(let i=0;i<500;i++)transition=advancePose(transition,{x:0,y:-1},.04);
assert.equal(transition.distance,11);
assert.equal(movementScene(transition.distance),'shore');
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
for(const id of ['walkStage','shoreActions','floatBoat','walkTarget',
  'morningButton','nightButton','starSky','starActions','nextStars','boatField',
  'walkJoystick','joystickThumb'])
  assert.match(html,new RegExp(`id="${id}"`));
for(const className of ['art-garden','art-trail','art-shore','art-shore-night',
  'walk-joystick','boat-field','scene-stars'])assert.match(html,new RegExp(`class="[^"]*\\b${className}\\b`));
assert.match(css,/scene-trail \.art-trail/);
assert.match(css,/scene-shore\.time-morning \.art-shore/);
assert.match(css,/scene-shore\.time-night \.art-shore-night/);
assert.match(css,/background-size:contain/);
assert.doesNotMatch(css,/background-size:cover/);
assert.match(css,/\.walk-stage\{[^}]*overflow:clip/); // A clipped stage must not become a focus-scroll container.
assert.match(css,/@keyframes boat-voyage/);
assert.match(css,/prefers-reduced-motion/);
assert.doesNotMatch(html,/id="walkForward"|id="walkBack"/); // No next/back buttons.
assert.match(css,/\.walk-scene-wrap\.has-shore \.walk-stage/);
assert.match(css,/\.shore-actions\{position:static/); // Shore actions live below the scenery.
assert.match(css,/56\.25dvh - 123px/); // Coast actions reserve phone space without cropping artwork.
assert.match(js,/joystick\.addEventListener\('pointerdown'/);
assert.match(js,/advancePose\(/);
assert.match(js,/tapDestination\(/);
assert.match(js,/reached\(next\.distance,tapTarget\.distance/); // End-point snap avoids stopping short.
assert.match(js,/shoreTapDestination/);
assert.match(js,/shoreDepth/);
assert.match(css,/\.walk-target\{/);
assert.match(css,/\.walk-stage,\.walk-scene-wrap\.has-shore \.walk-stage\{[\s\S]*?width:100%/);
assert.match(css,/100%\{left:50%;top:var\(--boat-horizon\)/);
assert.match(js,/scene-shore/);
assert.match(js,/relay\?\.sendMoment\('boat'\)/);
assert.match(relay,/onMoment/);
assert.match(js,/cleanPublicStar/);
assert.match(js,/createElement\('button'\)/);
assert.match(js,/\.textContent=row\.name/);
assert.doesNotMatch(js,/service_role|hm_memorial_requests|contact_email/);
assert.doesNotMatch(relay,/hm_memorial_public|pet_name|contact_email/);
for(const file of ['dist/memorial/spring-garden-20261104.jpg','dist/assets/temple-trail.webp',
  'dist/assets/temple-rest.webp',...['garden','morning','night'].map(name=>
    `dist/assets/memorial-walk-${name}-20261105.webp`)])assert.ok(existsSync(file));
console.log('MEMORIAL JOURNEY PASS: 11 walking steps; linked 3 scenes; mobile controls; paper boat voyage; morning/night; public-approved paged stars; no personal data in realtime.');
