(() => {
  'use strict';
  const cfg = window.HAEMUNGI_CONTENT_CONFIG || {};
  const api = cfg.projectUrl || '';
  const key = cfg.publishableKey || '';
  const ready = /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(api) && /^sb_publishable_[\w-]+$/.test(key);
  const $ = id => document.getElementById(id);
  const screens = Array.from(document.querySelectorAll('[data-screen]'));
  const videos = {entrance: $('entranceVideo'), hall: $('hallVideo'), ritual: $('ritualVideo')};
  const stills = {entrance: $('entranceStill'), hall: $('hallStill'), ritual: $('ritualStill')};
  const covers = {entrance: $('entranceCover'), hall: $('hallCover'), ritual: $('ritualCover')};
  const coordsX = [15,45,80];
  const coordsY = [24,41,60,78];
  let publicPets = [];
  let selectedPet = null;
  let activeScreen = 'entrance';
  let played = new Set();
  let offeringBusy = false;
  let offeringsLoadSeq = 0;
  const flowerNames = Object.freeze({white:'흰 꽃',peach:'연분홍 꽃',gold:'금빛 꽃'});
  const flowerArt = `<svg viewBox="0 0 54 82" aria-hidden="true" focusable="false"><path d="M27 75 Q23 53 28 32" fill="none" stroke="#61805b" stroke-width="2.5" stroke-linecap="round"/><path d="M26 60 Q12 46 8 58 Q15 65 26 64" fill="#7f9b6e"/><path d="M28 52 Q42 37 46 49 Q41 58 28 57" fill="#708d67"/><g fill="currentColor" stroke="#e4d6bb" stroke-width=".65"><ellipse cx="27" cy="15" rx="7.5" ry="13"/><ellipse cx="27" cy="39" rx="7.5" ry="13"/><ellipse cx="15" cy="27" rx="13" ry="7.5"/><ellipse cx="39" cy="27" rx="13" ry="7.5"/><ellipse cx="18.5" cy="18.5" rx="7.5" ry="12" transform="rotate(-45 18.5 18.5)"/><ellipse cx="35.5" cy="18.5" rx="7.5" ry="12" transform="rotate(45 35.5 18.5)"/><ellipse cx="18.5" cy="35.5" rx="7.5" ry="12" transform="rotate(45 18.5 35.5)"/><ellipse cx="35.5" cy="35.5" rx="7.5" ry="12" transform="rotate(-45 35.5 35.5)"/></g><circle cx="27" cy="27" r="7" fill="#e1b75e"/><circle cx="27" cy="27" r="3" fill="#a8793d"/></svg>`;

  // The first approved memorial uses its owner-confirmed tribute image served with the site.
  // All other entries continue to use the moderated Storage publishing path.
  const localApprovedPortraits = Object.freeze({
    'approved/65123d76-a511-47cb-8125-7d4863eac0ab.jpg': '/memorial/leo-tribute.jpg'
  });
  async function refreshSceneArt() {
    try {
      const rows=await restGET('hm_memorial_scene_settings?select=scene_key,image_path');
      for(const row of Array.isArray(rows)?rows:[]) {
        if(!/^(garden_backdrop|(entrance|hall|ritual)_cover)$/.test(row.scene_key||'')||
          !/^scene\/[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$/.test(row.image_path||''))continue;
        const url=api+'/storage/v1/object/public/hm-memorial-published/'+row.image_path;
        if(row.scene_key==='garden_backdrop') {
          document.querySelector('[data-screen="entrance"]').style.setProperty('--garden-image','url("'+url+'")');
        } else {
          const cover=covers[row.scene_key.replace('_cover','')];
          cover.style.setProperty('--scene-image','url("'+url+'")');
          cover.classList.add('has-scene-image');
        }
      }
    }catch(err){console.info('추모관 기본 배경을 유지합니다.',err.message);}
  }
  function publicPhoto(path) {
    if (Object.prototype.hasOwnProperty.call(localApprovedPortraits, path || '')) {
      return localApprovedPortraits[path];
    }
    if (!/^approved\/[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$/.test(path || '')) return '';
    return api + '/storage/v1/object/public/hm-memorial-published/' + path;
  }
  async function restGET(path) {
    if (!ready) throw new Error('추모관 데이터 연결 설정을 확인해주세요.');
    const r = await fetch(api + '/rest/v1/' + path, {headers: {apikey:key,Accept:'application/json'}, cache:'no-store'});
    if (!r.ok) throw new Error('데이터 조회 오류 (' + r.status + ')');
    return r.json();
  }
  async function restPOST(path, body) {
    if (!ready) throw new Error('추모관 데이터 연결 설정을 확인해주세요.');
    const r = await fetch(api + '/rest/v1/' + path, {method:'POST',
      headers:{apikey:key,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(body)});
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.message || '신청 접수에 실패했습니다. (' + r.status + ')');
    }
  }
  function currentRoute() {
    const hash = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (hash.startsWith('story:')) return {name:'story',id:hash.slice(6)};
    return {name:['entrance','hall','ritual','apply'].includes(hash) ? hash : 'entrance'};
  }
  function go(route) {
    if (location.hash === '#' + route) return routeTo(currentRoute());
    location.hash = route;
  }
  function stopFilms() {
    for (const vid of Object.values(videos)) {
      vid.pause();
      vid.hidden = true;
      vid.currentTime = 0;
    }
  }
  function routeTo(route) {
    stopFilms();
    activeScreen = route.name;
    screens.forEach(s => {s.hidden = s.dataset.screen !== route.name;});
    window.scrollTo(0,0);
    if (videos[route.name]) {
      const name = route.name;
      stills[name].hidden = true; covers[name].hidden = false; videos[name].hidden = false;
      document.querySelector('[data-skip="' + name + '"]').hidden = true;
      if (name === 'entrance') $('entranceOptions').hidden = true;
      if (name === 'hall') { $('hallSlots').hidden = true; $('hallActions').hidden = true; }
      if (name === 'ritual') { $('memorialMonitor').hidden = true; $('altarFlowers').hidden = true; $('ritualActions').hidden = true; }
    }
    if (route.name === 'story') showStory(route.id);
    if (route.name === 'ritual') refreshPetList();
  }
  async function playFilm(name) {
    const v = videos[name];
    if (!v) return;
    covers[name].hidden = true; v.hidden = false; stills[name].hidden = true;
    document.querySelector('[data-skip="' + name + '"]').hidden = false;
    v.currentTime = 0;
    try { await v.play(); }
    catch (_) {covers[name].hidden = false; document.querySelector('[data-skip="' + name + '"]').hidden = false;}
  }
  function finishFilm(name) {
    const v = videos[name];
    v.pause();v.hidden = true;stills[name].hidden = false;covers[name].hidden = true;
    document.querySelector('[data-skip="' + name + '"]').hidden = true;
    played.add(name);
    if (name === 'entrance') $('entranceOptions').hidden = false;
    if (name === 'hall') {
      $('hallSlots').hidden = false; $('hallActions').hidden = false; renderSlots();
    }
    if (name === 'ritual') {
      $('memorialMonitor').hidden = false; $('altarFlowers').hidden = false; $('ritualActions').hidden = false; refreshPetList();
    }
  }
  Object.entries(videos).forEach(([name,v]) => {
    v.addEventListener('ended', () => { if (activeScreen === name) finishFilm(name); });
    v.addEventListener('error', () => { if (activeScreen === name) finishFilm(name); });
  });
  $('playEntrance').addEventListener('click', () => playFilm('entrance'));
  $('playHall').addEventListener('click', () => playFilm('hall'));
  $('playRitual').addEventListener('click', () => playFilm('ritual'));
  $('visitHall').addEventListener('click', () => go('hall'));
  $('visitRitual').addEventListener('click', () => go('ritual'));
  $('openApplication').addEventListener('click', () => go('apply'));
  document.querySelectorAll('[data-skip]').forEach(b => b.addEventListener('click', () => finishFilm(b.dataset.skip)));
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
  window.addEventListener('hashchange', () => routeTo(currentRoute()));

  // Bookfair-style artwork placement: normalized four-corner projection on the original 9:16 scene.
  // The background photograph and the approved tribute asset are never modified.
  function validFrameCorners(q) {
    if(!Array.isArray(q)||q.length!==4||
       !q.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1)))return false;
    const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    return q.every((p,i)=>cross(p,q[(i+1)%4],q[(i+2)%4])>.00018) &&
      Math.max(...q.map(p=>p[0]))-Math.min(...q.map(p=>p[0]))>.025 &&
      Math.max(...q.map(p=>p[1]))-Math.min(...q.map(p=>p[1]))>.025;
  }
  function nicheArtCorners(slot,row,col,custom) {
    if(validFrameCorners(custom))return custom;
    if(slot===1) return [[.073,.104],[.255,.095],[.254,.211],[.072,.216]];
    const x=coordsX[col]/100, w=[.18,.20,.22][col], bottom=(coordsY[row]-3.0)/100;
    const h=[.11,.11,.115,.12][row], skew=[.006,.002,-.003][col];
    return [[x-w/2,bottom-h+skew],[x+w/2,bottom-h-skew],
            [x+w/2,bottom-skew/2],[x-w/2,bottom+skew/2]];
  }
  function frameHomography(q) {
    const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=q;
    const dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3;
    const dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3;
    let g=0,h=0;
    if(Math.abs(dx3)+Math.abs(dy3)>1e-10) {
      const den=dx1*dy2-dx2*dy1;
      if(Math.abs(den)<1e-10)throw Error('원근 좌표 오류');
      g=(dx3*dy2-dx2*dy3)/den;h=(dx1*dy3-dx3*dy1)/den;
    }
    return [x1-x0+g*x1,x3-x0+h*x3,x0,y1-y0+g*y1,y3-y0+h*y3,y0,g,h];
  }
  function frameInverse(H) {
    const [a,b,c,d,e,f,g,h]=H;
    const A=e-f*h,B=c*h-b,C=b*f-c*e,D=f*g-d,E=a-c*g,F=c*d-a*f,G=d*h-e*g,I=b*g-a*h,J=a*e-b*d;
    const det=a*A+b*D+c*G;
    if(!Number.isFinite(det)||Math.abs(det)<1e-12)throw Error('원근 역행렬 오류');
    return [A,B,C,D,E,F,G,I,J].map(n=>n/det);
  }
  function frameMap(M,x,y) {
    const z=M[6]*x+M[7]*y+M[8];
    return [(M[0]*x+M[1]*y+M[2])/z,(M[3]*x+M[4]*y+M[5])/z];
  }
  const nichePhotoCache=new Map();
  function nichePhoto(src) {
    if(!nichePhotoCache.has(src)) {
      const task=(async()=>{
        const img=new Image();img.crossOrigin='anonymous';img.src=src;await img.decode();
        return img;
      })();
      nichePhotoCache.set(src,task);
    }
    return nichePhotoCache.get(src);
  }
  async function paintNicheArt(canvas,source,q,focusX,focusY,frameStyle,fit='cover',matColor='#f4ead8') {
    try {
      const img=await nichePhoto(source);
      if(!canvas.isConnected)return;
      const parent=canvas.parentElement;
      const dpr=Math.min(2,window.devicePixelRatio||1);
      const xs=q.map(p=>p[0]),ys=q.map(p=>p[1]);
      const pad=3/Math.max(1,parent.clientWidth);
      const minX=Math.max(0,Math.min(...xs)-pad),maxX=Math.min(1,Math.max(...xs)+pad);
      const minY=Math.max(0,Math.min(...ys)-pad*.58),maxY=Math.min(1,Math.max(...ys)+pad*.58);
      const width=Math.max(1,Math.ceil((maxX-minX)*parent.clientWidth*dpr));
      const height=Math.max(1,Math.ceil((maxY-minY)*parent.clientHeight*dpr));
      canvas.width=width;canvas.height=height;
      Object.assign(canvas.style,{left:minX*100+'%',top:minY*100+'%',
        width:(maxX-minX)*100+'%',height:(maxY-minY)*100+'%'});
      const sourceCanvas=document.createElement('canvas');
      sourceCanvas.width=512;sourceCanvas.height=512;
      const sourceCtx=sourceCanvas.getContext('2d',{willReadFrequently:true});
      const frameAspect=((Math.max(...xs)-Math.min(...xs))*parent.clientWidth)/
        ((Math.max(...ys)-Math.min(...ys))*parent.clientHeight);
      sourceCtx.fillStyle=/^#[0-9a-f]{6}$/i.test(matColor)?matColor:'#f4ead8';
      sourceCtx.fillRect(0,0,512,512);
      if(fit==='contain') {
        const imageRatio=img.naturalWidth/img.naturalHeight;
        const scaledRatio=imageRatio/frameAspect;
        const drawW=scaledRatio>=1?512:512*scaledRatio;
        const drawH=scaledRatio>=1?512/scaledRatio:512;
        sourceCtx.drawImage(img,(512-drawW)/2,(512-drawH)/2,drawW,drawH);
      }else{
        let cropW=img.naturalWidth,cropH=img.naturalHeight;
        if(cropW/cropH>frameAspect)cropW=cropH*frameAspect;
        else cropH=cropW/frameAspect;
        const cropX=(img.naturalWidth-cropW)*Math.max(0,Math.min(1,focusX));
        const cropY=(img.naturalHeight-cropH)*Math.max(0,Math.min(1,focusY));
        sourceCtx.drawImage(img,cropX,cropY,cropW,cropH,0,0,512,512);
      }
      const pix=sourceCtx.getImageData(0,0,512,512).data;
      const H=frameInverse(frameHomography(q));
      const ctx=canvas.getContext('2d');
      const out=ctx.createImageData(width,height),data=out.data;
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        const nx=minX+(x+.5)/width*(maxX-minX);
        const ny=minY+(y+.5)/height*(maxY-minY);
        const [u,v]=frameMap(H,nx,ny);
        if(u<0||u>1||v<0||v>1)continue;
        const sx=Math.max(0,Math.min(511,u*511)),sy=Math.max(0,Math.min(511,v*511));
        const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(511,x0+1),y1=Math.min(511,y0+1);
        const tx=sx-x0,ty=sy-y0,at=(y*width+x)*4;
        for(let c=0;c<3;c++){
          const a=pix[(y0*512+x0)*4+c],b=pix[(y0*512+x1)*4+c];
          const d=pix[(y1*512+x0)*4+c],e=pix[(y1*512+x1)*4+c];
          data[at+c]=Math.round((a+(b-a)*tx)*(1-ty)+(d+(e-d)*tx)*ty);
        }
        data[at+3]=255;
      }
      if(!canvas.isConnected)return;
      ctx.putImageData(out,0,0);
      ctx.save();ctx.beginPath();
      q.forEach((p,i)=>{
        const x=(p[0]-minX)/(maxX-minX)*width,y=(p[1]-minY)/(maxY-minY)*height;
        if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      });
      const frameColors={ivory:'#e8d9bd',brass:'#bc9c58',walnut:'#6a492c'};
      ctx.closePath();ctx.strokeStyle=frameColors[frameStyle]||frameColors.ivory;ctx.lineWidth=Math.max(1.5,dpr*2);
      ctx.shadowColor='rgba(51,32,17,.5)';ctx.shadowBlur=dpr*3;ctx.stroke();ctx.restore();
      sourceCanvas.width=0;sourceCanvas.height=0;
    }catch(err){console.warn('안식관 사진 투영 실패',err);}
  }
  function renderSlots() {
    const box = $('hallSlots');box.replaceChildren();
    for (let row = 0; row < coordsY.length; row++) for (let col = 0; col < coordsX.length; col++) {
      const slot = row*3 + col + 1;
      const pet = publicPets.find(p => p.slot_index === slot);
      const openPet = () => { selectedPet=pet;go('story:'+pet.id); };
      const source = pet && publicPhoto(pet.photo_path);
      if(source) {
        const corners=nicheArtCorners(slot,row,col,pet.frame_corners);
        const artwork=document.createElement('canvas');
        artwork.width=0;artwork.height=0;artwork.className='niche-art-canvas';
        artwork.dataset.artSlot=String(slot);
        artwork.setAttribute('aria-hidden','true');box.appendChild(artwork);
        const hit=document.createElement('button');
        hit.type='button';hit.className='niche-art-hit';
        const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);
        const left=Math.min(...xs),top=Math.min(...ys),width=Math.max(...xs)-left,height=Math.max(...ys)-top;
        Object.assign(hit.style,{left:left*100+'%',top:top*100+'%',
          width:width*100+'%',height:height*100+'%'});
        hit.setAttribute('aria-label',String(slot).padStart(3,'0')+'호 · '+pet.pet_name+' 사진과 추억 보기');
        hit.addEventListener('click',openPet);box.appendChild(hit);
        const originalLeo=Object.prototype.hasOwnProperty.call(localApprovedPortraits,pet.photo_path||'');
        paintNicheArt(artwork,source,corners,
          pet.frame_focus_x==null?(originalLeo?0:.5):Number(pet.frame_focus_x),
          pet.frame_focus_y==null?.5:Number(pet.frame_focus_y),pet.frame_style||'ivory',pet.frame_fit||'cover',pet.frame_mat_color||'#f4ead8');
      }
      const b = document.createElement('button');
      b.type = 'button'; b.className='plaque';b.style.left=coordsX[col]+'%';b.style.top=coordsY[row]+'%';
      b.dataset.empty = String(!pet);
      b.dataset.pending = String(!pet && slot === 1);
      b.textContent = pet ? pet.pet_name : '';
      b.setAttribute('aria-label', pet ? String(slot).padStart(3,'0')+'호 · '+pet.pet_name+' 추억 보기' : slot === 1 ? '001호 · 등록 준비 중' : String(slot).padStart(3,'0')+'호 · 빈자리 등록 신청');
      b.addEventListener('click', () => { if(pet){openPet();} else if(slot===1){$('hallGuide').textContent='001호는 첫 친구를 위한 준비 중인 자리입니다.';} else {go('apply');} });
      box.appendChild(b);
    }
  }
  async function refreshPets() {
    try {
      const rows = await restGET('hm_memorial_public?select=id,slot_index,pet_name,born_on,passed_on,story,farewell,photo_path,published_at,frame_style,frame_focus_x,frame_focus_y,frame_corners,frame_fit,frame_mat_color&order=slot_index.asc');
      publicPets = Array.isArray(rows) ? rows : [];
      if (selectedPet) selectedPet = publicPets.find(x=>x.id===selectedPet.id) || null;
      if (!$('hallSlots').hidden) renderSlots();
      refreshPetList();
      if (activeScreen === 'story') showStory(currentRoute().id);
    } catch (_) {
      $('hallGuide').textContent = '친구 목록을 불러오지 못했습니다. 잠시 후 다시 이용해주세요.';
    }
  }
  function refreshPetList() {
    const list = $('ritualPetList');list.replaceChildren();
    const monitor = $('memorialMonitor');monitor.replaceChildren();
    const guide = $('ritualGuide');const btn=$('goSelectedStory');
    if (!selectedPet && publicPets.length) selectedPet = publicPets[0];
    if (selectedPet) {
      guide.textContent = selectedPet.pet_name + '의 기억을 함께합니다.';
      const src = publicPhoto(selectedPet.photo_path);
      if(src) {
        const img=document.createElement('img');img.src=src;img.alt=selectedPet.pet_name+'의 사진';img.loading='lazy';monitor.appendChild(img);
      }
      btn.hidden = false;
    } else {
      guide.textContent='공개된 친구가 아직 없습니다. 소중한 이야기를 기다리고 있습니다.';
      btn.hidden = true;
    }
    for (const pet of publicPets) {
      const b=document.createElement('button');b.type='button';
      b.textContent=pet.pet_name;b.setAttribute('aria-pressed',String(selectedPet?.id===pet.id));
      b.addEventListener('click',()=>{selectedPet=pet;$('offeringStatus').textContent='';refreshPetList();});list.appendChild(b);
    }
    $('offeringPanel').hidden = !selectedPet;
    updateFlowerButtons();
    refreshOfferings();
  }

  function offeringDayKey(petId) {
    const d = new Date();
    const today = [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
    return 'hm-memorial-flower-v1:'+petId+':'+today;
  }
  function offeredToday(petId) {
    try{return localStorage.getItem(offeringDayKey(petId))==='1';}catch(_){return false;}
  }
  function rememberOffering(petId) {
    try{localStorage.setItem(offeringDayKey(petId),'1');}catch(_){}
  }
  function updateFlowerButtons() {
    const done = selectedPet && offeredToday(selectedPet.id);
    document.querySelectorAll('[data-flower-kind]').forEach(button=>{
      button.disabled = !selectedPet || offeringBusy || !!done;
    });
    if(done && !offeringBusy && !$('offeringStatus').textContent) {
      $('offeringStatus').textContent = '오늘의 헌화를 마쳤습니다. 내일 다시 마음을 전할 수 있습니다.';
    }
  }
  async function refreshOfferings(animateLast=false) {
    const petId=selectedPet?.id, seq=++offeringsLoadSeq;
    const altar=$('altarFlowers');altar.replaceChildren();
    if(!petId)return;
    try {
      const rows=await restGET('hm_memorial_offerings?select=id,flower_kind,created_at&memorial_id=eq.'+
        encodeURIComponent(petId)+'&order=created_at.desc&limit=6');
      if(seq!==offeringsLoadSeq||selectedPet?.id!==petId)return;
      const recent=(Array.isArray(rows)?rows:[]).slice().reverse();
      recent.forEach((offering,index)=>{
        if(!Object.prototype.hasOwnProperty.call(flowerNames,offering.flower_kind))return;
        const blossom=document.createElement('span');
        blossom.className='altar-blossom flower-'+offering.flower_kind+
          (animateLast&&index===recent.length-1?' just-offered':'');
        blossom.innerHTML=flowerArt;
        altar.appendChild(blossom);
      });
    }catch(_){
      if(seq===offeringsLoadSeq&&selectedPet?.id===petId){
        $('offeringStatus').textContent='헌화 내역을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
      }
    }
  }
  document.querySelectorAll('[data-flower-kind]').forEach(button=>button.addEventListener('click',async()=>{
    const pet=selectedPet,kind=button.dataset.flowerKind,status=$('offeringStatus');
    if(!pet||offeringBusy||!Object.prototype.hasOwnProperty.call(flowerNames,kind))return;
    if(offeredToday(pet.id)){updateFlowerButtons();return;}
    offeringBusy=true;updateFlowerButtons();
    status.textContent='꽃을 제단에 올리고 있습니다…';
    try{
      await restPOST('hm_memorial_offerings',{memorial_id:pet.id,flower_kind:kind});
      rememberOffering(pet.id);
      if(selectedPet?.id===pet.id){
        status.textContent=pet.pet_name+'에게 '+flowerNames[kind]+'을(를) 헌화했습니다.';
        await refreshOfferings(true);
      }
    }catch(err){if(selectedPet?.id===pet.id)status.textContent='헌화 저장에 실패했습니다. '+err.message;}
    finally{offeringBusy=false;updateFlowerButtons();}
  }));
  $('goSelectedStory').addEventListener('click',()=>{if(selectedPet)go('story:'+selectedPet.id);});
  $('storyVisitRitual').addEventListener('click',()=>go('ritual'));
  function el(tag,className,txt) {
    const n=document.createElement(tag);if(className)n.className=className;if(txt!==undefined)n.textContent=txt;return n;
  }
  async function showStory(id) {
    const box=$('friendStory');box.replaceChildren();
    const pet=publicPets.find(x=>x.id===id);
    if (!pet){box.appendChild(el('p','', '공개된 추억을 찾을 수 없습니다.'));$('letterForm').hidden=true;return;}
    $('letterForm').hidden=false;selectedPet=pet;
    box.appendChild(el('p','eyebrow', '안식관 '+String(pet.slot_index).padStart(3,'0')+'호'));
    box.appendChild(el('h1','',pet.pet_name));
    const date=[pet.born_on,pet.passed_on].filter(Boolean).join(' ~ ');
    if(date)box.appendChild(el('p','dates',date));
    const src=publicPhoto(pet.photo_path);
    if(src){const img=el('img','portrait');img.src=src;img.alt=pet.pet_name+'의 모습';img.loading='lazy';box.appendChild(img);}
    box.appendChild(el('p','',pet.story||''));
    if(pet.farewell){box.appendChild(el('blockquote','',pet.farewell));}
    // The independent memory room belongs only to approved memorial 001, Leo.
    // Never display this invitation for an unapproved application or another pet.
    if (pet.slot_index === 1 && Object.prototype.hasOwnProperty.call(localApprovedPortraits,pet.photo_path||'')) {
      const roomLink=el('a','leo-room-invitation');
      roomLink.href='/leo-room.html';
      roomLink.textContent='🐾 '+pet.pet_name+'의 작은 일상, 햇살 가득한 추억방 방문하기 →';
      box.appendChild(roomLink);
    }
    loadLetters(pet.id);
  }
  async function loadLetters(petId){
    const list=$('letterList');list.replaceChildren();
    try{
      const letters=await restGET('hm_memorial_letters?select=author_alias,body,created_at&memorial_id=eq.'+encodeURIComponent(petId)+'&order=created_at.desc&limit=30');
      if(!letters.length){list.appendChild(el('p','hint','아직 공개된 편지가 없습니다.'));return;}
      for(const l of letters){const a=el('article');a.appendChild(el('strong','',l.author_alias));a.appendChild(el('p','',l.body));list.appendChild(a);}
    }catch(_){list.appendChild(el('p','hint','편지를 불러올 수 없습니다.'));}
  }
  $('letterForm').addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget;const status=$('letterStatus');const btn=form.querySelector('button[type=submit]');
    if(!selectedPet){status.textContent='친구를 먼저 선택해주세요.';return;}
    btn.disabled=true;status.textContent='편지를 접수하고 있습니다…';
    try{
      const f=new FormData(form);
      await restPOST('hm_memorial_letters',{memorial_id:selectedPet.id,author_alias:String(f.get('author_alias')||'').trim(),body:String(f.get('body')||'').trim(),status:'pending'});
      form.reset();status.textContent='편지가 접수되었습니다. 관리자 확인 후 공개됩니다.';
    }catch(err){status.textContent=err.message;}finally{btn.disabled=false;}
  });
  $('applicationForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.currentTarget,btn=$('submitApplication'),status=$('applicationStatus');
    const f=new FormData(form),file=f.get('photo');
    if(String(f.get('website')||'').trim())return;
    if(!(file instanceof File)||!file.size){status.textContent='사진 한 장을 선택해주세요.';return;}
    const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[file.type];
    if(!ext||file.size>5*1024*1024){status.textContent='JPG·PNG·WebP 파일을 5MB 이하로 선택해주세요.';return;}
    if(!f.get('consent_declaration')){status.textContent='등록 권한 및 보관 동의를 확인해주세요.';return;}
    btn.disabled=true;status.textContent='사진과 신청서를 안전하게 접수하고 있습니다…';
    try{
      if(!ready)throw new Error('신청 시스템 연결 설정을 확인해주세요.');
      const id=crypto.randomUUID(),path='incoming/'+id+'.'+ext;
      const upload=await fetch(api+'/storage/v1/object/hm-memorial-inbox/'+path,{method:'POST',
        headers:{apikey:key,'Content-Type':file.type,'x-upsert':'false'},body:file});
      if(!upload.ok)throw new Error('사진 업로드에 실패했습니다. ('+upload.status+')');
      await restPOST('hm_memorial_requests',{
        id,pet_name:String(f.get('pet_name')||'').trim(),photo_path:path,
        born_on:f.get('born_on')||null,passed_on:f.get('passed_on')||null,
        story:String(f.get('story')||'').trim(),farewell:String(f.get('farewell')||'').trim(),
        contact_email:String(f.get('contact_email')||'').trim(),
        requested_visibility:String(f.get('requested_visibility')||'public'),
        consent_declaration:true,status:'pending'
      });
      const prev=$('applicationCard');prev.replaceChildren();
      const img=el('img');img.src=URL.createObjectURL(file);img.alt='신청 사진 미리보기';prev.appendChild(img);
      prev.appendChild(el('h3','',String(f.get('pet_name')||'')));
      prev.appendChild(el('p','','신청이 접수되었습니다. 이 카드는 신청자에게 보여주는 미리보기이며 아직 공개되지 않았습니다.'));
      prev.hidden=false;form.reset();status.textContent='신청이 접수되었습니다. 관리자 확인 후 공개 여부가 결정됩니다.';
    }catch(err){status.textContent=err.message;}finally{btn.disabled=false;}
  });
  routeTo(currentRoute());
  refreshPets();
  refreshSceneArt();
})();
