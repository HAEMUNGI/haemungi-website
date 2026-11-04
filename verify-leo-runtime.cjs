'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

class Element {
  constructor(id=''){this.id=id;this.style={};this.listeners={};this.dataset={};this.textContent='';this.src='';this.clientWidth=1000;this.scrollLeft=0;this.classNames=new Set();this.classList={add:c=>this.classNames.add(c),remove:c=>this.classNames.delete(c),toggle:(c,force)=>{if(force)this.classNames.add(c);else this.classNames.delete(c);},contains:c=>this.classNames.has(c)};}
  addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
  dispatch(name,extra={}){for(const fn of this.listeners[name]||[])fn({preventDefault(){},pointerId:1,...extra});}
  setPointerCapture(){}
  querySelector(){return new Element('small');}
  setAttribute(k,v){this[k]=v;}
  getBoundingClientRect(){return {left:0,top:0,width:1536,height:865};}
}
const ids=['roomWorld','roomViewport','leoSprite','leoCharacter','toyBall','leoStatus','leoHearts','runToggle','moveLeft','moveRight','roomFloor','roomFullscreen','roomFullscreenExit'];
const elements=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
elements.roomWorld.clientWidth=1536;
elements.roomViewport.clientWidth=1280;
const buttons=Object.fromEntries(['sit','sleep','play','jump','call'].map(action=>[action,Object.assign(new Element(action),{dataset:{action}})]));
const zones=Object.fromEntries(['tower','bed','food','ball'].map(zone=>[zone,Object.assign(new Element(zone),{dataset:{zone}})]));
const listeners={};
let now=0,raf=[];
const win={matchMedia:()=>({matches:false}),addEventListener(name,fn){(listeners[name]??=[]).push(fn);}};
const documentListeners={};
const doc={hidden:false,fullscreenElement:null,body:new Element('body'),getElementById:id=>elements[id],querySelectorAll:selector=>selector==='[data-action]'?Object.values(buttons):selector==='[data-zone]'?Object.values(zones):[],addEventListener(name,fn){(documentListeners[name]??=[]).push(fn);}};
const dispatchFullscreenChange=()=>{for(const fn of documentListeners.fullscreenchange||[])fn();};
elements.roomViewport.requestFullscreen=async()=>{doc.fullscreenElement=elements.roomViewport;dispatchFullscreenChange();};
doc.exitFullscreen=async()=>{doc.fullscreenElement=null;dispatchFullscreenChange();};
const ctx={window:win,document:doc,HTMLElement:Element,performance:{now:()=>now},requestAnimationFrame:fn=>raf.push(fn),setTimeout:()=>1,clearTimeout:()=>{},screen:{orientation:{lock:async()=>{},unlock(){}}},console};
vm.runInNewContext(fs.readFileSync('dist/leo-room.js','utf8'),ctx,{filename:'leo-room.js'});
const advance=ms=>{for(let t=0;t<ms;t+=16){now+=16;const callbacks=raf;raf=[];callbacks.forEach(fn=>fn(now));}};
const x=()=>parseFloat(elements.leoCharacter.style.left);
advance(200);
assert.match(elements.leoSprite.src,/sit\/frame_/);
assert.ok(elements.roomViewport.scrollLeft>0,'initial camera centers Leo when the world overflows');
const initial=x();
elements.moveRight.dispatch('pointerdown');
advance(700);
elements.moveRight.dispatch('pointerup');
assert.ok(x()>initial+5,'Leo must actually move right');
buttons.sleep.dispatch('click');
advance(2500);
assert.match(elements.leoSprite.src,/sleep\/frame_/,`sleep pose: ${elements.leoSprite.src}`);
buttons.play.dispatch('click');
advance(2100);
assert.match(elements.leoSprite.src,/play_reference\/frame_/,`play pose: ${elements.leoSprite.src}`);
buttons.jump.dispatch('click');
advance(3000);
assert.match(elements.leoSprite.src,/(run|sit)\/frame_/,`jump pose: ${elements.leoSprite.src}`);
advance(3200);
assert.ok(x()>5 && x()<50,'Leo stays in room after tower jump');
assert.ok(raf.length===1,'single animation loop');

(async()=>{
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  elements.roomFullscreen.dispatch('click');
  await flush();
  assert.equal(doc.fullscreenElement,elements.roomViewport,'native fullscreen enters the room viewport');
  assert.equal(elements.roomFullscreenExit.hidden,false,'fullscreen exit button must be accessible');
  assert.equal(elements.roomFullscreen['aria-pressed'],'true','fullscreen state announced');
  elements.roomFullscreenExit.dispatch('click');
  await flush();
  assert.equal(doc.fullscreenElement,null,'fullscreen exit restores normal mode');
  assert.equal(elements.roomFullscreenExit.hidden,true,'fullscreen exit button hidden in normal mode');
  delete elements.roomViewport.requestFullscreen;
  elements.roomFullscreen.dispatch('click');
  await flush();
  assert.ok(elements.roomViewport.classList.contains('is-expanded'),'fallback expands room when browser blocks fullscreen');
  assert.ok(doc.body.classList.contains('room-expanded'),'fallback prevents background scrolling');
  for(const fn of listeners.keydown||[])fn({key:'Escape',preventDefault(){}});
  await flush();
  assert.ok(!elements.roomViewport.classList.contains('is-expanded'),'Escape closes fallback view');
  assert.ok(!doc.body.classList.contains('room-expanded'),'Escape unlocks document scroll');
  console.log('PASS: Leo sprite render, walking, sleeping, play, jump, native fullscreen, fallback, Escape exit');
})().catch(error=>{console.error(error);process.exitCode=1;});
