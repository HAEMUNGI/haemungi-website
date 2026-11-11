import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const dist=resolve(import.meta.dirname,'dist');
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
assert((await readFile(resolve(dist,'community.html'),'utf8')).includes('/community.js?v=20261112-content2'),'new community code must invalidate old browser cache');
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const file=resolve(dist,decodeURIComponent(url.pathname).slice(1)||'index.html');
  if(!file.startsWith(dist+sep)){res.writeHead(403).end();return;}
  try{const bytes=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream'}).end(bytes);}
  catch{res.writeHead(404).end('Not found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
const executablePath=process.env.CHROMIUM_EXECUTABLE;
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{channel:'chrome'}),args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
let mode='empty';
const boards=['free','qna','notice','guide'];
const starters={free:0,qna:4,notice:3,guide:4};
const posts=Object.fromEntries(boards.map(board=>[board,Array.from({length:board==='guide'?17:2},(_,i)=>({
  id:board+'-'+i,board,title:board+' 실제 게시글 '+i,
  body:i===0?'<img src=x onerror=alert(1)> 본문':'검증용 실제 게시글',
  author_nickname:'검증자',avatar_gender:'female',created_at:'2026-11-11T00:00:00Z'
}))]));
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/rest/v1/hm_community_posts?*',async route=>{
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'apikey,authorization,content-type','access-control-allow-methods':'GET,OPTIONS','content-type':'application/json'};
  if(route.request().method()==='OPTIONS'){
    await route.fulfill({status:204,headers,body:''});return;
  }
  const url=new URL(route.request().url());
  if(mode==='error'){
    await route.fulfill({status:503,headers,body:JSON.stringify({message:'일시적으로 게시글을 불러오지 못했습니다.'})});
    return;
  }
  const board=(url.searchParams.get('board')||'eq.free').replace(/^eq\./,'');
  const items=mode==='populated'?posts[board]||[]:[];
  const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||16);
  await route.fulfill({status:200,headers,body:JSON.stringify(items.slice(offset,offset+limit))});
});

try{
  const open=async board=>{
    await page.locator('[data-board="'+board+'"]').click();
    await page.waitForFunction(board=>document.querySelector('[data-board="'+board+'"]')?.getAttribute('aria-pressed')==='true' && !document.getElementById('cmPostList')?.textContent.includes('불러오는 중'),board);
  };
  // Empty state: the 11 built-in entries stay available without database rows.
  await page.goto(origin+'/community.html?board=free',{waitUntil:'domcontentloaded'});
  for(const board of boards){
    await open(board);
    assert.equal(await page.locator('.cm-starter-row').count(),starters[board],board+' empty starter count');
    assert.equal(await page.locator('.cm-post-row:not(.cm-starter-row)').count(),0,board+' empty posts');
  }
  console.log('PASS empty state: Q&A 4, notice 3, guide 4, free 0');

  // Loaded posts: posts must never displace or duplicate starter entries.
  mode='populated';
  await page.goto(origin+'/community.html?board=free',{waitUntil:'domcontentloaded'});
  for(const board of boards){
    await open(board);
    assert.equal(await page.locator('.cm-starter-row').count(),starters[board],board+' populated starter count');
    assert.equal(await page.locator('.cm-post-row:not(.cm-starter-row)').count(),board==='guide'?15:2,board+' populated post count');
    assert.equal(await page.locator('.cm-post-title').filter({hasText:board+' 실제 게시글 0'}).count(),1,board+' post visible');
  }
  console.log('PASS populated state: actual posts coexist with all permanent notices/FAQ');

  // Pagination, tab transitions, DOM text safety.
  await page.locator('#cmOlderPosts').click();
  await page.waitForFunction(()=>document.querySelectorAll('.cm-post-row:not(.cm-starter-row)').length===17);
  assert.equal(await page.locator('.cm-starter-row').count(),4,'starter entries not duplicated by pagination');
  assert.equal(await page.locator('#cmOlderPosts').isVisible(),false,'last-page button hidden');
  assert.equal(await page.locator('.cm-post-title img').count(),0,'post content never interpreted as markup');
  await open('qna');await open('guide');
  assert.equal(await page.locator('.cm-starter-row').count(),4,'starter count after tab return');
  assert.equal(await page.locator('.cm-post-row:not(.cm-starter-row)').count(),15,'post count after tab return');
  console.log('PASS pagination (17), tab return, safe text rendering');

  // Data API temporarily unavailable: built-in notices should remain readable.
  mode='error';
  await page.goto(origin+'/community.html?board=guide',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('cmPostList')?.textContent.includes('일시적으로 게시글'));
  assert.equal(await page.locator('.cm-starter-row').count(),4,'fallback guide should survive REST failure');
  console.log('PASS network-failure fallback keeps permanent guide');

  mode='populated';
  for(const viewport of [{width:390,height:844},{width:320,height:640},{width:1280,height:800}]){
    await page.setViewportSize(viewport);
    await page.goto(origin+'/community.html?board=guide',{waitUntil:'domcontentloaded'});
    await page.locator('.cm-starter-row').first().waitFor();
    const metrics=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
      targets:[...document.querySelectorAll('.cm-topbar,.cm-board,.cm-tabs,.cm-tabs button,.cm-post-row,.cm-post-title,#cmNewPost')].map(el=>({name:el.className||el.id,x:el.getBoundingClientRect().x,right:el.getBoundingClientRect().right}))}));
    assert(metrics.scrollWidth<=metrics.width+1,'horizontal overflow at '+viewport.width+': '+metrics.scrollWidth);
    for(const target of metrics.targets){
      assert(target.x>=-1&&target.right<=viewport.width+1,'clipped '+target.name+' at '+viewport.width+' ('+target.x+','+target.right+')');
    }
    console.log('PASS viewport '+viewport.width+'x'+viewport.height+': no horizontal overflow or clipped tabs/posts');
  }
  assert.equal(errors.length,0,'uncaught browser errors: '+errors.join(' | '));
  console.log('COMMUNITY BROWSER REGRESSION PASS');
}finally{
  await browser.close();await new Promise(done=>server.close(done));
}
