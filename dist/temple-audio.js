(() => {
'use strict';
// Authentic recordings of temple bells, wind chimes, water and birds. Source and license are linked.
// Audio begins on visitor click. No musical melody, generated hum, or YouTube audio extraction.
const $=id=>document.getElementById(id);
const sounds={
  haesu:{name:"잔잔히 밀려오는 물결",title:"Waves (호숫가 물결 현장 녹음)",creator:"Dsw4",source:'https://commons.wikimedia.org/wiki/File:Waves.ogg',url:'https://upload.wikimedia.org/wikipedia/commons/1/1f/Waves.ogg',license:"퍼블릭 도메인",licenseUrl:"",level:0.5},
  daewoong:{name:"고요히 울리는 사찰 범종",title:"Bonsyou5599 (사찰 범종 녹음)",creator:"Jnn",source:'https://commons.wikimedia.org/wiki/File:Bonsyou5599.ogg',url:'https://upload.wikimedia.org/wikipedia/commons/3/33/Bonsyou5599.ogg',license:"CC BY 2.1 JP",licenseUrl:"https://creativecommons.org/licenses/by/2.1/jp/",level:0.38,gapMs:55000},
  lantern:{name:"바람에 스치는 맑은 풍경",title:"Windglockenspiel.Koshi (풍경 녹음)",creator:"Membeth",source:'https://commons.wikimedia.org/wiki/File:Windglockenspiel.Koshi.ogg',url:'https://upload.wikimedia.org/wikipedia/commons/a/a6/Windglockenspiel.Koshi.ogg',license:"CC0 1.0",licenseUrl:"https://creativecommons.org/publicdomain/zero/1.0/",level:0.55,gapMs:12000},
  kitchen:{name:"창밖의 산들바람과 새소리",title:"Gentle breeze and birds singing",creator:"ezwa",source:'https://commons.wikimedia.org/wiki/File:Gentle_breeze_and_birds_singing.ogg',url:'https://upload.wikimedia.org/wikipedia/commons/0/0e/Gentle_breeze_and_birds_singing.ogg',license:"퍼블릭 도메인",licenseUrl:"",level:0.56},
  wish:{name:"잠깐 울렸다 사라지는 풍경",title:"Windchimes (짧은 풍경 녹음)",creator:"Esc861",source:'https://commons.wikimedia.org/wiki/File:Windchimes.ogg',url:'https://upload.wikimedia.org/wikipedia/commons/0/09/Windchimes.ogg',license:"퍼블릭 도메인",licenseUrl:"",level:0.6,gapMs:35000},
  rest:{name:"조용히 흐르는 물소리",title:"Swale (작은 물줄기 녹음)",creator:"Ksd5",source:'https://commons.wikimedia.org/wiki/File:Swale.ogg',url:'https://upload.wikimedia.org/wikipedia/commons/8/84/Swale.ogg',license:"CC0 1.0",licenseUrl:"https://creativecommons.org/publicdomain/zero/1.0/",level:0.5},
  trail:{name:"새들이 노래하는 정원길",title:"Birds singing in garden",creator:"ezwa",source:'https://commons.wikimedia.org/wiki/File:Birds_singing_in_garden.ogg',url:'https://upload.wikimedia.org/wikipedia/commons/8/80/Birds_singing_in_garden.ogg',license:"퍼블릭 도메인",licenseUrl:"",level:0.55}
};
const player=$('templeAudio'),toggle=$('templeAudioToggle'),volume=$('templeAudioVolume'),mood=$('templeAudioMood'),credit=$('templeAudioCredit'),status=$('templeAudioStatus');
const licensed=new Map();
let scene='',running=false,audio=null,generation=0,gapTimer=null;
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
  credit.append(document.createTextNode('현장 녹음: '+item.title+' · 녹음자: '+item.creator+' · '));
  addLink('녹음 출처 ↗',item.source);
  credit.append(document.createTextNode(' · '));
  if(item.licenseUrl)addLink(item.license+' ↗',item.licenseUrl);
  else addLink(item.license+' ↗',item.source);
  credit.append(document.createTextNode(' · 원본 그대로 재생(편집 없음)'));
}
function updateButton(){
  toggle.textContent=running?'Ⅱ 소리 멈추기':'▶ 마음 소리 듣기';
  toggle.setAttribute('aria-pressed',String(running));
}
function stopSound(){
  generation++;
  if(gapTimer!==null){clearTimeout(gapTimer);gapTimer=null}
  const previous=audio;audio=null;
  if(previous){previous.pause();previous.removeAttribute('src');previous.load()}
  running=false;updateButton();
}
async function startSound(){
  if(!scene)return;
  const startedAt=++generation,trackInfo=licensed.get(scene)||sounds[scene];
  toggle.disabled=true;
  status.textContent='소리를 불러오는 중입니다…';
  const track=new Audio();
  audio=track;
  track.preload='auto';track.loop=!trackInfo.gapMs;
  track.volume=volumeValue()*(trackInfo.level??1);
  track.src=trackInfo.url;
  if(trackInfo.gapMs){
    track.addEventListener('ended',()=>{
      if(audio!==track)return;
      gapTimer=setTimeout(async()=>{
        gapTimer=null;
        if(audio!==track)return;
        try{track.currentTime=0;await track.play()}
        catch(_){if(audio===track){stopSound();status.textContent='다음 종소리를 재생하지 못했습니다.'}}
      },trackInfo.gapMs);
    });
  }
  track.addEventListener('error',()=>{
    if(audio===track&&startedAt===generation){
      stopSound();status.textContent='소리에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
    }
  });
  try{
    await track.play();
    if(startedAt!==generation){track.pause();return}
    running=true;status.textContent='';updateButton();
  }catch(_){
    if(startedAt!==generation)return;
    stopSound();
    status.textContent='소리를 재생하지 못했습니다. 주소나 브라우저 설정을 확인해 주세요.';
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
    if(changed&&audio){stopSound();status.textContent='새 소리가 등록되었습니다. 재생 버튼을 눌러 주세요.'}
    if(changed)render();
  }catch(_){/* Licensed recordings remain the fallback; never use synthetic tones. */}
  finally{clearTimeout(timer)}
}
toggle.addEventListener('click',()=>{
  if(audio){stopSound();status.textContent='소리를 멈췄습니다.'}
  else startSound();
});
volume.addEventListener('input',()=>{if(audio)audio.volume=volumeValue()*(licensed.get(scene)?1:sounds[scene]?.level??1)});
window.addEventListener('hashchange',render);
window.addEventListener('temple:video-start',()=>{if(audio){stopSound();status.textContent='영상 소리가 겹치지 않도록 음악을 멈췄습니다.'}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&audio){stopSound();status.textContent='다시 듣고 싶을 때 재생 버튼을 눌러 주세요.'}});
window.addEventListener('pagehide',stopSound);
render();loadTracks();
})();