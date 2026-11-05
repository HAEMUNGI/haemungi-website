import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {STORE_PRODUCTS,MAX_ITEM_QUANTITY,cleanQuantity,cleanCart,cleanGifts,
  addToCart,cartCount,makeGiftBatch} from './dist/memorial-store-core.mjs';

const root='dist/memorial/';
const expected={
  'store-entry.mp4':'1d85d7a9e70ffe813b4c8c42f8ac8801d1ebd3f29b0d2cdf2cbcc4f34052c604',
  'store-corridor.jpg':'b0c8d175d6795d0bba5fc69dae604620bbaadbe92adccdbd3729db12ad2efd56',
  'store-interior.jpg':'806ca01aeaaef3f301c2233605afa2db796d9d51ab8293e61e9f42e48a9e7af9'
};
for(const [name,hash] of Object.entries(expected)){
  const bytes=readFileSync(root+name);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,`Approved media changed: ${name}`);
  if(name.endsWith('.jpg'))assert.equal(bytes.toString('hex',0,3),'ffd8ff');
  else{assert.ok(bytes.includes(Buffer.from('ftyp')));assert.ok(statSync(root+name).size>10_000_000);}
}
const partA=readFileSync('media-source/memorial-store/entry-00.bin');
const partB=readFileSync('media-source/memorial-store/entry-01.bin');
assert.equal(createHash('sha256').update(partA).update(partB).digest('hex'),expected['store-entry.mp4']);
assert.equal(STORE_PRODUCTS.length,8);
assert.equal(new Set(STORE_PRODUCTS.map(item=>item.id)).size,8);
for(const item of STORE_PRODUCTS){
  assert.ok(item.x>=0&&item.y>=0&&item.w>0&&item.h>0);
  assert.ok(item.x+item.w<=100&&item.y+item.h<=100);
}
assert.equal(cleanQuantity(-1),1);
assert.equal(cleanQuantity(999),MAX_ITEM_QUANTITY);
assert.deepEqual(cleanCart({'bouquet':2,'hacker':100,'fruit':-1}),{'bouquet':2});
assert.deepEqual(addToCart({'bouquet':18},'bouquet',9),{'bouquet':20});
assert.deepEqual(addToCart({},'nonexistent',10),{});
assert.equal(cartCount({'bouquet':2,'toys':3}),5);
assert.equal(makeGiftBatch({},Date.now()),null);
const batch=makeGiftBatch({'bouquet':2},Date.parse('2026-11-05T00:00:00.000Z'));
assert.equal(batch.items.bouquet,2);
assert.equal(cleanGifts([batch])[0].items.bouquet,2);
assert.deepEqual(cleanGifts([{createdAt:'bad',items:{bouquet:1}}]),[]);
const batchId='12345678-1234-4123-8123-123456789abc';
const petId='12345678-1234-4123-8123-abcdeffedcba';
const placed=cleanGifts([{...batch,batchId,placedPetId:petId,placedPetName:'레오',placedAt:'2026-11-05T12:00:00Z'}])[0];
assert.equal(placed.batchId,batchId);
assert.equal(placed.placedPetId,petId);
assert.equal(placed.placedPetName,'레오');
assert.equal(cleanGifts([{...batch,placedPetId:'not-a-uuid',placedAt:placed.placedAt}])[0].placedPetId,undefined);

const html=readFileSync('dist/memorial-store.html','utf8');
const js=readFileSync('dist/memorial-store.js','utf8');
const css=readFileSync('dist/memorial-store.css','utf8');
for(const id of ['storeStage','storeFilm','storeStill','storeHotspots','storeCover','enterStore',
  'skipStore','viewProducts','replayStore','productDirectory','selectionPanel','quantityControls',
  'productQuantity','addToCart','cartList','cartCount','clearCart','saveGift','giftList','giftCount','storeStatus']){
  assert.match(html,new RegExp(`id="${id}"`));
}
assert.match(html,/store-entry\.mp4/);
assert.match(html,/store-corridor\.jpg/);
assert.match(html,/store-interior\.jpg/);
assert.match(js,/film\.addEventListener\('ended',\(\)=>finishFilm\(\)\)/);
assert.match(js,/film\.play\(\)/);
assert.match(js,/film\.addEventListener\('error'/);
assert.match(js,/localStorage\.setItem/);
assert.match(js,/element\('button'/); // No opaque click-only bitmap.
assert.match(css,/\.store-hotspot:focus-visible/);
assert.match(css,/aspect-ratio:9\/16/);
assert.match(css,/prefers-reduced-motion/);
assert.doesNotMatch(css,/100dvh/);
assert.match(css,/100svh/);
assert.match(js,/제례실에 선물 놓기/);
assert.doesNotMatch(js,/innerHTML|service_role|hm_memorial_requests|contact_email/);
for(const page of ['dist/memorial.html','dist/memorial-walk.html'])
  assert.match(readFileSync(page,'utf8'),/href="\/memorial-store\.html"/);
const ritualHtml=readFileSync('dist/memorial.html','utf8');
const ritualJs=readFileSync('dist/memorial-gifts.js','utf8');
const memorialJs=readFileSync('dist/memorial.js','utf8');
const memorialCss=readFileSync('dist/memorial.css','utf8');
const migration=readFileSync('013_haemungi_memorial_store_gifts.sql','utf8');
for(const id of ['altarGifts','ritualStoreGifts','pendingStoreGifts','ritualGiftStatus','ritualRecentGifts'])
  assert.match(ritualHtml,new RegExp(`id="${id}"`));
assert.match(ritualJs,/hm_memorial_store_gifts/);
assert.match(ritualJs,/memorial_id:recipient\.id/);
assert.match(ritualJs,/gift_batch_id:batch\.batchId/);
assert.match(ritualJs,/renderPending\(\);loadPlaced\(\)/);
assert.match(memorialJs,/haemungi:ritual-pet-changed/);
assert.match(memorialCss,/\.altar-gifts\{/);
assert.match(migration,/enable row level security/);
assert.match(migration,/for insert to anon,authenticated/);
assert.doesNotMatch(migration,/drop table|truncate|delete from|alter table public\.hm_memorial_public/);
console.log('MEMORIAL STORE PASS: original film and JPEGs, 8 hotspots, virtual cart/gift box, accessible choices, memorial navigation.');
console.log('RITUAL GIFTS PASS: mobile steady sizing, saved gifts preserved, named recipient, guarded server placement, bench art and RLS.');
