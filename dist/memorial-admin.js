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

  const sceneDefaults=[
    ['garden_backdrop','추모관 바깥 정원 배경','/memorial/spring-garden-20261104.jpg'],
    ['entrance_cover','중앙 입구 · 건물 이미지','/memorial/entrance-daylight.png'],
    ['hall_cover','안식관 입장 화면','/memorial/hall-last.jpg'],
    ['ritual_cover','제례실 입장 화면','/memorial/ritual-last.jpg']
  ];
  const portraitDefaults={'approved/65123d76-a511-47cb-8125-7d4863eac0ab.jpg':'/memorial/leo-tribute.jpg'};
  const allowedImageTypes={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
  const publicImage=path=>{
    if(Object.prototype.hasOwnProperty.call(portraitDefaults,path||''))return portraitDefaults[path];
    if(!/^(approved|scene)\/[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$/.test(path||''))return '';
    return api+'/storage/v1/object/public/hm-memorial-published/'+path;
  };
  const field=(title,control)=>{
    const label=elem('label','admin-field');label.appendChild(elem('span','',title));
    label.appendChild(control);return label;
  };
  const input=(type,value='',maxLength=0)=>{
    const e=elem('input');e.type=type;if(type!=='file')e.value=value||'';
    if(maxLength)e.maxLength=maxLength;return e;
  };
  async function uploadPublicImage(file,prefix) {
    if(!file||!file.size)throw new Error('교체할 사진을 선택해주세요.');
    const ext=allowedImageTypes[file.type];
    if(!ext||file.size>5*1024*1024)throw new Error('5MB 이하 JPG·PNG·WebP 이미지만 등록할 수 있습니다.');
    const path=prefix+crypto.randomUUID()+'.'+ext;
    await request('/storage/v1/object/hm-memorial-published/'+path,{
      method:'POST',body:file,headers:{'Content-Type':file.type,'x-upsert':'false'}
    });
    return path;
  }
  function photoPicker(defaultSrc) {
    const preview=elem('img','admin-art-preview');preview.crossOrigin='anonymous';preview.src=defaultSrc;preview.alt='현재 공개 이미지 미리보기';
    const file=input('file');file.accept='image/jpeg,image/png,image/webp';
    file.addEventListener('change',()=>{
      const image=file.files?.[0];if(!image)return;
      if(!allowedImageTypes[image.type]||image.size>5*1024*1024) {
        notice('5MB 이하 JPG·PNG·WebP 이미지만 선택해주세요.',true);file.value='';return;
      }
      const url=URL.createObjectURL(image);preview.src=url;
      preview.addEventListener('load',()=>URL.revokeObjectURL(url),{once:true});
    });
    return {preview,file};
  }
  function renderSceneSettings(rows) {
    const box=$('sceneSettings');box.replaceChildren();
    for(const [sceneKey,label,fallback] of sceneDefaults) {
      const scene=(rows||[]).find(x=>x.scene_key===sceneKey);
      const src=scene?publicImage(scene.image_path):fallback;
      const card=elem('article','request-card scene-card');
      card.appendChild(elem('h3','',label));
      const {preview,file}=photoPicker(src||fallback);card.appendChild(preview);
      card.appendChild(field('새 배경 이미지 (세로형 9:16 권장)',file));
      card.appendChild(elem('p','meta',scene?'관리자가 교체한 공개 이미지':'현재 기본 배경 · 원본 영상 변경 없음'));
      card.appendChild(button('배경 이미지 적용','',()=>withBusy(async()=>{
        const imagePath=await uploadPublicImage(file.files?.[0],'scene/');
        await request(rest('hm_memorial_scene_settings','?on_conflict=scene_key'),{
          method:'POST',body:JSON.stringify({scene_key:sceneKey,image_path:imagePath,updated_at:new Date().toISOString()}),
          headers:{Prefer:'resolution=merge-duplicates,return=minimal'}
        });
        notice(label+'의 공개 배경을 교체했습니다.');
      })));
      if(scene)card.appendChild(button('기본 배경 복원','secondary',()=>{
        if(!confirm(label+'을 기본 배경으로 되돌리시겠습니까?'))return;
        withBusy(async()=>{
          await request(rest('hm_memorial_scene_settings','?scene_key=eq.'+sceneKey),{
            method:'DELETE',headers:{Prefer:'return=minimal'}
          });
          notice(label+'의 기본 배경을 복원했습니다.');
        });
      }));
      box.appendChild(card);
    }
  }
  // The same four-corner canvas projection used by the public memorial hall.
  const coordsX=[15,45,80],coordsY=[24,41,60,78];
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
  async function paintNicheArt(canvas,source,q,focusX,focusY,frameStyle,fit='cover',matColor='#f4ead8') {
    const serial=(canvas._framePaintSerial||0)+1;canvas._framePaintSerial=serial;
    try {
      const img=source;
      if(!img.complete||!img.naturalWidth)await new Promise((resolve,reject)=>{
        img.addEventListener('load',resolve,{once:true});
        img.addEventListener('error',reject,{once:true});
      });
      if(!canvas.isConnected||serial!==canvas._framePaintSerial)return;
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
      if(!canvas.isConnected||serial!==canvas._framePaintSerial)return;
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
    }catch(err){console.warn('관리자 액자 미리보기 오류',err);}
  }

  function renderPublic(row){
    const card=elem('article','request-card public-edit-card');
    card.appendChild(elem('h3','',String(row.slot_index).padStart(3,'0')+'호 · '+row.pet_name+' 액자'));
    const {preview,file}=photoPicker(publicImage(row.photo_path));
    const name=input('text',row.pet_name,60);name.required=true;
    const born=input('date',row.born_on||''),passed=input('date',row.passed_on||'');
    const story=elem('textarea');story.value=row.story||'';story.maxLength=900;story.rows=4;story.required=true;
    const farewell=elem('textarea');farewell.value=row.farewell||'';farewell.maxLength=500;farewell.rows=2;
    const slot=elem('select');
    for(let i=1;i<=12;i++){
      const opt=elem('option','',String(i).padStart(3,'0')+'호');opt.value=String(i);
      opt.selected=i===row.slot_index;slot.appendChild(opt);
    }
    const frame=elem('select');
    for(const [k,label] of [['ivory','아이보리 액자'],['brass','황동 액자'],['walnut','원목 액자']]){
      const opt=elem('option','',label);opt.value=k;opt.selected=(row.frame_style||'ivory')===k;frame.appendChild(opt);
    }
    const fit=elem('select');
    for(const [k,label] of [['cover','액자 채우기 · 일부 잘림'],['contain','사진 전체 보기 · 여백 허용']]){
      const opt=elem('option','',label);opt.value=k;opt.selected=(row.frame_fit||'cover')===k;fit.appendChild(opt);
    }
    const mat=input('color',row.frame_mat_color||'#f4ead8');
    const focusX=input('range',String(Math.round((row.frame_focus_x==null?
      (Object.prototype.hasOwnProperty.call(portraitDefaults,row.photo_path||'')?0:.5):Number(row.frame_focus_x))*100)));
    focusX.min='0';focusX.max='100';focusX.step='1';
    const focusY=input('range',String(Math.round((row.frame_focus_y==null?.5:Number(row.frame_focus_y))*100)));
    focusY.min='0';focusY.max='100';focusY.step='1';

    const initialIndex=Number(row.slot_index)||1;
    const initialQ=nicheArtCorners(initialIndex,Math.floor((initialIndex-1)/3),(initialIndex-1)%3,row.frame_corners);
    let corners=initialQ.map(p=>p.slice()),accepted=corners.map(p=>p.slice());
    let needsAccept=false,fine=false,blank=false,zoom=1,drawPending=false;

    const viewport=elem('div','admin-hall-viewport');
    const hallPreview=elem('div','admin-hall-preview');
    const hallImg=elem('img','admin-hall-still');hallImg.src='/memorial/hall-last.jpg';
    hallImg.alt='안식관 영상의 마지막 장면';
    const layer=elem('div','admin-hall-layer');
    const art=elem('canvas','niche-art-canvas');art.width=0;art.height=0;
    art.setAttribute('aria-hidden','true');layer.appendChild(art);
    const positions=elem('div','frame-position-ui');positions.hidden=true;
    const outline=document.createElementNS('http://www.w3.org/2000/svg','svg');
    outline.setAttribute('viewBox','0 0 1000 1000');outline.setAttribute('preserveAspectRatio','none');
    outline.classList.add('frame-corner-outline');outline.setAttribute('aria-hidden','true');
    const polygon=document.createElementNS('http://www.w3.org/2000/svg','polygon');
    outline.appendChild(polygon);positions.appendChild(outline);
    const mover=elem('button','frame-move-area');
    mover.type='button';mover.setAttribute('aria-label','액자 전체 이동');mover.title='액자 전체 이동';
    positions.appendChild(mover);
    const handles=[];
    for(let i=0;i<4;i++){
      const h=elem('button','frame-corner-handle',String(i+1));
      h.type='button';h.setAttribute('aria-label',['왼쪽 위','오른쪽 위','오른쪽 아래','왼쪽 아래'][i]+' 모서리 위치 조정');
      h.dataset.corner=String(i);positions.appendChild(h);handles.push(h);
    }
    hallPreview.appendChild(hallImg);hallPreview.appendChild(layer);hallPreview.appendChild(positions);
    viewport.appendChild(hallPreview);

    const sceneCol=elem('div','frame-preview-column');
    sceneCol.appendChild(elem('div','preview-label','안식관 실제 장면 · 액자 위치 편집'));
    sceneCol.appendChild(viewport);
    const info=elem('p','meta frame-status','사진을 교체하거나 정밀 조정을 눌러 네 모서리를 이동하세요.');
    info.setAttribute('role','status');info.setAttribute('aria-live','polite');sceneCol.appendChild(info);
    const nav=elem('div','frame-tool-row frame-zoom-tools');
    const full=button('전체 보기','secondary',()=>{zoomTo(1);card.classList.toggle('frame-fullview');});
    const plus=button('＋','secondary',()=>zoomTo(Math.min(5,zoom*1.55)));
    const minus=button('－','secondary',()=>zoomTo(Math.max(1,zoom/1.55)));
    plus.setAttribute('aria-label','안식관 화면 확대');minus.setAttribute('aria-label','안식관 화면 축소');
    nav.append(full,plus,minus);sceneCol.appendChild(nav);
    const editCol=elem('div','frame-editor-column');
    const toolbar=elem('div','frame-tool-row');
    const reframe=button('액자 추가·다시 배치','secondary',()=>{
      blank=false;corners=nicheArtCorners(Number(slot.value),Math.floor((Number(slot.value)-1)/3),(Number(slot.value)-1)%3)
        .map(p=>p.slice());
      needsAccept=true;enterFine();setInfo('기본 위치로 다시 지정했습니다. 네 점을 조절한 다음 「이 위치 사용」을 누르세요.');
    });
    const changeImage=button('사진 바꾸기','secondary',()=>file.click());
    const fineButton=button('정밀 조정','secondary',()=>{if(fine)leaveFine();else enterFine();});
    const empty=button('미리보기 비우기','secondary',()=>{
      blank=true;art.hidden=true;needsAccept=true;
      setInfo('미리보기에서만 비웠습니다. 공개 중인 사진은 보존됩니다. 「액자 추가·다시 배치」로 복원할 수 있습니다.');
    });
    toolbar.append(reframe,changeImage,fineButton,empty);editCol.appendChild(toolbar);

    const group=elem('div','frame-editor-actions');
    group.appendChild(elem('p','meta','현재 사진 / 선택한 새 사진'));
    group.appendChild(preview);
    group.appendChild(field('001~012호 액자 사진',file));
    const posActions=elem('div','frame-tool-row');
    const retry=button('다시 지정','secondary',()=>{
      corners=initialQ.map(p=>p.slice());needsAccept=true;blank=false;enterFine();
      setInfo('이전 위치부터 다시 조정합니다. 네 모서리를 움직인 다음 확정하세요.');
    });
    const usePosition=button('이 위치 사용','',()=>{
      if(blank){setInfo('먼저 「액자 추가·다시 배치」로 사진을 복원해주세요.');return;}
      if(!validFrameCorners(corners)){setInfo('모서리가 겹치거나 뒤집혔습니다. 위치를 다시 조정해주세요.');return;}
      accepted=corners.map(p=>p.slice());needsAccept=false;leaveFine();setInfo('액자 위치가 임시 확정됐습니다. 아래 공개 적용을 눌러야 방문자에게 반영됩니다.');
    });
    posActions.append(retry,usePosition);group.appendChild(posActions);

    const advanced=elem('details','frame-details');
    advanced.appendChild(elem('summary','','이름·이미지 맞춤 등 고급 설정'));
    advanced.appendChild(field('액자 모양',frame));
    advanced.appendChild(field('이미지 맞춤',fit));
    advanced.appendChild(field('여백 색',mat));
    advanced.appendChild(field('사진 가로 중심',focusX));
    advanced.appendChild(field('사진 세로 중심',focusY));
    const focusNote=elem('p','meta');advanced.appendChild(focusNote);
    group.appendChild(advanced);editCol.appendChild(group);

    const setInfo=text=>{info.textContent=text;};
    const setHandles=()=>{
      polygon.setAttribute('points',corners.map(p=>(p[0]*1000)+','+(p[1]*1000)).join(' '));
      for(let i=0;i<4;i++){
        handles[i].style.left=corners[i][0]*100+'%';
        handles[i].style.top=corners[i][1]*100+'%';
      }
      const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);
      Object.assign(mover.style,{left:Math.min(...xs)*100+'%',top:Math.min(...ys)*100+'%',
        width:(Math.max(...xs)-Math.min(...xs))*100+'%',height:(Math.max(...ys)-Math.min(...ys))*100+'%'});
    };
    const zoomTo=value=>{
      zoom=value;
      if(zoom<=1.001){hallPreview.style.transform='none';return;}
      const cx=corners.reduce((sum,p)=>sum+p[0],0)/4,cy=corners.reduce((sum,p)=>sum+p[1],0)/4;
      hallPreview.style.transformOrigin='0 0';
      hallPreview.style.transform='translate('+((.5-zoom*cx)*100)+'%,'+((.42-zoom*cy)*100)+'%) scale('+zoom+')';
    };
    const queueDraw=()=>{
      setHandles();focusNote.textContent='사진 중심: 가로 '+focusX.value+'% · 세로 '+focusY.value+'%';
      art.hidden=blank;
      if(blank||drawPending)return;
      drawPending=true;requestAnimationFrame(()=>{
        drawPending=false;
        if(!art.isConnected||blank)return;
        paintNicheArt(art,preview,corners.map(p=>p.slice()),Number(focusX.value)/100,
          Number(focusY.value)/100,frame.value,fit.value,mat.value);
      });
    };
    const enterFine=()=>{
      fine=true;positions.hidden=false;fineButton.textContent='정밀 조정 닫기';
      zoomTo(Math.max(zoom,2.3));queueDraw();
      setInfo('청록색 1~4번 점을 끌어 액자 테두리에 맞추세요. 안쪽을 끌면 액자 전체가 움직입니다.');
    };
    const leaveFine=()=>{
      fine=false;positions.hidden=true;fineButton.textContent='정밀 조정';
      zoomTo(1);queueDraw();
    };
    const validCandidate=q=>validFrameCorners(q);
    const clamp=n=>Math.min(.995,Math.max(.005,n));
    const pointerLocation=e=>{
      const rect=hallPreview.getBoundingClientRect();
      return [clamp((e.clientX-rect.left)/rect.width),clamp((e.clientY-rect.top)/rect.height)];
    };
    const bindDrag=(target,corner)=>{
      let drag=null;
      target.addEventListener('pointerdown',e=>{
        if(!fine||blank||e.button!==0)return;
        drag={id:e.pointerId,corner,start:pointerLocation(e),initial:corners.map(p=>p.slice())};
        target.setPointerCapture(e.pointerId);e.preventDefault();
      });
      target.addEventListener('pointermove',e=>{
        if(!drag||drag.id!==e.pointerId)return;
        const p=pointerLocation(e);let next=drag.initial.map(x=>x.slice());
        if(drag.corner===null){
          const dx=p[0]-drag.start[0],dy=p[1]-drag.start[1];
          next=next.map(x=>[x[0]+dx,x[1]+dy]);
        }else next[drag.corner]=p;
        if(validCandidate(next)){
          corners=next;needsAccept=true;queueDraw();
        }
      });
      const finish=e=>{if(drag&&drag.id===e.pointerId){drag=null;if(needsAccept)setInfo('위치를 조정했습니다. 「이 위치 사용」을 눌러 확정하세요.');}};
      target.addEventListener('pointerup',finish);target.addEventListener('pointercancel',finish);
    };
    bindDrag(mover,null);
    handles.forEach((handle,i)=>{
      bindDrag(handle,i);
      handle.addEventListener('keydown',e=>{
        const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
        if(!fine||!directions[e.key])return;
        e.preventDefault();const d=directions[e.key],delta=e.shiftKey?.009:.002;
        const next=corners.map(p=>p.slice());next[i]=[clamp(next[i][0]+d[0]*delta),clamp(next[i][1]+d[1]*delta)];
        if(validCandidate(next)){corners=next;needsAccept=true;queueDraw();}
      });
    });
    preview.addEventListener('load',queueDraw);
    [frame,fit,mat,focusX,focusY].forEach(el=>el.addEventListener(el===frame||el===fit?'change':'input',queueDraw));
    slot.addEventListener('change',()=>{
      if(!validFrameCorners(row.frame_corners)){
        const i=Number(slot.value);corners=nicheArtCorners(i,Math.floor((i-1)/3),(i-1)%3).map(p=>p.slice());
        queueDraw();
      }
    });
    const resizeObserver=new ResizeObserver(()=>{if(!hallPreview.isConnected){resizeObserver.disconnect();return;}queueDraw();});
    resizeObserver.observe(viewport);
    setHandles();

    editCol.appendChild(button('이 액자 사진·모양을 공개 적용','',()=>withBusy(async()=>{
      if(blank)throw new Error('비워둔 미리보기는 공개할 수 없습니다. 액자를 먼저 복원해주세요.');
      if(needsAccept)throw new Error('액자 위치를 조정한 뒤 「이 위치 사용」을 눌러주세요.');
      if(!validFrameCorners(accepted))throw new Error('액자의 네 모서리를 다시 확인해주세요.');
      const payload={
        frame_style:frame.value,frame_focus_x:Number(focusX.value)/100,
        frame_focus_y:Number(focusY.value)/100,
        frame_corners:accepted,frame_fit:fit.value,frame_mat_color:mat.value
      };
      if(file.files?.[0])payload.photo_path=await uploadPublicImage(file.files[0],'approved/');
      await patch('hm_memorial_public',row.id,payload);
      notice(row.pet_name+'의 액자 위치와 사진 설정을 공개 적용했습니다.');
    })));
    const details=elem('details','frame-details');
    details.appendChild(elem('summary','','명패 이름·날짜·추모 문구 수정'));
    const grid=elem('div','edit-fields');
    for(const [label,control] of [['명패 이름',name],['태어난 날',born],['떠난 날',passed],['안식관 번호',slot],
      ['추모 문구',story],['마지막 인사',farewell]])grid.appendChild(field(label,control));
    details.appendChild(grid);
    details.appendChild(button('명패·추모 정보 저장','secondary',()=>withBusy(async()=>{
      const payload={
        pet_name:name.value.trim(),born_on:born.value||null,passed_on:passed.value||null,
        slot_index:Number(slot.value),story:story.value.trim(),farewell:farewell.value.trim()
      };
      if(!payload.pet_name||!payload.story)throw new Error('이름과 추모 문구는 비워둘 수 없습니다.');
      if(payload.born_on&&payload.passed_on&&payload.born_on>payload.passed_on)
        throw new Error('생몰 날짜 순서를 확인해주세요.');
      await patch('hm_memorial_public',row.id,payload);
      notice(payload.pet_name+'의 명패·추모 정보를 수정했습니다.');
    })));
    editCol.appendChild(details);
    const a=elem('a','','실제 안식관에서 확인하기 →');
    a.href='/memorial.html#hall';a.target='_blank';a.rel='noopener';editCol.appendChild(a);
    card.appendChild(sceneCol);card.appendChild(editCol);
    return card;
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
    const [requests,published,letters,scenes,offerings]=await Promise.all([
      request(rest('hm_memorial_requests','?select=*&status=eq.pending&order=created_at.asc')),
      request(rest('hm_memorial_public','?select=*&order=slot_index.asc')),
      request(rest('hm_memorial_letters','?select=*&status=eq.pending&order=created_at.asc')),
      request(rest('hm_memorial_scene_settings','?select=*&order=scene_key.asc')),
      request(rest('hm_memorial_offerings','?select=memorial_id,flower_kind,created_at&order=created_at.desc&limit=100'))
    ]);
    renderSceneSettings(scenes);
    const offeringBox=$('offeringAdminList');offeringBox.replaceChildren();
    const counts=new Map();for(const offering of offerings){
      const n=counts.get(offering.memorial_id)||0;counts.set(offering.memorial_id,n+1);
    }
    for(const pet of published){
      offeringBox.appendChild(elem('p','',pet.pet_name+' · 최근 100건 중 '+(counts.get(pet.id)||0)+'건 헌화'));
    }
    if(!published.length)offeringBox.appendChild(elem('p','empty','공개된 친구가 없습니다.'));
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