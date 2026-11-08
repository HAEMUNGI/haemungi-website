(() => {
  'use strict';

  // Stage coordinates stay stable across desktop and mobile scrolling.
  const STAGE_W = 1536;
  const STAGE_H = 865;
  const SPRITE_COUNTS = Object.freeze({walk_left:6,walk_right:6,run:6,sit:3,sleep:1,play_reference:3});
  const $ = id => document.getElementById(id);
  const world = $('roomWorld');
  const viewport = $('roomViewport');
  const sprite = $('leoSprite');
  const character = $('leoCharacter');
  const ball = $('toyBall');
  const status = $('leoStatus');
  const hearts = $('leoHearts');
  const runButton = $('runToggle');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const state = {x:728,y:714,dir:1,action:'sit',actionStarted:performance.now(),
    held:0,target:null,running:false,lastFrame:'',jump:null,playStarted:0,ballX:880,ballY:710};
  let lastTime = performance.now();
  let heartTimer = 0;
  let cameraReady = false;

  const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
  const imagePath = (action,index) => '/leo-room/sprites/'+action+'/frame_'+String(index).padStart(2,'0')+'.png';
  const announce = message => { status.textContent = message; };
  const setAction = (action,now=performance.now()) => {
    if(state.action === action) return;
    state.action = action;
    state.actionStarted = now;
  };
  const setBall = (x=state.ballX,y=state.ballY) => {
    ball.style.left = x/STAGE_W*100+'%';
    ball.style.top = y/STAGE_H*100+'%';
  };
  const render = () => {
    character.style.left = state.x/STAGE_W*100+'%';
    character.style.top = state.y/STAGE_H*100+'%';
    sprite.classList.toggle('face-left',state.dir<0 && state.action==='run');
    hearts.style.left = state.x/STAGE_W*100+'%';
    hearts.style.top = (state.y-180)/STAGE_H*100+'%';
    if(world.clientWidth > viewport.clientWidth+12 && (state.target || state.held || state.jump || !cameraReady)) {
      const desired = state.x/STAGE_W*world.clientWidth - viewport.clientWidth*.52;
      viewport.scrollLeft = clamp(desired,0,world.clientWidth-viewport.clientWidth);
    }
    cameraReady=true;
  };
  const frameFor = now => {
    const action = state.action;
    let sheet=action;
    if(action==='walk') sheet=state.dir<0?'walk_left':'walk_right';
    if(action==='jump')sheet='run';
    const count=SPRITE_COUNTS[sheet]||3;
    const elapsed=now-state.actionStarted;
    let index;
    if(action==='walk')index=Math.floor(elapsed/115)%count;
    else if(action==='run'||action==='jump')index=Math.floor(elapsed/82)%count;
    else if(action==='play_reference')index=Math.floor(elapsed/170)%count;
    else index=Math.min(count-1,Math.floor(elapsed/260));
    if(reducedMotion.matches)index=count-1;
    return imagePath(sheet,index+1);
  };
  const paintFrame = now => {
    const path=frameFor(now);
    if(state.lastFrame===path) return;
    state.lastFrame=path;
    sprite.src=path;
  };
  const stopMovement = (announceRest=false) => {
    state.held=0;
    state.target=null;
    state.jump=null;
    setAction('sit');
    if(announceRest)announce('레오가 잠시 멈춰 쉬고 있어요.');
  };
  const approach = (x,y,whenThere,label) => {
    state.held=0;
    state.jump=null;
    state.target={x:clamp(x,115,1420),y:clamp(y,560,775),whenThere};
    state.dir=state.target.x<state.x?-1:1;
    setAction(state.running?'run':'walk');
    announce(label);
  };
  const sit = () => {stopMovement();announce('레오가 두 앞발을 가지런히 모으고 앉았어요.');};
  const sleep = () => {
    approach(460,595,()=>{
      setAction('sleep');
      announce('포근한 침대에서 레오가 눈을 감았어요.');
    },'레오가 포근한 침대 쪽으로 걸어가요.');
  };
  const play = () => {
    approach(825,720,()=>{
      setAction('play_reference');
      state.playStarted=performance.now();
      announce('레오가 앞발로 작은 공을 톡톡 건드려요.');
    },'레오가 장난감 공을 향해 다가가요.');
  };
  const eat = () => {
    approach(1025,600,()=>{
      setAction('sit');
      announce('레오가 밥그릇 앞에서 잠시 쉬고 있어요.');
    },'레오가 밥그릇으로 가고 있어요.');
  };
  const jump = () => {
    approach(410,665,()=>{
      const now=performance.now();
      state.jump={phase:'up',since:now,startX:state.x,startY:state.y};
      state.dir=-1;
      setAction('jump',now);
      announce('레오가 캣타워로 폴짝 뛰어올라요!');
    },'레오가 캣타워로 다가가요.');
  };
  const callLeo = () => {
    clearTimeout(heartTimer);
    hearts.classList.remove('is-visible');
    void hearts.offsetWidth;
    hearts.classList.add('is-visible');
    heartTimer=setTimeout(()=>hearts.classList.remove('is-visible'),1600);
    announce('레오야, 사랑해. ♡');
  };
  const actionHandlers={sit,sleep,play,jump,call:callLeo};

  const moveBy = (delta,now) => {
    state.x=clamp(state.x+delta,105,1435);
    state.dir=delta<0?-1:1;
    if(state.action!==(state.running?'run':'walk'))setAction(state.running?'run':'walk',now);
  };
  const advance = (dt,now) => {
    if(state.jump){
      const j=state.jump;
      const elapsed=now-j.since;
      if(j.phase==='up'){
        const t=clamp(elapsed/850,0,1);
        // Three-point easing keeps takeoff and landing natural while the tower stays still.
        const ease=t*t*(3-2*t);
        state.x=j.startX+(167-j.startX)*ease;
        state.y=j.startY+(346-j.startY)*ease-36*Math.sin(Math.PI*t);
        if(t>=1){j.phase='pause';j.since=now;setAction('sit',now);announce('레오가 높은 곳에서 창밖을 바라봐요.');}
      }else if(j.phase==='pause'){
        if(elapsed>=2100){j.phase='down';j.since=now;j.startX=state.x;j.startY=state.y;state.dir=1;setAction('jump',now);}
      }else{
        const t=clamp(elapsed/950,0,1),ease=t*t*(3-2*t);
        state.x=j.startX+(380-j.startX)*ease;
        state.y=j.startY+(705-j.startY)*ease-48*Math.sin(Math.PI*t);
        if(t>=1){state.jump=null;setAction('sit',now);announce('레오가 사뿐히 바닥에 내려왔어요.');}
      }
      return;
    }
    if(state.held){
      const speed=state.running?400:225;
      moveBy(state.held*speed*dt,now);
      return;
    }
    if(state.target){
      const target=state.target;
      const dx=target.x-state.x,dy=target.y-state.y;
      const dist=Math.hypot(dx,dy);
      const travel=(state.running?375:215)*dt;
      if(dist<=Math.max(3,travel)){
        state.x=target.x;state.y=target.y;
        state.target=null;
        if(typeof target.whenThere==='function')target.whenThere();
        else setAction('sit',now);
      }else{
        state.dir=dx<0?-1:1;
        state.x+=dx/dist*travel;
        state.y+=dy/dist*travel;
        setAction(state.running?'run':'walk',now);
      }
      return;
    }
    if(state.action==='play_reference'){
      const elapsed=now-state.playStarted;
      state.ballX=878+Math.sin(elapsed/380)*25;
      state.ballY=706+Math.sin(elapsed/220)*7;
      setBall();
      if(elapsed>5100){setAction('sit',now);setBall(880,710);announce('신나게 놀고 레오가 잠시 쉬어요.');}
    }
  };

  const tick = now => {
    const dt=clamp((now-lastTime)/1000,0,.045);
    lastTime=now;
    if(!document.hidden){advance(dt,now);render();paintFrame(now);}
    requestAnimationFrame(tick);
  };

  // Buttons support hold-to-walk on touch and mouse, and arrow keys on a keyboard.
  const bindDirection = (id,direction) => {
    const button=$(id);
    const release = () => {if(state.held===direction){state.held=0;setAction('sit');button.classList.remove('is-active');}};
    button.addEventListener('pointerdown',event=>{
      event.preventDefault();button.setPointerCapture(event.pointerId);
      state.target=null;state.jump=null;state.held=direction;state.dir=direction;
      setAction(state.running?'run':'walk');button.classList.add('is-active');
      announce(direction<0?'레오가 왼쪽으로 걸어가요.':'레오가 오른쪽으로 걸어가요.');
    });
    button.addEventListener('pointerup',release);
    button.addEventListener('pointercancel',release);
    button.addEventListener('lostpointercapture',release);
  };
  bindDirection('moveLeft',-1);
  bindDirection('moveRight',1);
  window.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight'].includes(event.key)||event.altKey||event.metaKey)return;
    if(document.activeElement instanceof HTMLElement&&['INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;
    event.preventDefault();state.target=null;state.jump=null;
    state.held=event.key==='ArrowLeft'?-1:1;
  });
  window.addEventListener('keyup',event=>{
    if(['ArrowLeft','ArrowRight'].includes(event.key)){state.held=0;setAction('sit');}
  });
  window.addEventListener('blur',()=>{if(state.held){state.held=0;setAction('sit');}});
  runButton.addEventListener('click',()=>{
    state.running=!state.running;
    runButton.classList.toggle('is-active',state.running);
    runButton.querySelector('small').textContent=state.running?'ON':'OFF';
    runButton.setAttribute('aria-pressed',String(state.running));
    if(state.target || state.held)setAction(state.running?'run':'walk');
    announce(state.running?'달리기 모드가 켜졌어요.':'천천히 걷는 모드로 돌아왔어요.');
  });
  runButton.setAttribute('aria-pressed','false');
  document.querySelectorAll('[data-action]').forEach(button=>{
    button.addEventListener('click',()=>actionHandlers[button.dataset.action]?.());
  });
  document.querySelectorAll('[data-zone]').forEach(button=>{
    button.addEventListener('click',()=>({tower:jump,bed:sleep,food:eat,ball:play})[button.dataset.zone]?.());
  });
  $('roomFloor').addEventListener('click',event=>{
    const rect=world.getBoundingClientRect();
    const x=(event.clientX-rect.left)/rect.width*STAGE_W;
    const y=clamp((event.clientY-rect.top)/rect.height*STAGE_H,570,775);
    approach(x,y,()=>{setAction('sit');announce('레오가 햇살 아래에서 쉬고 있어요.');},'레오가 선택한 자리로 걸어가요.');
  });
  const fullscreenButton=$('roomFullscreen');
  const fullscreenExit=$('roomFullscreenExit');
  let scrollBeforeFullscreen=0;
  const nativeFullscreen=()=>document.fullscreenElement===viewport || document.webkitFullscreenElement===viewport;
  const fullscreenActive=()=>nativeFullscreen() || viewport.classList.contains('is-expanded');
  const syncFullscreenControls=()=>{
    const active=fullscreenActive();
    fullscreenButton.setAttribute('aria-pressed',String(active));
    fullscreenButton.textContent=active?'⤢ 돌아가기':'⛶ 전체화면 보기';
    fullscreenExit.hidden=!active;
  };
  const leaveFullscreen=async()=>{
    try{
      if(nativeFullscreen()){
        if(document.exitFullscreen)await document.exitFullscreen();
        else if(document.webkitExitFullscreen)document.webkitExitFullscreen();
      }
    }catch(_){/* Browsers can already have ended fullscreen on Escape. */}
    viewport.classList.remove('is-expanded');
    document.body.classList.remove('room-expanded');
    try{screen.orientation?.unlock?.();}catch(_){}
    syncFullscreenControls();
    requestAnimationFrame(()=>{viewport.scrollLeft=scrollBeforeFullscreen;});
  };
  const enterFullscreen=async()=>{
    scrollBeforeFullscreen=viewport.scrollLeft;
    let entered=false;
    try{
      if(viewport.requestFullscreen){await viewport.requestFullscreen();entered=nativeFullscreen();}
      else if(viewport.webkitRequestFullscreen){await Promise.resolve(viewport.webkitRequestFullscreen());entered=nativeFullscreen();}
    }catch(_){/* Fall back to an in-page expanded room if fullscreen is blocked. */}
    if(!entered){
      viewport.classList.add('is-expanded');
      document.body.classList.add('room-expanded');
    }else{
      try{await screen.orientation?.lock?.('landscape');}catch(_){}
    }
    requestAnimationFrame(()=>{
      viewport.scrollLeft=Math.max(0,(viewport.scrollWidth-viewport.clientWidth)/2);
    });
    syncFullscreenControls();
  };
  fullscreenButton.addEventListener('click',()=>{
    if(fullscreenActive())void leaveFullscreen();
    else void enterFullscreen();
  });
  fullscreenExit.addEventListener('click',()=>{void leaveFullscreen();});
  const fullscreenChanged=()=>{
    syncFullscreenControls();
    if(!fullscreenActive()){
      try{screen.orientation?.unlock?.();}catch(_){}
      requestAnimationFrame(()=>{viewport.scrollLeft=scrollBeforeFullscreen;});
    }
  };
  document.addEventListener('fullscreenchange',fullscreenChanged);
  document.addEventListener('webkitfullscreenchange',fullscreenChanged);
  window.addEventListener('keydown',event=>{
    if(event.key==='Escape' && viewport.classList.contains('is-expanded'))void leaveFullscreen();
  });
  syncFullscreenControls();
  sprite.addEventListener('error',()=>{if(!sprite.dataset.errorShown){sprite.dataset.errorShown='1';announce('레오 이미지 연결 상태를 확인하고 있어요.');}});
  setBall();
  render();
  requestAnimationFrame(tick);
})();
