import {clamp,normalPosition,MIN_X,MAX_X,MIN_Y,MAX_Y,ROOM_COUNT} from './memorial-walk-core.mjs';
import {MemorialWalkRelay} from './memorial-walk-realtime.mjs';

const $=id=>document.getElementById(id);
const stage=$('walkStage'),avatarLayer=$('walkAvatars'),self=$('walkSelf');
const status=$('walkStatus'),count=$('walkCount'),mode=$('walkMode'),room=$('walkRoom');
const joinButton=$('walkJoin'),changeRoomButton=$('walkChangeRoom'),shareButton=$('walkShare');
const cfg=window.HAEMUNGI_CONTENT_CONFIG||{};
const randomByte=new Uint8Array(1);
crypto.getRandomValues(randomByte);
const tone=randomByte[0]%5;
const visitorId=crypto.randomUUID(); // Ephemeral; not stored or tied to a memorial record.
const requestedRoom=new URLSearchParams(location.search).get('room');
let seed=/^0[1-8]$/.test(requestedRoom||'')?Number(requestedRoom)-1:randomByte[0]%ROOM_COUNT;
let position={x:.50,y:.80};
let onlineWanted=false,relay=null;
let peerViews=new Map();

function setAvatarPosition(node,pos){
  node.style.left=(pos.x*100).toFixed(2)+'%';
  node.style.top=(pos.y*100).toFixed(2)+'%';
  node.style.setProperty('--avatar-scale',(0.76+(pos.y-MIN_Y)/(MAX_Y-MIN_Y)*0.40).toFixed(3));
  if(!node.classList.contains('is-self'))node.style.zIndex=String(Math.floor(pos.y*30));
}

function makeVisitor(visitor){
  const node=document.createElement('div');node.className='walk-avatar';
  node.dataset.tone=String(visitor.tone);
  for(const name of ['avatar-shadow','avatar-head','avatar-body','avatar-scarf','avatar-label']){
    const child=document.createElement('span');child.className=name;
    if(name==='avatar-label')child.textContent='방문 별';
    node.appendChild(child);
  }
  setAvatarPosition(node,visitor);return node;
}
function renderPeers(visitors){
  const incoming=new Set();
  for(const visitor of visitors){
    incoming.add(visitor.id);
    let node=peerViews.get(visitor.id);
    if(!node){node=makeVisitor(visitor);peerViews.set(visitor.id,node);avatarLayer.appendChild(node);}
    node.dataset.tone=String(visitor.tone);setAvatarPosition(node,visitor);
  }
  for(const [id,node] of peerViews)if(!incoming.has(id)){node.remove();peerViews.delete(id);}
  count.textContent='내 화면의 방문자 · '+(visitors.length+1)+'명';
}

function showStatus(state,_,roomIndex){
  const text={
    solo:'나만의 산책 · 마음 편히 머물러요.',
    connecting:'함께 걸을 작은 꽃길을 찾는 중입니다…',
    online:'같은 꽃길의 방문자와 천천히 걷고 있어요.',
    unavailable:'실시간 연결이 어려워 혼자 걷는 중입니다. 산책은 계속할 수 있어요.',
    full:'작은 꽃길이 모두 붐비고 있어요. 잠시 혼자 걸어주세요.'
  };
  status.textContent=text[state]||text.solo;
  mode.textContent=state==='online'?'함께 걷는 중':state==='connecting'?'연결 중':'나만의 산책';
  mode.classList.toggle('is-online',state==='online');
  room.textContent=state==='online'||state==='connecting'?'꽃길 '+String(roomIndex+1).padStart(2,'0')+' · 작은 구역':'꽃길 · 혼자';
  changeRoomButton.hidden=!onlineWanted;
  joinButton.textContent=onlineWanted?'혼자 산책하기':'✧ 다른 방문자와 함께 걷기';
}

function newRelay(){
  if(relay)relay.stop();
  relay=new MemorialWalkRelay({
    api:cfg.projectUrl,key:cfg.publishableKey,id:visitorId,tone,x:position.x,y:position.y,seed,
    onStatus:showStatus,onPeers:renderPeers
  });
  if(onlineWanted&&!document.hidden)relay.start();
}

function moveTo(x,y){
  const next=normalPosition(x,y);if(!next)return;
  position=next;setAvatarPosition(self,next);
  if(relay)relay.move(next.x,next.y);
}

stage.addEventListener('click',event=>{
  if(event.target.closest('button,a'))return;
  const rect=stage.getBoundingClientRect();
  moveTo((event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height);
});

const steps={up:[0,-.025],down:[0,.025],left:[-.035,0],right:[.035,0]};
function step(direction){
  const d=steps[direction];if(!d)return;
  moveTo(clamp(position.x+d[0],MIN_X,MAX_X),clamp(position.y+d[1],MIN_Y,MAX_Y));
}
document.querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>step(button.dataset.step)));
stage.addEventListener('keydown',event=>{
  const keys={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};
  if(keys[event.key]){event.preventDefault();step(keys[event.key]);}
});
joinButton.addEventListener('click',()=>{
  onlineWanted=!onlineWanted;
  if(onlineWanted)newRelay();else{relay?.stop();changeRoomButton.hidden=true;}
  joinButton.textContent=onlineWanted?'혼자 산책하기':'✧ 다른 방문자와 함께 걷기';
});
changeRoomButton.addEventListener('click',()=>{
  if(!onlineWanted)return;
  seed=(seed+1)%ROOM_COUNT;newRelay();
});
shareButton.addEventListener('click',async()=>{
  const activeRoom=relay?.joined ? relay.plan[relay.attempt] : seed;
  const url=new URL(location.pathname,location.origin);
  url.searchParams.set('room',String(activeRoom+1).padStart(2,'0'));
  try{
    if(navigator.share)await navigator.share({title:'별빛 추모관 · 함께 걷는 꽃길',url:url.href});
    else {await navigator.clipboard.writeText(url.href);status.textContent='같은 꽃길 초대 링크를 복사했어요.';}
  }catch(err){if(err?.name!=='AbortError')status.textContent='링크 복사가 어려워 주소창에서 주소를 공유해주세요.';}
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){relay?.stop();if(onlineWanted)status.textContent='다른 화면을 보는 동안 실시간 연결을 쉬고 있어요.';}
  else if(onlineWanted)newRelay();
});
window.addEventListener('pagehide',()=>relay?.stop());
self.dataset.tone=String(tone);
setAvatarPosition(self,position);
showStatus('solo','',-1);
