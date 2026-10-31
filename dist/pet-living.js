(() => {
  "use strict";
  const stage=document.getElementById("pet-scene");
  const section=document.getElementById("pg-game-pet");
  const actions=document.querySelector("#pg-game-pet .pg-pet-actions");
  if(!stage||!section||!actions)return;

  const art={
    room:"assets/haemungi-living-room.jpg",
    idle:"assets/haemungi-3d-idle.png",
    walk:"assets/haemungi-3d-walk.png",
    feed:"assets/haemungi-3d-feed.png",
    play:"assets/haemungi-3d-play.png",
    sleep:"assets/haemungi-3d-sleep.png",
    petted:"assets/haemungi-3d-play.png"
  };
  const spots={
    rug:{x:.50,y:.82},
    bowl:{x:.745,y:.605},
    water:{x:.797,y:.607},
    bed:{x:.165,y:.645},
    pad:{x:.875,y:.675},
    toy:{x:.57,y:.78}
  };
  const world=document.createElement("div");
  world.className="hm-living-world";
  world.hidden=true;
  world.setAttribute("role","group");
  world.setAttribute("aria-label","헤뭉이의 생활 공간. 카펫을 터치하면 헤뭉이가 걸어갑니다.");
  const room=document.createElement("img");
  room.className="hm-living-room-image";
  room.src=art.room; room.alt="";
  room.width=1536;room.height=864;
  room.setAttribute("aria-hidden","true");
  const lights=document.createElement("div");
  lights.className="hm-living-light";
  lights.setAttribute("aria-hidden","true");
  const shadow=document.createElement("div");
  shadow.className="hm-living-shadow";
  shadow.setAttribute("aria-hidden","true");
  const actor=document.createElement("div");
  actor.className="hm-living-actor";
  actor.setAttribute("role","img");
  actor.setAttribute("aria-label","헤뭉이: 편안히 쉬고 있어요");
  const frame=document.createElement("img");
  frame.src=art.idle;frame.alt="";frame.draggable=false;
  frame.setAttribute("aria-hidden","true");
  actor.append(frame);
  const petTarget=document.createElement("button");
  petTarget.type="button";
  petTarget.className="hm-living-pet-target";
  petTarget.setAttribute("aria-label","헤뭉이 머리 쓰다듬기");
  petTarget.title="헤뭉이 머리를 살살 문질러 주세요";
  const reaction=document.createElement("div");
  reaction.className="hm-living-reaction";
  reaction.setAttribute("aria-hidden","true");
  const hints=[
    ["feed","밥그릇",".69",".505",".11",".19"],
    ["water","물그릇",".765",".51",".105",".17"],
    ["rest","포근한 침대",".045",".335",".25",".28"],
    ["potty","배변패드",".78",".55",".21",".20"],
    ["play","장난감",".70",".77",".11",".16"]
  ];
  world.append(room,lights,shadow,actor,petTarget,reaction);
  for(const [key,label,left,top,width,height] of hints){
    const button=document.createElement("button");
    button.className="hm-living-hotspot hm-hotspot-"+key;
    button.type="button";
    button.dataset.hotspot=key;
    button.setAttribute("aria-label",label+(["밥그릇","물그릇","장난감"].includes(label)?"으로":"로")+" 이동");
    button.style.left=Number(left)*100+"%";
    button.style.top=Number(top)*100+"%";
    button.style.width=Number(width)*100+"%";
    button.style.height=Number(height)*100+"%";
    button.title=label+"에 가기";
    world.append(button);
  }
  stage.insertBefore(world,stage.firstChild);

  const touch=document.getElementById("pet-touch");
  if(touch){touch.classList.add("hm-pet-touch-tile");actions.append(touch);}
  const caption=document.createElement("div");
  caption.className="hm-living-caption";
  const speak=document.getElementById("pet-says");
  const captionCopy=document.createElement("div");
  captionCopy.className="hm-living-caption-copy";
  if(speak){speak.classList.add("hm-living-speech");captionCopy.append(speak);}
  const instruct=document.createElement("p");
  instruct.textContent="카펫을 누르면 산책해요. 헤뭉이 머리를 손가락으로 살살 쓰다듬어 보세요.";
  captionCopy.append(instruct);
  const fullscreen=document.createElement("button");
  fullscreen.type="button";
  fullscreen.className="hm-living-fullscreen";
  fullscreen.textContent="⛶ 크게 보기";
  fullscreen.setAttribute("aria-label","헤뭉이 방 전체화면으로 보기");
  const call=document.createElement("button");
  call.type="button";
  call.className="hm-living-call";
  call.textContent="♡ 헤뭉아, 이리 와!";
  call.setAttribute("aria-label","헤뭉이 부르기");
  const captionActions=document.createElement("div");
  captionActions.className="hm-living-caption-actions";
  captionActions.append(call,fullscreen);
  caption.append(captionCopy,captionActions);
  stage.insertAdjacentElement("afterend",caption);
  fullscreen.addEventListener("click",async()=>{
    try{
      if(document.fullscreenElement===stage)await document.exitFullscreen();
      else if(stage.requestFullscreen){await stage.requestFullscreen();try{await screen.orientation?.lock?.("landscape");}catch(_){}}
    }catch(_){if(speak)speak.textContent="이 브라우저에서는 전체화면을 사용할 수 없어요.";}
  });
  document.addEventListener("fullscreenchange",()=>{
    fullscreen.textContent=document.fullscreenElement===stage?"⤢ 돌아가기":"⛶ 크게 보기";
  });

  const state={x:.50,y:.80,tx:.50,ty:.80,face:1,mode:"idle",arrival:"idle",until:0,lastTime:0,pose:"",idleUntil:0,ready:false,pressedAt:0,lastUserAt:0,nextAutoAt:0,welcomed:false};
  const reduceMotion=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const now=()=>performance.now();
  const random=(a,b)=>a+Math.random()*(b-a);
  const bond=()=>clamp(Number.parseFloat(document.getElementById("pet-bond-bar")?.style.width)||0,0,100);
  const meter=id=>{const raw=document.getElementById(id)?.getAttribute("value");const value=Number(raw);return raw!==null&&raw!==undefined&&Number.isFinite(value)?value:80;};
  function markUser(){state.lastUserAt=now();state.nextAutoAt=state.lastUserAt+random(28000,45000);}
  function say(message){if(speak)speak.textContent=message;}
  function pose(name){
    if(state.pose===name)return;
    const path=art[name]||art.idle;
    frame.src=path;
    state.pose=name;
    const labels={idle:"쉬고 있어요",walk:"걸어가는 중이에요",feed:"냠냠 먹는 중이에요",play:"장난감과 놀고 있어요",sleep:"잠들었어요",petted:"쓰다듬는 손길에 웃고 있어요"};
    actor.setAttribute("aria-label","헤뭉이: "+(labels[name]||"놀고 있어요"));
    actor.dataset.pose=name;
  }
  function go(point,arrival){
    if(!state.ready)return;
    state.tx=clamp(point.x,.12,.88);
    state.ty=clamp(point.y,.60,.86);
    state.arrival=arrival||"idle";
    state.mode="moving";
    state.until=0;
    reaction.textContent="";
    reaction.className="hm-living-reaction";
  }
  function react(kind,autonomous=false){
    if(!state.ready)return;
    if(!autonomous)markUser();
    if(kind==="feed"){go(spots.bowl,"feed");}
    else if(kind==="water"){go(spots.water,"water");say("물 한 모금 마시고 올게몽!");}
    else if(kind==="rest"){go(spots.bed,"sleep");}
    else if(kind==="potty"){go(spots.pad,"potty");say("패드에 다녀올게몽!");}
    else if(kind==="play"){go(spots.toy,"play");}
    else if(kind==="touch"){
      const asleep=state.mode==="sleep";
      if(!asleep){state.mode="petted";state.until=now()+2100;pose("petted");}
      reaction.textContent=asleep?"♡":bond()>=45?"♡  ♡  ♡":"♡  ♡";
      reaction.className="hm-living-reaction hm-reaction-hearts";
      if(asleep)say("꿈속에서도 반갑몽... ♡");
    }
  }
  function arrival(at){
    state.mode=state.arrival;
    state.arrival="idle";
    const duration=state.mode==="sleep"?8800:state.mode==="feed"?5000:state.mode==="water"?4000:state.mode==="play"?4200:state.mode==="potty"?4000:900;
    state.until=at+duration;
    if(state.mode==="feed"||state.mode==="water"){
      pose("feed");
      reaction.textContent=state.mode==="water"?"💧":"♡";
      reaction.className="hm-living-reaction hm-reaction-food";
    }else if(state.mode==="sleep"){
      pose("sleep");reaction.textContent="z Z z";reaction.className="hm-living-reaction hm-reaction-sleep";
    }else if(state.mode==="play"){
      pose("play");reaction.textContent="✦ ♡ ✦";reaction.className="hm-living-reaction hm-reaction-play";
    }else if(state.mode==="potty"){
      pose("idle");reaction.textContent="✦";reaction.className="hm-living-reaction hm-reaction-food";
    }else if(state.mode==="greet"){
      pose("petted");reaction.textContent="♡";reaction.className="hm-living-reaction hm-reaction-hearts";
    }else{
      pose("idle");state.idleUntil=at+random(7500,14500);
    }
  }
  function draw(at){
    if(!state.ready)return;
    const moving=state.mode==="moving";
    const phase=moving&&!reduceMotion?Math.abs(Math.sin(at/135))*5:state.mode==="play"&&!reduceMotion?Math.abs(Math.sin(at/210))*8:state.mode==="feed"&&!reduceMotion?Math.sin(at/380)*1.5:0;
    const depth=clamp((state.y-.60)/.26,0,1);
    const level=Math.max(1,Number(document.getElementById("pet-level")?.textContent)||1);
    const scale=(.82+depth*.21)*(1+Math.min(level-1,6)*.014);
    actor.style.left=(state.x*100)+"%";
    actor.style.top=(state.y*100)+"%";
    actor.style.transform="translate(-50%,-100%) translateY("+(-phase)+"px) scale("+scale+") scaleX("+state.face+")";
    shadow.style.left=(state.x*100)+"%";
    shadow.style.top=(state.y*100)+"%";
    shadow.style.transform="translate(-50%,-50%) scale("+(1-phase*.017)+")";
    reaction.style.left=(state.x*100)+"%";
    reaction.style.top=(state.y*100-23)+"%";
    petTarget.style.left=((state.x+state.face*.058)*100)+"%";
    petTarget.style.top=((state.y-.132)*100)+"%";
    petTarget.style.transform="translate(-50%,-50%) scale("+scale+")";
  }
  function chooseAutonomy(at){
    if(at<state.nextAutoAt||at-state.lastUserAt<12000)return false;
    state.nextAutoAt=at+random(47000,79000);
    const energy=meter("pet-energy"),full=meter("pet-full"),happy=meter("pet-happy");
    const roll=Math.random();
    let action="water",message="목이 말라서 물 마시고 올게몽!";
    if(energy<35||roll<.19){action="rest";message="슬슬 졸리몽... 내 침대에 다녀올게몽.";}
    else if(full<35||roll<.34){action="feed";message="밥그릇에 뭐가 있나 살펴볼게몽!";}
    else if(happy<65||roll<.72){action="play";message="혼자서도 장난감을 갖고 놀 수 있몽!";}
    react(action,true);
    say(message);
    return true;
  }
  function greetVisitor(){
    if(!state.ready||section.hidden||state.welcomed)return;
    state.welcomed=true;
    let previous=0;
    try{
      const saved=JSON.parse(localStorage.getItem("hm_living_visit_v1")||"{}");
      previous=Number(saved.lastAt)||0;
      if(!previous||Date.now()-previous>600000)
        localStorage.setItem("hm_living_visit_v1",JSON.stringify({lastAt:Date.now()}));
    }catch(_){/* Private browsing may disallow storage; gameplay still works. */}
    if(previous&&Date.now()-previous>1800000){
      say(bond()>=75?"보고 싶었몽! 오늘도 나랑 같이 있자몽!":bond()>=35?"다시 왔몽? 기다리고 있었몽!":"어서 와몽! 다시 만나서 좋몽!");
      state.mode="greet";state.until=now()+1800;
      pose("petted");reaction.textContent="♡";reaction.className="hm-living-reaction hm-reaction-hearts";
    }
  }
  function tick(at){
    if(!state.ready)return;
    if(section.hidden||document.hidden){
      state.lastTime=at;
      setTimeout(()=>requestAnimationFrame(tick),700);
      return;
    }
    const dt=Math.min((at-state.lastTime)||16,48);state.lastTime=at;
    if(state.mode==="moving"){
      const dx=state.tx-state.x,dy=state.ty-state.y;
      const d=Math.hypot(dx,dy);
      if(d>.007){
        state.face=dx>=0?1:-1;
        const step=Math.min(d,(reduceMotion?.00029:.00024)*dt);
        state.x+=dx/d*step;
        state.y+=dy/d*step;
        pose(Math.floor(at/220)%2?"walk":"idle");
      }else{
        state.x=state.tx;state.y=state.ty;arrival(at);
      }
    }else{
      if(state.mode==="play")pose("play");
      if(state.mode==="sleep")pose("sleep");
      if(state.mode==="idle"){
        pose("idle");
        if(chooseAutonomy(at)){/* A quiet routine, without rewards or changes to saved care. */}
        else if(at>state.idleUntil){
          state.idleUntil=at+random(10500,19000);
          if(Math.random()<.65)go({x:random(.34,.62),y:random(.75,.85)},"idle");
        }
      }else if(at>state.until){
        reaction.textContent="";reaction.className="hm-living-reaction";
        state.mode="idle";state.idleUntil=at+random(7000,14000);pose("idle");
      }
    }
    draw(at);
    requestAnimationFrame(tick);
  }
  for(const btn of document.querySelectorAll("[data-care]")){
    btn.addEventListener("click",()=>react(btn.dataset.care));
  }
  touch?.addEventListener("click",()=>react("touch"));
  let activeStroke=null,lastPetAt=0;
  function completePet(){
    if(!state.ready||now()-lastPetAt<1250)return;
    lastPetAt=now();
    if(touch)touch.click();else react("touch");
    if(state.mode==="sleep")return;
    if(bond()>=75)say("네 손길은 언제나 알아보겠몽! ♡");
    else if(bond()>=40)say("그렇게 쓰다듬어 주면 너무 좋몽!");
    else say("헤헤, 기분이 몽글몽글해졌몽!");
  }
  petTarget.addEventListener("pointerdown",event=>{
    if(!event.isPrimary||!state.ready)return;
    event.preventDefault();event.stopPropagation();
    activeStroke={id:event.pointerId,x:event.clientX,y:event.clientY,length:0,started:now()};
    try{petTarget.setPointerCapture(event.pointerId);}catch(_){}
  });
  petTarget.addEventListener("pointermove",event=>{
    if(!activeStroke||event.pointerId!==activeStroke.id)return;
    const delta=Math.hypot(event.clientX-activeStroke.x,event.clientY-activeStroke.y);
    activeStroke.length+=delta;
    activeStroke.x=event.clientX;activeStroke.y=event.clientY;
    if(activeStroke.length>12&&!petTarget.classList.contains("is-stroking")){
      petTarget.classList.add("is-stroking");
      if(state.mode!=="sleep"){state.mode="petted";state.until=now()+2300;pose("petted");}
      reaction.textContent="♡";reaction.className="hm-living-reaction hm-reaction-hearts";
    }
    event.preventDefault();
  });
  function finishStroke(event){
    if(!activeStroke||event.pointerId!==activeStroke.id)return;
    event.stopPropagation();
    const completed=event.type==="pointerup";
    activeStroke=null;petTarget.classList.remove("is-stroking");
    if(completed)completePet();
  }
  petTarget.addEventListener("pointerup",finishStroke);
  petTarget.addEventListener("pointercancel",finishStroke);
  petTarget.addEventListener("click",event=>{
    event.stopPropagation();
    if(event.detail===0)completePet();
  });
  call.addEventListener("click",()=>{
    markUser();
    go(spots.rug,"greet");
    say(bond()>=45?"부르면 언제든 달려갈게몽!":"불렀몽? 지금 갈게몽!");
  });
  window.addEventListener("hashchange",()=>{
    if(location.hash==="#pet"){state.welcomed=false;setTimeout(greetVisitor,0);}
  });
  document.getElementById("pet-butterfly")?.addEventListener("click",()=>react("play"));
  document.querySelectorAll("[data-decor]").forEach(button=>button.addEventListener("click",()=>{
    reaction.textContent="✦ ✧ ✦";reaction.className="hm-living-reaction hm-reaction-play";
    setTimeout(()=>{if(state.mode==="idle"){reaction.textContent="";reaction.className="hm-living-reaction";}},1400);
  }));
  for(const hotspot of world.querySelectorAll("[data-hotspot]")){
    hotspot.addEventListener("click",event=>{
      event.stopPropagation();
      const key=hotspot.dataset.hotspot;
      if(key==="feed")document.querySelector('[data-care="feed"]')?.click();
      else if(key==="rest")document.querySelector('[data-care="rest"]')?.click();
      else if(key==="play")document.querySelector('[data-care="play"]')?.click();
      else react(key);
    });
  }
  world.addEventListener("pointerdown",event=>{
    if(event.target.closest("button"))return;
    const r=world.getBoundingClientRect();
    const x=clamp((event.clientX-r.left)/r.width,.13,.87);
    const y=clamp((event.clientY-r.top)/r.height,.63,.86);
    if(Math.hypot(x-state.x,y-state.y)<.085){react("touch");say("여기 있몽! ♡");}
    else{go({x,y},"idle");say("함께 산책하자몽!");}
  });
  world.tabIndex=0;
  world.addEventListener("keydown",event=>{
    const step=.075;let point=null;
    if(event.key==="ArrowLeft")point={x:state.x-step,y:state.y};
    if(event.key==="ArrowRight")point={x:state.x+step,y:state.y};
    if(event.key==="ArrowUp")point={x:state.x,y:state.y-step};
    if(event.key==="ArrowDown")point={x:state.x,y:state.y+step};
    if(point){event.preventDefault();go(point,"idle");}
  });
  function readyAsset(path){
    return new Promise((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>resolve(true);
      img.onerror=()=>reject(Error("missing living-room asset: "+path));
      img.src=path;
      if(img.complete&&img.naturalWidth)resolve(true);
    });
  }
  Promise.all([readyAsset(art.room),readyAsset(art.idle)]).then(()=>{
    state.ready=true;
    for(const kind of ["walk","feed","play","sleep"]){const next=new Image();next.src=art[kind];}
    world.hidden=false;
    stage.classList.add("hm-living");
    section.classList.add("hm-living");
    caption.classList.add("hm-living-ready");
    state.lastTime=now();state.lastUserAt=now();state.nextAutoAt=now()+random(28000,40000);state.idleUntil=now()+8000;
    pose("idle");draw(now());greetVisitor();
    requestAnimationFrame(tick);
  }).catch(error=>{
    console.error("HAEMUNGI living room did not initialize; preserving original room:",error);
    caption.hidden=true;
  });
})();
