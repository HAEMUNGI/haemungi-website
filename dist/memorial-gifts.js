import {STORE_PRODUCTS,cleanGifts,UUID_PATTERN} from './memorial-store-core.mjs';

// The existing one-flower-per-day offering is independent of these store gifts.
// A gift is public only after its donor explicitly selects a memorial and places it.
const $=id=>document.getElementById(id);
const storeKey='haemungi-memorial-store-v1';
const products=new Map(STORE_PRODUCTS.map(item=>[item.id,item]));
const cfg=window.HAEMUNGI_CONTENT_CONFIG||{};
const api=cfg.projectUrl||'',key=cfg.publishableKey||'';
const ready=/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(api)&&/^sb_publishable_[\w-]+$/.test(key);
const layer=$('altarGifts'),panel=$('ritualStoreGifts'),pending=$('pendingStoreGifts');
const status=$('ritualGiftStatus'),recent=$('ritualRecentGifts');
let pet=null,loadingSequence=0,placing=false;

// Percent coordinates refer to the immutable 9:16 ritual-room photograph.
// The first three gifts rest on the front wooden table, with overflow on the
// rear stone shelf. Objects remain anchored when the mobile address bar moves.
const placementSlots={
  1:[[50,68.55]],
  2:[[43.2,68.55],[56.8,68.55]],
  3:[[39.5,68.55],[50,68.55],[60.5,68.55]],
  4:[[39.5,68.55],[50,68.55],[60.5,68.55],[41.5,61.25]],
  5:[[39.5,68.55],[50,68.55],[60.5,68.55],[41.5,61.25],[58.5,61.25]]
};
const productWidths={bouquet:12.2,'flower-basket':13.4,cake:12.6,treats:12.1,drinks:10.3,fruit:13,toys:12.9,'gift-box':11.7};
const el=(tag,cls,text)=>{
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text!==undefined)node.textContent=text;
  return node;
};

