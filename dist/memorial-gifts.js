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

const artwork={
  bouquet:`<path d="M22 69 12 42 42 42 35 69Z" fill="#e9c6a7" stroke="#bd977b"/><path d="M27 52 21 20M30 54 36 16M31 54 43 28" stroke="#6b8e63" stroke-width="2.5"/><g fill="#f4c6cf" stroke="#fff8ec" stroke-width="1"><circle cx="20" cy="23" r="10"/><circle cx="36" cy="17" r="11"/><circle cx="43" cy="29" r="9"/><circle cx="25" cy="33" r="9"/></g><g fill="#dfb35d"><circle cx="20" cy="23" r="3"/><circle cx="36" cy="17" r="3"/><circle cx="43" cy="29" r="3"/></g>`,
  'flower-basket':`<path d="M10 37Q12 16 30 16T50 37" fill="none" stroke="#a77748" stroke-width="4"/><path d="M9 42 14 66Q30 74 46 66L51 42Z" fill="#c7945e" stroke="#805c3d" stroke-width="2"/><path d="M13 50H47M16 59H44M24 43V68M36 43V68" stroke="#e8bd86" stroke-width="2"/><g fill="#f3bdd0" stroke="#ffe7e4"><circle cx="18" cy="36" r="10"/><circle cx="31" cy="30" r="12"/><circle cx="43" cy="37" r="9"/></g><g fill="#e8ce71"><circle cx="18" cy="36" r="3"/><circle cx="31" cy="30" r="3"/><circle cx="43" cy="37" r="3"/></g>`,
  cake:`<ellipse cx="30" cy="66" rx="26" ry="5" fill="#d8c5b1"/><path d="M11 43H49V64H11Z" fill="#f5c7b7" stroke="#d7a58e"/><path d="M11 45Q17 52 23 45T35 45T49 45V55H11Z" fill="#fff7e6"/><rect x="18" y="29" width="24" height="15" rx="3" fill="#f7e5cb"/><path d="M18 32Q22 38 27 32T36 32T42 32" fill="none" stroke="#de9e96" stroke-width="3"/><path d="M30 20V29" stroke="#a56a51" stroke-width="2"/><path d="M30 16Q24 23 30 25Q36 21 30 16" fill="#e2aa52"/>`,
  treats:`<path d="M14 23 46 23 50 66Q30 73 10 66Z" fill="#f5c68d" stroke="#aa7952" stroke-width="2"/><path d="M14 23 21 15H39L46 23" fill="#eac19b"/><path d="M14 34H46" stroke="#e2a15d" stroke-width="3"/><path d="M26 43Q17 38 19 47Q22 52 30 57Q38 52 41 47Q42 39 34 43Q30 37 26 43" fill="#fff7e8"/><circle cx="25" cy="45" r="2" fill="#a77a5d"/><circle cx="35" cy="45" r="2" fill="#a77a5d"/>`,
  drinks:`<path d="M13 24 25 16 42 24V69H13Z" fill="#e9f3e2" stroke="#7e9a81" stroke-width="2"/><path d="M13 24H42L30 32H13Z" fill="#fff9e4"/><path d="M30 32V69" stroke="#a2c3a2" stroke-width="2"/><path d="M21 20V10H31" stroke="#f6a9aa" stroke-width="3" fill="none"/><ellipse cx="23" cy="50" rx="8" ry="11" fill="#b9d49f"/><path d="M18 51Q23 43 28 51" fill="none" stroke="#f9f4e2" stroke-width="2"/>`,
  fruit:`<path d="M7 51Q30 75 53 51Z" fill="#dbab79" stroke="#9d704f" stroke-width="2"/><path d="M7 51Q30 57 53 51" fill="none" stroke="#f5ddbb" stroke-width="3"/><circle cx="19" cy="43" r="11" fill="#e9a39c"/><circle cx="34" cy="42" r="11" fill="#efcc79"/><circle cx="44" cy="47" r="8" fill="#c7d69d"/><path d="M19 32Q25 27 28 33M34 31Q40 27 42 32" fill="none" stroke="#70855b" stroke-width="3"/>`,
  toys:`<g fill="#dfb78f" stroke="#a98262" stroke-width="1.5"><circle cx="17" cy="25" r="9"/><circle cx="43" cy="25" r="9"/><ellipse cx="30" cy="54" rx="17" ry="18"/><circle cx="30" cy="33" r="18"/></g><ellipse cx="30" cy="40" rx="10" ry="7" fill="#fff0df"/><circle cx="24" cy="31" r="2.2" fill="#523a32"/><circle cx="36" cy="31" r="2.2" fill="#523a32"/><path d="M26 39Q30 43 34 39" fill="none" stroke="#805643" stroke-width="2"/><path d="M22 53 30 60 38 53" fill="#eea4ae"/>`,
  'gift-box':`<rect x="11" y="34" width="38" height="34" rx="3" fill="#e9afa9" stroke="#a96e6b" stroke-width="2"/><rect x="8" y="29" width="44" height="10" rx="2" fill="#f6c7b3" stroke="#a96e6b" stroke-width="2"/><path d="M27 29V68H34V29" fill="#f9e0a7"/><path d="M30 29Q10 26 17 17Q23 11 30 29Q40 9 46 17Q54 27 30 29" fill="#f9e0a7" stroke="#bb955b" stroke-width="2"/>`
};
const svgFor=id=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80" aria-hidden="true">${artwork[id]||''}</svg>`;
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
    for(const row of visible){
      const item=el('span','altar-gift'+(row.gift_batch_id===animateBatchId?' just-placed':''));
      item.innerHTML=svgFor(row.product_id);layer.append(item);
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
