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

  // The first approved memorial uses its owner-confirmed tribute image served with the site.
  // All other entries continue to use the moderated Storage publishing path.
  const localApprovedPortraits = Object.freeze({
    'approved/65123d76-a511-47cb-8125-7d4863eac0ab.jpg': '/memorial/leo-tribute.jpg'
  });
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
      if (name === 'ritual') { $('memorialMonitor').hidden = true; $('ritualActions').hidden = true; }
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
      $('memorialMonitor').hidden = false; $('ritualActions').hidden = false; refreshPetList();
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

  function renderSlots() {
    const box = $('hallSlots');box.replaceChildren();
    for (let row = 0; row < coordsY.length; row++) for (let col = 0; col < coordsX.length; col++) {
      const slot = row*3 + col + 1;
      const pet = publicPets.find(p => p.slot_index === slot);
      const b = document.createElement('button');
      b.type = 'button'; b.className='plaque';b.style.left=coordsX[col]+'%';b.style.top=coordsY[row]+'%';
      b.dataset.empty = String(!pet);
      b.dataset.pending = String(!pet && slot === 1);
      b.textContent = pet ? pet.pet_name : '';
      b.setAttribute('aria-label', pet ? String(slot).padStart(3,'0')+'호 · '+pet.pet_name+' 추억 보기' : slot === 1 ? '001호 · 등록 준비 중' : String(slot).padStart(3,'0')+'호 · 빈자리 등록 신청');
      b.addEventListener('click', () => { if(pet){ selectedPet=pet;go('story:'+pet.id); } else if(slot===1){$('hallGuide').textContent='001호는 첫 친구를 위한 준비 중인 자리입니다.';} else {go('apply');} });
      box.appendChild(b);
    }
  }
  async function refreshPets() {
    try {
      const rows = await restGET('hm_memorial_public?select=id,slot_index,pet_name,born_on,passed_on,story,farewell,photo_path,published_at&order=slot_index.asc');
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
      b.addEventListener('click',()=>{selectedPet=pet;refreshPetList();});list.appendChild(b);
    }
  }
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
})();