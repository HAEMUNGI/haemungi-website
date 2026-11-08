import {clamp,ROOM_COUNT} from './memorial-walk-core.mjs';
import {MemorialWalkRelay} from './memorial-walk-realtime.mjs';
import {LAST_STEP,PUBLIC_STAR_PAGE_SIZE,sceneForRelayY,
  relayYForStep,cleanPublicStar,starPosition,publicStarsUrl} from './memorial-journey-core.mjs';
import {advancePose,advanceShorePose,limit,movementScene,movementSceneProgress,
  tapDestination,shoreTapDestination,projectedWalkPosition,shorePoint,pathPoint,
  WALK_PATHS,WALK_SPEED,LANE_SPEED,SHORE_SPEED} from './memorial-walk-motion.mjs?v=20261105-freewalk2';
import {WALK_IDENTITY_KEY,FELT_AVATARS,cleanWalkIdentity,cleanWalkNickname,
  genderForTone} from './memorial-walk-identity.mjs';
import {initAvatarChat} from './avatar-chat.js';

const $=id=>document.getElementById(id);
const stage=$('walkStage'),avatarLayer=$('walkAvatars'),self=$('walkSelf');
const shoreCinema=$('shoreCinema');
const sunriseIntro=$('shoreSunriseIntro'),sunriseIdle=$('shoreSunriseIdle'),nightOcean=$('shoreNightVideo');
const shoreVideos=[sunriseIntro,sunriseIdle,nightOcean];
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
const cfg=window.HAEMUNGI_CONTENT_CONFIG||{};
const random=new Uint8Array(1);crypto.getRandomValues(random);
const visitorId=crypto.randomUUID(); // Anonymous and temporary.
function savedIdentity(){
  try{return cleanWalkIdentity(JSON.parse(localStorage.getItem(WALK_IDENTITY_KEY)||'null'));}
  catch{return null;}
}
let identity=savedIdentity(),tone=identity?FELT_AVATARS[identity.gender].tone:random[0]%2;
const requestedRoom=new URLSearchParams(location.search).get('room');
let seed=/^0[1-8]$/.test(requestedRoom||'')?Number(requestedRoom)-1:random[0]%ROOM_COUNT;
let distance=0,lane=.5,shoreDepth=0,pendingBoat=false,dayTime='morning',onlineWanted=false,relay=null;
let peerViews=new Map(),currentPeers=[];
let starPage=0,starCursors=[null],starNextCursor=null,starStatus='unloaded',starRequest=0;
let cinemaSerial=0,cinemaMode='off',idleStarted=false;

function prepareShoreVideo(video){
  if(!video.src){video.src=video.dataset.src;video.load();}
}
function stopShoreCinema(){
  cinemaSerial++;cinemaMode='off';idleStarted=false;
  shoreCinema.classList.remove('is-ready');
  for(const video of shoreVideos){video.pause();video.classList.remove('is-active');}
}
function startSunriseIdle(){
  if(idleStarted||cinemaMode!=='morning'||document.hidden)return;
  idleStarted=true;
  const serial=cinemaSerial;
  prepareShoreVideo(sunriseIdle);
  sunriseIdle.currentTime=0;
  Promise.resolve(sunriseIdle.play()).then(()=>{
    if(serial!==cinemaSerial||cinemaMode!=='morning')return;
    sunriseIdle.classList.add('is-active');
    sunriseIntro.classList.remove('is-active');
    window.setTimeout(()=>sunriseIntro.pause(),380);
  }).catch(()=>{idleStarted=false;/* Keep the final sunrise frame if idle playback is blocked. */});
}
function startShoreCinema(){
  stopShoreCinema();
  if(movementScene(distance)!=='shore'||reducedMotion.matches||document.hidden)return;
  cinemaMode=dayTime;
  const serial=cinemaSerial;
  const video=dayTime==='night'?nightOcean:sunriseIntro;
  prepareShoreVideo(video);
  if(dayTime==='morning')prepareShoreVideo(sunriseIdle);
  video.currentTime=0;
  const reveal=()=>{
    if(serial!==cinemaSerial||cinemaMode!==dayTime)return;
    video.classList.add('is-active');shoreCinema.classList.add('is-ready');
  };
  video.addEventListener('playing',reveal,{once:true});
  Promise.resolve(video.play()).catch(()=>{/* Static original artwork remains visible. */});
}
sunriseIntro.addEventListener('timeupdate',()=>{
  if(cinemaMode==='morning'&&sunriseIntro.duration>0&&sunriseIntro.currentTime>=sunriseIntro.duration-.35)startSunriseIdle();
});
sunriseIntro.addEventListener('ended',startSunriseIdle);
for(const video of shoreVideos)video.addEventListener('error',()=>{
  if(video.classList.contains('is-active')){
    stopShoreCinema(); // The supplied original background remains a readable fallback.
  }
});
reducedMotion.addEventListener?.('change',()=>startShoreCinema());

