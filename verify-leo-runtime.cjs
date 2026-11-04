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
const ids=['roomWorld','roomViewport','leoSprite','leoCharacter','toyBall','leoStatus','leoHearts','runToggle','moveLeft','moveRight','roomFloor'];
const elements=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
elements.roomWorld.clientWidth=1536;
elements.roomViewport.clientWidth=1280;
const buttons=Object.fromEntries(['sit','sleep','play','jump','call'].map(action=>[action,Object.assign(new Element(action),{dataset:{action}})]));
const zones=Object.fromEntries(['tower','bed','food','ball'].map(zone=>[zone,Object.assign(new Element(zone),{dataset:{zone}})]));
const listeners={};
let now=0,raf=[];
const win={matchMedia:()=>({matches:false}),addEventListener(name,fn){(listeners[name]??=[]).push(fn);}};
const doc={hidden:false,getElementById:id=>elements[id],querySelectorAll:selector=>selector==='[data-action]'?Object.values(buttons):selector==='[data-zone]'?Object.values(zones):[]};
const ctx={window:win,document:doc,HTMLElement:Element,performance:{now:()=>now},requestAnimationFrame:fn=>raf.push(fn),setTimeout:()=>1,clearTimeout:()=>{},console};
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
console.log('PASS: Leo sprite render, actual walking, sleeping, prop-independent play, tower jump, animation loop');
