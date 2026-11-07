(() => {
  'use strict';
  const cfg=window.HAEMUNGI_CONTENT_CONFIG||{};
  const api=cfg.projectUrl||'', key=cfg.publishableKey||'';
  const $=id=>document.getElementById(id);
  const form=$('applicationForm');
  const sessionKey='hm-memorial-visitor-v1';
  let visitor=null,selectedSlot=null,wings=[],busy=false,wingLoadSeq=0,slotLoadSeq=0;
  const status=(message)=>{$('applicationStatus').textContent=message;};
  const authStatus=(message)=>{$('visitorAuthStatus').textContent=message;};
  const quickStatus=(message)=>{$('quickLoginStatus').textContent=message;};
  const tier=()=>form.querySelector('input[name="registration_tier"]:checked')?.value||'archive';
  const headers=(jwt)=>({apikey:key,...(jwt?{Authorization:'Bearer '+jwt}:{}),'Content-Type':'application/json'});

  async function jsonFetch(url,opts={}) {
    const response=await fetch(url,{cache:'no-store',...opts});
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(body.msg||body.message||body.error_description||body.error||'서비스 연결 오류 ('+response.status+')');
    return body;
  }
  function persistVisitor() {
    if(visitor)sessionStorage.setItem(sessionKey,JSON.stringify(visitor));
    else sessionStorage.removeItem(sessionKey);
  }
  async function visitorToken() {
    if(!visitor?.access_token)throw new Error('먼저 이메일 계정으로 로그인하고 인증을 완료해주세요.');
    if((visitor.expires_at||0)<Date.now()/1000+65){
      const updated=await jsonFetch(api+'/auth/v1/token?grant_type=refresh_token',{
        method:'POST',headers:headers(),body:JSON.stringify({refresh_token:visitor.refresh_token})});
      visitor={...updated,user:updated.user||visitor.user,expires_at:Math.floor(Date.now()/1000)+updated.expires_in};
      persistVisitor();
    }
    return visitor.access_token;
  }
  async function callRPC(name,params={},jwt='') {
    return jsonFetch(api+'/rest/v1/rpc/'+name,{
      method:'POST',headers:headers(jwt),body:JSON.stringify(params)});
  }
  async function loadWings(){
    const sequence=++wingLoadSeq;
    try {
      const response=await callRPC('hm_memorial_wings');
      if(sequence!==wingLoadSeq)return;
      wings=Array.isArray(response)?response:[];
      const select=$('plaqueWing'),prior=Number(select.value)||1;
      select.replaceChildren();
      for(const wing of wings){
        const option=document.createElement('option');option.value=wing.wing_number;
        option.textContent=`제${wing.wing_number}관 · ${String((wing.wing_number-1)*12+1).padStart(3,'0')}~${String(wing.wing_number*12).padStart(3,'0')}호 · 빈자리 ${wing.available}`;
        select.appendChild(option);
      }
      select.value=String(wings.some(w=>w.wing_number===prior)?prior:1);
      await loadSlots();
    }catch(err){$('plaqueSlotStatus').textContent='구역 정보를 불러오지 못했습니다. '+err.message;}
  }
  async function loadSlots(){
    const sequence=++slotLoadSeq;
    const wing=Number($('plaqueWing').value)||1,container=$('plaqueSlotPicker');
    selectedSlot=null;container.replaceChildren();
    $('plaqueSlotStatus').textContent='호수별 자리를 확인하고 있습니다…';
    try{
      const rows=await callRPC('hm_memorial_slot_status',{p_wing:wing});
      if(sequence!==slotLoadSeq)return;
      if(!Array.isArray(rows)||rows.length!==12)throw new Error('자리 정보를 다시 불러와주세요.');
      const available=rows.filter(r=>r.state==='available').length;
      for(const row of rows){
        const button=document.createElement('button');button.type='button';button.className='plaque-slot';
        const free=row.state==='available';button.disabled=!free;
        button.dataset.state=row.state;button.setAttribute('aria-pressed','false');
        const stateName=row.state==='occupied'?'배정 완료':row.state==='pending'?'승인 대기':'신청 가능';
        button.textContent=String(row.slot_index).padStart(3,'0')+'호 · '+stateName;
        button.addEventListener('click',()=>{
          selectedSlot=row.slot_index;
          container.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
          $('plaqueSlotStatus').textContent=String(selectedSlot).padStart(3,'0')+'호를 선택했습니다. 로그인 후 신청하실 수 있습니다.';
        });
        container.appendChild(button);
      }
      $('plaqueSlotStatus').textContent=`제${wing}관 · 신청 가능한 자리 ${available}개 · 배정/승인 대기 자리는 선택할 수 없습니다.`;
    }catch(err){if(sequence===slotLoadSeq)$('plaqueSlotStatus').textContent=err.message;}
  }
  $('plaqueWing').addEventListener('change',loadSlots);

  function setTier(options={}){
    const plaque=tier()==='plaque';$('plaqueApplication').hidden=!plaque;$('archiveAuth').hidden=plaque;
    $('submitApplication').textContent=plaque?'안식관 명패 승인 신청하기':'무료 기록 바로 공개하기';
    $('photoPolicy').textContent=plaque?'JPG·PNG·WebP / 5MB 이하 · 관리자 승인 전 사진 비공개':'JPG·PNG·WebP / 5MB 이하 · 한 장을 압축하여 바로 공개';
    $('applyExplanation').textContent=plaque?
      '로그인 후 신청하면 선택한 자리가 승인 대기로 표시됩니다. 관리자가 확인한 뒤 같은 사진으로 명패가 공개됩니다.':
      '이메일 인증 후 관리자 승인 없이 공개됩니다. 개인정보가 공개되지 않도록 내용을 확인해주세요.';
    if(plaque&&!options.skipWingLoad)loadWings();
  }
  form.querySelectorAll('input[name="registration_tier"]').forEach(r=>r.addEventListener('change',setTier));

  function readEmail(){
    const email=String(form.elements.contact_email.value||'').trim().toLowerCase();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw new Error('신청자 이메일을 먼저 입력해주세요.');
    return email;
  }
  function readPassword(){
    const password=$('visitorPassword').value;
    if(password.length<8)throw new Error('비밀번호는 8자 이상 입력해주세요.');
    return password;
  }
  function renderVisitor(){
    const logged=!!visitor?.access_token;
    $('visitorLogin').hidden=logged;$('visitorSignup').hidden=logged;$('visitorLogout').hidden=!logged;
    $('upgradeArchiveBox').hidden=!logged;
    $('openVisitorLogin').textContent=logged?'내 계정':'로그인';
    $('quickLoginForm').hidden=logged;$('quickAccountArea').hidden=!logged;
    $('quickAccountEmail').textContent=logged?'로그인됨 · '+(visitor.user?.email||'이메일 계정'):'';
    form.elements.contact_email.readOnly=logged;
    $('archiveAuthStatus').textContent=logged?
      '이메일 인증 완료 · '+(visitor.user?.email||'계정')+' · 무료 기록 공개 가능':
      '기록을 공개하려면 이메일 인증을 마친 계정으로 로그인해주세요.';
    $('archiveLogin').textContent=logged?'로그인된 내 계정 확인':'이메일 로그인 · 계정 만들기';
    if(logged){
      form.elements.contact_email.value=visitor.user?.email||form.elements.contact_email.value;
      authStatus('로그인됨: '+(visitor.user?.email||'이메일 계정')+' · 명패 신청 가능');
      loadOwnedArchives();
    }else{authStatus('무료 기록 공개와 명패 신청에는 이메일 인증 계정이 필요합니다.');}
  }
  async function authenticate(signup=false,credentials=null){
    if(busy)return;
    busy=true;
    try{
      const email=credentials?.email||readEmail(),password=credentials?.password||readPassword();
      const message=signup?'계정과 확인 메일을 준비하고 있습니다…':'로그인하고 있습니다…';
      authStatus(message);if(credentials)quickStatus(message);
      const path=signup?'/auth/v1/signup?redirect_to='+encodeURIComponent(location.origin+'/memorial.html#apply'):
        '/auth/v1/token?grant_type=password';
      const data=await jsonFetch(api+path,{method:'POST',headers:headers(),body:JSON.stringify({email,password})});
      if(!data.access_token){
        const message='가입 신청을 받았습니다. 이메일 인증 안내를 확인한 뒤 이곳에서 로그인해주세요.';
        authStatus(message);if(credentials)quickStatus(message);
        return;
      }
      visitor={...data,expires_at:Math.floor(Date.now()/1000)+(data.expires_in||3600)};
      if(!visitor.user?.email_confirmed_at){visitor=null;throw new Error('이메일 인증을 마친 뒤 로그인해주세요.');}
      persistVisitor();renderVisitor();
      $('visitorPassword').value='';$('quickLoginPassword').value='';
      if(credentials)quickStatus('로그인되었습니다. 내 기록과 명패 신청을 확인할 수 있습니다.');
    }catch(err){authStatus(err.message);if(credentials)quickStatus(err.message);}finally{busy=false;}
  }
  $('visitorLogin').addEventListener('click',()=>authenticate(false));
  $('visitorSignup').addEventListener('click',()=>authenticate(true));
  async function logoutVisitor(){
    const token=visitor?.access_token;
    visitor=null;persistVisitor();renderVisitor();
    $('visitorPassword').value='';$('quickLoginPassword').value='';
    form.elements.contact_email.readOnly=false;
    quickStatus('이 기기에서 로그아웃했습니다.');
    if(token&&api){
      try{await fetch(api+'/auth/v1/logout?scope=local',{method:'POST',headers:headers(token),cache:'no-store'});}
      catch(_){/* Local session is cleared even if the server is unreachable. */}
    }
  }
  $('visitorLogout').addEventListener('click',logoutVisitor);
  $('quickLogout').addEventListener('click',logoutVisitor);

  const loginDialog=$('visitorLoginDialog');
  $('archiveLogin').addEventListener('click',()=>{
    const email=String(form.elements.contact_email.value||'').trim();
    if(email&&!visitor)$('quickLoginEmail').value=email;
    if(!loginDialog.open)loginDialog.showModal();
    if(visitor?.access_token)$('quickManageMemories').focus();
    else $('quickLoginEmail').focus();
  });
  $('openVisitorLogin').addEventListener('click',()=>{
    if(!loginDialog.open)loginDialog.showModal();
    if(visitor?.access_token)$('quickManageMemories').focus();
    else $('quickLoginEmail').focus();
  });
  $('closeVisitorLogin').addEventListener('click',()=>loginDialog.close());
  loginDialog.addEventListener('close',()=>{$('quickLoginPassword').value='';});
  $('quickLoginForm').addEventListener('submit',event=>{
    event.preventDefault();
    const email=$('quickLoginEmail').value.trim().toLowerCase();
    const password=$('quickLoginPassword').value;
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){quickStatus('올바른 이메일 주소를 입력해주세요.');return;}
    if(password.length<8){quickStatus('비밀번호는 8자 이상 입력해주세요.');return;}
    authenticate(false,{email,password});
  });
  $('quickSignup').addEventListener('click',()=>{
    const email=$('quickLoginEmail').value.trim().toLowerCase();
    const password=$('quickLoginPassword').value;
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){quickStatus('올바른 이메일 주소를 입력해주세요.');return;}
    if(password.length<8){quickStatus('비밀번호는 8자 이상 입력해주세요.');return;}
    authenticate(true,{email,password});
  });
  $('quickManageMemories').addEventListener('click',()=>{
    const radio=form.querySelector('input[name="registration_tier"][value="plaque"]');
    radio.checked=true;setTier();loginDialog.close();
    location.hash='#apply';
  });

  async function loadOwnedArchives(){
    const select=$('myArchiveRecords');select.replaceChildren();
    try{
      const jwt=await visitorToken();
      const records=await callRPC('hm_memorial_my_archive_entries',{},jwt);
      for(const row of Array.isArray(records)?records:[]){
        const option=document.createElement('option');option.value=row.id;
        option.textContent=row.pet_name+' · '+new Date(row.created_at).toLocaleDateString('ko-KR');
        select.appendChild(option);
      }
      if(!select.options.length){const option=document.createElement('option');option.textContent='같은 이메일의 공개 기록이 없습니다.';option.value='';select.appendChild(option);}
    }catch(err){const option=document.createElement('option');option.value='';option.textContent='기록 조회 오류: '+err.message;select.appendChild(option);}
  }
  $('upgradeArchive').addEventListener('click',async()=>{
    if(busy)return;
    const id=$('myArchiveRecords').value;if(!id){status('사진을 재사용할 기존 기록을 선택해주세요.');return;}
    if(!selectedSlot){status('안식관의 신청 가능한 호수를 먼저 선택해주세요.');return;}
    busy=true;$('upgradeArchive').disabled=true;
    try{
      await callRPC('hm_memorial_request_archive_plaque',{p_id:id,p_slot:selectedSlot},await visitorToken());
      status('기존 사진으로 '+String(selectedSlot).padStart(3,'0')+'호 명패 신청을 접수했습니다. 관리자 승인 후 명패가 표시됩니다.');
      await loadWings();await loadOwnedArchives();
    }catch(err){status(err.message);}finally{busy=false;$('upgradeArchive').disabled=false;}
  });
  window.HAEMUNGI_MEMORIAL_SELECT_PLAQUE=async slot=>{
    const radio=form.querySelector('input[name="registration_tier"][value="plaque"]');
    radio.checked=true;setTier({skipWingLoad:true});
    const expectedWing=Math.floor((slot-1)/12)+1;
    await loadWings();
    $('plaqueWing').value=String(expectedWing);
    await loadSlots();
    const button=Array.from($('plaqueSlotPicker').children).find(b=>b.textContent.startsWith(String(slot).padStart(3,'0')+'호'));
    if(button&&!button.disabled)button.click();
  };

  function onePhoto(file){
    if(!(file instanceof File)||file.size===0)throw new Error('사진 한 장을 선택해주세요.');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)
      throw new Error('JPG·PNG·WebP / 최대 5MB 사진만 등록 가능합니다.');
  }
  async function compressImage(file){
    const src=URL.createObjectURL(file);
    try{
      const image=new Image();image.src=src;await image.decode();
      if(!image.naturalWidth||!image.naturalHeight)throw new Error('사진을 열 수 없습니다.');
      const ratio=Math.min(1,1280/Math.max(image.naturalWidth,image.naturalHeight));
      const canvas=document.createElement('canvas');
      canvas.width=Math.round(image.naturalWidth*ratio);canvas.height=Math.round(image.naturalHeight*ratio);
      canvas.getContext('2d',{alpha:false}).drawImage(image,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.76));
      canvas.width=0;canvas.height=0;
      if(!blob||blob.type!=='image/webp'||blob.size>900000)throw new Error('사진을 압축할 수 없습니다. 다른 사진을 선택해주세요.');
      return new File([blob],'memory.webp',{type:'image/webp'});
    }finally{URL.revokeObjectURL(src);}
  }
  function submittedPreview(file,name,message,id){
    const preview=$('applicationCard');preview.replaceChildren();
    const photo=document.createElement('img');photo.src=URL.createObjectURL(file);photo.alt=name+'의 사진 미리보기';
    photo.onload=()=>URL.revokeObjectURL(photo.src);
    const title=document.createElement('h3');title.textContent=name;
    const detail=document.createElement('p');detail.textContent=message;
    preview.append(photo,title,detail);
    if(id){const link=document.createElement('a');link.href='/memorial.html#story:'+id;link.textContent='공개된 추억 보러가기 →';preview.appendChild(link);}
    preview.hidden=false;
  }

  async function submit(event){
    event.preventDefault();event.stopImmediatePropagation();
    if(busy)return;
    const data=new FormData(form),file=data.get('photo');
    if(String(data.get('website')||'').trim())return;
    try{
      onePhoto(file);
      if(!data.get('consent_declaration'))throw new Error('공개 및 보관 동의를 확인해주세요.');
      if(data.get('born_on')&&data.get('passed_on')&&data.get('born_on')>data.get('passed_on'))
        throw new Error('태어난 날과 별이 된 날의 순서를 확인해주세요.');
      const email=readEmail(),isPlaque=tier()==='plaque';
      const jwt=await visitorToken();
      if(visitor?.user?.email?.toLowerCase()!==email)throw new Error('로그인 계정과 신청자 이메일이 달라요.');
      if(!visitor.user?.email_confirmed_at)throw new Error('이메일 인증을 완료한 뒤 신청해주세요.');
      if(isPlaque){
        if(!selectedSlot)throw new Error('안식관 명패를 신청할 호수를 먼저 선택해주세요.');
        data.set('session_token',jwt);
      }else if(!confirm('이름·사진 한 장·생몰일(입력 시)·이야기·마지막 인사가 별들의 기록에 즉시 공개됩니다. 누구나 검색하고 열람할 수 있습니다. 이 내용으로 공개하시겠습니까?')){
        status('공개를 취소했습니다. 사진과 내용을 다시 확인해주세요.');
        return;
      }
      busy=true;$('submitApplication').disabled=true;
      const name=String(data.get('pet_name')||'').trim();
      if(!isPlaque){
        status('사진 한 장을 최적화하고 별들의 기록에 공개하고 있습니다…');
        data.set('photo',await compressImage(file));data.set('consent_declaration','true');
        data.delete('registration_tier');data.delete('session_token');
        const r=await jsonFetch(api+'/functions/v1/memorial-self-register',{
          method:'POST',headers:{apikey:key,Authorization:'Bearer '+jwt},body:data});
        submittedPreview(file,name,'등록되었습니다. 별들의 기록에서 누구나 검색하고 기억할 수 있습니다.',r.id);
        status('별들의 기록 공개가 완료되었습니다. 관리자 승인 없이 바로 이용하실 수 있습니다.');
      }else{
        status('선택한 명패 자리에 신청하고 사진을 비공개 저장하고 있습니다…');
        const id=crypto.randomUUID(),ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[file.type];
        const photoPath='incoming/'+id+'.'+ext;
        const jwt=data.get('session_token');
        const upload=await fetch(api+'/storage/v1/object/hm-memorial-inbox/'+photoPath,{
          method:'POST',headers:{apikey:key,Authorization:'Bearer '+jwt,'Content-Type':file.type,'x-upsert':'false'},body:file});
        if(!upload.ok)throw new Error('사진을 비공개 저장하지 못했습니다. ('+upload.status+')');
        await jsonFetch(api+'/rest/v1/hm_memorial_requests',{
          method:'POST',headers:headers(jwt),body:JSON.stringify({
            id,pet_name:name,photo_path:photoPath,born_on:data.get('born_on')||null,
            passed_on:data.get('passed_on')||null,story:String(data.get('story')||'').trim(),
            farewell:String(data.get('farewell')||'').trim(),contact_email:email,
            requested_visibility:'public',requested_slot:selectedSlot,owner_id:visitor.user.id,
            consent_declaration:true,status:'pending',publication_source:'admin',
          })});
        submittedPreview(file,name,String(selectedSlot).padStart(3,'0')+'호 신청이 접수되었습니다. 관리자 승인 전까지는 공개되지 않습니다.');
        status('신청이 접수되었습니다. 관리자 승인 후 안식관 명패로 연결됩니다.');
        await loadWings();
      }
      form.querySelector('input[name=photo]').value='';
    }catch(err){status(err.message);}finally{busy=false;$('submitApplication').disabled=false;}
  }
  form.addEventListener('submit',submit,true);
  try{
    const raw=sessionStorage.getItem(sessionKey);
    if(raw){visitor=JSON.parse(raw);if(!visitor?.access_token)visitor=null;}
  }catch(_){visitor=null;}
  renderVisitor();setTier();
  if(new URLSearchParams(location.search).get('login')==='1'&&!loginDialog.open)loginDialog.showModal();
})();
