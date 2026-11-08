import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {cleanNickname,safeBoard,TERMS_VERSION} from './dist/community-core.mjs';
import {MemorialWalkRelay} from './dist/memorial-walk-realtime.mjs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
for(const file of [
  'dist/community.html','dist/community-post.html','dist/community.css',
  'dist/community-core.mjs','dist/community-client.mjs','dist/community-ui.mjs',
  'dist/community.js','dist/community-post.js','dist/avatar-chat.js',
  'dist/avatar-chat.css','dist/terms.html','dist/privacy.html',
  '021_haemungi_community.sql'
])assert(existsSync(new URL(file,import.meta.url)),'missing '+file);

assert.equal(TERMS_VERSION,'2026-11-09');
assert.equal(cleanNickname('<>별 친구 \n'), '별 친구');
assert.equal(cleanNickname('a'), '');
assert.equal(cleanNickname('기'.repeat(30)).length,14);
assert.equal(safeBoard('__proto__'),'free');
assert.equal(safeBoard('qna'),'qna');

const home=read('dist/index.html'),memorial=read('dist/memorial.html'),walk=read('dist/memorial-walk.html');
assert(home.includes('href="/community.html"'),'homepage community link');
assert(home.includes('href="/privacy.html"'),'homepage privacy link');
assert(home.includes('href="/terms.html"'),'homepage terms link');
assert(memorial.includes('href="/community.html"'),'memorial community link');
assert.equal((memorial.match(/class="choice"/g)||[]).length,8,'existing fixed 8-scene entrance preserved');
assert(walk.includes('id="walkChat"')&&walk.includes('id="walkChatForm"'),'avatar chat UI');
assert(walk.includes('/avatar-chat.css'),'walk chat stylesheet');
assert(walk.includes('별빛 펫 편의점'),'store signage preserved');
assert(read('dist/community-client.mjs').includes("'return=minimal'"),'reports stay unreadable to regular users after insert');
for(const category of ['free','qna','notice','guide'])
  assert(read('dist/community.html').includes('data-board="'+category+'"'),'board '+category);
const privacy=read('dist/privacy.html');
for(const required of ['개인정보처리방침','수집','보유','공개 범위','파기','제3자','일현 조성훈','say3589@naver.com'])
  assert(privacy.includes(required),'privacy policy: '+required);

const sql=read('021_haemungi_community.sql');
for(const name of ['hm_community_profiles','hm_community_posts','hm_community_comments','hm_avatar_chat_messages','hm_community_reports']){
  assert(sql.includes('create table public.'+name),'table '+name);
  assert(sql.includes('alter table public.'+name+' enable row level security'),'RLS '+name);
}
assert(!/grant\s+(?:all|insert|update|delete)\b[^;]*\bto\s+anon\b/i.test(sql),'No anonymous writes');
assert(sql.includes("board in ('free','qna') or exists"),'admin-only notice and guide');
assert(sql.includes('pg_advisory_xact_lock'),'database rate limit');
assert(sql.includes('author_id=(select auth.uid())'),'verified authorship');
assert(sql.includes('hm_community_reports_admin_read'),'private admin report inbox');
const chat=read('dist/avatar-chat.js');
assert(chat.includes("rest('hm_avatar_chat_messages'"),'chat uses protected REST');
assert(chat.includes('notifyPeers(room)'),'realtime notification');
assert(!chat.includes('.innerHTML'),'visitor chat rendered as text, not HTML');
assert(!read('dist/community.js').includes('.innerHTML'),'board rendered as text, not HTML');
assert(!read('dist/community-post.js').includes('.innerHTML'),'post rendered as text, not HTML');

class FakeSocket {
  constructor(){this.readyState=0;this.sent=[];}
  send(payload){this.sent.push(JSON.parse(payload));}
  close(){this.readyState=3;this.onclose?.();}
  open(){this.readyState=1;this.onopen?.();}
  receive(topic,event,payload,ref){
    this.onmessage?.({data:JSON.stringify({topic,event,payload,ref})});
  }
}
let ws=null,notice=[];
const relay=new MemorialWalkRelay({api:'https://demo123.supabase.co',key:'sb_publishable_demo',
  id:'89a1f9ef-2134-4cde-9a9b-59c5a2347fa2',tone:0,seed:2,
  WebSocketImpl:class extends FakeSocket{constructor(){super();ws=this;}},
  onChatNotice:room=>notice.push(room)});
relay.start();ws.open();
const topic=ws.sent[0].topic;
ws.receive(topic,'phx_reply',{status:'ok'},ws.sent[0].ref);
const room=relay.plan[relay.attempt]+1;
assert(relay.sendChatNotice(room),'can send a same-room hint');
const hint=ws.sent.at(-1);
assert.equal(hint.payload.event,'chat-updated');
assert.deepEqual(hint.payload.payload,{room_no:room});
assert(!JSON.stringify(hint).includes('body'),'public realtime has no message text');
assert(!relay.sendChatNotice(room===8?1:room+1),'cannot signal another room');
ws.receive(topic,'broadcast',{event:'chat-updated',payload:{room_no:room}});
ws.receive(topic,'broadcast',{event:'chat-updated',payload:{room_no:room===8?1:room+1}});
assert.deepEqual(notice,[room]);
relay.stop();

console.log('COMMUNITY PASS: 4 boards, 5 RLS tables, authenticated avatar chat, moderation, privacy and safe relay.');
