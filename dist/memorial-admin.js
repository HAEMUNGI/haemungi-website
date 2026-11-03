(() => {
  'use strict';
  const cfg=window.HAEMUNGI_CONTENT_CONFIG||{},api=cfg.projectUrl||'',key=cfg.publishableKey||'';
  const $=id=>document.getElementById(id);
  let session=null;let busy=false;
  function notice(txt,error=false){$('notice').textContent=txt;$('notice').style.color=error?'#ffb6a5':'#e9d5b7';}
  function authView(text){$('authMessage').hidden=false;$('authMessage').querySelector('p').textContent=text;$('adminWorkspace').hidden=true;}
  function persist(){if(session)sessionStorage.setItem('hm-owner-session-v1',JSON.stringify(session));}
  async function token(){
    if(!session?.access_token)throw new Error('헤뭉이 관리자 로그인이 필요합니다.');
    if(!session.expires_at||session.expires_at<Date.now()/1000+60){
      const res=await fetch(api+'/auth/v1/token?grant_type=refresh_token',{method:'POST',
        headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.access_token)throw new Error('관리자 인증이 만료되었습니다. 다시 로그인해주세요.');
      session={...data,user:data.user||session.user,expires_at:Math.floor(Date.now()/1000)+data.expires_in};persist();
    }return session.access_token;
  }
  async function request(path,options={}){
    const jwt=await token();const isBinary=options.body instanceof Blob;
    const res=await fetch(api+path,{...options,headers:{apikey:key,Authorization:'Bearer '+jwt,
      ...(!isBinary&&options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},cache:'no-store'});
    if(!res.ok){const error=await res.json().catch(()=>({}));throw new Error(error.message||error.error||'서버 오류 ('+res.status+')');}
    if(options.binary)return res.blob();
    if(res.status===204)return null;
    return res.json().catch(()=>null);
  }
  const rest=(table,q='')=>'/rest/v1/'+table+q;
  const elem=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;};
  function button(label,cls,fn){const b=elem('button',cls,label);b.type='button';b.addEventListener('click',fn);return b;}
  async function patch(table,id,data){
    return request(rest(table,'?id=eq.'+encodeURIComponent(id)),{method:'PATCH',body:JSON.stringify(data),headers:{Prefer:'return=minimal'}});
  }
  function dates(row){return [row.born_on,row.passed_on].filter(Boolean).join(' ~ ')||'날짜 미등록';}
  async function withBusy(fn){if(busy)return;busy=true;try{await fn();await reload();}catch(err){notice(err.message,true);}finally{busy=false;}}
  async function fetchPrivatePhoto(path){
    if(!/^incoming\/[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$/.test(path||''))throw new Error('비공개 사진 경로 오류');
    return request('/storage/v1/object/authenticated/hm-memorial-inbox/'+path,{binary:true});
  }
  async function getPublishedPhoto(path){
    if(!/^approved\/[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$/.test(path||''))return '';
    return api+'/storage/v1/object/public/hm-memorial-published/'+path;
  }
  async function publish(row,slot,verified){
    if(!verified)throw new Error('보호자의 명시적 공개 동의를 먼저 확인해주세요.');
    if(row.requested_visibility!=='public')throw new Error('비공개 신청은 공개할 수 없습니다.');
    if(!row.photo_path)throw new Error('사진을 먼저 등록해주세요.');
    if(!Number.isInteger(slot)||slot<1||slot>12)throw new Error('안식관 위치는 001~012호 중 선택해주세요.');
    if(slot===1 && !(row.requested_slot===1))throw new Error('001호는 첫 친구를 위해 예약되어 있습니다.');
    const taken=await request(rest('hm_memorial_public','?select=id&slot_index=eq.'+slot));
    if(taken.some(r=>r.id!==row.id))throw new Error('해당 안치 공간은 이미 사용 중입니다.');
    await patch('hm_memorial_requests',row.id,{owner_consent_verified:true});
    const blob=await fetchPrivatePhoto(row.photo_path);
    const path='approved/'+row.id+'.'+row.photo_path.split('.').pop();
    await request('/storage/v1/object/hm-memorial-published/'+path,{method:'POST',body:blob,
      headers:{'Content-Type':blob.type||'image/jpeg','x-upsert':'true'}});
    const publicRow={id:row.id,slot_index:slot,pet_name:row.pet_name,born_on:row.born_on,
      passed_on:row.passed_on,story:row.story,farewell:row.farewell,photo_path:path};
    await request(rest('hm_memorial_public','?on_conflict=id'),{method:'POST',body:JSON.stringify(publicRow),
      headers:{Prefer:'resolution=merge-duplicates,return=minimal'}});
    await patch('hm_memorial_requests',row.id,{status:'published',approved_slot:slot,approved_at:new Date().toISOString()});
    notice('안식관 '+String(slot).padStart(3,'0')+'호 공개가 완료되었습니다.');
  }
  async function approvePrivate(row,verified){
    if(!verified)throw new Error('보호자의 공개·보관 범위 동의를 확인해주세요.');
    await patch('hm_memorial_requests',row.id,{owner_consent_verified:true,status:'approved_private',approved_at:new Date().toISOString()});
    notice('비공개 보관으로 승인했습니다. 공개 명패에는 표시되지 않습니다.');
  }
  async function uploadPhoto(row,file){
    if(!file||!file.size)throw new Error('사진을 선택해주세요.');
    const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'})[file.type];
    if(!ext||file.size>5*1024*1024)throw new Error('5MB 이하 JPG·PNG·WebP만 업로드할 수 있습니다.');
    const path='incoming/'+row.id+'.'+ext;
    await request('/storage/v1/object/hm-memorial-inbox/'+path,{method:'POST',body:file,
      headers:{'Content-Type':file.type,'x-upsert':'true'}});
    await patch('hm_memorial_requests',row.id,{photo_path:path});
    notice(row.pet_name+'의 사진을 비공개 저장소에 등록했습니다.');
  }
  function renderRequest(row){
    const card=elem('article','request-card'),title=elem('h3','',row.pet_name+' · '+(row.requested_visibility==='public'?'공개 신청':'비공개 신청'));
    card.appendChild(title);card.appendChild(elem('p','meta','신청: '+new Date(row.created_at).toLocaleString('ko-KR')+' · 상태: '+row.status+' · 희망 위치: '+(row.requested_slot||'미지정')));
    card.appendChild(elem('p','meta','연락처: '+(row.contact_email||'등록되지 않음')));
    card.appendChild(elem('p','meta',dates(row)));
    card.appendChild(elem('p','',row.story||''));
    if(row.farewell)card.appendChild(elem('p','', '남긴 말: '+row.farewell));
    if(row.photo_path){
      const preview=button('비공개 사진 확인','secondary',async()=>{
        preview.disabled=true;
        try{const blob=await fetchPrivatePhoto(row.photo_path);const img=elem('img');img.src=URL.createObjectURL(blob);img.alt=row.pet_name+' 사진';card.insertBefore(img,preview);}
        catch(err){notice(err.message,true);}finally{preview.remove();}
      });card.appendChild(preview);
    }
    const uploadLabel=elem('label','',row.photo_path?'사진 교체(관리자)':'사진 등록(관리자)');
    const file=elem('input');file.type='file';file.accept='image/jpeg,image/png,image/webp';uploadLabel.appendChild(file);card.appendChild(uploadLabel);
    card.appendChild(button('사진 저장','secondary',()=>withBusy(()=>uploadPhoto(row,file.files?.[0]))));
    const consentLabel=elem('label');
    const consent=elem('input');consent.type='checkbox';consent.checked=!!row.owner_consent_verified;
    consentLabel.appendChild(consent);consentLabel.appendChild(document.createTextNode(' 실제 보호자에게 공개·보관 동의를 확인했습니다.'));
    card.appendChild(consentLabel);
    if(row.requested_visibility==='public'){
      const slotLabel=elem('label','', '배정할 안식관 번호 (001~012)');
      const slot=elem('input');slot.type='number';slot.min='1';slot.max='12';slot.step='1';slot.value=String(row.requested_slot||2);
      slotLabel.appendChild(slot);card.appendChild(slotLabel);
      card.appendChild(button('승인하고 명패 공개','',()=>withBusy(()=>publish(row,Number(slot.value),consent.checked))));
    }else{
      card.appendChild(button('비공개 보관 승인','',()=>withBusy(()=>approvePrivate(row,consent.checked))));
    }
    card.appendChild(button('신청 반려','danger',()=>{if(confirm(row.pet_name+'의 신청을 반려하시겠습니까?'))withBusy(()=>patch('hm_memorial_requests',row.id,{status:'rejected'}));}));
    return card;
  }
  function renderPublic(row){
    const card=elem('article','request-card');card.appendChild(elem('h3','',String(row.slot_index).padStart(3,'0')+'호 · '+row.pet_name));
    card.appendChild(elem('p','meta',dates(row)));card.appendChild(elem('p','',row.story||''));
    const a=elem('a','', '공개된 추억 페이지 보기 →');a.href='/memorial.html#story:'+row.id;a.target='_blank';a.rel='noopener';card.appendChild(a);return card;
  }
  function renderLetter(row){
    const card=elem('article','request-card');
    card.appendChild(elem('p','meta',new Date(row.created_at).toLocaleString('ko-KR')+' · '+row.author_alias));
    card.appendChild(elem('p','',row.body));
    card.appendChild(button('편지 공개','',()=>withBusy(()=>patch('hm_memorial_letters',row.id,{status:'approved'}))));
    card.appendChild(button('반려','danger',()=>withBusy(()=>patch('hm_memorial_letters',row.id,{status:'rejected'}))));
    return card;
  }
  async function reload(){
    const [requests,published,letters]=await Promise.all([
      request(rest('hm_memorial_requests','?select=*&status=eq.pending&order=created_at.asc')),
      request(rest('hm_memorial_public','?select=*&order=slot_index.asc')),
      request(rest('hm_memorial_letters','?select=*&status=eq.pending&order=created_at.asc'))
    ]);
    for(const [id,rows,render] of [['requestList',requests,renderRequest],['publishedList',published,renderPublic],['letterAdminList',letters,renderLetter]]){
      const box=$(id);box.replaceChildren();
      if(!rows.length)box.appendChild(elem('p','empty','해당 항목이 없습니다.'));
      rows.forEach(row=>box.appendChild(render(row)));
    }
  }
  $('reload').addEventListener('click',()=>withBusy(async()=>{notice('목록을 새로고침했습니다.');}));
  async function init(){
    try{
      session=JSON.parse(sessionStorage.getItem('hm-owner-session-v1')||'null');
      if(!session)throw new Error('관리자 로그인이 필요합니다.');
      const rows=await request(rest('hm_admins','?select=user_id&user_id=eq.'+encodeURIComponent(session.user?.id||'')));
      if(!Array.isArray(rows)||rows.length!==1)throw new Error('추모관 관리 권한이 없습니다.');
      $('authMessage').hidden=true;$('adminWorkspace').hidden=false;
      await reload();
    }catch(err){authView(err.message);}
  }
  init();
})();