function localStore(){
  try{
    const data=JSON.parse(localStorage.getItem(storeKey)||'{}');
    return {data,gifts:cleanGifts(data.gifts)};
  }catch{return {data:{},gifts:[]};}
}
function saveBatches(data,gifts){
  localStorage.setItem(storeKey,JSON.stringify({...data,gifts}));
}
async function request(path,body){
  if(!ready)throw new Error('제례실 서버 연결 설정을 확인해주세요.');
  const response=await fetch(api+'/rest/v1/'+path,{
    method:body===undefined?'GET':'POST',
    headers:{apikey:key,Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json',Prefer:'return=minimal'})},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
    cache:'no-store'
  });
  if(!response.ok){
    const detail=await response.json().catch(()=>({}));
    const error=new Error(detail.message||'선물 기록을 처리할 수 없습니다. ('+response.status+')');
    error.status=response.status;throw error;
  }
  return body===undefined?response.json():undefined;
}
function describe(items){
  return STORE_PRODUCTS.filter(item=>items[item.id])
    .map(item=>item.name+' '+items[item.id]+'개').join(' · ');
}
function renderPending(){
  pending.replaceChildren();
  panel.hidden=!pet;
  if(!pet)return;
  $('giftRecipientGuide').textContent=pet.name+'의 제례실 제단에 무료 선물을 놓습니다. 배치하면 다른 방문객에게도 보입니다.';
  const {gifts}=localStore();
  let available=0;
  gifts.forEach((batch,index)=>{
    if(batch.placedAt)return;
    available++;
    const row=el('div','pending-gift-row');
    row.append(el('strong',null,describe(batch.items)));
    const button=el('button',null,pet.name+'에게 선물 놓기');
    button.type='button';button.disabled=placing;
    button.addEventListener('click',()=>placeBatch(index,batch.createdAt));
    row.append(button);pending.append(row);
  });
  if(!available)pending.append(el('p','pending-gift-empty','아직 놓을 선물이 없습니다. 편의점에서 골라 선물함에 담아 주세요.'));
}
async function confirmedBatch(batchId,petId,items){
  const rows=await request('hm_memorial_store_gifts?select=product_id,quantity&gift_batch_id=eq.'+encodeURIComponent(batchId)+'&memorial_id=eq.'+encodeURIComponent(petId)+'&limit=8');
  return Array.isArray(rows)&&rows.length===Object.keys(items).length&&
    rows.every(row=>items[row.product_id]===row.quantity);
}
async function placeBatch(index,createdAt){
  if(placing||!pet)return;
  const recipient={...pet};
  let saved;
  try{
    saved=localStore();
    const batch=saved.gifts[index];
    if(!batch||batch.createdAt!==createdAt||batch.placedAt)return;
    if(!batch.batchId)batch.batchId=crypto.randomUUID();
    saveBatches(saved.data,saved.gifts); // Persist the id before a possibly interrupted request.
    placing=true;renderPending();
    status.textContent=recipient.name+'의 제단에 선물을 올리는 중입니다…';
    const rows=Object.entries(batch.items).map(([productId,quantity])=>({
      memorial_id:recipient.id,gift_batch_id:batch.batchId,product_id:productId,quantity
    }));
    try{await request('hm_memorial_store_gifts',rows);}
    catch(err){
      if(err.status!==409||!await confirmedBatch(batch.batchId,recipient.id,batch.items))throw err;
    }
    const latest=localStore();
    const matched=latest.gifts.find(g=>g.batchId===batch.batchId);
    if(matched){
      matched.placedAt=new Date().toISOString();matched.placedPetId=recipient.id;
      matched.placedPetName=recipient.name;
      saveBatches(latest.data,latest.gifts);
    }
    if(pet?.id===recipient.id){
      status.textContent=recipient.name+'의 제단에 선물을 놓았습니다. 위 제단에 선물이 나타납니다.';
      await loadPlaced(batch.batchId);
    }
  }catch(err){
    if(pet?.id===recipient.id)status.textContent='선물 배치에 실패했습니다. 선물함은 그대로 보존됩니다. '+err.message;
  }finally{placing=false;renderPending();}
}
async function loadPlaced(animateBatchId=''){
  const currentPet=pet,seq=++loadingSequence;
  layer.replaceChildren();recent.replaceChildren();
  if(!currentPet)return;
  recent.append(el('p',null,'제단에 놓인 선물을 불러오고 있습니다…'));
  try{
    const rows=await request('hm_memorial_store_gifts?select=product_id,quantity,gift_batch_id,created_at&memorial_id=eq.'+
      encodeURIComponent(currentPet.id)+'&order=created_at.desc&limit=40');
    if(seq!==loadingSequence||pet?.id!==currentPet.id)return;
    const gifts=(Array.isArray(rows)?rows:[]).filter(row=>products.has(row.product_id)&&
      Number.isInteger(row.quantity)&&row.quantity>0&&row.quantity<=20);
    const visible=gifts.slice(0,5).reverse();
    const slots=placementSlots[visible.length]||[];
    for(const [index,row] of visible.entries()){
      const item=el('span','altar-gift'+(row.gift_batch_id===animateBatchId?' just-placed':''));
      const [x,y]=slots[index];
      item.style.setProperty('--gift-x',x+'%');
      item.style.setProperty('--gift-y',y+'%');
      item.style.setProperty('--gift-width',(index<3?productWidths[row.product_id]:productWidths[row.product_id]*.78)+'%');
      item.dataset.surface=index<3?'table':'shelf';
      const img=el('img');
      img.src='/memorial/store-products/'+row.product_id+'.webp';
      img.alt='';img.decoding='async';
      item.append(img);layer.append(item);
    }
    recent.replaceChildren();
    if(!gifts.length){recent.append(el('p',null,'아직 제단에 놓인 편의점 선물이 없습니다.'));return;}
    const total=gifts.reduce((n,g)=>n+g.quantity,0);
    recent.append(el('p',null,'최근 배치 기록 '+gifts.length+'종 · '+total+'개 (제단에는 가장 최근 5종 표시)'));
    const last=gifts.slice(0,8).map(g=>products.get(g.product_id).name+' '+g.quantity+'개').join(' · ');
    recent.append(el('p',null,last));
  }catch(err){
    if(seq===loadingSequence&&pet?.id===currentPet.id){
      recent.replaceChildren(el('p',null,'선물 기록을 불러오지 못했습니다. '+err.message));
    }
  }
}
document.addEventListener('haemungi:ritual-pet-changed',event=>{
  const next=event.detail;
  if(!next||!UUID_PATTERN.test(next.id||'')){pet=null;layer.replaceChildren();renderPending();return;}
  if(pet?.id===next.id){renderPending();return;}
  pet={id:next.id,name:String(next.name||'친구').slice(0,60)};
  status.textContent='';
  renderPending();loadPlaced();
});
