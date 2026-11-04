(() => {
'use strict';
// Seven original real-time Web Audio soundscapes; no sampled or extracted third-party music.
// Optional owner-published audio uses the existing Supabase media library and requires attribution.
const $=id=>document.getElementById(id);
const sounds={
  haesu:{name:'바다의 자비',root:174.61,sea:.115,bell:.012,tint:340},
  daewoong:{name:'고요한 반야의 울림',root:146.83,sea:.032,bell:.013,tint:190},
  lantern:{name:'연등의 온기',root:261.63,sea:.045,bell:.025,tint:490},
  kitchen:{name:'따뜻한 공양',root:196,sea:.035,bell:.015,tint:260},
  wish:{name:'소원을 담은 연꽃',root:233.08,sea:.05,bell:.023,tint:360},
  rest:{name:'파도에 쉬어가기',root:174.61,sea:.155,bell:.009,tint:520},
  trail:{name:'바람과 산책',root:220,sea:.105,bell:.011,tint:440}
};
const player=$('templeAudio'),toggle=$('templeAudioToggle'),volume=$('templeAudioVolume'),mood=$('templeAudioMood'),credit=$('templeAudioCredit'),status=$('templeAudioStatus');
const licensed=new Map();
let scene='',running=false,context=null,master=null,audio=null,chimes=null,generation=0;
const AudioEngine=window.AudioContext||window.webkitAudioContext;
function sceneFromHash(){const key=location.hash.replace(/^#/,'');return Object.hasOwn(sounds,key)?key:''}
function validRemote(input){try{const url=new URL(input);return url.protocol==='https:'&&!url.username&&!url.password&&!/(^|\.)youtu(?:be)?(?:\.com)?$/.test(url.hostname)&&/\.(mp3|ogg|wav|m4a)(?:$)/i.test(url.pathname)}catch(_){return false}}
function mediaURL(row,config){
  if(/^audio\/[a-z0-9-]+\.(mp3|ogg|wav|m4a)$/.test(row.source_path||''))
    return config.projectUrl+'/storage/v1/object/public/hm-media/'+row.source_path;
  return validRemote(row.source_url)?row.source_url:'';
}
function volumeValue(){return Math.max(0,Math.min(1,Number(volume.value||0)/100))}
function displayCredit(){
  credit.replaceChildren();
  const entry=licensed.get(scene);
  if(entry){
    credit.append(document.createTextNode('음원: '+entry.title+' · 저작자/출처/라이선스: '+entry.description+' · '));
    const link=document.createElement('a');link.href=entry.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='음원 주소 확인 ↗';credit.append(link);
  }else{
    credit.textContent='음향 제작: 헤뭉이의 마음쉼터 · 오리지널 실시간 합성 사운드 (외부 음원·샘플 미사용). © 2026 일현 조성훈.';
  }
}
function updateButton(){
  toggle.textContent=running?'Ⅱ 소리 멈추기':'▶ 소리 듣기';
  toggle.setAttribute('aria-pressed',String(running));
}
function stopSound(){
  generation++;
  if(chimes!==null){clearInterval(chimes);chimes=null}
  if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio=null}
  const old=context,oldMaster=master;context=null;master=null;
  if(old){try{if(oldMaster){oldMaster.gain.cancelScheduledValues(old.currentTime);oldMaster.gain.setTargetAtTime(0,old.currentTime,.10)}}catch(_){}
    setTimeout(()=>old.close().catch(()=>{}),350)}
  running=false;updateButton();
}
function bell(ctx,destination,frequency,intensity){
  const now=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type='sine';osc.frequency.setValueAtTime(frequency,now);osc.frequency.exponentialRampToValueAtTime(frequency*.992,now+3.5);
  gain.gain.setValueAtTime(.00001,now);gain.gain.exponentialRampToValueAtTime(Math.max(.0005,intensity),now+.045);gain.gain.exponentialRampToValueAtTime(.00001,now+4.2);
  osc.connect(gain);gain.connect(destination);osc.start(now);osc.stop(now+4.25);
}
function makeSynth(key){
  if(!AudioEngine)throw new Error('이 브라우저는 실시간 음향을 지원하지 않습니다.');
  const item=sounds[key],ctx=new AudioEngine();
  context=ctx;
  const m=ctx.createGain();master=m;m.gain.value=0;m.connect(ctx.destination);
  m.gain.setTargetAtTime(volumeValue()*.64,ctx.currentTime,.20);
  const buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate),data=buffer.getChannelData(0);
  let previous=0;
  for(let i=0;i<data.length;i++){previous=(previous*.945)+(Math.random()*2-1)*.055;data[i]=previous}
  const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),wave=ctx.createGain();
  noise.buffer=buffer;noise.loop=true;filter.type='lowpass';filter.frequency.value=item.tint;wave.gain.value=item.sea;
  noise.connect(filter);filter.connect(wave);wave.connect(m);noise.start();
  const lfo=ctx.createOscillator(),mod=ctx.createGain();
  lfo.type='sine';lfo.frequency.value=.09;mod.gain.value=item.sea*.30;lfo.connect(mod);mod.connect(wave.gain);lfo.start();
  [1,1.5,2].forEach((multiple,i)=>{
    const osc=ctx.createOscillator(),g=ctx.createGain();
    osc.type=i===1?'triangle':'sine';osc.frequency.value=item.root*multiple;g.gain.value=[.020,.010,.005][i];
    osc.connect(g);g.connect(m);osc.start();
  });
  let count=0;
  function chime(){if(context!==ctx)return;const scale=[1,1.5,2,1.333,1.5];bell(ctx,m,item.root*4*scale[count%scale.length],item.bell);count++}
  chimes=setInterval(chime,11500);
  setTimeout(chime,1500);
  return ctx.resume();
}
async function startSound(){
  if(!scene)return;
  const startedAt=++generation;
  toggle.disabled=true;status.textContent='';
  const entry=licensed.get(scene);
  try{
    if(entry){
      const track=new Audio();track.preload='none';track.loop=true;track.volume=volumeValue();track.src=entry.url;audio=track;
      await track.play();
      if(startedAt!==generation){track.pause();return}
    }else{
      await makeSynth(scene);
      if(startedAt!==generation)return;
    }
    running=true;updateButton();
  }catch(_){
    stopSound();
    status.textContent=entry?'등록된 음원을 재생하지 못했습니다. 음원 주소와 형식을 확인해 주세요.':'소리를 재생할 수 없습니다. 브라우저의 오디오 설정을 확인해 주세요.';
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
    for(const row of rows){
      const key=typeof row.slot==='string'?row.slot.replace(/^music-temple-/,''):'';
      if(!Object.hasOwn(sounds,key)||!row.title?.trim()||!row.description?.trim())continue;
      const source=mediaURL(row,c);
      if(source)licensed.set(key,{title:row.title.trim(),description:row.description.trim(),url:source});
    }
    render();
  }catch(_){/* Original sounds remain available without the CMS. */}
  finally{clearTimeout(timer)}
}
toggle.addEventListener('click',()=>{if(running){stopSound();status.textContent='소리를 멈췄습니다.'}else startSound()});
volume.addEventListener('input',()=>{const v=volumeValue();if(master&&context)master.gain.setTargetAtTime(v*.64,context.currentTime,.08);if(audio)audio.volume=v});
window.addEventListener('hashchange',render);
window.addEventListener('temple:video-start',()=>{if(running){stopSound();status.textContent='영상 재생을 위해 배경 소리를 멈췄습니다.'}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running){stopSound();status.textContent='다시 듣고 싶을 때 재생 버튼을 눌러 주세요.'}});
window.addEventListener('pagehide',stopSound);
render();loadTracks();
})();