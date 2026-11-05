// Local-only virtual gifts. No checkout, memorial record, or private visitor data.
export const STORE_PRODUCTS = Object.freeze([
  {id:'bouquet',name:'추모 꽃다발',category:'꽃',description:'정성스럽게 묶은 꽃으로 소중한 마음을 전해요.',x:3,y:30,w:32,h:24},
  {id:'flower-basket',name:'꽃바구니',category:'꽃',description:'화사한 꽃바구니를 추억의 선물로 골라요.',x:2,y:55,w:30,h:24},
  {id:'cake',name:'기념 케이크',category:'먹거리',description:'함께했던 특별한 날을 떠올리는 작은 케이크예요.',x:32,y:42,w:30,h:15},
  {id:'treats',name:'간식 꾸러미',category:'먹거리',description:'좋아하던 간식을 떠올리며 꾸러미를 준비해요.',x:73,y:30,w:26,h:24},
  {id:'drinks',name:'음료와 우유',category:'먹거리',description:'매장 오른쪽 진열대의 음료를 골라요.',x:73,y:55,w:25,h:11},
  {id:'fruit',name:'과일 바구니',category:'먹거리',description:'알록달록한 과일을 담은 작은 바구니예요.',x:74,y:67,w:24,h:13},
  {id:'toys',name:'인형과 장난감',category:'선물',description:'좋아하는 인형과 장난감을 기억하는 선물이에요.',x:34,y:56,w:32,h:13},
  {id:'gift-box',name:'리본 선물 상자',category:'선물',description:'마음을 담아 준비하는 리본 장식 선물이에요.',x:39,y:69,w:29,h:13}
]);
export const MAX_ITEM_QUANTITY = 20;
export const MAX_GIFT_BATCHES = 12;
const productIds = new Set(STORE_PRODUCTS.map(item=>item.id));
export function cleanQuantity(value){
  const num = Number(value);
  if(!Number.isFinite(num))return 1;
  return Math.max(1,Math.min(MAX_ITEM_QUANTITY,Math.trunc(num)));
}
export function cleanCart(raw){
  if(!raw || typeof raw!=='object' || Array.isArray(raw))return {};
  const result={};
  for(const [id,qty] of Object.entries(raw)){
    if(productIds.has(id) && Number.isInteger(qty) && qty>=1)result[id]=cleanQuantity(qty);
  }
  return result;
}
export function addToCart(raw,id,qty=1){
  const cart=cleanCart(raw);
  if(!productIds.has(id))return cart;
  cart[id]=Math.min(MAX_ITEM_QUANTITY,(cart[id]||0)+cleanQuantity(qty));
  return cart;
}
export function cartCount(raw){return Object.values(cleanCart(raw)).reduce((sum,n)=>sum+n,0);}
export function makeGiftBatch(raw,createdAt){
  const cart=cleanCart(raw);
  if(cartCount(cart)===0)return null;
  return {createdAt:new Date(createdAt).toISOString(),items:cart};
}
export function cleanGifts(raw){
  if(!Array.isArray(raw))return [];
  return raw.slice(0,MAX_GIFT_BATCHES).flatMap(batch=>{
    if(!batch || !Number.isFinite(Date.parse(batch.createdAt)))return [];
    const items=cleanCart(batch.items);
    return cartCount(items)>0?[{createdAt:new Date(batch.createdAt).toISOString(),items}]:[];
  });
}
