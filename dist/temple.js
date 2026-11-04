(() => {
'use strict';
const $=id=>document.getElementById(id);
const places={
  map:{name:'전체 지도',art:'/assets/temple-map.webp',label:'HAEMUNGI · 마음쉼터',title:'마음을 쉬어 가는 바닷가 법당',desc:'일곱 장소의 이름을 누르면 그곳으로 이동합니다. 서두르지 않아도 괜찮습니다.',alt:'벚꽃과 바다, 사찰 건물이 어우러진 전체 지도'},
  haesu:{name:'해수관음상',art:'/assets/temple-haesu.webp',label:'01 · 해수관음상',title:'바다를 품은 자비의 미소',desc:'잔잔한 파도 앞에서 잠시 두 손을 모아 봅니다. 말하지 않아도 마음이 쉬어 갈 수 있습니다.',alt:'바다를 바라보는 해수관음상과 연꽃 제단'},
  daewoong:{name:'법당(대웅전)',art:'/assets/temple-daewoong.webp',label:'02 · 대웅전',title:'마음을 비우고 평온을 찾는 곳',desc:'대웅전 스크린에 연결된 유튜브 영상을 볼 수 있습니다. 직접 재생 버튼을 누르면 원본 유튜브 영상이 열립니다.',alt:'불상 위에 넓은 검은 스크린이 있는 대웅전 내부'},
  lantern:{name:'법등마당',art:'/assets/temple-lantern.webp',label:'03 · 법등마당',title:'작은 등불 하나에 담는 마음',desc:'따뜻한 불빛을 바라보고 조용히 소원을 떠올려 보세요.',alt:'벚꽃과 연꽃 법등이 빛나는 바닷가 마당'},
  kitchen:{name:'공양간',art:'/assets/temple-kitchen.webp',label:'04 · 공양간',title:'마음을 나누는 따뜻한 공양',desc:'한 끼의 소중함에 감사하며 쉬어 갑니다. 음식을 판매하거나 주문받는 곳은 아닙니다.',alt:'바다가 보이는 사찰 공양간의 음식과 나무 식탁'},
  wish:{name:'발원당',art:'/assets/temple-wish.webp',label:'05 · 발원당',title:'소원과 바람을 적어 올리는 곳',desc:'그림 아래 발원문 책상이나 ‘소원 적기’를 눌러 마음을 남겨 보세요. 소원은 공개되지 않고 이 기기에만 보관됩니다.',alt:'발원문과 연꽃등, 발원함이 준비된 발원당'},
  rest:{name:'바다 쉼터',art:'/assets/temple-rest.webp',label:'06 · 바다 쉼터',title:'파도 소리처럼 마음을 내려놓는 시간',desc:'잠시 아무것도 하지 않아도 괜찮습니다. 수평선을 바라보며 마음을 쉬어 가세요.',alt:'바다와 수평선이 펼쳐진 정자의 차탁과 방석'},
  trail:{name:'해안 산책로',art:'/assets/temple-trail.webp',label:'07 · 해안 산책로',title:'파도와 바람이 위로가 되는 길',desc:'벚꽃이 흩날리는 길을 따라 천천히 걸어 보세요. 서두르지 않는 것도 하나의 여행입니다.',alt:'노을빛 바다와 벚꽃이 어우러진 절벽 산책로'}
};
const img=$('templeArt'),aura=$('haesuAura'),spots=$('mapHotspots'),video=$('templeVideo'),play=$('videoPlay'),pending=$('videoPending'),mount=$('videoMount'),wishHot=$('wishHotspot'),actions=$('sceneActions'),directory=$('placeLinks'),panel=$('wishSaved'),list=$('wishSavedList'),dialog=$('wishDialog'),textBox=$('wishText');
const wishKey='haemungi-temple-private-wishes-v1';
const lanternKey='haemungi-temple-lantern-v1';
let current='map',youtube='hP-8B7sHJt4',lanternLit=false;
try{lanternLit=localStorage.getItem(lanternKey)==='lit'}catch(_){}
function route(){const k=decodeURIComponent(location.hash.slice(1));return Object.hasOwn(places,k)?k:'map'}
function action(label,fn,primary=false){const b=document.createElement('button');b.type='button';b.className=primary?'action-primary':'action-soft';b.textContent=label;b.addEventListener('click',fn);actions.append(b);return b}
function status(message){let el=$('sceneStatus');if(!el){el=document.createElement('p');el.id='sceneStatus';el.setAttribute('role','status');el.className='scene-status';actions.after(el)}el.textContent=message||'';el.hidden=!message}
function readWishes(){try{const a=JSON.parse(localStorage.getItem(wishKey)||'[]');return Array.isArray(a)?a.filter(x=>x&&typeof x.id==='string'&&typeof x.text==='string'&&x.text.length<=300).slice(0,10):[]}catch(_){return []}}
function renderWishes(){list.replaceChildren();const arr=readWishes();panel.hidden=current!=='wish'||arr.length===0;for(const x of arr){const li=document.createElement('li'),p=document.createElement('p'),del=document.createElement('button');p.textContent=x.text;del.type='button';del.textContent='지우기';del.setAttribute('aria-label','이 발원문 지우기');del.addEventListener('click',()=>{if(!confirm('이 발원문을 정말 지울까요?'))return;try{localStorage.setItem(wishKey,JSON.stringify(readWishes().filter(r=>r.id!==x.id)));renderWishes()}catch(_){status('발원문을 지울 수 없습니다.')}});li.append(p,del);list.append(li)}}
function openWish(){$('wishMessage').textContent='';textBox.value='';$('wishCount').textContent='0 / 300';dialog.showModal();textBox.focus()}
function closeWish(){if(dialog.open)dialog.close()}
function quiet(){document.body.classList.add('quiet-mode');$('quietExit').hidden=false;$('quietExit').focus()}
function exitQuiet(){document.body.classList.remove('quiet-mode');$('quietExit').hidden=true}

function videoId(input){try{const u=new URL(input),h=u.hostname.toLowerCase();let id='';if(h==='youtu.be')id=u.pathname.slice(1).split('/')[0];else if(['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(h))id=u.pathname.startsWith('/embed/')||u.pathname.startsWith('/shorts/')?u.pathname.split('/')[2]:u.searchParams.get('v');return /^[a-zA-Z0-9_-]{11}$/.test(id||'')?id:''}catch(_){return ''}}
async function loadVideo(){const c=window.HAEMUNGI_CONTENT_CONFIG||{};if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(c.projectUrl||'')||!/^sb_publishable_[\w-]+$/.test(c.publishableKey||''))return;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),6000);try{const url=c.projectUrl+'/rest/v1/hm_media_public?select=kind,source_url&slot=eq.video-temple&kind=eq.video&is_published=eq.true&limit=1';const r=await fetch(url,{headers:{apikey:c.publishableKey,Accept:'application/json'},signal:controller.signal,cache:'no-store'});if(!r.ok)return;const rows=await r.json();youtube=videoId(Array.isArray(rows)?rows[0]?.source_url:'')||youtube;updateVideo()}catch(_){/* Keep the owner-selected YouTube video. */}finally{clearTimeout(timeout)}}
function updateVideo(){const thumb=$('videoThumb');if(youtube){const url='https://i.ytimg.com/vi/'+encodeURIComponent(youtube)+'/hqdefault.jpg';if(thumb.src!==url){thumb.dataset.failedSrc='';thumb.src=url;}if(thumb.complete&&thumb.naturalWidth===0)thumb.dataset.failedSrc=url;thumb.hidden=thumb.dataset.failedSrc===url;thumb.alt='대웅전 영상 썸네일 · 재생 버튼을 눌러 시청';}else thumb.hidden=true;play.hidden=!youtube;pending.hidden=!!youtube;$('templeVideoChannelWrap').hidden=youtube!=='hP-8B7sHJt4';const link='https://youtu.be/'+youtube;$('templeVideoSource').href=link;$('templeVideoDialogSource').href=link}
function startVideo(){if(!youtube||current!=='daewoong')return;window.dispatchEvent(new Event('temple:video-start'));const iframe=document.createElement('iframe');iframe.src='https://www.youtube-nocookie.com/embed/'+youtube+'?autoplay=1&rel=0&playsinline=1';iframe.title='대웅전 명상 영상 (YouTube)';iframe.allow='accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share';iframe.allowFullscreen=true;iframe.referrerPolicy='strict-origin-when-cross-origin';mount.replaceChildren(iframe);$('templeVideoDialog').showModal();play.hidden=true;pending.hidden=true}
function stopVideo(){const dlg=$('templeVideoDialog');if(dlg.open)dlg.close();mount.replaceChildren();updateVideo()}
function render(){const next=route();if(next!==current){stopVideo();exitQuiet();status('')}current=next;const p=places[next];img.src=p.art;img.alt=p.alt;aura.toggleAttribute('hidden',next!=='haesu');spots.hidden=next!=='map';video.hidden=next!=='daewoong';wishHot.hidden=next!=='wish';$('templeVideoCredit').hidden=next!=='daewoong';updateVideo();$('sceneKicker').textContent=p.label;$('sceneTitle').textContent=p.title;$('sceneDescription').textContent=p.desc;$('mapReturn').hidden=next==='map';document.title=(next==='map'?'파도가 들리는 법당':p.name)+' | 헤뭉이의 마음쉼터';actions.replaceChildren();if(next==='map')action('바다 쉼터 먼저 가기',()=>{location.hash='rest'},true);if(next==='wish')action('✎ 소원 적기',openWish,true);if(next==='lantern')action(lanternLit?'✓ 법등을 밝혔습니다':'✧ 법등 한 등 밝히기',()=>{lanternLit=true;try{localStorage.setItem(lanternKey,'lit')}catch(_){}actions.firstElementChild.textContent='✓ 법등을 밝혔습니다';status('마음속 작은 불빛이 오래도록 따뜻하길 바랍니다.')},true);if(next==='haesu')action('🙏 두 손 모아 합장하기',()=>status('지금 이 순간만큼은 마음이 편안해지기를 바랍니다.'),true);if(next!=='map'){action('고요한 화면으로 머무르기',quiet);action('← 전체 지도',()=>{location.hash='map'})}directory.replaceChildren();for(const [key,place] of Object.entries(places)){if(key==='map')continue;const a=document.createElement('a');a.href='#'+key;a.textContent=place.name+' ↗';if(next===key)a.setAttribute('aria-current','location');directory.append(a)}renderWishes();window.scrollTo({top:0,behavior:'instant'})}
const thumbnail=$('videoThumb');thumbnail.addEventListener('error',()=>{thumbnail.dataset.failedSrc=thumbnail.src;thumbnail.hidden=true});thumbnail.addEventListener('load',()=>{thumbnail.dataset.failedSrc='';thumbnail.hidden=false});
play.addEventListener('click',startVideo);
$('templeVideoClose').addEventListener('click',stopVideo);
$('templeVideoDialog').addEventListener('close',()=>{mount.replaceChildren();updateVideo()});
wishHot.addEventListener('click',openWish);
$('wishClose').addEventListener('click',closeWish);
$('wishCancel').addEventListener('click',closeWish);
$('quietExit').addEventListener('click',exitQuiet);
textBox.addEventListener('input',()=>{$('wishCount').textContent=textBox.value.length+' / 300'});
$('wishForm').addEventListener('submit',e=>{e.preventDefault();const value=textBox.value.trim();if(!value||value.length>300){$('wishMessage').textContent='1~300자로 소원을 적어 주세요.';return}const arr=readWishes();arr.unshift({id:String(Date.now())+Math.random().toString(36).slice(2,7),text:value});try{localStorage.setItem(wishKey,JSON.stringify(arr.slice(0,10)));closeWish();renderWishes();status('소원을 발원함에 담았습니다. 이 기기에만 보관되며 다른 방문자에게 공개되지 않습니다.')}catch(_){$('wishMessage').textContent='브라우저에 저장하지 못했습니다. 내용을 복사해 보관해 주세요.'}});
dialog.addEventListener('click',e=>{if(e.target===dialog)closeWish()});
window.addEventListener('hashchange',render);
render();loadVideo();
})();