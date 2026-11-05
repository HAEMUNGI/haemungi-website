import {clamp,ROOM_COUNT} from './memorial-walk-core.mjs';
import {MemorialWalkRelay} from './memorial-walk-realtime.mjs';
import {LAST_STEP,PUBLIC_STAR_PAGE_SIZE,sceneForRelayY,
  relayYForStep,cleanPublicStar,starPosition,publicStarsUrl} from './memorial-journey-core.mjs';
import {advancePose,limit,movementScene,movementSceneProgress,tapDestination} from './memorial-walk-motion.mjs';

const $=id=>document.getElementById(id);
const stage=$('walkStage'),avatarLayer=$('walkAvatars'),self=$('walkSelf');
const cfg=window.HAEMUNGI_CONTENT_CONFIG||{};
const random=new Uint8Array(1);crypto.getRandomValues(random);
const tone=random[0]%5,visitorId=crypto.randomUUID(); // Anonymous and temporary.
const requestedRoom=new URLSearchParams(location.search).get('room');
let seed=/^0[1-8]$/.test(requestedRoom||'')?Number(requestedRoom)-1:random[0]%ROOM_COUNT;
let distance=0,lane=.5,dayTime='morning',onlineWanted=false,relay=null;
let peerViews=new Map(),currentPeers=[];
let starPage=0,starCursors=[null],starNextCursor=null,starStatus='unloaded',starRequest=0;

