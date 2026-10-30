(() => {
  "use strict";
  const scene=document.getElementById("pet-scene");
  const section=document.getElementById("pg-game-pet");
  if(!scene||!section||!document.createElement("canvas").getContext)return;
  const screen=document.createElement("div");
  screen.className="hm-pet-world";
  screen.hidden=true;
  screen.setAttribute("role","group");
  screen.setAttribute("aria-label","움직이는 헤뭉이의 작은 방. 빈 공간을 터치하면 헤뭉이가 걸어갑니다.");
  screen.innerHTML=[
    '<div class="hm-world-sky" aria-hidden="true"><span class="hm-cloud hm-cloud-a"></span><span class="hm-cloud hm-cloud-b"></span><span class="hm-sun"></span></div>',
    '<div class="hm-world-window" aria-hidden="true"><span class="hm-window-cross"></span></div>',
    '<div class="hm-world-curtain hm-curtain-left" aria-hidden="true"></div><div class="hm-world-curtain hm-curtain-right" aria-hidden="true"></div>',
    '<div class="hm-world-shelf" aria-hidden="true"><span></span><span></span><span></span></div>',
    '<div class="hm-world-floor" aria-hidden="true"></div><div class="hm-world-rug" aria-hidden="true"></div>',
    '<div class="hm-world-flower hm-flower-left" aria-hidden="true">❀</div><div class="hm-world-flower hm-flower-right" aria-hidden="true">✿</div>',
    '<div class="hm-world-cookie" id="hm-world-cookie" aria-hidden="true">🍪</div>',
    '<div class="hm-world-butterfly" id="hm-world-butterfly" aria-hidden="true">🦋</div>',
    '<div class="hm-world-zz" id="hm-world-zz" aria-hidden="true">z z Z</div>',
    '<div class="hm-world-shadow" id="hm-world-shadow" aria-hidden="true"></div>',
    '<div class="hm-pet-actor" id="hm-pet-actor" role="img" aria-label="방 안을 돌아다니는 헤뭉이"></div>',
    '<div class="hm-world-hint">빈 공간을 터치해 보세요 · 헤뭉이가 걸어와요 ♡</div>'
  ].join("");
  scene.insertBefore(screen,scene.firstChild);
  const actor=screen.querySelector("#hm-pet-actor");
  const shadow=screen.querySelector("#hm-world-shadow");
  const cookie=screen.querySelector("#hm-world-cookie");
  const butterfly=screen.querySelector("#hm-world-butterfly");
  const zz=screen.querySelector("#hm-world-zz");
  const poses={
    idle:[18,813,115,135],
    smile:[138,813,115,135],
    surprised:[260,813,124,135],
    walk:[20,1017,115,118],
    jump:[135,1017,122,118],
    sit:[255,1017,118,118],
    crouch:[374,1031,116,104],
    look:[491,1018,118,118],
    butterfly:[604,1010,125,125],
    sleep:[743,1040,112,96]
  };
  const poseURLs=Object.create(null);
  const sheet=new Image();
  sheet.decoding="async";
  sheet.src="assets/haemungi-sheet.webp";
  let ready=false,x=.5,target=.5,facing=1,mode="idle",afterTravel="",stateUntil=0;
  let idleUntil=0,lastTime=0,lastPose="",eventAt=0,animationHandle=0;
  const prefersReduced=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const random=(a,b)=>a+Math.random()*(b-a);
  function extractPose(rect){
    const sx=rect[0],sy=rect[1],w=rect[2],h=rect[3];
    const off=document.createElement("canvas");off.width=w;off.height=h;
    const ctx=off.getContext("2d",{willReadFrequently:true});if(!ctx)return null;
    ctx.drawImage(sheet,sx,sy,w,h,0,0,w,h);
    const image=ctx.getImageData(0,0,w,h),d=image.data;
    // Only flood-fill the paper color connected to the crop edges.
    // Unlike a global white-key, the ivory character body is preserved.
    const bg=[d[0],d[1],d[2]];
    const close=(p)=>{
      const q=p*4;
      return Math.abs(d[q]-bg[0])<21&&Math.abs(d[q+1]-bg[1])<21&&Math.abs(d[q+2]-bg[2])<21;
    };
    const seen=new Uint8Array(w*h),queue=new Int32Array(w*h);
    let head=0,tail=0;
    const put=p=>{if(!seen[p]&&close(p)){seen[p]=1;queue[tail++]=p;}};
    for(let j=0;j<w;j++){put(j);put((h-1)*w+j);}
    for(let i=0;i<h;i++){put(i*w);put(i*w+w-1);}
    while(head<tail){
      const p=queue[head++],col=p%w,row=(p-col)/w;
      d[p*4+3]=0;
      if(col>0)put(p-1);if(col<w-1)put(p+1);
      if(row>0)put(p-w);if(row<h-1)put(p+w);
    }
    ctx.putImageData(image,0,0);
    return off.toDataURL("image/png");
  }
  function prepare(){
    if(ready)return;
    try{
      if(sheet.naturalWidth!==864||sheet.naturalHeight!==1536)throw Error("unexpected sprite sheet dimensions");
      for(const [name,rect] of Object.entries(poses))poseURLs[name]=extractPose(rect);
    }catch(err){
      console.warn("HAEMUNGI sprite extraction fallback:",err);
      for(const [name,rect] of Object.entries(poses)){
        poseURLs[name]="assets/haemungi-sheet.webp";
      }
      screen.classList.add("hm-sheet-fallback");
    }
    if(!Object.keys(poseURLs).every(k=>poseURLs[k]))return;
    ready=true;
    screen.hidden=false;
    scene.classList.add("hm-live");
    idleUntil=performance.now()+3000;
    showPose("idle");
    animationHandle=requestAnimationFrame(tick);
  }
  function showPose(name){
    if(!ready||lastPose===name)return;
    const rect=poses[name];
    actor.style.width=rect[2]+"px";actor.style.height=rect[3]+"px";
    if(screen.classList.contains("hm-sheet-fallback")){
      actor.style.backgroundImage='url("assets/haemungi-sheet.webp")';
      actor.style.backgroundSize="864px 1536px";
      actor.style.backgroundPosition="-"+rect[0]+"px -"+rect[1]+"px";
    }else{
      actor.style.backgroundImage='url("'+poseURLs[name]+'")';
      actor.style.backgroundSize="100% 100%";
      actor.style.backgroundPosition="center center";
    }
    actor.setAttribute("aria-label","헤뭉이: "+({idle:"가만히 쉬는 중",smile:"웃는 중",walk:"걷는 중",jump:"뛰는 중",sit:"간식 먹는 중",sleep:"자는 중",look:"주위를 보는 중",butterfly:"나비와 노는 중"}[name]||name));
    lastPose=name;
  }
  function walkTo(next,arrival="idle"){
    target=clamp(next,.16,.84);
    afterTravel=arrival;
    mode="walk";stateUntil=0;
    cookie.classList.toggle("show",arrival==="sit");
    butterfly.classList.toggle("show",arrival==="jump"||arrival==="butterfly");
    zz.classList.remove("show");
    screen.classList.add("hm-moving");
  }
  function react(kind){
    if(!ready)return;
    eventAt=performance.now();
    if(kind==="feed"){walkTo(.28,"sit");}
    if(kind==="play"){walkTo(.7,"jump");}
    if(kind==="rest"){walkTo(.77,"sleep");}
    if(kind==="touch"){
      target=x;mode="smile";stateUntil=performance.now()+1700;
      screen.classList.remove("hm-moving");screen.classList.add("hm-petted");
      setTimeout(()=>screen.classList.remove("hm-petted"),1250);
    }
  }
  function tick(now){
    animationHandle=requestAnimationFrame(tick);
    if(!ready||section.hidden||document.hidden){lastTime=now;return;}
    const dt=Math.min((now-lastTime)||16,48);lastTime=now;
    const distance=target-x;
    if(Math.abs(distance)>.006){
      facing=distance>0?1:-1;
      const speed=(mode==="walk"?.00030:.00018)*dt;
      x+=Math.sign(distance)*Math.min(Math.abs(distance),speed);
      showPose(Math.floor(now/190)%2?"walk":"jump");
    }else{
      x=target;
      if(mode==="walk"){
        mode=afterTravel||"idle";
        afterTravel="";
        stateUntil=now+(mode==="sleep"?5200:mode==="sit"?2500:mode==="jump"?2100:800);
        screen.classList.remove("hm-moving");
        if(mode==="idle")idleUntil=now+random(2600,4800);
      }
      if(mode!=="idle"&&now>stateUntil){
        mode="idle";idleUntil=now+random(2800,5800);
        cookie.classList.remove("show");butterfly.classList.remove("show");zz.classList.remove("show");
      }
      if(mode==="idle"&&now>idleUntil){
        if(Math.random()<.55)walkTo(random(.18,.82),"idle");
        else idleUntil=now+random(2400,4300);
      }
      const phase=mode==="idle"?(Math.floor(now/1400)%5===0?"smile":"idle"):
        mode==="smile"?"smile":mode==="sit"?"sit":mode==="sleep"?"sleep":
        mode==="jump"?(Math.floor(now/400)%2?"jump":"butterfly"):"look";
      showPose(phase);
    }
    const bounce=prefersReduced?0:Math.abs(distance)>.006?Math.abs(Math.sin(now/110))*7:mode==="sleep"?0:Math.sin(now/700)*2;
    const level=Math.max(1,Number(document.getElementById("pet-level")?.textContent)||1);
    const scale=(window.innerWidth<560?.92:1.35)*(1+Math.min(level-1,6)*.026);
    actor.style.left=(x*100)+"%";
    actor.style.transform="translate(-50%,"+(-bounce)+"px) scale("+scale+") scaleX("+facing+")";
    shadow.style.left=(x*100)+"%";
    shadow.style.transform="translateX(-50%) scale("+(1-bounce*.018)+")";
    zz.classList.toggle("show",mode==="sleep");
    zz.style.left=(x*100)+"%";
    cookie.style.left=(x*100+6)+"%";
    butterfly.style.left=(x*100+9)+"%";
  }
  screen.addEventListener("pointerdown",e=>{
    if(e.target.closest("button"))return;
    if(!ready)return;
    const r=screen.getBoundingClientRect();
    const next=(e.clientX-r.left)/r.width;
    if(Math.abs(next-x)<.1){react("touch");document.getElementById("pet-says").textContent="여기 있몽! ♡";}
    else{walkTo(next);document.getElementById("pet-says").textContent="산책하러 가자몽!";}
  });
  screen.tabIndex=0;
  screen.addEventListener("keydown",e=>{
    if(e.key==="ArrowLeft"||e.key==="ArrowRight"){
      e.preventDefault();walkTo(x+(e.key==="ArrowLeft"?-.15:.15));
    }
  });
  document.querySelectorAll("[data-care]").forEach(button=>
    button.addEventListener("click",()=>react(button.dataset.care==="feed"?"feed":button.dataset.care==="play"?"play":"rest"))
  );
  document.getElementById("pet-touch")?.addEventListener("click",()=>react("touch"));
  document.getElementById("pet-butterfly")?.addEventListener("click",()=>react("play"));
  sheet.addEventListener("load",prepare,{once:true});
  sheet.addEventListener("error",()=>{
    console.error("HAEMUNGI sheet failed; preserving original room illustration");
  },{once:true});
  if(sheet.complete&&sheet.naturalWidth)prepare();
})();