function setAvatarPosition(node,x,atDistance=distance,atShoreDepth=shoreDepth){
  const pos=movementScene(atDistance)==='shore'?
    shorePoint(atShoreDepth,x):projectedWalkPosition(atDistance,x);
  node.style.left=(pos.x*100).toFixed(2)+'%';
  node.style.top=(pos.y*100).toFixed(2)+'%';
  node.style.setProperty('--avatar-scale',pos.scale.toFixed(3));
}
function applyFeltAvatar(node,gender,nickname){
  const assets=FELT_AVATARS[gender]||FELT_AVATARS.male;
  node.classList.add('has-felt');node.dataset.gender=gender;
  node.querySelector('.avatar-felt-main').src=assets.idle;
  node.querySelector('.avatar-felt-alt').src=assets.step;
  node.querySelector('.avatar-label').textContent=nickname;
}
function makeVisitor(visitor){
  const node=document.createElement('div');node.className='walk-avatar has-felt';node.dataset.tone=String(visitor.tone);
  const shadow=document.createElement('span');shadow.className='avatar-shadow';node.append(shadow);
  const art=document.createElement('span');art.className='avatar-art';
  for(const name of ['avatar-felt-main','avatar-felt-alt']){
    const img=document.createElement('img');img.className=name;img.alt='';img.decoding='async';art.append(img);
  }
  node.append(art);
  const label=document.createElement('span');label.className='avatar-label';node.append(label);
  applyFeltAvatar(node,genderForTone(visitor.tone),'방문 별');
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
    node.dataset.tone=String(visitor.tone);
    if(node.dataset.gender!==genderForTone(visitor.tone))
      applyFeltAvatar(node,genderForTone(visitor.tone),'방문 별');
    const peerDistance=limit(Math.round((.93-visitor.y)/.36*LAST_STEP),0,LAST_STEP);
    setAvatarPosition(node,visitor.x,peerDistance,.35);
  }
  for(const [id,node] of peerViews)if(!present.has(id)){node.remove();peerViews.delete(id);}
  $('walkCount').textContent='내 화면의 방문자 · '+(present.size+1)+'명';
}
const identityDialog=$('walkIdentityDialog');
const identityForm=$('walkIdentityForm');
function openIdentityDialog(){
  stopMotion();
  for(const radio of identityForm.querySelectorAll('[name="walkGender"]'))
    radio.checked=identity?.gender===radio.value;
  $('walkNickname').value=identity?.nickname||'';
  $('walkIdentityError').textContent='';
  if(!identityDialog.open){
    if(typeof identityDialog.showModal==='function')identityDialog.showModal();
    else identityDialog.setAttribute('open','');
  }
}
identityForm.addEventListener('submit',event=>{
  event.preventDefault();
  const gender=identityForm.elements.namedItem('walkGender')?.value;
  const nickname=cleanWalkNickname($('walkNickname').value);
  const selected=cleanWalkIdentity({gender,nickname});
  if(!selected){
    $('walkIdentityError').textContent=!gender?'남성 또는 여성 미니미를 선택해 주세요.':'닉네임을 입력해 주세요.';
    (!gender?identityForm.querySelector('input[name="walkGender"]'):$('walkNickname')).focus();
    return;
  }
  identity=selected;tone=FELT_AVATARS[selected.gender].tone;
  self.dataset.tone=String(tone);
  applyFeltAvatar(self,selected.gender,selected.nickname);
  try{localStorage.setItem(WALK_IDENTITY_KEY,JSON.stringify(selected));}
  catch{/* The active walk still works if the browser blocks local storage. */}
  if(typeof identityDialog.close==='function')identityDialog.close();
  else identityDialog.removeAttribute('open');
  if(onlineWanted)newRelay();
  announce(selected.nickname+'님, 별빛 산책길에 오신 것을 환영해요.');
});
$('walkCustomize').addEventListener('click',openIdentityDialog);
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
  chat.refreshRoom();
}
function newRelay(){
  relay?.stop();
  relay=new MemorialWalkRelay({api:cfg.projectUrl,key:cfg.publishableKey,id:visitorId,tone,
    x:lane,y:relayYForStep(distance),seed,onStatus:showStatus,onPeers:renderPeers,
    onChatNotice:roomNo=>chat.onNotice(roomNo),
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
  if(scene==='shore'&&cinemaMode==='off')startShoreCinema();
  else if(scene!=='shore'&&cinemaMode!=='off')stopShoreCinema();
  const titles={garden:'꽃길 끝에서, 바다를 만나요.',trail:'저 멀리, 파도 소리가 들려요.',shore:'이곳에서 마음을 바다에 띄워요.'};
  const labels={garden:'01 · 햇살 꽃길',trail:'02 · 절의 해안 산책로',shore:'03 · 바다 쉼터'};
  $('journeyTitle').textContent=titles[scene];
  $('sceneLabel').textContent=labels[scene];
  $('sceneStep').textContent=distance<.01?'첫 걸음':'여정 '+Math.round(distance/LAST_STEP*100)+'%';
  $('walkProgress').style.width=(distance/LAST_STEP*100)+'%';
  $('journeyDescription').textContent=scene==='garden'?'꽃길의 원하는 지점을 터치해 걸어가세요. 길 끝에서 해안길로 이어집니다.':
    scene==='trail'?'해안 산책로의 오른쪽 위 길 끝까지 걸으면 바다 쉼터로 이어집니다.':'난간에 다가가 종이배를 띄우고 아침과 밤의 바다를 만나 보세요.';
  for(const s of ['Garden','Trail','Shore']){
    const el=$('route'+s),key=s.toLowerCase();
    el.classList.toggle('is-current',key===scene);
    el.classList.toggle('is-past',(key==='garden'&&scene!=='garden')||(key==='trail'&&scene==='shore'));
  }
  $('shoreActions').hidden=scene!=='shore';
  $('starSky').hidden=scene!=='shore'||dayTime!=='night';
  $('starActions').hidden=scene!=='shore'||dayTime!=='night';
  if(scene==='shore'&&dayTime==='night'&&starStatus==='unloaded')loadStars();
  if(scene==='garden')announce('길 위 원하는 지점을 터치하면 그곳까지 걸어갑니다.');
  if(scene==='trail')announce('오른쪽 위로 이어지는 산책길 끝까지 걸어보세요.');
  if(scene==='shore')announce(dayTime==='night'?'별이 된 아이들의 이름을 찾아보세요.':'바다에 종이배를 띄우거나 일출을 바라보세요.');
  setAvatarPosition(self,lane);
  renderPeers();
}
let lastPresenceAt=0;
function setPose(pose){
  const previousScene=movementScene(distance),oldRounded=Math.round(distance);
  distance=limit(pose.distance,0,LAST_STEP);lane=limit(pose.lane,.21,.79);
  if(previousScene!==movementScene(distance)){
    if(movementScene(distance)==='shore'){shoreDepth=0;lane=.5;}
    if(tapTarget){tapTarget=null;hideWalkTarget();}
    updateJourney();
  }
  else {
    stage.style.setProperty('--forward',movementSceneProgress(distance).toFixed(3));
    stage.style.setProperty('--camera-pan',((.5-lane)*4).toFixed(2)+'%');
    $('walkProgress').style.width=(distance/LAST_STEP*100)+'%';
    if(oldRounded!==Math.round(distance))$('sceneStep').textContent='여정 '+Math.round(distance/LAST_STEP*100)+'%';
    setAvatarPosition(self,lane);
  }
  const now=performance.now();
  if(now-lastPresenceAt>=150){relay?.move(lane,relayYForStep(distance));lastPresenceAt=now;}
}
function setTime(next){
  if((next!=='morning'&&next!=='night')||movementScene(distance)!=='shore')return;
  dayTime=next;stage.classList.toggle('time-morning',next==='morning');stage.classList.toggle('time-night',next==='night');
  startShoreCinema();
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

// Tap a visible point on the actual path, or steer continuously with the stick.
// The avatar occupies real x/y positions and crosses a scene at the far end.
const joystick=$('walkJoystick'),thumb=$('joystickThumb');
let stick={x:0,y:0},stickPointer=null,tapTarget=null,frameId=0,previousFrame=0;
const keys=new Set();
const keyAxes={arrowup:'up',w:'up',arrowdown:'down',s:'down',arrowleft:'left',a:'left',arrowright:'right',d:'right'};
const targetMarker=$('walkTarget');
function hideWalkTarget(){targetMarker.hidden=true;}
function showWalkTarget(){
  if(!tapTarget)return hideWalkTarget();
  const scene=movementScene(distance);
  const point=scene==='shore'?shorePoint(tapTarget.depth,tapTarget.lane):
    pathPoint(scene,(tapTarget.distance-WALK_PATHS[scene].start)/
      (WALK_PATHS[scene].end-WALK_PATHS[scene].start),tapTarget.lane);
  targetMarker.style.left=(point.x*100).toFixed(2)+'%';
  targetMarker.style.top=(point.y*100).toFixed(2)+'%';
  targetMarker.hidden=false;
}
function hasMotion(){return stickPointer!==null||keys.size>0||tapTarget!==null;}
function axes(){
  if(stickPointer!==null)return stick;
  if(keys.size)return {x:Number(keys.has('right'))-Number(keys.has('left')),
    y:Number(keys.has('down'))-Number(keys.has('up'))};
  if(tapTarget)return {x:limit((tapTarget.lane-lane)/.12,-1,1),
    y:limit((movementScene(distance)==='shore'?shoreDepth-tapTarget.depth:
      distance-tapTarget.distance)/.45,-1,1)};
  return {x:0,y:0};
}
function reached(value,target,step){return Math.abs(value-target)<=Math.max(step*1.3,.012);}
function motionFrame(stamp){
  frameId=0;
  if(!hasMotion()){stage.classList.remove('is-walking');previousFrame=0;return;}
  const dt=previousFrame?Math.min((stamp-previousFrame)/1000,.06):.016;
  previousFrame=stamp;
  const vector=axes();
  if(vector.x>.15)self.dataset.facing='right';
  else if(vector.x<-.15)self.dataset.facing='left';
  if(movementScene(distance)==='shore'){
    const next=advanceShorePose({depth:shoreDepth,lane},vector,dt);
    if(tapTarget?.kind==='shore'){
      if(reached(next.depth,tapTarget.depth,SHORE_SPEED*dt))next.depth=tapTarget.depth;
      if(reached(next.lane,tapTarget.lane,LANE_SPEED*dt))next.lane=tapTarget.lane;
    }
    shoreDepth=next.depth;lane=next.lane;setAvatarPosition(self,lane);
    if(tapTarget?.kind==='shore'&&shoreDepth===tapTarget.depth&&lane===tapTarget.lane){
      tapTarget=null;hideWalkTarget();
      if(pendingBoat){pendingBoat=false;launchBoat();}
    }
    const now=performance.now();
    if(now-lastPresenceAt>=150){relay?.move(lane,relayYForStep(distance));lastPresenceAt=now;}
  }else{
    const next=advancePose({distance,lane},vector,dt);
    if(tapTarget?.kind==='walk'){
      if(reached(next.distance,tapTarget.distance,WALK_SPEED*dt))next.distance=tapTarget.distance;
      if(reached(next.lane,tapTarget.lane,LANE_SPEED*dt))next.lane=tapTarget.lane;
    }
    setPose(next);
    if(tapTarget?.kind==='walk'&&distance===tapTarget.distance&&lane===tapTarget.lane){
      tapTarget=null;hideWalkTarget();
    }
  }
  if(hasMotion())frameId=requestAnimationFrame(motionFrame);
  else{stage.classList.remove('is-walking');previousFrame=0;}
}
function resumeMotion(){if(!frameId&&hasMotion()){stage.classList.add('is-walking');frameId=requestAnimationFrame(motionFrame);}}
function stopMotion(){
  stickPointer=null;stick={x:0,y:0};keys.clear();tapTarget=null;pendingBoat=false;
  hideWalkTarget();
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
  event.preventDefault();tapTarget=null;pendingBoat=false;hideWalkTarget();stickPointer=event.pointerId;
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
  const x=(event.clientX-box.left)/box.width,y=(event.clientY-box.top)/box.height;
  pendingBoat=false;
  tapTarget=movementScene(distance)==='shore'?{kind:'shore',...shoreTapDestination(x,y)}:
    {kind:'walk',...tapDestination(distance,lane,x,y)};
  showWalkTarget();
  resumeMotion();
});
window.addEventListener('keydown',event=>{
  if(identityDialog.open)return;
  if(event.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
  const axis=keyAxes[event.key.toLowerCase()];if(!axis)return;
  event.preventDefault();tapTarget=null;pendingBoat=false;hideWalkTarget();keys.add(axis);resumeMotion();
});
window.addEventListener('keyup',event=>{const axis=keyAxes[event.key.toLowerCase()];if(axis)keys.delete(axis);});
window.addEventListener('blur',stopMotion);
$('morningButton').addEventListener('click',()=>setTime('morning'));
$('nightButton').addEventListener('click',()=>setTime('night'));
function prepareBoat(){
  if(movementScene(distance)!=='shore'||pendingBoat)return;
  if(shoreDepth<.94||Math.abs(lane-.5)>.035){
    pendingBoat=true;tapTarget={kind:'shore',depth:1,lane:.5};
    showWalkTarget();resumeMotion();
    announce('난간 끝으로 다가가 종이배를 띄웁니다.');
  }else launchBoat();
}
$('floatBoat').addEventListener('click',prepareBoat);
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
    if(navigator.share)await navigator.share({title:'별잇다 · 기억의 산책길',url:url.href});
    else{await navigator.clipboard.writeText(url.href);$('walkStatus').textContent='같은 길 초대 링크를 복사했습니다.';}
  }catch(err){if(err?.name!=='AbortError')$('walkStatus').textContent='주소창의 링크를 직접 공유해 주세요.';}
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){relay?.stop();shoreVideos.forEach(video=>video.pause());if(onlineWanted)$('walkStatus').textContent='잠시 연결을 쉬고 있습니다.';}
  else {
    if(onlineWanted)newRelay();
    if(movementScene(distance)==='shore'){
      if(cinemaMode==='off')startShoreCinema();
      else (shoreVideos.find(video=>video.classList.contains('is-active'))||sunriseIntro).play().catch(()=>{});
    }
  }
});
window.addEventListener('pagehide',()=>{relay?.stop();shoreVideos.forEach(video=>video.pause());});
let chatBubbleTimer=0;
function showSelfChatBubble(message){
  let bubble=self.querySelector('.walk-self-chat-bubble');
  if(!bubble){bubble=document.createElement('span');bubble.className='walk-self-chat-bubble';self.append(bubble);}
  bubble.textContent=message.slice(0,50);
  bubble.hidden=false;
  clearTimeout(chatBubbleTimer);chatBubbleTimer=setTimeout(()=>{bubble.hidden=true;},6500);
}
const chat=initAvatarChat({
  getRoom:()=>onlineWanted&&relay?.joined?relay.plan[relay.attempt]+1:null,
  sessionId:visitorId,
  notifyPeers:roomNo=>relay?.sendChatNotice(roomNo),
  onNewMessage:item=>{if(item.self)showSelfChatBubble(item.body);}
});
applyFeltAvatar(self,identity?.gender||genderForTone(tone),identity?.nickname||'나');
self.dataset.tone=String(tone);
setAvatarPosition(self,lane);showStatus('solo','',-1);updateJourney();
if(!identity)openIdentityDialog();
