const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  fs.mkdirSync('smoke-shots',{recursive:true});
  const browser=await chromium.launch({headless:true});
  try{
    for(const config of [
      {name:'mobile-390',width:390,height:844,mobile:true},
      {name:'desktop-1280',width:1280,height:900,mobile:false}
    ]){
      const context=await browser.newContext({
        viewport:{width:config.width,height:config.height},
        deviceScaleFactor:1,isMobile:config.mobile,hasTouch:config.mobile
      });
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      const response=await page.goto((process.env.HAEMUNGI_PLAYGROUND_URL || 'https://haemungi.pages.dev/playground#pet'),
        {waitUntil:'networkidle',timeout:45000});
      assert.equal(response.status(),200,config.name+' http status');
      await page.locator('.hm-living-world:not([hidden])').waitFor({timeout:20000});
      await page.locator('.hm-living-actor img').waitFor();
      const report=await page.evaluate(()=>{
        const r=document.querySelector('.hm-living-world').getBoundingClientRect();
        const c=document.querySelector('.hm-living-caption').getBoundingClientRect();
        const actor=document.querySelector('.hm-living-actor img');
        const style=document.querySelector('.hm-living-actor').style;
        return {roomWidth:r.width,roomHeight:r.height,captionTop:c.top,roomBottom:r.bottom,
          scrollWidth:document.documentElement.scrollWidth,viewportWidth:window.innerWidth,
          actorNaturalWidth:actor.naturalWidth,actorSrc:actor.currentSrc,
          actorLeft:style.left,actorTop:style.top,hidden:document.querySelector('#pg-game-pet').hidden,
          buttonCount:document.querySelectorAll('#pg-game-pet .pg-pet-actions > button').length,
          originalRoomHidden:getComputedStyle(document.querySelector('#pet-room-img')).opacity};
      });
      assert.equal(report.hidden,false,config.name+' pet route opens');
      assert.ok(report.actorNaturalWidth>900,config.name+' 3D actor must load');
      assert.ok(report.roomWidth>200,config.name+' room must render');
      assert.ok(Math.abs(report.roomWidth/report.roomHeight - 16/9)<.04,config.name+' room aspect');
      assert.ok(report.captionTop>=report.roomBottom-5,config.name+' speech outside room');
      assert.ok(report.scrollWidth<=report.viewportWidth+12,config.name+' no horizontal overflow');
      assert.equal(report.buttonCount,4,config.name+' four care controls');
      assert.ok(Number(report.originalRoomHidden)<.1,config.name+' only supplied room visible');
      await page.screenshot({path:'smoke-shots/'+config.name+'.png',fullPage:true});
      await page.locator('[data-care="play"]').click();
      await page.waitForTimeout(1900);
      const afterPlay=await page.evaluate(()=>({
        actorLeft:document.querySelector('.hm-living-actor').style.left,
        actorSrc:document.querySelector('.hm-living-actor img').currentSrc,
        bubble:document.querySelector('#pet-says').textContent,
        level:document.querySelector('#pet-level').textContent
      }));
      assert.notEqual(report.actorLeft,afterPlay.actorLeft,config.name+' actor must actually travel');
      assert.ok(/haemungi-3d-(walk|play|idle)\.png/.test(afterPlay.actorSrc),config.name+' pose stream');
      await page.screenshot({path:'smoke-shots/'+config.name+'-play.png',fullPage:false});
      await page.locator('[data-hotspot="rest"]').click({force:true});
      await page.waitForTimeout(1500);
      const afterRest=await page.evaluate(()=>({
        x:document.querySelector('.hm-living-actor').style.left,
        mode:document.querySelector('.hm-living-actor').dataset.pose
      }));
      assert.notEqual(afterPlay.actorLeft,afterRest.x,config.name+' resting navigates to the bed');
      const petTarget=page.locator('.hm-living-pet-target');
      await petTarget.waitFor({state:'visible'});
      const prior=await page.evaluate(()=>({
        happy:Number(document.querySelector('#pet-happy').value),
        xp:document.querySelector('#pet-xp').textContent
      }));
      const touchBox=await petTarget.boundingBox();
      assert.ok(touchBox && touchBox.width>25,config.name+' touch zone is reachable');
      await page.mouse.move(touchBox.x+touchBox.width*.48,touchBox.y+touchBox.height*.45);
      await page.mouse.down();
      await page.mouse.move(touchBox.x+touchBox.width*.67,touchBox.y+touchBox.height*.45,{steps:5});
      await page.mouse.move(touchBox.x+touchBox.width*.32,touchBox.y+touchBox.height*.48,{steps:5});
      await page.mouse.up();
      const afterPet=await page.evaluate(()=>({
        pose:document.querySelector('.hm-living-actor').dataset.pose,
        speech:document.querySelector('#pet-says').textContent,
        happy:Number(document.querySelector('#pet-happy').value),
        xp:document.querySelector('#pet-xp').textContent
      }));
      assert.equal(afterPet.pose,'petted',config.name+' strokes make the pet smile');
      assert.ok(afterPet.happy>=prior.happy,config.name+' petting remains positive');
      assert.equal(afterPet.xp,prior.xp,config.name+' petting cannot farm daily XP');
      await page.locator('.hm-living-call').click();
      const callSpeech=await page.locator('#pet-says').textContent();
      assert.match(callSpeech,/몽/,config.name+' calling receives a character response');
      assert.deepEqual(errors,[],config.name+' browser errors');
      console.log(JSON.stringify({device:config.name,report,afterPlay,afterRest,qa:'PASS'}));
      await context.close();
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
