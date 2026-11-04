(() => {
'use strict';
const scenes = {
  map: {name:'전체 지도',img:'/assets/christmas-map.webp',kicker:'HAEMUNGI · CHRISTMAS VILLAGE',title:'눈 내리는 밤, 헤뭉이의 크리스마스',desc:'반짝이는 표지판을 눌러 여섯 광장으로 이동해 보세요. 겨울 정원에도 작은 선물이 기다리고 있어요.',alt:'크리스마스 중앙광장, 야행 야시장, 퍼레이드, 썰매타기, 얼음낚시와 특설무대를 표시한 헤뭉이 크리스마스 빌리지 전체 지도'},
  square: {name:'크리스마스 중앙광장',emoji:'🎄',img:'/assets/christmas-square.webp',kicker:'01 · CHRISTMAS SQUARE',title:'가장 큰 트리 아래에서 만나몽!',desc:'별빛과 오로라가 내려앉은 중앙광장. 헤뭉이와 함께 크리스마스트리의 불빛을 바라보며 소원을 빌어 봐요.',alt:'거대한 크리스마스트리와 선물 상자, 산타 모자와 빨간 목도리를 두른 헤뭉이'},
  market: {name:'야행 야시장',emoji:'🍪',img:'/assets/christmas-market.webp',kicker:'02 · NIGHT MARKET',title:'따뜻한 겨울 간식이 기다리몽!',desc:'달콤한 과자와 반짝이는 선물 가게가 가득한 야시장 골목. 은은한 불빛을 따라 천천히 걸어 보세요.',alt:'따뜻한 불빛으로 가득한 눈 내리는 크리스마스 야행 야시장'},
  parade: {name:'퍼레이드 광장',emoji:'🎺',img:'/assets/christmas-parade.webp',kicker:'03 · CHRISTMAS PARADE',title:'헤뭉이 산타가 지나간다몽!',desc:'눈사람 악단과 선물 썰매가 행진하는 퍼레이드. 환호와 반짝임이 가득한 겨울 축제의 순간이에요.',alt:'산타 옷의 헤뭉이가 썰매를 타고 눈사람 악단과 함께 행진하는 크리스마스 퍼레이드'},
  sled: {name:'썰매타기 광장',emoji:'🛷',img:'/assets/christmas-sled.webp',kicker:'04 · SLEDDING HILL',title:'눈길을 슝! 달려보자몽!',desc:'하얀 눈길 위에서 신나게 썰매를 타는 헤뭉이들. 보기만 해도 웃음이 나는 겨울 놀이터예요.',alt:'따뜻한 겨울 옷을 입은 헤뭉이들이 경사로에서 썰매를 타고 내려오는 광장'},
  fishing: {name:'얼음낚시 광장',emoji:'🎣',img:'/assets/christmas-fishing.webp',kicker:'05 · ICE FISHING',title:'물고기가 잡혔몽?!',desc:'반짝이는 얼음 위에서 낚싯대를 드리운 헤뭉이. 조용한 기다림 끝에 작은 놀라움이 찾아올지도 몰라요.',alt:'얼음 구멍에 낚싯대를 드리운 헤뭉이와 다른 헤뭉이들이 모여 있는 얼음낚시 광장'},
  stage: {name:'특설무대',emoji:'🎶',img:'/assets/christmas-stage.webp',kicker:'06 · SPECIAL STAGE',title:'오늘 밤의 주인공은 헤뭉이몽!',desc:'크리스마스 조명 아래 헤뭉이 밴드가 준비한 겨울 무대. 음악 소리가 들리는 듯한 반짝이는 공연장이에요.',alt:'기타를 든 헤뭉이와 밴드가 관객들 앞에서 공연하는 크리스마스 특설무대'},
  garden: {name:'겨울 정원',emoji:'🎁',img:'/assets/christmas-garden.webp',kicker:'07 · WINTER GARDEN',title:'작은 선물이 놓인 겨울 쉼터',desc:'눈 덮인 나무와 별 모양 등불, 따뜻한 선물 가판대가 있는 조용한 곳. 잠시 쉬었다 가도 좋다몽.',alt:'눈 내리는 해안 정원과 크리스마스트리, 선물 상자 옆에 앉은 헤뭉이'}
};
const ids=['square','market','parade','sled','fishing','stage','garden'];
const $=id=>document.getElementById(id);
const art=$('sceneImage'), spots=$('mapHotspots'),directory=$('placeLinks'),actions=$('sceneActions');
const hoverName=(id)=>scenes[id].name;
function currentRoute(){let raw='';try{raw=decodeURIComponent(location.hash.slice(1))}catch(_){return 'map'}return Object.prototype.hasOwnProperty.call(scenes,raw)?raw:'map'}
function action(label,href,primary=false){const a=document.createElement('a');a.href=href;a.className=primary?'button-primary':'button-secondary';a.textContent=label;actions.append(a)}
function renderDirectory(id){
  directory.replaceChildren();
  for(const key of ids){
    const s=scenes[key],a=document.createElement('a'),mark=document.createElement('span'),name=document.createTextNode(s.name);
    a.href='#'+key;mark.textContent=s.emoji;a.append(mark,name);
    if(id===key)a.setAttribute('aria-current','location');
    directory.append(a)
  }
}
let last=null;
function render(){
  const id=currentRoute(),s=scenes[id];
  if(last===id)return;
  last=id;
  art.src=s.img;art.alt=s.alt;
  spots.hidden=id!=='map';
  $('sceneKicker').textContent=s.kicker;
  $('sceneTitle').textContent=s.title;
  $('sceneDescription').textContent=s.desc;
  $('mapReturn').hidden=id==='map';$('headerCharm').hidden=id!=='map';
  $('villageTip').textContent=id==='map'?'지도 속 나무 간판을 누르면 해당 광장으로 이동해요. 겨울 정원은 아래 장소 목록에서 만날 수 있어요.':'전체 지도를 누르거나 아래 목록에서 다른 장소로 이동할 수 있어요.';
  document.title=(id==='map'?'헤뭉이 크리스마스 빌리지':s.name+' | 크리스마스 빌리지')+' · HAEMUNGI';
  actions.replaceChildren();
  if(id==='map'){
    action('🎄 중앙광장 먼저 가기','#square',true);
    action('🎁 겨울 정원 들르기','#garden');
  } else {
    action('← 전체 지도','#map',true);
    const next=ids[(ids.indexOf(id)+1)%ids.length];action('다음 장소: '+hoverName(next)+' →','#'+next);
  }
  renderDirectory(id);
  if(document.readyState==='complete'&&location.hash)window.scrollTo({top:0,behavior:'auto'});
}
window.addEventListener('hashchange',render);
render();
})();