function setAvatarPosition(node,x,scale=1){
  const shore=movementScene(distance)==='shore';
  const visualX=shore?(node.classList.contains('is-self')?.5+(x-.5)*.32:
    .16+((parseInt(node.dataset.visitorHash||'0',10)%100)/100)*.68):x;
  node.style.left=(visualX*100).toFixed(2)+'%';
  node.style.top='80%';
  node.style.setProperty('--avatar-scale',String(scale));
}
function makeVisitor(visitor){
  const node=document.createElement('div');node.className='walk-avatar';node.dataset.tone=String(visitor.tone);
  for(const name of ['avatar-shadow','avatar-head','avatar-body','avatar-scarf','avatar-label']){
    const part=document.createElement('span');part.className=name;
    if(name==='avatar-label')part.textContent='방문 별';
    node.appendChild(part);
  }
  return node;
}
function renderPeers(visitors=currentPeers){
  currentPeers=visitors;
  const scene=movementScene(distance),present=new Set();
  for(const visitor of visitors){
    if(sceneForRelayY(visitor.y)!==scene)continue;
    present.add(visitor.id);
    let node=peerViews.get(visitor.id);
    if(!node){node=makeVisitor(visitor);peerViews.set(visitor.id,node);avatarLayer.append(node);}
    node.dataset.visitorHash=String(parseInt(visitor.id.slice(0,8),16)%100);
    node.dataset.tone=String(visitor.tone);setAvatarPosition(node,visitor.x,.9);
  }
  for(const [id,node] of peerViews)if(!present.has(id)){node.remove();peerViews.delete(id);}
  $('walkCount').textContent='내 화면의 방문자 · '+(present.size+1)+'명';
}
function showStatus(state,_,roomIndex){
  const copy={solo:'혼자 조용히 둘러볼 수 있습니다.',connecting:'다른 방문자와 이어지는 중입니다…',
    online:'같은 길에 있는 다른 방문자를 볼 수 있습니다.',
    unavailable:'실시간 연결이 어려워 혼자 산책합니다.',full:'모든 작은 구역이 붐벼 혼자 산책합니다.'};
  $('walkStatus').textContent=copy[state]||copy.solo;
  $('walkMode').textContent=state==='online'?'함께 걷는 중':state==='connecting'?'연결 중':'나만의 여정';
  $('walkMode').classList.toggle('is-online',state==='online');
  $('walkRoom').textContent=state==='online'||state==='connecting'?'함께 걷는 길 '+String(roomIndex+1).padStart(2,'0'):'기억의 길 · 혼자';
  $('walkJoin').textContent=onlineWanted?'혼자 산책하기':'✧ 다른 방문자와 함께 걷기';
  $('walkChangeRoom').hidden=!onlineWanted;
}
function newRelay(){
  relay?.stop();
  relay=new MemorialWalkRelay({api:cfg.projectUrl,key:cfg.publishableKey,id:visitorId,tone,
    x:lane,y:relayYForStep(distance),seed,onStatus:showStatus,onPeers:renderPeers,
    onMoment:moment=>{if(moment.type==='boat'&&movementScene(distance)==='shore')launchBoat(true);}});
  if(onlineWanted&&!document.hidden)relay.start();
}
let noticeTimer=0;
function announce(text){
  const el=$('sceneMessage');el.textContent=text;el.classList.add('is-visible');
  clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>el.classList.remove('is-visible'),2700);
}
function updateJourney(){
  const scene=movementScene(distance),p=movementSceneProgress(distance);
  stage.classList.toggle('scene-garden',scene==='garden');
  stage.classList.toggle('scene-trail',scene==='trail');
  stage.classList.toggle('scene-shore',scene==='shore');
  stage.closest('.walk-scene-wrap').classList.toggle('has-shore',scene==='shore');
  stage.style.setProperty('--forward',p.toFixed(3));
  stage.style.setProperty('--camera-pan',((.5-lane)*4).toFixed(2)+'%');
  stage.dataset.scene=scene;
  const titles={garden:'꽃길 끝에서, 바다를 만나요.',trail:'저 멀리, 파도 소리가 들려요.',shore:'이곳에서 마음을 바다에 띄워요.'};
  const labels={garden:'01 · 햇살 꽃길',trail:'02 · 절의 해안 산책로',shore:'03 · 바다 쉼터'};
  $('journeyTitle').textContent=titles[scene];
  $('sceneLabel').textContent=labels[scene];
  $('sceneStep').textContent=distance<.01?'첫 걸음':'여정 '+Math.round(distance/LAST_STEP*100)+'%';
  $('walkProgress').style.width=(distance/LAST_STEP*100)+'%';
  $('journeyDescription').textContent=scene==='garden'?'앞으로 걸을수록 꽃길 풍경이 가까워집니다.':
    scene==='trail'?'절의 해안 산책로를 따라 바다를 향해 걷습니다.':'종이배를 띄우고, 아침과 밤의 바다를 만나 보세요.';
  for(const s of ['Garden','Trail','Shore']){
    const el=$('route'+s),key=s.toLowerCase();
    el.classList.toggle('is-current',key===scene);
    el.classList.toggle('is-past',(key==='garden'&&scene!=='garden')||(key==='trail'&&scene==='shore'));
  }
  $('shoreActions').hidden=scene!=='shore';
  $('starSky').hidden=scene!=='shore'||dayTime!=='night';
  $('starActions').hidden=scene!=='shore'||dayTime!=='night';
  if(scene==='shore'&&dayTime==='night'&&starStatus==='unloaded')loadStars();
  if(scene==='garden')announce('길 위를 누르거나 조이스틱으로 천천히 걸어보세요.');
  if(scene==='trail')announce('절의 해안 산책로에 들어섰어요.');
  if(scene==='shore')announce(dayTime==='night'?'별이 된 아이들의 이름을 찾아보세요.':'바다에 종이배를 띄우거나 일출을 바라보세요.');
  setAvatarPosition(self,lane,scene==='shore'?1.09:1);
  renderPeers();
}
let lastPresenceAt=0;
function setPose(pose){
  const previousScene=movementScene(distance),oldRounded=Math.round(distance);
  distance=limit(pose.distance,0,LAST_STEP);lane=limit(pose.lane,.21,.79);
  if(previousScene!==movementScene(distance)){updateJourney();}
  else {
    stage.style.setProperty('--forward',movementSceneProgress(distance).toFixed(3));
    stage.style.setProperty('--camera-pan',((.5-lane)*4).toFixed(2)+'%');
    $('walkProgress').style.width=(distance/LAST_STEP*100)+'%';
    if(oldRounded!==Math.round(distance))$('sceneStep').textContent='여정 '+Math.round(distance/LAST_STEP*100)+'%';
    setAvatarPosition(self,lane,movementScene(distance)==='shore'?1.09:1);
  }
  const now=performance.now();
  if(now-lastPresenceAt>=150){relay?.move(lane,relayYForStep(distance));lastPresenceAt=now;}
}
function setTime(next){
  if((next!=='morning'&&next!=='night')||movementScene(distance)!=='shore')return;
  dayTime=next;stage.classList.toggle('time-morning',next==='morning');stage.classList.toggle('time-night',next==='night');
  $('morningButton').setAttribute('aria-pressed',String(next==='morning'));
  $('nightButton').setAttribute('aria-pressed',String(next==='night'));
  $('starSky').hidden=next!=='night';$('starActions').hidden=next!=='night';
  announce(next==='morning'?'수평선 너머로 천천히 해가 떠오릅니다.':'별이 된 아이들의 이름이 밤하늘에 빛납니다.');
  if(next==='night'&&starStatus==='unloaded')loadStars();
}
function boatElement(){
  const boat=document.createElement('div');boat.className='paper-boat';
  boat.innerHTML='<svg viewBox="0 0 80 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+
    '<path d="M4 32L42 40L76 31L62 49L23 53Z" fill="#fff9e8" stroke="#b69d7a" stroke-width="2"/>'+
    '<path d="M8 31L39 7L43 40Z" fill="#fffdfa" stroke="#b69d7a" stroke-width="2"/>'+
    '<path d="M41 8L72 30L43 40Z" fill="#eedcbe" stroke="#b69d7a" stroke-width="2"/>'+
    '<path d="M4 32L42 40L76 31" fill="none" stroke="#c5ae8d" stroke-width="1.5"/></svg><span class="boat-wave"></span>';
  boat.addEventListener('animationend',()=>{boat.remove();if(movementScene(distance)==='shore')announce('작은 종이배가 수평선 너머로 멀어졌습니다.');},{once:true});
  return boat;
}
let lastBoatAt=0;
function launchBoat(remote=false){
  if(movementScene(distance)!=='shore')return;
  const now=Date.now();
  if(!remote && now-lastBoatAt<4500){announce('종이배가 먼 바다로 가는 동안 잠시 기다려 주세요.');return;}
  if(!remote){lastBoatAt=now;relay?.sendMoment('boat');}
  const field=$('boatField');
  if(field.childElementCount>=3)field.firstElementChild.remove();
  field.append(boatElement());
  announce(remote?'다른 방문자의 종이배가 바다로 나아갑니다.':'마음을 담은 종이배가 수평선을 향해 떠납니다.');
}
function renderStars(rows){
  const sky=$('starSky');sky.replaceChildren();
  if(!rows.length){const el=document.createElement('p');el.className='star-empty';el.textContent='아직 이 하늘에 공개된 아이들의 별이 없습니다.';sky.append(el);return;}
  for(const [i,row] of rows.entries()){
    const star=document.createElement('button');star.type='button';star.className='star-item';
    const pos=starPosition(row,i);star.style.left=pos.x+'%';star.style.top=pos.y+'%';
    star.textContent=row.name;star.setAttribute('aria-label',row.name+'의 공개 추모 기록 열기');
    star.addEventListener('click',()=>{location.href='/memorial.html#story:'+encodeURIComponent(row.id)});
    sky.append(star);
  }
}
async function loadStars(){
  const serial=++starRequest;starStatus='loading';
  const btn=$('nextStars');btn.disabled=true;btn.textContent='별을 불러오는 중…';
  try{
    if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(cfg.projectUrl||'')||
       !/^sb_publishable_[\w-]+$/.test(cfg.publishableKey||''))throw new Error('공개 기록 연결 설정을 확인해 주세요.');
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),7500);
    let response;
    try{response=await fetch(publicStarsUrl(cfg.projectUrl,starCursors[starPage]),
      {headers:{apikey:cfg.publishableKey,Accept:'application/json'},signal:controller.signal});}
    finally{clearTimeout(timer);}
    if(!response.ok)throw new Error('공개 기록을 불러오지 못했습니다.');
    const result=await response.json();
    if(!Array.isArray(result))throw new Error('공개 기록 응답을 확인할 수 없습니다.');
    if(serial!==starRequest)return;
    const rows=result.slice(0,PUBLIC_STAR_PAGE_SIZE).map(cleanPublicStar).filter(Boolean);
    starNextCursor=result.length>PUBLIC_STAR_PAGE_SIZE&&rows.length?
      {published_at:rows.at(-1).published_at,id:rows.at(-1).id}:null;
    renderStars(rows);starStatus='loaded';
    btn.disabled=false;btn.textContent=starNextCursor?'다음 별자리 보기':'첫 별자리 다시 보기';
  }catch(err){
    if(serial!==starRequest)return;
    starStatus='error';renderStars([]);
    const p=$('starSky').querySelector('p');if(p)p.textContent='공개 기록을 불러오지 못했어요. 별들의 기록 페이지에서 찾아볼 수 있습니다.';
    btn.textContent='별자리 다시 불러오기';btn.disabled=false;
  }
}

