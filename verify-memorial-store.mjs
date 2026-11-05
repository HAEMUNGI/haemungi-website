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
assert.doesNotMatch(js,/innerHTML|service_role|hm_memorial_requests|contact_email/);
for(const page of ['dist/memorial.html','dist/memorial-walk.html'])
  assert.match(readFileSync(page,'utf8'),/href="\/memorial-store\.html"/);
console.log('MEMORIAL STORE PASS: original film and JPEGs, 8 hotspots, virtual cart/gift box, accessible choices, memorial navigation.');
