import {STORE_PRODUCTS,MAX_ITEM_QUANTITY,MAX_GIFT_BATCHES,
  cleanQuantity,cleanCart,cleanGifts,addToCart,cartCount,makeGiftBatch} from './memorial-store-core.mjs';

const $=id=>document.getElementById(id);
const key='haemungi-memorial-store-v1';
const film=$('storeFilm'),still=$('storeStill'),cover=$('storeCover');
const stage=$('storeStage'),hotspots=$('storeHotspots');
const quantity=$('productQuantity');
const catalogue=new Map(STORE_PRODUCTS.map(item=>[item.id,item]));
let selected=null,cart={},gifts=[];
let isShopping=false;

function announce(message){$('storeStatus').textContent=message;}
function element(tag,className,textValue){
  const el=document.createElement(tag);
  if(className)el.className=className;
  if(textValue!==undefined)el.textContent=textValue;
  return el;
}
function readSaved(){
  try{
    const data=JSON.parse(localStorage.getItem(key)||'{}');
    cart=cleanCart(data.cart);
    gifts=cleanGifts(data.gifts);
  }catch{cart={};gifts=[];}
}
function save(){
  try{localStorage.setItem(key,JSON.stringify({cart,gifts}));}
  catch{announce('저장 공간이 제한되어 있어 이 브라우저를 닫으면 선물이 유지되지 않을 수 있습니다.');}
}

function finishFilm(message='매장에 도착했습니다. 그림 속 물건을 눌러 선물을 골라주세요.'){
  film.pause();
  film.hidden=true;
  still.hidden=false;
  hotspots.hidden=false;
  cover.hidden=true;
  $('skipStore').hidden=true;
  $('viewProducts').hidden=true;
  $('replayStore').hidden=false;
  isShopping=true;
  stage.classList.add('is-shopping');
  announce(message);
}

async function playFilm(){
  isShopping=false;
  stage.classList.remove('is-shopping');
  cover.hidden=true;
  still.hidden=true;
  hotspots.hidden=true;
  film.hidden=false;
  $('viewProducts').hidden=true;
  $('replayStore').hidden=true;
  $('skipStore').hidden=false;
  announce('별빛 펫 편의점으로 들어가는 중입니다…');
  try{
    film.currentTime=0;
    await film.play();
  }catch{
    finishFilm('이 브라우저에서 영상 재생이 어려워 매장 상품 화면으로 이동했습니다.');
  }
}

function selectItem(id){
  const item=catalogue.get(id);
  if(!item)return;
  if(!isShopping)finishFilm();
  selected=id;
  $('selectionPanel').querySelector('h2').textContent=item.name;
  $('selectedDescription').textContent=item.description;
  $('quantityControls').hidden=false;
  $('addToCart').disabled=false;
  quantity.value='1';
  for(const button of document.querySelectorAll('[data-product]')){
    button.setAttribute('aria-pressed',String(button.dataset.product===id));
  }
  announce(`${item.name}을(를) 선택했습니다. 수량을 고르고 무료 장바구니에 담으세요.`);
  if(matchMedia('(max-width: 850px)').matches){
    $('selectionPanel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
  }
}

function renderCatalogue(){
  for(const item of STORE_PRODUCTS){
    const spot=element('button','store-hotspot');
    spot.type='button';
    spot.dataset.product=item.id;
    spot.setAttribute('aria-label',`${item.name} 선택`);
    spot.setAttribute('aria-pressed','false');
    spot.style.left=item.x+'%';spot.style.top=item.y+'%';
    spot.style.width=item.w+'%';spot.style.height=item.h+'%';
    spot.addEventListener('click',()=>selectItem(item.id));
    hotspots.append(spot);

    const tile=element('button','product-tile');
    tile.type='button';tile.dataset.product=item.id;
    tile.setAttribute('aria-pressed','false');
    tile.append(element('span','product-category',item.category));
    tile.append(element('strong',null,item.name));
    tile.append(element('small',null,'무료 가상 선물 · 0원'));
    tile.addEventListener('click',()=>selectItem(item.id));
    $('productDirectory').append(tile);
  }
}

function renderCart(){
  const items=STORE_PRODUCTS.filter(item=>cart[item.id]);
  const count=cartCount(cart);
  $('cartCount').textContent=`${count}개`;
  $('saveGift').disabled=count===0;
  $('clearCart').disabled=count===0;
  const list=$('cartList');list.replaceChildren();
  if(count===0){list.append(element('p','empty-note','아직 담은 물건이 없습니다.'));return;}
  for(const item of items){
    const row=element('div','cart-row');
    const label=element('span',null,`${item.name} × ${cart[item.id]}`);
    const remove=element('button','remove-action','빼기');
    remove.type='button';remove.setAttribute('aria-label',`${item.name} 장바구니에서 빼기`);
    remove.addEventListener('click',()=>{
      delete cart[item.id];save();renderCart();
      announce(`${item.name}을(를) 장바구니에서 뺐습니다.`);
    });
    row.append(label,remove);list.append(row);
  }
}

function renderGifts(){
  const list=$('giftList');list.replaceChildren();
  $('giftCount').textContent=`${gifts.length}묶음`;
  if(gifts.length===0){list.append(element('p','empty-note','담아 둔 선물이 여기에 표시됩니다.'));return;}
  for(const batch of gifts){
    const row=element('article','gift-batch');
    const heading=element('strong',null,`✿ ${new Date(batch.createdAt).toLocaleDateString('ko-KR')}에 담은 선물`);
    const contents=element('p',null,STORE_PRODUCTS.filter(item=>batch.items[item.id])
      .map(item=>`${item.name} ${batch.items[item.id]}개`).join(' · '));
    row.append(heading,contents);list.append(row);
  }
}

$('enterStore').addEventListener('click',playFilm);
$('replayStore').addEventListener('click',playFilm);
$('skipStore').addEventListener('click',()=>finishFilm());
$('viewProducts').addEventListener('click',()=>finishFilm());
film.addEventListener('ended',()=>finishFilm());
film.addEventListener('error',()=>finishFilm('영상 파일을 불러올 수 없어 매장 상품 화면을 표시했습니다.'));
const adjust=step=>{quantity.value=String(cleanQuantity(Number(quantity.value)+step));};
$('decreaseQuantity').addEventListener('click',()=>adjust(-1));
$('increaseQuantity').addEventListener('click',()=>adjust(1));
quantity.addEventListener('change',()=>{quantity.value=String(cleanQuantity(quantity.value));});
$('addToCart').addEventListener('click',()=>{
  if(!selected)return;
  const chosen=cleanQuantity(quantity.value);
  const previous=cart[selected]||0;
  cart=addToCart(cart,selected,chosen);
  save();renderCart();
  announce(`${catalogue.get(selected).name} ${cart[selected]-previous}개를 무료 장바구니에 담았습니다. (상품별 최대 ${MAX_ITEM_QUANTITY}개)`);
});
$('clearCart').addEventListener('click',()=>{
  cart={};save();renderCart();announce('장바구니를 비웠습니다. 선물함에 보관된 선물은 유지됩니다.');
});
$('saveGift').addEventListener('click',()=>{
  const batch=makeGiftBatch(cart,Date.now());
  if(!batch)return;
  gifts=cleanGifts([batch,...gifts]).slice(0,MAX_GIFT_BATCHES);
  cart={};save();renderCart();renderGifts();
  announce('선물을 내 가상 선물함에 보관했습니다. 이 브라우저에서 다시 확인할 수 있어요.');
});

readSaved();renderCatalogue();renderCart();renderGifts();