// The stage is a genuinely continuous, two-axis walk surface. No repeated
// "next step" button is required to traverse the 3 authored environments.
const joystick=$('walkJoystick'),thumb=$('joystickThumb');
let stick={x:0,y:0},stickPointer=null,tapTarget=null,frameId=0,previousFrame=0;
const keys=new Set();
const keyAxes={arrowup:'up',w:'up',arrowdown:'down',s:'down',arrowleft:'left',a:'left',arrowright:'right',d:'right'};
function hasMotion(){return stickPointer!==null||keys.size>0||tapTarget!==null;}
function axes(){
  if(stickPointer!==null)return stick;
  if(keys.size)return {x:Number(keys.has('right'))-Number(keys.has('left')),
    y:Number(keys.has('down'))-Number(keys.has('up'))};
  if(tapTarget)return {x:limit((tapTarget.lane-lane)/.15,-1,1),
    y:limit((distance-tapTarget.distance)/.8,-1,1)};
  return {x:0,y:0};
}
function motionFrame(stamp){
  frameId=0;
  if(!hasMotion()){stage.classList.remove('is-walking');previousFrame=0;return;}
  const dt=previousFrame?Math.min((stamp-previousFrame)/1000,.06):.016;
  previousFrame=stamp;
  const next=advancePose({distance,lane},axes(),dt);
  setPose(next);
  if(tapTarget&&Math.abs(distance-tapTarget.distance)<.025&&Math.abs(lane-tapTarget.lane)<.01)
    tapTarget=null;
  if(hasMotion())frameId=requestAnimationFrame(motionFrame);
  else{stage.classList.remove('is-walking');previousFrame=0;}
}
function resumeMotion(){if(!frameId&&hasMotion()){stage.classList.add('is-walking');frameId=requestAnimationFrame(motionFrame);}}
function stopMotion(){
  stickPointer=null;stick={x:0,y:0};keys.clear();tapTarget=null;
  thumb.style.transform='translate(0px,0px)';
  if(frameId)cancelAnimationFrame(frameId);
  frameId=0;previousFrame=0;stage.classList.remove('is-walking');
}
function aimStick(event){
  const rect=joystick.querySelector('.joystick-track').getBoundingClientRect();
  const x=(event.clientX-(rect.left+rect.width/2))/(rect.width*.34);
  const y=(event.clientY-(rect.top+rect.height/2))/(rect.height*.34);
  const len=Math.max(1,Math.hypot(x,y));stick={x:x/len,y:y/len};
  thumb.style.transform=`translate(${(stick.x*27).toFixed(1)}px,${(stick.y*27).toFixed(1)}px)`;
}
joystick.addEventListener('pointerdown',event=>{
  if(stickPointer!==null)return;
  event.preventDefault();tapTarget=null;stickPointer=event.pointerId;
  joystick.setPointerCapture(event.pointerId);aimStick(event);resumeMotion();
});
joystick.addEventListener('pointermove',event=>{if(stickPointer===event.pointerId)aimStick(event);});
function releaseStick(event){
  if(stickPointer!==event.pointerId)return;
  stickPointer=null;stick={x:0,y:0};thumb.style.transform='translate(0px,0px)';
}
joystick.addEventListener('pointerup',releaseStick);
joystick.addEventListener('pointercancel',releaseStick);
joystick.addEventListener('lostpointercapture',releaseStick);
stage.addEventListener('click',event=>{
  if(event.target.closest('button,a,#walkJoystick,.journey-hud,.scene-message'))return;
  const box=stage.getBoundingClientRect();
  tapTarget=tapDestination(distance,lane,(event.clientX-box.left)/box.width,
    (event.clientY-box.top)/box.height);
  resumeMotion();
});
window.addEventListener('keydown',event=>{
  if(event.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
  const axis=keyAxes[event.key.toLowerCase()];if(!axis)return;
  event.preventDefault();tapTarget=null;keys.add(axis);resumeMotion();
});
window.addEventListener('keyup',event=>{const axis=keyAxes[event.key.toLowerCase()];if(axis)keys.delete(axis);});
window.addEventListener('blur',stopMotion);
$('morningButton').addEventListener('click',()=>setTime('morning'));
$('nightButton').addEventListener('click',()=>setTime('night'));
$('floatBoat').addEventListener('click',()=>launchBoat());
$('nextStars').addEventListener('click',()=>{
  if(starStatus==='loading')return;
  if(starStatus==='error'){loadStars();return;}
  if(starNextCursor){starPage++;starCursors[starPage]=starNextCursor;}
  else{starPage=0;starCursors=[null];}
  loadStars();
});
$('walkJoin').addEventListener('click',()=>{
  onlineWanted=!onlineWanted;
  if(onlineWanted)newRelay();else relay?.stop();
  $('walkJoin').textContent=onlineWanted?'혼자 산책하기':'✧ 다른 방문자와 함께 걷기';
});
$('walkChangeRoom').addEventListener('click',()=>{if(!onlineWanted)return;seed=(seed+1)%ROOM_COUNT;newRelay();});
$('walkShare').addEventListener('click',async()=>{
  const selected=relay?.joined?relay.plan[relay.attempt]:seed;
  const url=new URL(location.pathname,location.origin);
  url.searchParams.set('room',String(selected+1).padStart(2,'0'));
  try{
    if(navigator.share)await navigator.share({title:'별빛 추모관 · 기억의 산책길',url:url.href});
    else{await navigator.clipboard.writeText(url.href);$('walkStatus').textContent='같은 길 초대 링크를 복사했습니다.';}
  }catch(err){if(err?.name!=='AbortError')$('walkStatus').textContent='주소창의 링크를 직접 공유해 주세요.';}
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){relay?.stop();if(onlineWanted)$('walkStatus').textContent='잠시 연결을 쉬고 있습니다.';}
  else if(onlineWanted)newRelay();
});
window.addEventListener('pagehide',()=>relay?.stop());
self.dataset.tone=String(tone);
setAvatarPosition(self,lane);showStatus('solo','',-1);updateJourney();
