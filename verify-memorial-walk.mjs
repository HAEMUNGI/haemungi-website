import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {ROOM_COUNT,ROOM_CAP,VISIBLE_PEERS,roomPlan,roomTopic,normalPosition,
  safeVisitor,presenceSnapshot,applyPresenceDiff,activeVisitors,wireMessage} from './dist/memorial-walk-core.mjs';
import {MemorialWalkRelay} from './dist/memorial-walk-realtime.mjs';

const ID='f9a2ccca-e056-4bcd-95a2-279a5036051a';
const uid=n=>n.toString(16).padStart(8,'0')+'-0000-4000-8000-000000000000';
const loc=normalPosition(.5,.8);
assert.deepEqual(normalPosition(NaN,0),null);
assert.deepEqual(normalPosition(-9,8),{x:.12,y:.93});
assert.equal(safeVisitor('wrong',{x:.5,y:.8,tone:0}),null);
assert.equal(safeVisitor(uid(1),{x:.5,y:.8,tone:9}),null);
assert.equal(safeVisitor(uid(1),{x:.5,y:.8,tone:2}).tone,2);
assert.deepEqual(roomPlan(7),[7,2,4]);
assert.equal(new Set(roomPlan(4)).size,3);
assert.equal(roomTopic(7),'realtime:hm-memorial-garden-v1-08');
assert.throws(()=>roomTopic(8),/Invalid/);
assert.deepEqual(JSON.parse(wireMessage('phoenix','heartbeat',{},5,null)).join_ref,null);

const metas=n=>({metas:[{phx_ref:'ref'+n,x:.5,y:.72,tone:n%5}]});
const raw=Object.fromEntries(Array.from({length:40},(_,i)=>[uid(i+1),metas(i+1)]));
const snapshot=presenceSnapshot(raw);
assert.equal(Object.keys(snapshot).length,40);
assert.equal(activeVisitors(snapshot,ID,loc).length,VISIBLE_PEERS);
const joined=applyPresenceDiff(snapshot,{joins:{[uid(50)]:metas(50)},leaves:{[uid(1)]:metas(1)}});
assert.equal(joined[uid(1)],undefined);
assert.ok(joined[uid(50)]);
assert.equal(Object.keys(snapshot).length,40); // immutable reconciliation

// 10,000 synthetic arrival attempts never render or subscribe to 10,000 avatars.
// This is an allocation model, not a 10,000-WebSocket production load test.
const roomSizes=Array(ROOM_COUNT).fill(0);
let allocated=0,solo=0;
for(let i=0;i<10000;i++){
  const chosen=roomPlan(i).find(r=>roomSizes[r]<ROOM_CAP);
  if(chosen===undefined)solo++;
  else {roomSizes[chosen]++;allocated++;}
}
assert.equal(allocated,ROOM_COUNT*ROOM_CAP);
assert.equal(solo,10000-allocated);
assert.ok(roomSizes.every(size=>size<=ROOM_CAP));

class FakeSocket {
  static sockets=[];
  constructor(url){this.url=url;this.sent=[];this.readyState=0;FakeSocket.sockets.push(this);}
  open(){this.readyState=1;this.onopen?.();}
  send(s){this.sent.push(JSON.parse(s));}
  receive(event,payload,ref){this.onmessage?.({data:JSON.stringify({topic:this.sent[0]?.topic,event,payload,ref})});}
  close(){this.readyState=3;this.onclose?.();}
}
const statuses=[];let peers=[];
const relay=new MemorialWalkRelay({api:'https://example123.supabase.co',key:'sb_publishable_test',id:ID,
  tone:2,x:.5,y:.8,seed:0,WebSocketImpl:FakeSocket,
  onStatus:s=>statuses.push(s),onPeers:p=>{peers=p;}});
relay.start();
const ws=FakeSocket.sockets.at(-1);
assert.match(ws.url,/\/realtime\/v1\/websocket\?/);
ws.open();
assert.equal(ws.sent[0].event,'phx_join');
assert.equal(ws.sent[0].payload.config.presence.enabled,true);
assert.equal(ws.sent[0].payload.config.broadcast.ack,false);
assert.equal(ws.sent[0].payload.config.private,false);
assert.deepEqual(ws.sent[0].payload.config.postgres_changes,[]);
ws.receive('phx_reply',{status:'ok',response:{}},ws.sent[0].ref);
assert.ok(statuses.includes('online'));
assert.equal(ws.sent.filter(m=>m.event==='presence').length,1);
ws.receive('presence_state',{[ID]:metas(0),[uid(1)]:metas(1)});
assert.equal(peers.length,1);
relay.move(.55,.82);
relay.move(.59,.83);
assert.equal(ws.sent.filter(m=>m.event==='broadcast').length,1); // 12s cap
const first=ws.sent.find(m=>m.event==='broadcast');
assert.equal(first.payload.event,'move');
assert.equal(first.payload.payload.id,ID);
assert.equal(relay.sendMoment('boat'),true);
assert.equal(relay.sendMoment('boat'),false); // Cooldown prevents repeat spam.
assert.deepEqual(ws.sent.filter(m=>m.payload?.event==='boat').map(m=>Object.keys(m.payload.payload)),[['id']]);
ws.receive('presence_diff',{joins:{[uid(2)]:metas(2)},leaves:{[uid(1)]:metas(1)}});
assert.equal(peers.length,1);
assert.equal(peers[0].id,uid(2));
ws.receive('broadcast',{event:'move',type:'broadcast',payload:{id:uid(2),tone:2,x:.81,y:.90}});
assert.equal(peers[0].x,.81);
assert.equal(peers[0].y,.90);
ws.receive('broadcast',{event:'move',type:'broadcast',payload:{id:uid(999),tone:2,x:.40,y:.70}});
assert.equal(peers.length,1); // no forged visitor can appear without presence
relay.stop();assert.equal(ws.readyState,3);
assert.equal(relay.heartbeat,null);assert.equal(relay.moveTimer,null);

