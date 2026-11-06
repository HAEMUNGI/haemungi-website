import {cleanPetQuery,photoForPublicPet,formatRemaining,isRoomEligible} from './memorial-communal-core.mjs';

const $=id=>document.getElementById(id);
const cfg=window.HAEMUNGI_CONTENT_CONFIG||{};
const api=cfg.projectUrl||'',key=cfg.publishableKey||'';
const ready=/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(api)&&/^sb_publishable_[\w-]+$/.test(key);
const tokenKey='hm-communal-visitor-v1';
let token='',selectedPet=null,booking=null,activeTab='message',tourDone=false;
let searchSeq=0,claimBusy=false,messageBusy=false,interval=null,serverPollAt=0;

function visitorToken(){
  let value='';
  try{value=localStorage.getItem(tokenKey)||'';}catch{}
  if(!/^[0-9a-f]{64}$/.test(value)){
    const bytes=crypto.getRandomValues(new Uint8Array(32));
    value=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    try{localStorage.setItem(tokenKey,value);}catch{}
  }
  return value;
}
token=visitorToken();
function status(id,text){$(id).textContent=text;}
function node(tag,className,text){
  const el=document.createElement(tag);if(className)el.className=className;
  if(text!==undefined)el.textContent=text;
  return el;
}
async function apiCall(path,method='GET',body=null){
  if(!ready)throw new Error('추모 기록 연결을 확인해 주세요.');
  const response=await fetch(api+'/rest/v1/'+path,{
    method,cache:'no-store',headers:{apikey:key,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  if(!response.ok){
    const error=await response.json().catch(()=>({}));
    throw new Error(error.message||'서버 연결 오류 ('+response.status+')');
  }
  return response.json();
}
const rpc=(name,args)=>apiCall('rpc/'+name,'POST',args);
const bookingRPC=(action,petId=null)=>rpc('hm_temporary_ritual_manage',{
  p_action:action,p_token:token,p_memorial_id:petId
});
const photo=row=>photoForPublicPet(row,api);

function finishTour(){
  const video=$('hallTour');video.pause();video.hidden=true;
  $('hallPoster').src='/memorial/communal-hall-final.webp';$('hallPoster').hidden=false;
  $('hallEntry').hidden=true;$('skipTour').hidden=true;$('unmuteTour').hidden=true;
  $('kioskHotspot').hidden=false;$('hallActions').hidden=false;tourDone=true;
}
async function playTour(automatic=false){
  const video=$('hallTour');$('hallEntry').hidden=true;
  $('hallPoster').hidden=true;video.hidden=false;$('skipTour').hidden=false;
  video.muted=automatic;$('unmuteTour').hidden=!automatic;
  $('kioskHotspot').hidden=true;$('hallActions').hidden=true;
  video.currentTime=0;
  try{await video.play();}catch{
    // Visitors who cannot play video can still enter and use the kiosk.
    finishTour();
  }
}
$('enterHall').addEventListener('click',()=>playTour());
$('replayTour').addEventListener('click',()=>playTour());
$('unmuteTour').addEventListener('click',()=>{
  $('hallTour').muted=false;$('unmuteTour').hidden=true;
});
$('hallTour').addEventListener('ended',finishTour);
$('hallTour').addEventListener('error',finishTour);
$('skipTour').addEventListener('click',finishTour);

function switchTab(tab){
  if(!['message','search','reservation'].includes(tab))return;
  activeTab=tab;
  for(const button of document.querySelectorAll('[data-kiosk-tab]')){
    button.setAttribute('aria-selected',String(button.dataset.kioskTab===tab));
  }
  for(const panel of document.querySelectorAll('[data-kiosk-panel]'))panel.hidden=panel.dataset.kioskPanel!==tab;
  if(tab==='message')loadMessages();
  if(tab==='reservation')refreshAvailability();
}
function openKiosk(tab='message'){
  if(!tourDone)finishTour();
  switchTab(tab);
  if(!$('kioskDialog').open)$('kioskDialog').showModal();
}
$('openKiosk').addEventListener('click',()=>openKiosk());
$('kioskHotspot').addEventListener('click',()=>openKiosk());
$('closeKiosk').addEventListener('click',()=>$('kioskDialog').close());
for(const button of document.querySelectorAll('[data-kiosk-tab]')){
  button.addEventListener('click',()=>switchTab(button.dataset.kioskTab));
}

async function loadMessages(){
  const list=$('hallMessageList');
  try{
    const messages=await apiCall('hm_memorial_hall_messages?select=author_alias,body,created_at&status=eq.approved&order=created_at.desc&limit=12');
    list.replaceChildren();
    if(!messages.length){list.appendChild(node('p','empty-hint','따뜻한 추모 메시지를 기다리고 있어요.'));return;}
    for(const message of messages){
      const item=node('article','message-card');
      item.appendChild(node('strong','',message.author_alias));
      item.appendChild(node('p','',message.body));
      item.appendChild(node('small','',new Date(message.created_at).toLocaleDateString('ko-KR')));
      list.appendChild(item);
    }
  }catch(err){list.replaceChildren(node('p','empty-hint','메시지를 불러오지 못했습니다. '+err.message));}
}
$('hallMessageForm').addEventListener('submit',async event=>{
  event.preventDefault();if(messageBusy)return;
  const form=event.currentTarget,fd=new FormData(form);
  if(String(fd.get('homepage')||'').trim())return;
  const alias=String(fd.get('alias')||'').trim(),body=String(fd.get('body')||'').trim();
  if(!alias||alias.length>30||body.length<2||body.length>300){
    status('hallMessageStatus','이름과 2~300자 메시지를 확인해 주세요.');return;
  }
  messageBusy=true;form.querySelector('button[type=submit]').disabled=true;
  status('hallMessageStatus','메시지를 접수하고 있습니다…');
  try{
    const response=await rpc('hm_hall_message_submit',{p_token:token,p_alias:alias,p_body:body});
    if(response.status==='rate_limited')throw new Error('하루 3회 접수 제한에 도달했습니다.');
    if(response.status!=='pending')throw new Error('접수 정보를 확인해 주세요.');
    form.reset();status('hallMessageStatus','추모 메시지가 접수됐습니다. 관리자 확인 후 공개됩니다.');
  }catch(err){status('hallMessageStatus',err.message);}finally{
    messageBusy=false;form.querySelector('button[type=submit]').disabled=false;
  }
});

function displaySearchResults(rows){
  const box=$('petSearchResults');box.replaceChildren();
  if(!rows.length){box.appendChild(node('p','empty-hint','해당 이름의 공개된 기록을 찾지 못했습니다.'));return;}
  for(const pet of rows){
    const button=node('button','pet-card');button.type='button';
    button.setAttribute('aria-pressed',String(selectedPet?.id===pet.id));
    if(photo(pet)){
      const img=node('img');img.src=photo(pet);img.alt=pet.pet_name+'의 공개된 사진';img.loading='lazy';
      button.appendChild(img);
    }else button.appendChild(node('span','empty-hint','사진이 없습니다.'));
    button.appendChild(node('strong','',pet.pet_name));
    button.appendChild(node('small','',isRoomEligible(pet)?'임시 제례실 이용 가능':'전용 안식 공간이 있는 아이'));
    button.addEventListener('click',()=>{
      selectedPet=pet;
      for(const card of box.querySelectorAll('button'))card.setAttribute('aria-pressed',String(card===button));
      updateReservationChoice();switchTab('reservation');
    });
    box.appendChild(button);
  }
}
$('petSearchForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const current=++searchSeq;
  const query=cleanPetQuery($('petSearchInput').value);
  $('petSearchInput').value=query;
  if(!query){status('petSearchStatus','아이 이름을 입력해 주세요.');return;}
  status('petSearchStatus','공개된 별들을 찾고 있습니다…');
  try{
    const params=new URLSearchParams({
      select:'id,pet_name,born_on,passed_on,photo_path,thumbnail_path,slot_index',
      pet_name:'ilike.*'+query+'*',order:'published_at.desc',limit:'24'
    });
    const rows=await apiCall('hm_memorial_public?'+params);
    if(current!==searchSeq)return;
    displaySearchResults(rows);
    status('petSearchStatus',rows.length+'명의 공개 기록을 찾았습니다.');
  }catch(err){if(current!==searchSeq)return;displaySearchResults([]);status('petSearchStatus',err.message);}
});

function updateReservationChoice(){
  const box=$('reservationChoice');box.replaceChildren();
  if(!selectedPet){box.textContent='먼저 ‘아이 찾기’에서 사진을 선택해 주세요.';return;}
  const src=photo(selectedPet);
  if(src){const img=node('img');img.src=src;img.alt=selectedPet.pet_name+' 사진';box.appendChild(img);}
  box.appendChild(node('strong','',selectedPet.pet_name));
  if(isRoomEligible(selectedPet))box.appendChild(node('small','','전용 공간이 없는 아이 · 임시 제례실 이용 가능'));
  else{
    box.appendChild(node('small','','이 아이는 이미 전용 공간이 마련되어 있습니다.'));
    const link=node('a','','기존 제례실 방문하기 →');link.href='/memorial.html#ritual';box.appendChild(link);
  }
}
async function refreshAvailability(){
  const reserve=$('reserveRoom');reserve.disabled=true;
  status('roomAvailability','이용 가능 여부를 확인합니다…');
  try{
    const response=await bookingRPC('status');
    if(response.status==='available'){
      const others=Number(response.rooms_in_use);
      const count=Number.isFinite(others)?`현재 ${others}개의 방에서 추모 중입니다. `:'';
      status('roomAvailability',count+'독립 임시 제례실을 바로 배정받아 10분간 이용할 수 있습니다.');
    }
    else if(response.status==='occupied')status('roomAvailability','현재 모든 임시 제례실이 이용 중입니다. 약 '+formatRemaining(Date.parse(response.expires_at)-Date.now())+' 후 다시 확인해 주세요.');
    else if(response.status==='active')status('roomAvailability','이미 이용 중인 임시 제례실이 있습니다. 남은 시간 동안 다시 입장할 수 있습니다.');
    else status('roomAvailability','예약 상태를 확인할 수 없습니다.');
    reserve.disabled=!isRoomEligible(selectedPet)||!['available','active'].includes(response.status);
    reserve.textContent=response.status==='active'?'현재 예약한 제례실로 돌아가기':'선택한 아이와 10분 보내기';
  }catch(err){status('roomAvailability','예약 서버 연결 오류: '+err.message);}
}
$('checkAvailability').addEventListener('click',refreshAvailability);

async function fetchPetById(id){
  if(!/^[a-f0-9-]{36}$/i.test(id||''))return null;
  const rows=await apiCall('hm_memorial_public?'+new URLSearchParams({
    select:'id,pet_name,born_on,passed_on,photo_path,thumbnail_path,slot_index',id:'eq.'+id,limit:'1'
  }));
  return rows[0]||null;
}
function startRitual(row,result){
  if(!row||!isRoomEligible(row)||result.status!=='active'||result.memorial_id!==row.id){
    status('reservationStatus','예약 대상이 유효하지 않습니다. 다시 검색해 주세요.');return;
  }
  const expires=Date.parse(result.expires_at);
  if(!Number.isFinite(expires)||expires<=Date.now()){
    status('reservationStatus','이용 시간이 끝났습니다. 예약 상태를 확인해 주세요.');return;
  }
  booking={id:row.id,expires};
  const roomKey=String(result.room_key||'');
  const roomNumber=roomKey==='shared'?'001':/^room-[0-9]{4}$/.test(roomKey)?String(Number(roomKey.slice(5))).padStart(3,'0'):'';
  status('ritualRoomLabel',roomNumber?'별빛 임시 제례실 '+roomNumber+'호':'나만의 임시 제례실');
  const img=$('temporaryPetPhoto');img.src=photo(row);img.alt=row.pet_name+'의 공개 추모 사진';
  $('temporaryPetName').textContent=row.pet_name;
  $('temporaryPetDates').textContent=[row.born_on,row.passed_on].filter(Boolean).join(' ~ ');
  status('ritualSubtitle',row.pet_name+'에게 전하는 조용한 인사');
  status('ritualStatus','10분 후 자동으로 이용이 종료됩니다. 다른 가족의 공간과 독립적으로 이용합니다.');
  $('kioskDialog').close();$('hallView').hidden=true;$('ritualView').hidden=false;
  window.scrollTo({top:0,behavior:'instant'});
  if(interval)clearInterval(interval);
  serverPollAt=Date.now()+15000;
  interval=setInterval(checkRemaining,1000);
  checkRemaining();
}
function endLocalRitual(message){
  booking=null;if(interval){clearInterval(interval);interval=null;}
  $('ritualView').hidden=true;$('hallView').hidden=false;
  if(!tourDone)finishTour();
  $('hallActions').hidden=false;
  if(message)status('reservationStatus',message);
}
async function checkRemaining(){
  if(!booking)return;
  const left=booking.expires-Date.now();
  status('ritualRemaining',formatRemaining(left));
  if(left<=0){
    endLocalRitual('10분 이용 시간이 끝났습니다. 소중한 인사에 함께해 주셔서 감사합니다.');
    openKiosk('reservation');return;
  }
  if(Date.now()<serverPollAt)return;
  serverPollAt=Date.now()+15000;
  try{
    const live=await bookingRPC('status');
    if(!booking)return;
    if(live.status!=='active'||live.memorial_id!==booking.id){
      endLocalRitual('예약이 종료되어 공동 추모홀로 돌아왔습니다.');openKiosk('reservation');
    }
  }catch{status('ritualStatus','연결 확인 중입니다. 서버가 확인될 때까지 시간이 연장되지는 않습니다.');}
}
$('reserveRoom').addEventListener('click',async()=>{
  if(claimBusy||!selectedPet||!isRoomEligible(selectedPet))return;
  claimBusy=true;$('reserveRoom').disabled=true;
  status('reservationStatus','임시 제례실을 예약하고 있습니다…');
  try{
    const response=await bookingRPC('claim',selectedPet.id);
    if(response.status==='active'){
      const pet=response.memorial_id===selectedPet.id?selectedPet:await fetchPetById(response.memorial_id);
      startRitual(pet,response);
    }else if(response.status==='occupied'){
      status('reservationStatus','현재 모든 임시 제례실이 사용 중입니다. 잠시 후 다시 확인해 주세요.');
    }else if(response.status==='not_eligible'){
      status('reservationStatus','전용 제례실이 없는 공개 승인 기록만 예약할 수 있습니다.');
    }else status('reservationStatus','예약 정보를 확인해 주세요.');
  }catch(err){status('reservationStatus',err.message);}finally{
    claimBusy=false;if(!booking)refreshAvailability();
  }
});
$('endRitual').addEventListener('click',async()=>{
  $('endRitual').disabled=true;
  try{
    const response=await bookingRPC('release');
    if(!['released','not_owner'].includes(response.status))throw new Error('이용 종료를 확인하지 못했습니다.');
    endLocalRitual('이용을 마쳤습니다. 함께 기억해 주셔서 감사합니다.');
    openKiosk('reservation');
  }catch(err){status('ritualStatus','종료 처리 오류: '+err.message);}
  finally{$('endRitual').disabled=false;}
});

// Reopen a still-valid reservation after a refresh, without minting a new 10-minute period.
async function restoreRitual(){
  try{
    const result=await bookingRPC('status');
    if(result.status!=='active'||!result.memorial_id)return false;
    const pet=await fetchPetById(result.memorial_id);
    if(pet){startRitual(pet,result);return true;}
  }catch{/* A temporarily unavailable server must not block the hall entrance. */}
  return false;
}
restoreRitual().then(restored=>{
  if(!restored&&new URLSearchParams(location.search).get('tour')==='1')playTour(true);
});
