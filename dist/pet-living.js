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
    sleep:"assets/haemungi-3d-sleep.png"
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
  world.append(room,lights,shadow,actor,reaction);
  for(const [key,label,left,top,width,height] of hints){
    const button=document.createElement("button");
    button.className="hm-living-hotspot hm-hotspot-"+key;
    button.type="button";
    button.dataset.hotspot=key;
    button.setAttribute("aria-label",label+"로 이동");
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
  instruct.textContent="카펫을 터치하면 산책하고, 방 안의 생활용품을 누르면 헤뭉이가 찾아가요.";
  captionCopy.append(instruct);
  const fullscreen=document.createElement("button");
  fullscreen.type="button";
  fullscreen.className="hm-living-fullscreen";
  fullscreen.textContent="⛶ 크게 보기";
  fullscreen.setAttribute("aria-label","헤뭉이 방 전체화면으로 보기");
  caption.append(captionCopy,fullscreen);
  stage.insertAdjacentElement("afterend",caption);
  fullscreen.addEventListener("click",async()=>{
    try{
      if(document.fullscreenElement===stage)await document.exitFullscreen();
      else if(stage.requestFullscreen)await stage.requestFullscreen();
    }catch(_){if(speak)speak.textContent="이 브라우저에서는 전체화면을 사용할 수 없어요.";}
  });
  document.addEventListener("fullscreenchange",()=>{
    fullscreen.textContent=document.fullscreenElement===stage?"⤢ 돌아가기":"⛶ 크게 보기";
  });

  const state={x:.50,y:.80,tx:.50,ty:.80,face:1,mode:"idle",arrival:"idle",until:0,lastTime:0,pose:"",idleUntil:0,ready:false,pressedAt:0};
  const reduceMotion=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const now=()=>performance.now();
  const random=(a,b)=>a+Math.random()*(b-a);
  function say(message){if(speak)speak.textContent=message;}
  function pose(name){
    if(state.pose===name)return;
    const path=art[name]||art.idle;
    frame.src=path;
    state.pose=name;
    const labels={idle:"쉬고 있어요",walk:"걸어가는 중이에요",feed:"냠냠 먹는 중이에요",sleep:"잠들었어요"};
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
  function react(kind){
    if(!state.ready)return;
    if(kind==="feed"){go(spots.bowl,"feed");}
    else if(kind==="water"){go(spots.water,"water");say("물 한 모금 마시고 올게몽!");}
    else if(kind==="rest"){go(spots.bed,"sleep");}
    else if(kind==="potty"){go(spots.pad,"potty");say("패드에 다녀올게몽!");}
    else if(kind==="play"){go(spots.toy,"play");}
    else if(kind==="touch"){
      state.mode="petted";state.until=now()+1700;
      pose("idle");reaction.textContent="♡  ♡  ♡";reaction.className="hm-living-reaction hm-reaction-hearts";
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
      pose("walk");reaction.textContent="✦ ♡ ✦";reaction.className="hm-living-reaction hm-reaction-play";
    }else if(state.mode==="potty"){
      pose("feed");reaction.textContent="✦";reaction.className="hm-living-reaction hm-reaction-food";
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
      if(state.mode==="play")pose(Math.floor(at/350)%2?"walk":"idle");
      if(state.mode==="sleep")pose("sleep");
      if(state.mode==="idle"){
        pose("idle");
        if(at>state.idleUntil){
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
    world.hidden=false;
    stage.classList.add("hm-living");
    section.classList.add("hm-living");
    caption.classList.add("hm-living-ready");
    state.lastTime=now();state.idleUntil=now()+8000;
    pose("idle");draw(now());
    requestAnimationFrame(tick);
  }).catch(error=>{
    console.error("HAEMUNGI living room did not initialize; preserving original room:",error);
    caption.hidden=true;
  });
})();