// At capacity, a client is redirected to the next shard, then disconnects the old socket.
const roomTester=new MemorialWalkRelay({api:'https://example123.supabase.co',key:'sb_publishable_test',
  id:ID,tone:0,WebSocketImpl:FakeSocket,x:.5,y:.8,seed:3});
roomTester.start();let packed=FakeSocket.sockets.at(-1);packed.open();
packed.receive('phx_reply',{status:'ok'},packed.sent[0].ref);
const full=Object.fromEntries(Array.from({length:ROOM_CAP},(_,i)=>[uid(100+i),metas(i)]));
packed.receive('presence_state',full);
assert.equal(packed.readyState,3);
assert.notEqual(FakeSocket.sockets.at(-1),packed);
roomTester.stop();

const html=readFileSync('dist/memorial-walk.html','utf8');
const js=readFileSync('dist/memorial-walk.js','utf8');
const css=readFileSync('dist/memorial-walk.css','utf8');
assert.match(html,/content-config\.js/);
assert.match(html,/memorial-walk\.js/);
assert.match(html,/id="walkStage"/);
assert.match(html,/aria-live="polite"/);
assert.match(html,/다른 방문자와 함께 걷기/);
assert.match(css,/prefers-reduced-motion/);
assert.match(css,/max-width:460px/);
assert.match(js,/visibilitychange/);
assert.match(js,/pagehide/);
assert.ok(existsSync('dist/memorial/spring-garden-20261104.jpg'));
// The three supplied memorial artworks are full-frame optimized WebP assets.
for(const name of ['garden','morning','night']){
  const filename=`dist/assets/memorial-walk-${name}-20261105.webp`;
  const asset=readFileSync(filename);
  assert.equal(asset.toString('ascii',0,4),'RIFF',filename);
  assert.equal(asset.toString('ascii',8,12),'WEBP',filename);
  assert.ok(asset.length<300_000,`${filename}: unexpectedly large`);
  assert.match(css,new RegExp(`memorial-walk-${name}-20261105\\.webp`));
}
assert.match(html,/art-shore-night/);
assert.match(html,/id="shoreCinema"/);
assert.match(html,/id="shoreSunriseIntro"/);
assert.match(html,/id="shoreSunriseIdle"/);
assert.match(html,/id="shoreNightVideo"/);
assert.match(html,/class="shore-deck"/);
assert.match(css,/\.shore-deck\{position:absolute/);
assert.match(css,/\.shore-cinema\{position:absolute/);
assert.match(js,/startSunriseIdle/);
assert.match(js,/prefers-reduced-motion: reduce/);
for(const name of ['temple-sunrise-intro.mp4','temple-sunrise-idle.mp4','temple-starry-ocean.mp4']){
  const path=`dist/assets/${name}`;
  const bytes=readFileSync(path);
  assert.ok(bytes.length>20000&&bytes.length<3_000_000,`${path}: video budget exceeded`);
  assert.equal(bytes.toString('ascii',4,8),'ftyp',`${path}: invalid MP4`);
  const moov=bytes.indexOf(Buffer.from('moov'));
  const mdat=bytes.indexOf(Buffer.from('mdat'));
  assert.ok(moov>0&&mdat>0&&moov<mdat,`${path}: missing fast-start MP4 index`);
  assert.match(html,new RegExp(name.replaceAll('.','\\.')));
}
const deck=readFileSync('dist/assets/temple-viewing-deck.png');
assert.equal(deck.toString('hex',0,8),'89504e470d0a1a0a');
assert.equal(deck[25],6,'viewing-deck image must retain RGBA transparency');
assert.match(css,/background-size:contain/);
assert.doesNotMatch(css,/background-size:cover/);
assert.doesNotMatch(css,/\.scene-(?:garden|trail|shore) \.art-\w+\{transform:.*scale/);
assert.match(readFileSync('dist/memorial.html','utf8'),/href="\/memorial-walk\.html"/);
assert.match(readFileSync('dist/memorial-archive.html','utf8'),/href="\/memorial-walk\.html"/);
for(const file of ['dist/memorial-walk.js','dist/memorial-walk-realtime.mjs']){
  const src=readFileSync(file,'utf8');
  assert.doesNotMatch(src,/contact_email|service_role|hm_memorial_requests/);
}
console.log('MEMORIAL WALK PASS: immutable records; 8 rooms × 12 soft-cap; 10,000 arrival model; 11 visible peers; Presence/Broadcast protocol; movement throttling; fallback; no personal records.');
