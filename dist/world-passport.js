(() => {
  'use strict';
  const cfg=window.HAEMUNGI_CONTENT_CONFIG||{};
  const api=cfg.projectUrl||'',key=cfg.publishableKey||'';
  const storageKey='hm-world-passport-v1';
  const stops=[
    ['home','작은 세계 홈','여행의 시작, 헤뭉이의 작은 세계에 오신 것을 환영합니다.','✿','/#home','헤뭉이 마을'],
    ['videos','헤뭉이 영상','헤뭉이가 움직이는 순간들을 천천히 만나보세요.','▣','/#videos','헤뭉이 마을'],
    ['cards','카드뉴스','계절과 이야기를 담은 그림을 펼쳐보는 곳입니다.','❀','/#cards','헤뭉이 마을'],
    ['daily','일상다반사','평범한 하루에서 귀여운 우연을 발견해 보세요.','☀','/#daily','헤뭉이 마을'],
    ['goods','헤뭉이 굿즈','우리 친구의 작은 소품과 작품을 구경해요.','♧','/#goods','헤뭉이 마을'],
    ['room','헤뭉이의 방','헤뭉이가 쉬고 노는 아늑한 방에 들러요.','⌂','/#room','헤뭉이 마을'],
    ['about','헤뭉이 소개','머리카락 한 올에서 시작된 특별한 인연을 알아보세요.','♡','/#about','헤뭉이 마을'],
    ['today','헤뭉이의 오늘','오늘 헤뭉이가 발견한 세계를 함께 둘러봐요.','✧','/#today','헤뭉이 마을'],
    ['creator','캐릭터 제작자','헤뭉이를 만든 일현 조성훈의 이야기를 만나요.','✎','/#creator','헤뭉이 마을'],
    ['emoticons','헤뭉이 이모티콘','작은 표정과 움직임 속 이야기를 찾아보세요.','☺','/#emoticons','헤뭉이 마을'],
    ['playground','헤뭉이 놀이터','타로와 놀이, 헤뭉이를 돌보는 즐거운 정류장입니다.','★','/playground.html','놀이터 섬'],
    ['memorial','별빛 추모관','소중한 친구들의 기억을 다정하게 마주하는 공간입니다.','✧','/memorial.html','별빛 해안'],
    ['temple','파도가 들리는 법당','종소리와 파도 곁에서 잠시 마음을 쉬어가요.','☼','/temple.html','해안 사찰'],
    ['christmas','크리스마스 빌리지','반짝이는 트리와 겨울의 축제를 만나보세요.','❄','/christmas.html','겨울 마을'],
  ];
  const ids=new Set(stops.map(s=>s[0]));
  let pass=null,stamps={},claimedSlot=null,page=0,busy=false,visitTimer=null;
  let dialog,pageBody,statusNode,countNode,prevBtn,nextBtn;
  try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');
    if(saved?.id&&saved?.token)pass={id:saved.id,token:saved.token};
  }catch(_){/* Corrupt local passport is treated as absent. */}

  async function request(action,fields={},jwt=''){
    if(!api||!key)throw Error('여권 발급 서비스 설정을 확인 중입니다.');
    const response=await fetch(api+'/functions/v1/world-passport',{
      method:'POST',cache:'no-store',headers:{apikey:key,'Content-Type':'application/json',...(jwt?{Authorization:'Bearer '+jwt}:{})},
      body:JSON.stringify({action,...(pass||{}),...fields}),
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(payload.error||'여권 서비스 연결 오류 ('+response.status+')');
    return payload;
  }
  const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stampCount=()=>stops.filter(s=>Boolean(stamps[s[0]])).length;
  const complete=()=>stampCount()===stops.length;
  function currentStop(){
    const path=location.pathname.replace(/\.html$/,'').replace(/\/$/,'');
    if(path===''||path==='/index'){
      const hash=location.hash.slice(1).split(/[?&]/)[0]||'home';return ids.has(hash)&&stops.slice(0,10).some(s=>s[0]===hash)?hash:'home';
    }
    const route=path.slice(1);return ['playground','memorial','temple','christmas'].includes(route)?route:null;
  }
  function setStatus(message){if(statusNode)statusNode.textContent=message;}
  function save(){if(pass)localStorage.setItem(storageKey,JSON.stringify(pass));}
  async function ensure(){
    if(pass)return;
    const result=await request('create');pass={id:result.id,token:result.token};save();
    stamps={};claimedSlot=null;
  }
  async function sync(){
    if(!pass)return;
    const response=await request('status');
    stamps=response.stamps||{};claimedSlot=response.claimed_slot||null;
    render();
  }
  async function stampStop(stop){
    if(!pass||!ids.has(stop)||stamps[stop]||busy||claimedSlot||document.visibilityState==='hidden')return;
    try{
      busy=true;const response=await request('stamp',{stop});
      stamps=response.stamps||stamps;render();
      setStatus(stops.find(s=>s[0]===stop)[1]+' 방문 도장을 여권에 찍었습니다.');
    }catch(err){setStatus(err.message);}
    finally{busy=false;}
  }
  function queueStamp(){
    if(visitTimer)clearTimeout(visitTimer);
    if(!pass)return;
    const stop=currentStop();if(!stop)return;
    // A visible stay, not an item merely shown in the sitemap, counts as a visit.
    visitTimer=setTimeout(()=>{if(currentStop()===stop)stampStop(stop);},4000);
  }

  function drawMap(){
    return `<div class="hm-passport-map" role="img" aria-label="가운데 헤뭉이 마을과 사방의 놀이터, 별빛 추모관, 해안 사찰, 크리스마스 빌리지가 이어지는 헤뭉이 월드 지도">
      <svg viewBox="0 0 340 235" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs><linearGradient id="hmSea" x2="0" y2="1"><stop stop-color="#cfeee9"/><stop offset="1" stop-color="#f5e4c5"/></linearGradient></defs>
        <rect width="340" height="235" rx="19" fill="url(#hmSea)"/>
        <path d="M14 52 Q40 14 84 25 T152 36 Q173 65 148 99 T70 121 Q15 111 14 52" fill="#e5f0d2" stroke="#99b99a" stroke-width="2"/>
        <path d="M189 27 Q241 6 300 33 T327 104 Q289 124 222 97 T189 27" fill="#f2e4dc" stroke="#c8a29b" stroke-width="2"/>
        <path d="M75 143 Q127 104 197 132 T245 214 Q181 232 113 214 T75 143" fill="#f4ecc6" stroke="#d0b57c" stroke-width="2"/>
        <path d="M258 140 Q299 122 324 156 L326 217 Q292 235 255 211 T258 140" fill="#d9e6f5" stroke="#9faec9" stroke-width="2"/>
        <path d="M62 82 Q142 112 163 164 M245 69 Q202 112 165 164 M165 164 Q255 167 292 178" fill="none" stroke="#ab9275" stroke-width="2.5" stroke-dasharray="4 6" stroke-linecap="round"/>
        <g fill="#735941" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="11">
          <text x="79" y="64">✿ 놀이터</text><text x="255" y="62">✧ 추모관</text>
          <text x="165" y="164">⌂ 헤뭉이 마을</text><text x="165" y="178" font-size="9" font-weight="400">10개의 이야기</text>
          <text x="292" y="176">❄ 겨울 마을</text><text x="270" y="88" font-size="9">☼ 해안 사찰</text>
        </g>
      </svg>
    </div>`;
  }
  function cover(){
    const number=pass?'HM-'+pass.id.replace(/-/g,'').slice(0,8).toUpperCase():'발급 전';
    return `<div class="hm-passport-cover"><span class="hm-passport-crest">✿</span>
      <small>HAEMUNGI LITTLE WORLD</small><h2>헤뭉이 월드<br>여행 여권</h2>
      <p>HAEMUNGI WORLD PASSPORT</p><span class="hm-passport-cover-line"></span>
      <span class="hm-passport-cover-number">PASSPORT NO. ${number}</span>
      <p class="hm-passport-cover-caption">사소한 우연이 특별한 여행이 되는 곳</p></div>
      <div class="hm-passport-footnote">${pass?'이 여권은 이 브라우저에 보관됩니다.':'비밀번호나 회원가입 없이 여행 여권을 발급받을 수 있어요.'}</div>
      ${pass?'':`<button class="hm-passport-primary" id="hmPassportIssue" type="button">나의 여권 발급하기</button>`}`;
  }
  function intro(){return `<div class="hm-passport-kicker">TRAVEL GUIDE · 01</div><h2>헤뭉이 월드 안내도</h2>
    <p class="hm-passport-intro">머리카락 한 올에서 시작된 작은 세계. 14곳의 이야기를 따라가며 여권에 방문 도장을 모아보세요.</p>
    ${drawMap()}<p class="hm-passport-map-note">지도 속 모든 공간은 헤뭉이 공식 홈페이지의 서로 다른 이야기로 이어집니다.</p>
    <div class="hm-passport-progress">방문 기록 <strong>${stampCount()} / 14</strong></div>`;}
  function locationPage(index){
    const [id,title,desc,symbol,href,region]=stops[index];
    const raw=String(stamps[id]||'');const date=/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw:'';
    return `<div class="hm-passport-kicker">OFFICIAL VISIT COURSE · ${String(index+1).padStart(2,'0')}/14</div>
      <h2>${escapeHtml(title)}</h2><p class="hm-passport-region">${escapeHtml(region)}</p>
      <div class="hm-passport-landmark" aria-hidden="true"><span>${symbol}</span><i></i></div>
      <p class="hm-passport-description">${escapeHtml(desc)}</p>
      <div class="hm-passport-seal-area">${date?`<div class="hm-passport-seal"><strong>방문 완료</strong><span>HAEMUNGI WORLD</span><time>${date}</time></div>`:
       `<div class="hm-passport-seal-outline"><span>방문 도장을 기다리는 중</span></div>`}</div>
      <a class="hm-passport-visit" href="${href}">${date?'다시 둘러보기':'이 장소로 여행하기'} →</a>`;
  }
  function reward(){
    if(claimedSlot)return `<div class="hm-passport-kicker">JOURNEY COMPLETED</div><div class="hm-passport-reward-symbol">✧</div>
      <h2>축하합니다!</h2><p>모든 여행을 마치고 별빛 추모관 <strong>${String(claimedSlot).padStart(3,'0')}호</strong> 명패가 배정되었습니다.</p>
      <a class="hm-passport-visit" href="/memorial.html#hall">우리 아이의 안식관으로 →</a>`;
    if(!complete())return `<div class="hm-passport-kicker">FINAL DESTINATION</div><div class="hm-passport-reward-symbol">☆</div>
      <h2>여행의 마지막 장</h2><p>아직 ${14-stampCount()}곳의 방문 도장이 남아 있습니다. 천천히 둘러보고 다시 돌아오세요.</p>
      <p class="hm-passport-reward-count">${stampCount()} / 14</p>`;
    return `<div class="hm-passport-kicker">HAEMUNGI WORLD · COMPLETED</div><div class="hm-passport-reward-symbol">✧</div>
      <h2>여권 완주를 축하합니다!</h2><p>14개의 방문 인장을 모두 모았습니다. 이메일 인증과 공개 동의 후 우리 아이의 명패를 자동 배정받을 수 있습니다.</p>
      <div class="hm-passport-claim" id="hmPassportClaim">
        <p id="hmPassportClaimStatus" role="status">이메일 인증을 마친 뒤 별들의 기록에서 우리 아이를 선택해주세요.</p>
        <label for="hmPassportMemorial">명패로 만날 아이</label><select id="hmPassportMemorial"><option value="">확인하고 있습니다…</option></select>
        <label class="hm-passport-claim-consent"><input id="hmPassportConsent" type="checkbox"> 아이의 이름·사진·이야기가 안식관 명패에 공개되는 데 동의합니다.</label>
        <button class="hm-passport-primary" id="hmPassportClaimButton" type="button">내 아이의 명패 자동 배정받기</button>
        <button class="hm-passport-text-button" id="hmPassportLogin" type="button">이메일 로그인 / 기록 등록 안내</button>
      </div>`;
  }
  function render(){
    if(!pageBody)return;
    pageBody.classList.remove('hm-passport-turning');void pageBody.offsetWidth;
    pageBody.classList.add('hm-passport-turning');
    pageBody.innerHTML=page===0?cover():page===1?intro():page===16?reward():locationPage(page-2);
    countNode.textContent=`${page+1} / 17 · 방문 ${stampCount()}/14`;
    prevBtn.disabled=page===0;nextBtn.disabled=page===16;
    nextBtn.textContent=page===15?'완주 확인 →':'다음 쪽 →';
    const issue=document.getElementById('hmPassportIssue');if(issue)issue.addEventListener('click',issuePassport);
    const claim=document.getElementById('hmPassportClaim');if(claim)setupClaim(claim);
  }
  async function issuePassport(){
    if(busy)return;busy=true;
    try{setStatus('여권을 발급하고 있습니다…');await ensure();render();setStatus('새 여권이 발급되었습니다. 장소를 방문하면 도장이 찍힙니다.');queueStamp();}
    catch(err){setStatus(err.message);}finally{busy=false;}
  }

  async function authToken(){
    const saved=JSON.parse(sessionStorage.getItem('hm-memorial-visitor-v1')||'null');
    if(!saved?.access_token||!saved.user?.email_confirmed_at)return null;
    if((saved.expires_at||0)<Date.now()/1000+60){
      const r=await fetch(api+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:saved.refresh_token})});
      if(!r.ok)return null;
      const data=await r.json();const updated={...data,expires_at:Math.floor(Date.now()/1000)+(data.expires_in||3600)};
      sessionStorage.setItem('hm-memorial-visitor-v1',JSON.stringify(updated));return updated.access_token;
    }
    return saved.access_token;
  }
  async function setupClaim(claim){
    const select=claim.querySelector('#hmPassportMemorial');
    const message=claim.querySelector('#hmPassportClaimStatus');
    claim.querySelector('#hmPassportLogin').addEventListener('click',()=>{
      dialog.close();if(location.pathname.replace(/\.html$/,'')!=='/memorial')location.href='/memorial.html#apply';
      else document.getElementById('openVisitorLogin')?.click();
    });
    claim.querySelector('#hmPassportClaimButton').addEventListener('click',async()=>{
      if(busy)return;
      if(!claim.querySelector('#hmPassportConsent').checked){message.textContent='명패 공개에 동의해주세요.';return;}
      if(!select.value){message.textContent='명패로 등록할 아이를 먼저 선택해주세요.';return;}
      const jwt=await authToken();if(!jwt){message.textContent='이메일 인증을 완료한 뒤 로그인해주세요.';return;}
      if(!confirm('여권 완주 기념으로 우리 아이의 사진·이름·이야기를 안식관에 공개하고 빈 호수를 자동 배정하시겠습니까?'))return;
      busy=true;
      try{const result=await request('claim',{memorial_id:select.value,consent:true},jwt);
        claimedSlot=result.slot;render();setStatus('명패 '+String(result.slot).padStart(3,'0')+'호 자동 배정이 완료되었습니다.');}
      catch(err){message.textContent=err.message;}finally{busy=false;}
    });
    const jwt=await authToken();if(!jwt){select.replaceChildren(new Option('이메일 로그인 후 선택 가능',''));return;}
    if(location.pathname.replace(/\.html$/,'')!=='/memorial'){
      select.replaceChildren(new Option('추모관 등록 화면에서 선택해주세요',''));return;
    }
    try{
      const r=await fetch(api+'/rest/v1/rpc/hm_memorial_my_archive_entries',{
        method:'POST',headers:{apikey:key,Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:'{}'});
      const data=await r.json();if(!r.ok)throw Error(data.message||'아이 기록을 확인하지 못했습니다.');
      select.replaceChildren(new Option('아이를 선택하세요',''));
      for(const entry of Array.isArray(data)?data:[]){const option=new Option(entry.pet_name,entry.id);select.add(option);}
      if(select.length===1)message.textContent='아직 공개한 별들의 기록이 없습니다. 먼저 우리 아이의 기록을 등록해주세요.';
    }catch(err){message.textContent=err.message;}
  }
  function open(){if(!dialog.open)dialog.showModal();render();if(pass)sync().catch(err=>setStatus(err.message));}
  // Legacy hall placement links and the registration panel now lead to the
  // passport reward, never to the discontinued manual slot reservation.
  window.HAEMUNGI_PASSPORT_OPEN_REWARD=()=>{page=pass?16:0;open();};
  function mount(){
    const launcher=document.createElement('button');launcher.id='hmPassportLauncher';launcher.type='button';
    launcher.className='hm-passport-launcher';launcher.setAttribute('aria-label','헤뭉이 월드 여행 여권 열기');
    launcher.textContent='✿ 여권';document.body.appendChild(launcher);
    dialog=document.createElement('dialog');dialog.id='hmPassportDialog';dialog.className='hm-passport-dialog';
    dialog.setAttribute('aria-label','헤뭉이 월드 여권');dialog.innerHTML=`
      <div class="hm-passport-header"><span>HAEMUNGI WORLD PASSPORT</span><button type="button" id="hmPassportClose" aria-label="여권 닫기">×</button></div>
      <div class="hm-passport-book" id="hmPassportBook"><div class="hm-passport-bookmark" aria-hidden="true">✿</div>
      <div class="hm-passport-page" id="hmPassportPage"></div></div>
      <div class="hm-passport-controls"><button type="button" id="hmPassportPrev">← 이전</button>
      <span id="hmPassportCount" aria-live="polite">1 / 17</span>
      <button type="button" id="hmPassportNext">다음 쪽 →</button></div>
      <p class="hm-passport-status" id="hmPassportStatus" role="status" aria-live="polite"></p>`;
    document.body.appendChild(dialog);
    pageBody=dialog.querySelector('#hmPassportPage');statusNode=dialog.querySelector('#hmPassportStatus');
    countNode=dialog.querySelector('#hmPassportCount');prevBtn=dialog.querySelector('#hmPassportPrev');nextBtn=dialog.querySelector('#hmPassportNext');
    launcher.addEventListener('click',open);
    dialog.querySelector('#hmPassportClose').addEventListener('click',()=>dialog.close());
    prevBtn.addEventListener('click',()=>{if(page>0){page--;render();}});
    nextBtn.addEventListener('click',()=>{if(page<16){page++;render();}});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')queueStamp();});
    window.addEventListener('hashchange',queueStamp);
    window.addEventListener('haemungi:visitor',()=>{if(dialog.open&&page===16)render();});
    if(pass){sync().then(queueStamp).catch(err=>setStatus(err.message));}
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
