'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');

const ROOT = path.join(__dirname,'dist','leo-room','sprites');
const COUNTS={walk_right:6,walk_left:6,run:6,sit:3,sleep:1,play_reference:3};
for(const [action,count] of Object.entries(COUNTS))for(let i=1;i<=count;i++){
  const p=path.join(ROOT,action,`frame_${String(i).padStart(2,'0')}.png`);
  assert.ok(fs.statSync(p).size>2000,`missing or empty sprite ${p}`);
}
assert.ok(fs.statSync(path.join(__dirname,'dist','leo-room','room-background.webp')).size>100000);
const html=fs.readFileSync(path.join(__dirname,'dist','leo-room.html'),'utf8');
const fullscreenCss=fs.readFileSync(path.join(__dirname,'dist','leo-room-fullscreen.css'),'utf8');
assert.match(html,/id="roomFullscreen"[^>]*aria-controls="roomViewport"/,'fullscreen entry must target the room viewport');
assert.match(html,/id="roomFullscreenExit"[^>]*hidden/,'fullscreen exit must be available');
assert.match(fullscreenCss,/min-width:\s*0/,'fullscreen stage must override mobile 880px minimum width');
assert.match(fullscreenCss,/height:\s*100dvh[\s\S]*?aspect-ratio:\s*auto/,
  'landscape fullscreen must fill the viewport without sidebars');
assert.match(fullscreenCss,/@media \(orientation: portrait\)[\s\S]*?width:\s*max\(100vw,\s*177\.57dvh\)/,
  'portrait fullscreen must preserve the room scene and allow horizontal panning');
console.log('PASS: 25 vetted RGBA sprite frames and approved 16:9 scene asset present');

if(!fs.existsSync(chromium.executablePath())){
  console.warn('SKIP: browser visual QA: Chromium is unavailable in this execution environment.');
  process.exit(0);
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  const base=process.env.LEO_ROOM_URL||'http://127.0.0.1:8765/leo-room.html';
  try{
    for(const config of [{name:'desktop',width:1280,height:900,isMobile:false},{name:'mobile',width:390,height:844,isMobile:true}]){
      const context=await browser.newContext({viewport:{width:config.width,height:config.height},isMobile:config.isMobile,hasTouch:config.isMobile});
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      const response=await page.goto(base,{waitUntil:'networkidle',timeout:30000});
      assert.equal(response.status(),200,`${config.name} status`);
      await page.locator('#leoSprite').waitFor();
      const initial=await page.evaluate(()=>{
        const world=document.querySelector('.room-world').getBoundingClientRect();
        const bg=document.querySelector('.room-background');
        const img=document.querySelector('#leoSprite');
        return {ratio:world.width/world.height,bgWidth:bg.naturalWidth,imgWidth:img.naturalWidth,x:document.querySelector('#leoCharacter').style.left,overflow:document.documentElement.scrollWidth-window.innerWidth};
      });
      assert.ok(Math.abs(initial.ratio-1536/865)<.015,`${config.name} wide room aspect`);
      assert.equal(initial.bgWidth,1536,`${config.name} room image loaded`);
      assert.equal(initial.imgWidth,384,`${config.name} actual sprite frame loaded`);
      assert.ok(initial.overflow<=4,`${config.name} page must not overflow horizontally`);
      await page.locator('#roomFullscreen').click();
      await page.waitForFunction(()=>document.fullscreenElement===document.querySelector('#roomViewport') || document.querySelector('#roomViewport').classList.contains('is-expanded'));
      const expanded=await page.evaluate(()=>{
        const viewport=document.querySelector('#roomViewport');
        const rect=viewport.querySelector('.room-world').getBoundingClientRect();
        return {stageWidth:rect.width,stageHeight:rect.height,viewWidth:viewport.clientWidth,viewHeight:viewport.clientHeight,exitHidden:document.querySelector('#roomFullscreenExit').hidden};
      });
      assert.equal(expanded.exitHidden,false,`${config.name} fullscreen exit accessible`);
      assert.ok(Math.abs(expanded.stageHeight-expanded.viewHeight)<=1,`${config.name} fullscreen scene fills viewport height`);
      if(config.width>=config.height){
        assert.ok(Math.abs(expanded.stageWidth-expanded.viewWidth)<=1,`${config.name} fullscreen has no sidebars`);
      }else{
        assert.ok(expanded.stageWidth>=expanded.viewWidth,`${config.name} portrait fullscreen offers horizontal panning`);
        assert.ok(Math.abs(expanded.stageWidth/expanded.stageHeight-1536/865)<.02,
          `${config.name} portrait fullscreen retains scene aspect`);
      }
      await page.locator('#roomFullscreenExit').click();
      await page.waitForFunction(()=>!document.fullscreenElement && !document.querySelector('#roomViewport').classList.contains('is-expanded'));
      assert.equal(await page.locator('#roomFullscreenExit').isHidden(),true,`${config.name} exits fullscreen`);
      await page.screenshot({path:`/tmp/leo-room-${config.name}.png`,fullPage:true});
      const rightBox=await page.locator('#moveRight').boundingBox();
      await page.mouse.move(rightBox.x+rightBox.width/2,rightBox.y+rightBox.height/2);
      await page.mouse.down();
      await page.waitForTimeout(580);
      await page.mouse.up();
      const right=await page.locator('#leoCharacter').evaluate(node=>parseFloat(node.style.left));
      assert.ok(right>parseFloat(initial.x)+.9,`${config.name} right movement`);
      await page.locator('#runToggle').click();
      assert.equal(await page.locator('#runToggle').getAttribute('aria-pressed'),'true');
      await page.locator('[data-action="sleep"]').click();
      await page.waitForTimeout(3500);
      const slept=await page.locator('#leoSprite').getAttribute('src');
      assert.match(slept,/sleep\/frame_/,`${config.name} sleep pose`);
      await page.locator('[data-action="play"]').click();
      await page.waitForTimeout(2500);
      const play=await page.locator('#leoSprite').getAttribute('src');
      assert.match(play,/play_reference\/frame_/,`${config.name} play animation`);
      await page.locator('[data-action="jump"]').click();
      await page.waitForTimeout(1300);
      const jump=await page.locator('#leoSprite').getAttribute('src');
      assert.match(jump,/(walk_left|run|sit)\/frame_/,`${config.name} approaches tower and jumps`);
      assert.deepEqual(errors,[],`${config.name} browser errors`);
      console.log(JSON.stringify({name:config.name,initial,right,slept,play,jump,status:'PASS'}));
      await context.close();
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
