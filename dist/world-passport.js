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
  // One canonical luxury cover is reused on the passport AND the About preview.
  // All visible text, 14 legitimate stamps, and navigation are real HTML UI.
  const artBase='/assets/world-passport/';
  const coverAsset=artBase+'luxury-cover.webp';
  const paperAsset=artBase+'luxury-paper.webp';
  const atlasAsset=artBase+'luxury-atlas.webp';
  const landmarkArt={
    home:'haemungi-hero.webp',videos:'haemungi-3d-play.webp',
    cards:'cardnews-01-01.webp',daily:'daily-first-encounter.webp',
    goods:'merch-collection.webp',room:'haemungi-room.webp',
    about:'haemungi-sheet.webp',today:'today-world-trip.jpg',
    creator:'haemungi-3d-reference.jpg',emoticons:'emoticon-collection.jpg',
    playground:'playground-main.jpg',memorial:'memorial-walk-morning-20261105.webp',
    temple:'temple-haesu.webp',christmas:'christmas-square.jpg',
  };
  const wideArt=new Set(['home','videos','room']);
  const ids=new Set(stops.map(s=>s[0]));
  let pass=null,stamps={},claimedSlot=null,page=0,busy=false,visitTimer=null;
  let visitTicker=null,visitToastTimer=null,visitSequence=0,stampBusy=false,retryTimer=null;
  let visitToast,visitToastText,visitToastProgress;
  let dialog,pageBody,actionNode,statusNode,countNode,prevBtn,nextBtn;
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
    // A slower status response must never erase a stamp just confirmed by the server.
    stamps={...stamps,...(response.stamps||{})};claimedSlot=response.claimed_slot||null;
    render();
  }
  const stopName=stop=>stops.find(s=>s[0]===stop)?.[1]||'이 장소';
  function showVisitToast(message,progress=0,state='pending'){
    if(!visitToast)return;
    if(visitToastTimer){clearTimeout(visitToastTimer);visitToastTimer=null;}
    visitToast.hidden=false;visitToast.dataset.state=state;
    visitToastText.textContent=message;
    visitToastProgress.style.width=Math.max(0,Math.min(100,progress))+'%';
  }
  function hideVisitToast(delay=0){
    if(visitToastTimer)clearTimeout(visitToastTimer);
    visitToastTimer=setTimeout(()=>{if(visitToast)visitToast.hidden=true;},delay);
  }
  function clearVisitTimers(){
    if(visitTimer){clearTimeout(visitTimer);visitTimer=null;}
    if(visitTicker){clearInterval(visitTicker);visitTicker=null;}
    if(retryTimer){clearTimeout(retryTimer);retryTimer=null;}
  }
  const stillVisiting=(stop,sequence)=>sequence===visitSequence&&currentStop()===stop&&document.visibilityState!=='hidden';
  async function stampStop(stop,sequence,attempt=0){
    if(!pass||!ids.has(stop)||stamps[stop]||claimedSlot||!stillVisiting(stop,sequence))return;
    // A stamp for another destination may be in flight. Queue this visit instead of dropping it.
    if(stampBusy||busy){
      retryTimer=setTimeout(()=>stampStop(stop,sequence,attempt),1200);
      return;
    }
    stampBusy=true;
    showVisitToast(stopName(stop)+' 방문 도장 저장 중…',100);
    try{
      const response=await request('stamp',{stop});
      stamps={...stamps,...(response.stamps||{})};render();
      if(!stamps[stop])throw Error('서버에서 방문 도장 저장을 확인하지 못했습니다.');
      setStatus(stopName(stop)+' 방문 도장을 여권에 찍었습니다.');
      if(stillVisiting(stop,sequence)){
        showVisitToast('✿ '+stopName(stop)+' 방문 완료 · '+stampCount()+'/14',100,'success');
        hideVisitToast(4200);
      }
    }catch(err){
      setStatus(stopName(stop)+' 저장 실패: '+err.message);
      if(stillVisiting(stop,sequence)){
        if(attempt<2){
          const delay=3200+attempt*1800;
          showVisitToast('도장 저장이 지연되어 다시 확인 중…',100,'retry');
          retryTimer=setTimeout(()=>stampStop(stop,sequence,attempt+1),delay);
        }else{
          showVisitToast('도장을 저장하지 못했어요. 여권을 열어 확인해주세요.',100,'error');
          hideVisitToast(9000);
        }
      }
    }finally{stampBusy=false;}
  }
  function queueStamp(){
    clearVisitTimers();
    const sequence=++visitSequence;
    if(!pass||claimedSlot||document.visibilityState==='hidden'){hideVisitToast();return;}
    const stop=currentStop();
    if(!stop||stamps[stop]){hideVisitToast();return;}
    // A visible stay, not an item merely shown in the sitemap, counts as a visit.
    const began=Date.now(),dwell=4000;
    showVisitToast(stopName(stop)+' 방문 확인 중 · 4초',0);
    visitTicker=setInterval(()=>{
      if(!stillVisiting(stop,sequence))return;
      const elapsed=Math.min(dwell,Date.now()-began);
      showVisitToast(stopName(stop)+' 방문 확인 중 · '+Math.max(1,Math.ceil((dwell-elapsed)/1000))+'초',elapsed/dwell*100);
    },600);
    visitTimer=setTimeout(()=>{
      if(visitTicker){clearInterval(visitTicker);visitTicker=null;}
      visitTimer=null;
      if(stillVisiting(stop,sequence))stampStop(stop,sequence);
    },dwell);
  }

  function coverArtwork(){
    return `<div class="hm-premium-cover" aria-label="헤뭉이 월드 여행 여권 핑크 사쿠라 에디션 표지">
      <img src="${coverAsset}" alt="벚꽃과 금빛 문양으로 장식된 헤뭉이 월드 여권의 공식 프리미엄 표지" width="1024" height="1536" decoding="async" draggable="false">
      <div class="hm-premium-cover-letters"><span>HAEMUNGI WORLD PASSPORT</span>
        <strong>헤뭉이 월드<br>여행 여권</strong><em>✦ PINK SAKURA EDITION ✦</em></div>
      <div class="hm-premium-cover-serial" aria-label="가상의 여권 디자인 번호">HM · WORLD · 001</div>
    </div>`;
  }
  function paperPage(inner,kind=''){
    return `<div class="hm-premium-paper ${kind}" style="--hm-paper:url('${paperAsset}')">${inner}</div>`;
  }
  function folio(number){return `<div class="hm-premium-folio"><span>✦ HAEMUNGI WORLD ✦</span><span>${number} / 17</span></div>`;}
  function artPage(index){
    if(index===0)return coverArtwork();
    if(index===1){
      const places=stops.map((s,i)=>`<li><span>${String(i+1).padStart(2,'0')}</span>${escapeHtml(s[1])}</li>`).join('');
      return paperPage(`<div class="hm-premium-kicker">THE WORLD ATLAS · TRAVEL GUIDE</div>
        <h2>헤뭉이 월드 <span>여행 안내도</span></h2>
        <p class="hm-premium-subtitle">작은 우연에서 시작된 특별한 세계, 열네 곳의 이야기를 만나러 떠나요.</p>
        <div class="hm-premium-atlas"><img src="${atlasAsset}" alt="헤뭉이 마을, 놀이터, 별빛 해안과 사찰, 겨울 마을이 모두 이어진 판타지 월드 지도" width="1672" height="941" decoding="async"></div>
        <div class="hm-premium-section-title">YOUR 14 DESTINATIONS <span>방문 도장 ${stampCount()}/14</span></div>
        <ol class="hm-premium-destinations">${places}</ol>
        ${folio(2)}`,'hm-premium-guide');
    }
    if(index===16){
      const message=claimedSlot?`14곳 완주! 안식관 ${String(claimedSlot).padStart(3,'0')}호 명패가 배정되었습니다.`:
        complete()?'14곳의 방문을 모두 마쳤습니다. 아래에서 이메일 확인과 공개 동의를 진행해주세요.':
        `아직 ${14-stampCount()}곳의 방문 도장이 남았습니다. 천천히 둘러보고 돌아오세요.`;
      return paperPage(`<div class="hm-premium-kicker">THE GRAND FINALE · COMPLETION CERTIFICATE</div>
        <h2>여행의 끝, <span>새로운 시작</span></h2>
        <div class="hm-premium-final-crest" aria-hidden="true"><span>✿</span><strong>HAEMUNGI</strong><small>WORLD EXPLORER</small></div>
        <p class="hm-premium-final-intro">여권 속 열네 개의 장소를 지나<br>헤뭉이의 세계를 만나주셔서 고마워요.</p>
        <div class="hm-premium-final-count" aria-label="방문 ${stampCount()}곳 완료"><strong>${stampCount()}</strong><span>/ 14</span><small>VISIT STAMPS</small></div>
        <p class="hm-premium-final-message">${message}</p>
        ${folio(17)}`,'hm-premium-final');
    }
    const stop=stops[index-2];
    const raw=String(stamps[stop[0]]||'');
    const date=/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw:'';
    const wide=wideArt.has(stop[0]);
    const image=landmarkArt[stop[0]];
    return paperPage(`<div class="hm-premium-kicker">OFFICIAL VISIT COURSE · ${String(index-1).padStart(2,'0')} / 14</div>
      <h2>${escapeHtml(stop[1])}</h2>
      <p class="hm-premium-region">✦ ${escapeHtml(stop[5])} ✦</p>
      <div class="hm-premium-visit-panel ${wide?'hm-premium-landscape':'hm-premium-portrait'}">
        <div class="hm-premium-picture"><img src="/assets/${image}" alt="${escapeHtml(stop[1])}의 원본 전체 그림" loading="lazy" decoding="async" draggable="false"></div>
        <div class="hm-premium-visit-info"><span class="hm-premium-entry-mark">${escapeHtml(stop[3])}</span>
          <p>${escapeHtml(stop[2])}</p>
          <div class="hm-premium-seal ${date?'hm-premium-seal-earned':'hm-premium-seal-empty'}" aria-label="${escapeHtml(stop[1])} ${date?'방문 완료 '+date:'방문 도장 미획득'}">
            ${date?`<strong>방문 완료</strong><span>HAEMUNGI WORLD</span><time>${date}</time>`:'<span>VISIT STAMP</span><strong>도장을 기다리는 중</strong><small>✦ ✦ ✦</small>'}
          </div>
          <a class="hm-premium-visit-link" href="${stop[4]}">${date?'이 장소 다시 둘러보기':'이 장소로 여행하기'} ↗</a>
        </div>
      </div>
      <div class="hm-premium-visit-bottom">${String(index-1).padStart(2,'0')} <span>✧</span> ${escapeHtml(stop[1])}</div>
      ${folio(index+1)}`,'hm-premium-visit');
  }
  function claimPanel(){
    if(page===0)return pass?'<p class="hm-passport-footnote">이 여권의 방문 기록은 현재 브라우저에 연결되어 있습니다.</p>':
      '<button class="hm-passport-primary" id="hmPassportIssue" type="button">나의 여권 발급하기</button>';
    if(page!==16)return '';
    if(claimedSlot)return `<a class="hm-passport-primary hm-passport-claimed-link" href="/memorial.html#hall">배정된 ${String(claimedSlot).padStart(3,'0')}호 안식관 방문하기 →</a>`;
    if(!complete())return '';
    return `<div class="hm-passport-claim" id="hmPassportClaim">
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
    pageBody.innerHTML=artPage(page);
    actionNode.innerHTML=claimPanel();
    dialog.classList.toggle('hm-passport-has-claim',page===16&&complete()&&!claimedSlot);
    countNode.textContent=`${page+1} / 17 · 방문 ${stampCount()}/14`;
    prevBtn.disabled=page===0;nextBtn.disabled=page===16;
    nextBtn.textContent=page===15?'완주 확인 →':'다음 쪽 →';
    const issue=document.getElementById('hmPassportIssue');if(issue)issue.addEventListener('click',issuePassport);
    const claim=actionNode.querySelector('#hmPassportClaim');if(claim)setupClaim(claim);
  }
  async function issuePassport(){
    if(busy)return;busy=true;
    try{setStatus('여권을 발급하고 있습니다…');await ensure();render();setStatus('새 여권이 발급되었습니다. 장소를 방문하면 도장이 찍힙니다.');}
    catch(err){setStatus(err.message);}finally{busy=false;}
    if(pass)queueStamp();
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
    visitToast=document.createElement('div');visitToast.id='hmPassportVisitToast';
    visitToast.className='hm-passport-visit-toast';visitToast.hidden=true;visitToast.setAttribute('role','status');
    visitToast.setAttribute('aria-live','polite');
    visitToast.innerHTML='<span class="hm-passport-visit-toast-text"></span><span class="hm-passport-visit-track"><span class="hm-passport-visit-progress"></span></span>';
    document.body.appendChild(visitToast);
    visitToastText=visitToast.querySelector('.hm-passport-visit-toast-text');
    visitToastProgress=visitToast.querySelector('.hm-passport-visit-progress');
    const launcher=document.createElement('button');launcher.id='hmPassportLauncher';launcher.type='button';
    launcher.className='hm-passport-launcher';launcher.setAttribute('aria-label','헤뭉이 월드 여행 여권 열기');
    launcher.textContent='✿ 여권';document.body.appendChild(launcher);
    dialog=document.createElement('dialog');dialog.id='hmPassportDialog';dialog.className='hm-passport-dialog';
    dialog.setAttribute('aria-label','헤뭉이 월드 여권');dialog.innerHTML=`
      <div class="hm-passport-header"><span>HAEMUNGI WORLD PASSPORT</span><button type="button" id="hmPassportClose" aria-label="여권 닫기">×</button></div>
      <div class="hm-passport-book" id="hmPassportBook"><div class="hm-passport-page" id="hmPassportPage"></div></div>
      <div class="hm-passport-controls"><button type="button" id="hmPassportPrev">← 이전</button>
      <span id="hmPassportCount" aria-live="polite">1 / 17</span>
      <button type="button" id="hmPassportNext">다음 쪽 →</button></div>
      <div class="hm-passport-action" id="hmPassportAction"></div>
      <p class="hm-passport-status" id="hmPassportStatus" role="status" aria-live="polite"></p>`;
    document.body.appendChild(dialog);
    pageBody=dialog.querySelector('#hmPassportPage');actionNode=dialog.querySelector('#hmPassportAction');statusNode=dialog.querySelector('#hmPassportStatus');
    countNode=dialog.querySelector('#hmPassportCount');prevBtn=dialog.querySelector('#hmPassportPrev');nextBtn=dialog.querySelector('#hmPassportNext');
    launcher.addEventListener('click',open);
    const aboutPreview=document.getElementById('hmPassportAboutCover');
    if(aboutPreview)aboutPreview.innerHTML=coverArtwork();
    document.getElementById('hmPassportAboutOpen')?.addEventListener('click',open);
    dialog.querySelector('#hmPassportClose').addEventListener('click',()=>dialog.close());
    prevBtn.addEventListener('click',()=>{if(page>0){page--;render();}});
    nextBtn.addEventListener('click',()=>{if(page<16){page++;render();}});
    document.addEventListener('visibilitychange',queueStamp);
    window.addEventListener('hashchange',queueStamp);
    window.addEventListener('pageshow',event=>{if(event.persisted)sync().catch(err=>setStatus(err.message)).finally(queueStamp);});
    window.addEventListener('haemungi:visitor',()=>{if(dialog.open&&page===16)render();});
    if(pass){sync().catch(err=>setStatus(err.message)).finally(queueStamp);}
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
