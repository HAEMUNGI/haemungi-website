(() => {
"use strict";
const $ = id => document.getElementById(id);
const games = ["tarot", "pet", "rps"];
const tarot = [
 {no:"00",name:"첫 번째 눈뜸",art:"assets/tarot-00.png",meaning:"가능성의 시작",message:"아직 작아 보여도 괜찮몽. 오늘의 작은 발견이 내일의 큰 이야기가 될 수 있몽!"},
 {no:"01",name:"새로운 여정",art:"assets/tarot-01.png",meaning:"낯선 길에 첫발을",message:"오늘은 평소와 다른 길을 걸어보몽. 낯선 풍경 속에서 소중한 것을 찾게 될지 모르몽!"},
 {no:"02",name:"선택의 갈림길",art:"assets/tarot-02.png",meaning:"마음이 향하는 쪽",message:"정답은 하나만 있는 게 아니몽. 천천히 생각하고 마음이 편안해지는 쪽을 골라보몽!"},
 {no:"03",name:"성장의 시간",art:"assets/tarot-03.png",meaning:"작은 것을 돌보는 힘",message:"오늘 심은 씨앗이 당장 꽃피지 않아도 괜찮몽. 매일의 작은 정성이 모여 자라난다몽!"},
 {no:"04",name:"작은 용기",art:"assets/tarot-04.png",meaning:"한 걸음의 용기",message:"겁이 나는 건 당연하몽. 그래도 한 걸음 내딛는 당신을 헤뭉이가 응원하몽!"}
];
const DEFAULT_PET = () => ({xp:0,full:80,happy:80,energy:80,lastSeen:Date.now(),interactions:0});
const STORE = {tarot:"hm_playground_tarot_v1",pet:"hm_playground_pet_v1",rps:"hm_playground_rps_v1"};
let pet = DEFAULT_PET();
let scores = {wins:0,draws:0,losses:0};
let drawnCard = null, toastTimer;
function read(key,fallback){try{const v=JSON.parse(localStorage.getItem(key));return v && typeof v==="object" ? v : fallback;}catch(_){return fallback;}}
function save(key,v){try{localStorage.setItem(key,JSON.stringify(v));return true;}catch(_){return false;}}
function clamp(n){return Math.round(Math.max(0,Math.min(100,Number(n)||0)));}
function notify(msg){const t=$("pg-toast");t.textContent=msg;t.classList.add("shown");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("shown"),3000);}
function randomInt(n){if(window.crypto?.getRandomValues){let b=new Uint32Array(1);crypto.getRandomValues(b);return b[0]%n;}return Math.floor(Math.random()*n);}
function koreaDate(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function route(){
 const routeName=decodeURIComponent(location.hash.slice(1)).replace(/[^a-z]/g,"");
 const target=games.includes(routeName)?routeName:"plaza";
 $("pg-plaza").hidden=target!=="plaza";
 for(const name of games)$("pg-game-"+name).hidden=target!==name;
 document.title=(target==="plaza"?"헤뭉이 놀이터":target==="tarot"?"헤뭉이 타로":target==="pet"?"헤뭉이 키우기":"헤뭉이 가위바위보")+" | HAEMUNGI";
 window.scrollTo({top:0,behavior:"instant"});
 if(target==="tarot")initTarot();
 if(target==="pet")renderPet();
 if(target==="rps")renderRps();
}
for(const b of document.querySelectorAll("[data-enter]"))b.addEventListener("click",()=>{location.hash=b.dataset.enter;route();});
for(const b of document.querySelectorAll("[data-back]"))b.addEventListener("click",()=>{location.hash="playground";route();});
window.addEventListener("hashchange",route);

function initTarot(){
 const stored=read(STORE.tarot,null);
 if(stored?.date===koreaDate()&&tarot.some(c=>c.no===stored.no)){
  revealTarot(tarot.find(c=>c.no===stored.no),true);
 }else{
  drawnCard=null;$("tarot-picker").hidden=false;$("tarot-card").hidden=true;
  $("tarot-card-inner").classList.remove("revealed");$("tarot-state").textContent="마음에 드는 카드를 골라 보세요.";
  $("tarot-meaning").hidden=true;$("tarot-meaning").textContent="";$("tarot-message").textContent="";
  $("tarot-share").hidden=true;document.querySelector(".pg-reading-hint").hidden=false;
 }
}
function revealTarot(card,immediate=false){
 drawnCard=card;
 $("tarot-picker").hidden=true;$("tarot-card").hidden=false;
 $("tarot-num").textContent=card.no;$("tarot-name").textContent=card.name;
 $("tarot-art").src=card.art;$("tarot-art").alt="헤뭉이 타로 "+card.no+"번 "+card.name+" 독립 일러스트";
 $("tarot-card-inner").classList.remove("revealed");
 $("tarot-state").textContent="오늘의 카드";
 $("tarot-meaning").hidden=false;$("tarot-meaning").textContent=card.meaning;
 $("tarot-message").textContent=card.message;$("tarot-share").hidden=false;
 document.querySelector(".pg-reading-hint").hidden=true;
 if(immediate)$("tarot-card-inner").classList.add("revealed");
 else requestAnimationFrame(()=>setTimeout(()=>$("tarot-card-inner").classList.add("revealed"),240));
}
for(const button of document.querySelectorAll("[data-pick]"))button.addEventListener("click",()=>{
 if(drawnCard)return;
 const card=tarot[randomInt(tarot.length)];
 save(STORE.tarot,{date:koreaDate(),no:card.no});
 revealTarot(card);
});
$("tarot-share").addEventListener("click",async()=>{
 if(!drawnCard)return;
 const url=location.href.split("#")[0]+"#tarot";
 const text="오늘의 헤뭉이 타로 ✦ "+drawnCard.name+"\n"+drawnCard.message+"\n"+url;
 try{if(navigator.share){await navigator.share({title:"헤뭉이 오늘의 타로",text,url});return;}
 if(navigator.clipboard){await navigator.clipboard.writeText(text);notify("오늘의 카드 내용을 복사했몽!");return;}}
 catch(e){if(e.name==="AbortError")return;}
 notify("공유가 지원되지 않는 환경이에몽.");
});

function petLevel(){return 1+Math.floor(Math.max(0,pet.xp)/25);}
function remember(message){
 const day=koreaDate();
 if(!Array.isArray(pet.memories))pet.memories=[];
 if(pet.memories.some(x=>x.date===day&&x.message===message))return;
 pet.memories.unshift({date:day,message});
 pet.memories=pet.memories.slice(0,16);
}
function restorePet(){
 pet=Object.assign(DEFAULT_PET(),read(STORE.pet,{}));
 for(const k of ["xp","full","happy","energy","lastSeen","interactions"])if(!Number.isFinite(Number(pet[k])))pet[k]=DEFAULT_PET()[k];
 pet.xp=Math.max(0,Math.floor(Number(pet.xp)||0));
 pet.bond=Math.max(0,Math.min(100,Number(pet.bond)||0));
 pet.days=Array.isArray(pet.days)?pet.days.filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)).slice(-89):[];
 const day=koreaDate();
 if(!pet.days.includes(day)){pet.days.push(day);pet.days=pet.days.slice(-90);}
 if(!pet.careDay||pet.careDay.date!==day)pet.careDay={date:day,count:0};
 pet.careDay.count=Math.max(0,Math.min(3,Number(pet.careDay.count)||0));
 pet.memories=Array.isArray(pet.memories)?pet.memories.filter(x=>x&&typeof x.date==="string"&&typeof x.message==="string").slice(0,16):[];
 if(!["petals","stars","butterflies"].includes(pet.decor))pet.decor="petals";
 const hours=Math.min(168,Math.max(0,(Date.now()-Number(pet.lastSeen))/3600000));
 pet.full=clamp(pet.full-Math.min(20,hours*.6));
 pet.happy=clamp(pet.happy-Math.min(15,hours*.4));
 pet.energy=clamp(pet.energy-Math.min(12,hours*.3));
 pet.lastSeen=Date.now();
 if(pet.days.length===1&&!pet.memories.length)remember("헤뭉이와 친구가 된 날");
 save(STORE.pet,pet);
}
function setPetSpeech(message){
 $("pet-says").textContent=message;
}
function petSceneMotion(type){
 const scene=$("pet-scene");
 scene.classList.remove("touched","is-fed","is-playing","is-resting","is-petted");
 void scene.offsetWidth;
 scene.classList.add("touched",type);
 clearTimeout(petTimer);
 petTimer=setTimeout(()=>scene.classList.remove("touched",type),1400);
}
function ensurePetDay(){
 const day=koreaDate();
 if(pet.careDay.date!==day)pet.careDay={date:day,count:0};
 if(!pet.days.includes(day)){pet.days.push(day);pet.days=pet.days.slice(-90);save(STORE.pet,pet);}
}
function renderPet(){
 ensurePetDay();
 const level=petLevel();
 for(const k of ["full","happy","energy"]){
  $("pet-"+k).value=clamp(pet[k]);
  $("pet-"+k+"-text").textContent=String(clamp(pet[k]));
 }
 $("pet-level").textContent=String(level);
 $("pet-xp").textContent=String(pet.xp)+" XP";
 $("pet-stage").textContent=level>=7?"언제나 함께":level>=5?"포근한 동반자":level>=3?"호기심 친구":"솜털 친구";
 $("pet-bond").textContent=pet.bond>=75?"소중한 단짝":pet.bond>=45?"서로 믿는 친구":pet.bond>=20?"친해지는 사이":"처음 만난 사이";
 $("pet-bond-bar").style.width=String(pet.bond)+"%";
 $("pet-visit-days").textContent="함께한 날 "+pet.days.length+"일";
 const count=pet.careDay.count;
 $("pet-progress-note").textContent=count>=3?"오늘의 성장 경험치를 모두 모았어요. 돌보기는 계속할 수 있어요.":"오늘의 성장 돌봄 "+count+" / 3 · 하루 세 번까지 경험치를 얻어요.";
 const h=Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Seoul",hour:"2-digit",hour12:false}).format(new Date()));
 const scene=$("pet-scene");
 scene.classList.toggle("pg-night",h<6||h>=19);
 scene.classList.toggle("pg-morning",h>=6&&h<12);
 $("pet-time-label").textContent=h<6?"고요한 새벽":h<12?"햇살 드는 아침":h<18?"나른한 오후":h<19?"노을 지는 저녁":"포근한 밤";
 const decorations={petals:"✿  ❀  ✿",stars:"✧  ✦  ✧",butterflies:"♡  🦋  ♡"};
 $("pet-decoration").textContent=decorations[pet.decor];
 for(const b of document.querySelectorAll("[data-decor]")){
  const required=b.dataset.decor==="stars"?2:b.dataset.decor==="butterflies"?3:1;
  b.disabled=level<required;
  b.setAttribute("aria-pressed",String(pet.decor===b.dataset.decor));
  b.title=level<required?"레벨 "+required+"부터 열려요":"장식 바꾸기";
 }
 $("pet-quest-status").textContent=pet.questDate===koreaDate()?"오늘의 나비 모험을 마쳤어요. 다시 놀 수 있어요.":"오늘 첫 나비를 찾으면 추억과 경험치를 얻어요.";
 $("pet-quest").textContent=pet.questDate===koreaDate()?"나비와 다시 놀기 ↗":"나비 찾기 ↗";
 const list=$("pet-memory-list");list.replaceChildren();
 if(!pet.memories.length){const li=document.createElement("li");li.textContent="오늘의 첫 번째 추억을 만들어 보세요.";list.append(li);}
 for(const m of pet.memories.slice(0,6)){
  const li=document.createElement("li");
  const time=document.createElement("time");time.dateTime=m.date;time.textContent=m.date;
  const span=document.createElement("span");span.textContent=m.message.slice(0,72);
  li.append(time,span);list.append(li);
 }
}
restorePet();
let petTimer, butterflyTimer, butterflyHits=0, butterflyActive=false;
renderPet();
const petLines={
 feed:["와, 달콤한 냄새가 나몽!","간식 한 입에 기분까지 몽글몽글!","냠냠! 이건 내가 좋아하는 맛이몽!"],
 play:["나비를 따라 폴짝폴짝!","조금만 더 놀자몽!","같이 있으니까 더 신나몽!"],
 rest:["구름처럼 포근하몽...","잠깐 눈을 감고 쉬어가몽.","따뜻한 이불이 최고몽!"]
};
for(const button of document.querySelectorAll("[data-care]"))button.addEventListener("click",()=>{
 const type=button.dataset.care;
 if(type==="feed"){pet.full=clamp(pet.full+18);pet.energy=clamp(pet.energy+3);}
 if(type==="play"){pet.happy=clamp(pet.happy+18);pet.energy=clamp(pet.energy-5);}
 if(type==="rest"){pet.energy=clamp(pet.energy+18);pet.happy=clamp(pet.happy+4);}
 setPetSpeech(petLines[type][randomInt(petLines[type].length)]);
 if(pet.careDay.count<3){
  pet.careDay.count++;pet.xp+=5;pet.bond=Math.min(100,pet.bond+5);
  if(pet.careDay.count===3){remember("오늘도 헤뭉이를 정성껏 돌본 날");notify("오늘의 돌봄 추억을 간직했몽!");}
 }
 pet.interactions=Math.max(0,Number(pet.interactions)||0)+1;
 pet.lastSeen=Date.now();save(STORE.pet,pet);renderPet();
 petSceneMotion(type==="feed"?"is-fed":type==="play"?"is-playing":"is-resting");
});
$("pet-touch").addEventListener("click",()=>{
 const lines=["헤헤, 간지럽몽!","이 손길 기억할게몽.","쓰다듬어줘서 고맙몽 ♡"];
 setPetSpeech(lines[randomInt(lines.length)]);
 pet.happy=clamp(pet.happy+2);save(STORE.pet,pet);renderPet();petSceneMotion("is-petted");
});
for(const b of document.querySelectorAll("[data-decor]"))b.addEventListener("click",()=>{
 if(b.disabled)return;
 pet.decor=b.dataset.decor;save(STORE.pet,pet);renderPet();
 setPetSpeech(pet.decor==="stars"?"별빛이 반짝이몽!":pet.decor==="butterflies"?"나비 친구가 찾아왔몽!":"꽃잎이 살랑살랑하몽!");
 petSceneMotion("is-petted");
});
function placeButterfly(){
 const b=$("pet-butterfly");b.style.left=String(22+randomInt(58))+"%";b.style.top=String(15+randomInt(42))+"%";
 b.classList.remove("flutter");void b.offsetWidth;b.classList.add("flutter");
}
function stopButterfly(success){
 clearTimeout(butterflyTimer);butterflyActive=false;
 $("pet-butterfly").hidden=true;$("pet-quest").disabled=false;
 if(success){
  setPetSpeech("나비 세 마리를 만났몽! 짝짝짝!");
  if(pet.questDate!==koreaDate()){
   pet.questDate=koreaDate();pet.xp+=8;pet.bond=Math.min(100,pet.bond+12);
   remember("방 안에서 반짝이는 나비 세 마리를 만난 날");
   save(STORE.pet,pet);notify("오늘의 나비 추억을 모았몽!");
  }else notify("나비와 즐겁게 다시 놀았몽!");
  petSceneMotion("is-playing");
 }else setPetSpeech("나비가 잠시 쉬러 갔몽. 다음에 다시 찾아보몽!");
 renderPet();
}
$("pet-quest").addEventListener("click",()=>{
 if(butterflyActive)return;
 butterflyActive=true;butterflyHits=0;$("pet-butterfly").hidden=false;$("pet-quest").disabled=true;
 setPetSpeech("나비를 세 번 톡톡 눌러보몽!");
 placeButterfly();butterflyTimer=setTimeout(()=>stopButterfly(false),24000);
});
$("pet-butterfly").addEventListener("click",()=>{
 if(!butterflyActive)return;
 butterflyHits++;
 if(butterflyHits>=3)stopButterfly(true);
 else{setPetSpeech("찾았몽! "+(3-butterflyHits)+"번 더!");placeButterfly();}
});
function restoreRps(){
 const s=read(STORE.rps,{});
 scores={wins:Math.max(0,Number(s.wins)||0),draws:Math.max(0,Number(s.draws)||0),losses:Math.max(0,Number(s.losses)||0),streak:Math.max(0,Number(s.streak)||0),best:Math.max(0,Number(s.best)||0)};
}
const hands={rock:"✊",paper:"✋",scissors:"✌️"},beats={rock:"scissors",paper:"rock",scissors:"paper"};
let rpsMatch={you:0,them:0,round:0,locked:false,done:false};
let soundEnabled=false,audioContext;
function rpsSound(frequency=480,duration=.09){
 if(!soundEnabled)return;
 try{
  audioContext=audioContext||new (window.AudioContext||window.webkitAudioContext)();
  if(audioContext.state==="suspended")audioContext.resume().catch(()=>{});
  const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();
  oscillator.type="sine";oscillator.frequency.value=frequency;
  gain.gain.setValueAtTime(.045,audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();oscillator.stop(audioContext.currentTime+duration);
 }catch(_){}
}
function renderRps(){
 for(const key of ["wins","draws","losses"])$("rps-"+key).textContent=String(scores[key]);
 $("rps-best").textContent=String(scores.best||0);
 $("rps-match-you").textContent=String(rpsMatch.you);
 $("rps-match-them").textContent=String(rpsMatch.them);
 $("rps-rounds").textContent=rpsMatch.done?"대결 종료 · "+rpsMatch.round+"라운드":"현재 "+(rpsMatch.round+1)+"라운드 · 먼저 2승";
 $("rps-again").hidden=!rpsMatch.done;
 for(const b of document.querySelectorAll("[data-rps]"))b.disabled=rpsMatch.locked||rpsMatch.done;
}
restoreRps();renderRps();
$("rps-sound").addEventListener("click",()=>{
 soundEnabled=!soundEnabled;
 $("rps-sound").textContent=soundEnabled?"♫ 효과음 끄기":"♪ 효과음 켜기";
 $("rps-sound").setAttribute("aria-pressed",String(soundEnabled));
 if(soundEnabled)rpsSound(660,.08);
});
$("rps-again").addEventListener("click",()=>{
 rpsMatch={you:0,them:0,round:0,locked:false,done:false};
 $("rps-you").textContent="?";$("rps-them").textContent="?";
 $("rps-result").textContent="새로운 대결을 시작하몽!";
 $("rps-character-says").textContent="이번에도 같이 놀자몽!";
 $("rps-character").className="pg-rps-character";
 $("rps-stage").classList.remove("is-revealing","is-counting","is-firework");
 renderRps();
});
for(const b of document.querySelectorAll("[data-rps]"))b.addEventListener("click",()=>{
 if(rpsMatch.locked||rpsMatch.done)return;
 const yours=b.dataset.rps,theirs=Object.keys(hands)[randomInt(3)];
 rpsMatch.locked=true;renderRps();
 $("rps-stage").classList.remove("is-revealing","is-firework");
 $("rps-stage").classList.add("is-counting");
 $("rps-character").className="pg-rps-character";
 $("rps-you").textContent="✊";$("rps-them").textContent="✊";
 $("rps-result").textContent="가위...";
 $("rps-character-says").textContent="이번엔 뭘 낼까몽?";
 rpsSound(380,.08);
 setTimeout(()=>{$("rps-result").textContent="바위...";rpsSound(430,.08);},360);
 setTimeout(()=>{$("rps-result").textContent="보!";rpsSound(510,.11);},740);
 setTimeout(()=>{
  $("rps-stage").classList.remove("is-counting");$("rps-stage").classList.add("is-revealing");
  $("rps-you").textContent=hands[yours];$("rps-them").textContent=hands[theirs];
  const result=yours===theirs?"draws":beats[yours]===theirs?"wins":"losses";
  scores[result]++;rpsMatch.round++;
  if(result==="wins"){rpsMatch.you++;scores.streak++;scores.best=Math.max(scores.best,scores.streak);}
  else if(result==="losses"){rpsMatch.them++;scores.streak=0;}
  const lines={wins:["앗! 내가 졌몽... 한 번만 더!","이번엔 네가 빨랐몽!"],draws:["어라, 마음이 통했몽!","똑같은 생각을 했몽!"],losses:["헤헤! 이번엔 내가 이겼몽!","내가 이겼몽! 신난다몽!"]};
  $("rps-character-says").textContent=lines[result][randomInt(lines[result].length)];
  $("rps-character").className="pg-rps-character "+(result==="wins"?"is-sulking":result==="losses"?"is-cheering":"is-twinning");
  $("rps-result").textContent=result==="wins"?"이번 판은 당신의 승리!":result==="draws"?"무승부! 다시 한 번!":"이번 판은 헤뭉이 승리!";
  if(result==="wins")$("rps-stage").classList.add("is-firework");
  rpsSound(result==="wins"?780:result==="losses"?580:660,.17);
  if(rpsMatch.you>=2||rpsMatch.them>=2){
   rpsMatch.done=true;
   const playerWon=rpsMatch.you>=2;
   $("rps-result").textContent=playerWon?"최종 승리! 헤뭉이가 축하해 주몽!":"헤뭉이 승리! 다음엔 꼭 이겨보몽!";
   $("rps-character-says").textContent=playerWon?"짝짝짝! 정말 잘했몽!":"헤헤, 오늘은 내가 한 수 위몽!";
  }
  rpsMatch.locked=false;save(STORE.rps,scores);renderRps();
 },1120);
});

route();
})();