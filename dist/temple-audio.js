(() => {
'use strict';
// These are real piano recordings, released by their composer under Creative Commons.
// Audio starts on a visitor click only. No synthetic tones and no YouTube audio extraction.
const $=id=>document.getElementById(id);
const sounds={
  haesu:{name:"바다 앞의 명상",title:"Meditation Impromptu 01",creator:'Kevin MacLeod',source:'https://commons.wikimedia.org/wiki/File:Kevin_MacLeod_-_01_-_Meditation_Impromptu_01.ogg',url:'https://upload.wikimedia.org/wikipedia/commons/6/67/Kevin_MacLeod_-_01_-_Meditation_Impromptu_01.ogg',license:'CC BY 3.0'},
  daewoong:{name:"고요한 마음",title:"Meditation Impromptu 02",creator:'Kevin MacLeod',source:'https://commons.wikimedia.org/wiki/File:Kevin_MacLeod_-_02_-_Meditation_Impromptu_02.ogg',url:'https://upload.wikimedia.org/wikipedia/commons/e/e8/Kevin_MacLeod_-_02_-_Meditation_Impromptu_02.ogg',license:'CC BY 3.0'},
  lantern:{name:"등불의 온기",title:"Bathed in the Light",creator:'Kevin MacLeod',source:'https://commons.wikimedia.org/wiki/File:Kevin_MacLeod_-_Bathed_in_the_Light.ogg',url:'https://upload.wikimedia.org/wikipedia/commons/e/e6/Kevin_MacLeod_-_Bathed_in_the_Light.ogg',license:'CC BY 3.0'},
  kitchen:{name:"따뜻한 오후",title:"Autumn Day",creator:'Kevin MacLeod',source:'https://commons.wikimedia.org/wiki/File:Kevin_MacLeod_-_Autumn_Day.ogg',url:'https://upload.wikimedia.org/wikipedia/commons/5/59/Kevin_MacLeod_-_Autumn_Day.ogg',license:'CC BY 3.0'},
  wish:{name:"조용히 소원을 적는 시간",title:"Calmant",creator:'Kevin MacLeod',source:'https://commons.wikimedia.org/wiki/File:Kevin_MacLeod_-_Calmant.ogg',url:'https://upload.wikimedia.org/wikipedia/commons/3/3c/Kevin_MacLeod_-_Calmant.ogg',license:'CC BY 3.0'},
  rest:{name:"파도에 쉬어가는 시간",title:"Meditation Impromptu 03",creator:'Kevin MacLeod',source:'https://commons.wikimedia.org/wiki/File:Kevin_MacLeod_-_03_-_Meditation_Impromptu_03.ogg',url:'https://upload.wikimedia.org/wikipedia/commons/1/17/Kevin_MacLeod_-_03_-_Meditation_Impromptu_03.ogg',license:'CC BY 3.0'},
  trail:{name:"천천히 걷는 길",title:"On the Passing of Time",creator:'Kevin MacLeod',source:'https://commons.wikimedia.org/wiki/File:Kevin_MacLeod_-_On_the_Passing_of_Time.ogg',url:'https://upload.wikimedia.org/wikipedia/commons/f/fe/Kevin_MacLeod_-_On_the_Passing_of_Time.ogg',license:'CC BY 3.0'}
};
const player=$('templeAudio'),toggle=$('templeAudioToggle'),volume=$('templeAudioVolume'),mood=$('templeAudioMood'),credit=$('templeAudioCredit'),status=$('templeAudioStatus');
const licensed=new Map();
let scene='',running=false,audio=null,generation=0;
function sceneFromHash(){const key=location.hash.replace(/^#/,'');return Object.hasOwn(sounds,key)?key:''}
function validRemote(input){
  try{
    const url=new URL(input);
    return url.protocol==='https:'&&!url.username&&!url.password&&!url.hostname.includes('youtube.com')&&!url.hostname.includes('youtu.be')&&/\.(mp3|ogg|wav|m4a)$/i.test(url.pathname);
  }catch(_){return false}
}
function mediaURL(row,config){
  if(/^audio\/[a-z0-9-]+\.(mp3|ogg|wav|m4a)$/.test(row.source_path||''))
    return config.projectUrl+'/storage/v1/object/public/hm-media/'+row.source_path;
  return validRemote(row.source_url)?row.source_url:'';
}
function volumeValue(){return Math.max(0,Math.min(1,Number(volume.value||0)/100))}
function addLink(label,url){
  const link=document.createElement('a');
  link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=label;
  credit.append(link);
}
function displayCredit(){
  credit.replaceChildren();
  const override=licensed.get(scene);
  if(override){
    credit.append(document.createTextNode('음원: '+override.title+' · 저작자·출처·이용허락: '+override.description+' · '));
    addLink('음원 주소 ↗',override.url);
    return;
  }
  const item=sounds[scene];
  if(!item)return;
  credit.append(document.createTextNode('곡명: '+item.title+' · 작곡: '+item.creator+' · '));
  addLink('음원 출처 ↗',item.source);
  credit.append(document.createTextNode(' · '));
  addLink(item.license+' ↗','https://creativecommons.org/licenses/by/3.0/');
  credit.append(document.createTextNode(' · 원본 그대로 재생(변경 없음)'));
}
function updateButton(){
  toggle.textContent=running?'Ⅱ 음악 멈추기':'▶ 음악 듣기';
  toggle.setAttribute('aria-pressed',String(running));
}
function stopSound(){
  generation++;
  const previous=audio;audio=null;
  if(previous){previous.pause();previous.removeAttribute('src');previous.load()}
  running=false;updateButton();
}
async function startSound(){
  if(!scene)return;
  const startedAt=++generation,trackInfo=licensed.get(scene)||sounds[scene];
  toggle.disabled=true;
  status.textContent='음원을 불러오는 중입니다…';
  const track=new Audio();
  audio=track;
  track.preload='auto';track.loop=true;track.volume=volumeValue();track.src=trackInfo.url;
  track.addEventListener('error',()=>{
    if(audio===track&&startedAt===generation){
      stopSound();status.textContent='음원에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
    }
  });
  try{
    await track.play();
    if(startedAt!==generation){track.pause();return}
    running=true;status.textContent='';updateButton();
  }catch(_){
    if(startedAt!==generation)return;
    stopSound();
    status.textContent='음악을 재생하지 못했습니다. 음원 주소나 브라우저 설정을 확인해 주세요.';
  }finally{toggle.disabled=false}
}
function render(){
  const next=sceneFromHash();
  if(next!==scene){stopSound();scene=next;status.textContent=''}
  player.hidden=!scene;
  if(!scene)return;
  mood.textContent=sounds[scene].name;
  displayCredit();updateButton();
}
async function loadTracks(){
  const c=window.HAEMUNGI_CONTENT_CONFIG||{};
  if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(c.projectUrl||'')||!/^sb_publishable_[\w-]+$/.test(c.publishableKey||''))return;
  const slots=Object.keys(sounds).map(k=>'music-temple-'+k).join(',');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);
  try{
    const url=c.projectUrl+'/rest/v1/hm_media_public?select=slot,kind,title,description,source_path,source_url&slot=in.('+slots+')&kind=eq.audio&is_published=eq.true';
    const response=await fetch(url,{headers:{apikey:c.publishableKey,Accept:'application/json'},signal:controller.signal,cache:'no-store'});
    if(!response.ok)return;
    const rows=await response.json();
    if(!Array.isArray(rows))return;
    let changed=false;
    for(const row of rows){
      const key=typeof row.slot==='string'?row.slot.replace(/^music-temple-/,''):'';
      if(!Object.hasOwn(sounds,key)||!row.title?.trim()||!row.description?.trim())continue;
      const source=mediaURL(row,c);
      if(source){licensed.set(key,{title:row.title.trim(),description:row.description.trim(),url:source});changed=true}
    }
    if(changed&&audio){stopSound();status.textContent='새 음악이 등록되었습니다. 재생 버튼을 눌러 주세요.'}
    if(changed)render();
  }catch(_){/* Licensed recordings remain the fallback; never use synthetic tones. */}
  finally{clearTimeout(timer)}
}
toggle.addEventListener('click',()=>{
  if(audio){stopSound();status.textContent='음악을 멈췄습니다.'}
  else startSound();
});
volume.addEventListener('input',()=>{if(audio)audio.volume=volumeValue()});
window.addEventListener('hashchange',render);
window.addEventListener('temple:video-start',()=>{if(audio){stopSound();status.textContent='영상 소리가 겹치지 않도록 음악을 멈췄습니다.'}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&audio){stopSound();status.textContent='다시 듣고 싶을 때 재생 버튼을 눌러 주세요.'}});
window.addEventListener('pagehide',stopSound);
render();loadTracks();
})();