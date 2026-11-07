(() => {
  'use strict';
  const cfg=window.HAEMUNGI_CONTENT_CONFIG||{};
  const api=cfg.projectUrl||'', key=cfg.publishableKey||'';
  const $=id=>document.getElementById(id);
  const form=$('applicationForm');
  const sessionKey='hm-memorial-visitor-v1';
  let visitor=null,busy=false;
  const status=(message)=>{$('applicationStatus').textContent=message;};
  const authStatus=(message)=>{quickStatus(message);};
  const quickStatus=(message)=>{$('quickLoginStatus').textContent=message;};
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
    window.dispatchEvent(new Event('haemungi:visitor'));
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
  function readEmail(){
    const email=String(form.elements.contact_email.value||'').trim().toLowerCase();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw new Error('신청자 이메일을 먼저 입력해주세요.');
    return email;
  }
  function renderVisitor(){
    const logged=!!visitor?.access_token;
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
    }
  }
  async function authenticate(signup=false,credentials=null){
    if(busy)return;
    busy=true;
    try{
      if(!credentials)throw new Error('이메일 로그인 창에서 계정을 확인해주세요.');
      const email=credentials.email,password=credentials.password;
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
      $('quickLoginPassword').value='';
      if(credentials)quickStatus('로그인되었습니다. 14개 방문 여권과 내 기록을 확인할 수 있습니다.');
    }catch(err){authStatus(err.message);if(credentials)quickStatus(err.message);}finally{busy=false;}
  }
  async function logoutVisitor(){
    const token=visitor?.access_token;
    visitor=null;persistVisitor();renderVisitor();
    $('quickLoginPassword').value='';
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
    loginDialog.close();
    location.hash='#apply';
    window.HAEMUNGI_PASSPORT_OPEN_REWARD?.();
  });
  $('openPassportReward').addEventListener('click',()=>window.HAEMUNGI_PASSPORT_OPEN_REWARD?.());
  window.HAEMUNGI_MEMORIAL_SELECT_PLAQUE=()=>window.HAEMUNGI_PASSPORT_OPEN_REWARD?.();

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
      const email=readEmail();
      const jwt=await visitorToken();
      if(visitor?.user?.email?.toLowerCase()!==email)throw new Error('로그인 계정과 신청자 이메일이 달라요.');
      if(!visitor.user?.email_confirmed_at)throw new Error('이메일 인증을 완료한 뒤 신청해주세요.');
      if(!confirm('이름·사진 한 장·생몰일(입력 시)·이야기·마지막 인사가 별들의 기록에 즉시 공개됩니다. 누구나 검색하고 열람할 수 있습니다. 이 내용으로 공개하시겠습니까?')){
        status('공개를 취소했습니다. 사진과 내용을 다시 확인해주세요.');
        return;
      }
      busy=true;$('submitApplication').disabled=true;
      const name=String(data.get('pet_name')||'').trim();
      status('사진 한 장을 최적화하고 별들의 기록에 공개하고 있습니다…');
      data.set('photo',await compressImage(file));data.set('consent_declaration','true');
      const r=await jsonFetch(api+'/functions/v1/memorial-self-register',{
        method:'POST',headers:{apikey:key,Authorization:'Bearer '+jwt},body:data});
      submittedPreview(file,name,'등록되었습니다. 별들의 기록에서 누구나 검색하고 기억할 수 있습니다.',r.id);
      status('별들의 기록 공개 완료. 여권 14개 도장을 모았다면 여권 마지막 장에서 명패를 자동 발급받을 수 있습니다.');
      form.querySelector('input[name=photo]').value='';
    }catch(err){status(err.message);}finally{busy=false;$('submitApplication').disabled=false;}
  }
  form.addEventListener('submit',submit,true);
  try{
    const raw=sessionStorage.getItem(sessionKey);
    if(raw){visitor=JSON.parse(raw);if(!visitor?.access_token)visitor=null;}
  }catch(_){visitor=null;}
  renderVisitor();
  if(new URLSearchParams(location.search).get('login')==='1'&&!loginDialog.open)loginDialog.showModal();
})();
