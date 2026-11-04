'use strict';
// Fast, isolated test: a 20,000-entry public memorial dataset, no writes to production.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {URL}=require('node:url');
const migration=fs.readFileSync('012_haemungi_memorial_open_stars.sql','utf8');
const publicJs=fs.readFileSync('dist/memorial.js','utf8');
const adminJs=fs.readFileSync('dist/memorial-admin.js','utf8');
assert.match(migration,/alter column slot_index drop not null/,'legacy twelve-slot capacity not decoupled');
assert.match(migration,/owner_consent_verified=true/,'owner consent RLS must remain enforced');
assert.match(migration,/hm_memorial_public_recent_seek_idx/,'seek index required');
assert.match(migration,/thumbs\//,'private admin-only thumbnail uploads required');
assert.match(publicJs,/slot_index=not\.is\.null/,'12-slot visualizer must not query all records');
assert.match(publicJs,/id=eq\./,'individual public story must load by ID');
assert.match(adminJs,/publish\(row,null,consent\.checked\)/,'archive approval must be distinct from hall assignment');
assert.match(adminJs,/uploadListThumbnail\(blob\)/,'published records require list thumbnail');

class Element {
  constructor(tag='div'){this.tag=tag;this.children=[];this.listeners={};this.value='';this.disabled=false;this.attributes={};this.textContent='';}
  addEventListener(type,fn){this.listeners[type]=fn;}
  setAttribute(k,v){this.attributes[k]=v;}
  appendChild(x){this.children.push(x);return x;}
  append(...xs){this.children.push(...xs);}
  replaceChildren(...xs){this.children=xs;}
  async trigger(type){const fn=this.listeners[type];assert(fn,'missing listener '+type);await fn({preventDefault(){},currentTarget:this});}
}

const ids=['archiveGrid','archiveStatus','archivePrev','archiveNext','archivePage',
  'archiveSearch','archiveQuery','archiveClear'];
const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
const data=Array.from({length:20000},(_,i)=>({
  id:'00000000-0000-4000-8000-'+String(i).padStart(12,'0'),
  pet_name:'별 '+i,
  born_on:'2022-01-01',passed_on:'2026-01-01',
  photo_path:'approved/00000000-0000-4000-8000-'+String(i).padStart(12,'0')+'.jpg',
  thumbnail_path:'thumbs/00000000-0000-4000-8000-'+String(i).padStart(12,'0')+'.webp',
  published_at:new Date(Date.UTC(2026,10,5)-i*60000).toISOString()
}));
let requests=0,maxReturned=0,lastRequest='',failNext=false;
async function fakeFetch(input){
  const url=new URL(input);requests++;lastRequest=url.toString();
  if(failNext){failNext=false;return {ok:false,status:503};}
  assert.equal(url.pathname,'/rest/v1/hm_memorial_public');
  assert.equal(url.searchParams.get('limit'),'25');
  assert.equal(url.searchParams.get('select'),'id,pet_name,born_on,passed_on,photo_path,thumbnail_path,published_at');
  let result=data;
  const name=url.searchParams.get('pet_name');
  if(name){const text=name.replace(/^ilike\.\*/,'').replace(/\*$/,'').toLowerCase();result=result.filter(x=>x.pet_name.toLowerCase().includes(text));}
  const filter=url.searchParams.get('or');
  if(filter){
    const match=filter.match(/^\(published_at\.lt\.(.+?),and\(published_at\.eq\.(.+?),id\.lt\.(.+?)\)\)$/);
    assert(match,'invalid keyset filter '+filter);
    const [,before,same,id]=match;
    result=result.filter(x=>x.published_at<before||(x.published_at===same&&x.id<id));
  }
  const rows=result.slice(0,Number(url.searchParams.get('limit')));
  maxReturned=Math.max(maxReturned,rows.length);
  return {ok:true,json:async()=>rows};
}
const context={
  window:{HAEMUNGI_CONTENT_CONFIG:{projectUrl:'https://fake.supabase.co',publishableKey:'sb_publishable_test'}},
  document:{getElementById:id=>elements[id],createElement:tag=>new Element(tag)},
  fetch:fakeFetch,URLSearchParams,console
};
vm.runInNewContext(fs.readFileSync('dist/memorial-archive.js','utf8'),context);
const settle=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  await settle();
  assert.equal(elements.archiveGrid.children.length,24,'initial page contains 24 items');
  assert.equal(elements.archivePrev.disabled,true);
  assert.equal(elements.archiveNext.disabled,false);
  assert.equal(elements.archiveGrid.children[0].children[0].href,'/memorial.html#story:'+data[0].id);
  assert.equal(elements.archiveGrid.children[0].children[0].children[0].children[0].src,
    'https://fake.supabase.co/storage/v1/object/public/hm-memorial-published/'+data[0].thumbnail_path);
  await elements.archiveNext.trigger('click');await settle();
  assert.equal(elements.archiveGrid.children.length,24);
  assert.equal(elements.archiveGrid.children[0].children[0].href,'/memorial.html#story:'+data[24].id);
  assert.equal(elements.archivePage.textContent,'2쪽');
  await elements.archivePrev.trigger('click');await settle();
  assert.equal(elements.archivePage.textContent,'1쪽');
  elements.archiveQuery.value='별 19999';
  await elements.archiveSearch.trigger('submit');await settle();
  assert.equal(elements.archiveGrid.children.length,1);
  assert.equal(elements.archiveNext.disabled,true);
  await elements.archiveClear.trigger('click');await settle();
  assert.equal(elements.archiveGrid.children.length,24);
  failNext=true;
  await elements.archiveNext.trigger('click');await settle();
  assert.match(elements.archiveStatus.textContent,/503/);
  assert.equal(elements.archiveGrid.children.length,1,'error state has one message only');
  await elements.archiveClear.trigger('click');await settle();
  const seen=new Set();
  let pages=0;
  while(true){
    pages++;
    for(const item of elements.archiveGrid.children){
      const target=item.children[0].href;
      assert(!seen.has(target),'duplicate record after keyset navigation');
      seen.add(target);
    }
    if(elements.archiveNext.disabled)break;
    assert(pages<900,'page navigation did not terminate');
    await elements.archiveNext.trigger('click');await settle();
    assert(elements.archiveGrid.children.length<=24,'unbounded browser render');
  }
  assert.equal(seen.size,20000,'all 20,000 memories reachable without duplication');
  assert.equal(pages,834,'expected page count at 24 entries per page');
  assert(maxReturned<=25,'browser must never download all 20k records');
  assert(requests>=6);
  assert(lastRequest.includes('limit=25'));
  console.log('PASS: 20,000 synthetic memorials across '+pages+' pages, no missing/duplicate entries; keyset pages (24+1), name search, thumbnails, error handling; max response='+maxReturned);
})().catch(err=>{console.error(err);process.exitCode=1;});
