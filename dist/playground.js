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

function restorePet(){
 pet=Object.assign(DEFAULT_PET(),read(STORE.pet,{}));
 for(const k of ["xp","full","happy","energy","lastSeen","interactions"])if(!Number.isFinite(Number(pet[k])))pet[k]=DEFAULT_PET()[k];
 const hours=Math.min(168,Math.max(0,(Date.now()-Number(pet.lastSeen))/3600000));
 pet.full=clamp(pet.full-Math.min(20,hours*.6));
 pet.happy=clamp(pet.happy-Math.min(15,hours*.4));
 pet.energy=clamp(pet.energy-Math.min(12,hours*.3));
 pet.lastSeen=Date.now();save(STORE.pet,pet);
}
function renderPet(){
 $("pet-full").value=clamp(pet.full);$("pet-happy").value=clamp(pet.happy);$("pet-energy").value=clamp(pet.energy);
 for(const k of ["full","happy","energy"])$("pet-"+k+"-text").textContent=String(clamp(pet[k]));
 const level=1+Math.floor(pet.xp/25);
 $("pet-level").textContent=String(level);$("pet-xp").textContent=String(pet.xp)+" XP";
 $("pet-stage").textContent=level>=5?"포근한 동반자":level>=3?"호기심 친구":"솜털 친구";
}
restorePet();renderPet();
let petTimer;
for(const button of document.querySelectorAll("[data-care]"))button.addEventListener("click",()=>{
 const type=button.dataset.care;
 if(type==="feed"){pet.full=clamp(pet.full+18);pet.energy=clamp(pet.energy+3);$("pet-says").textContent="간식이 정말 맛있몽! 고맙몽!";}
 if(type==="play"){pet.happy=clamp(pet.happy+18);pet.energy=clamp(pet.energy-5);$("pet-says").textContent="또 같이 놀고 싶몽!";}
 if(type==="rest"){pet.energy=clamp(pet.energy+18);pet.happy=clamp(pet.happy+4);$("pet-says").textContent="쉬었다 가도 괜찮몽~";}
 pet.xp=Math.max(0,Number(pet.xp))+5;
 pet.interactions=Math.max(0,Number(pet.interactions))+1;
 pet.lastSeen=Date.now();save(STORE.pet,pet);renderPet();
 const scene=document.querySelector(".pg-pet-stage");scene.classList.remove("touched");void scene.offsetWidth;scene.classList.add("touched");clearTimeout(petTimer);petTimer=setTimeout(()=>scene.classList.remove("touched"),1250);
});
function restoreRps(){
 const s=read(STORE.rps,{});
 scores={wins:Math.max(0,Number(s.wins)||0),draws:Math.max(0,Number(s.draws)||0),losses:Math.max(0,Number(s.losses)||0)};
}
function renderRps(){for(const key of ["wins","draws","losses"])$("rps-"+key).textContent=String(scores[key]);}
restoreRps();renderRps();
const hands={rock:"✊",paper:"✋",scissors:"✌️"},beats={rock:"scissors",paper:"rock",scissors:"paper"};
for(const b of document.querySelectorAll("[data-rps]"))b.addEventListener("click",()=>{
 const yours=b.dataset.rps;const theirs=Object.keys(hands)[randomInt(3)];
 $("rps-you").textContent=hands[yours];$("rps-them").textContent=hands[theirs];
 const result=yours===theirs?"draws":beats[yours]===theirs?"wins":"losses";
 scores[result]++;save(STORE.rps,scores);renderRps();
 $("rps-result").textContent=result==="wins"?"우와! 당신이 이겼몽!":result==="draws"?"우리 생각이 똑같았몽!":"이번엔 헤뭉이가 이겼몽! 또 해보몽!";
});
route();
})();