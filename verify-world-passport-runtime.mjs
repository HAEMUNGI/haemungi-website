import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const original=readFileSync('dist/world-passport.js','utf8');
const hooked=original.replace(
  "  if(document.readyState==='loading')",
  "  globalThis.__hmTest={queueStamp,sync,stampCount,get stamps(){return stamps;}};\n  if(document.readyState==='loading')",
);
assert.notEqual(original,hooked,'Runtime harness must reach the real passport functions');

function setup({hash='#room',failures=0}={}){
  let now=0,nextId=0,remainingFailures=failures;
  const tasks=new Map(),calls=[];
  const setTask=(fn,delay,period=0)=>{
    const id=++nextId;tasks.set(id,{fn,at:now+delay,period});return id;
  };
  const clearTask=id=>tasks.delete(id);
  function advance(ms){
    const end=now+ms;
    while(true){
      const first=[...tasks].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
      if(!first)break;
      const [id,t]=first;now=t.at;
      if(t.period)t.at+=t.period;else tasks.delete(id);
      t.fn();
    }
    now=end;
  }
  const localStorage={getItem:()=>JSON.stringify({id:'test-passport-id',token:'test-passport-token'}),setItem:()=>{}};
  const document={readyState:'loading',visibilityState:'visible',addEventListener:()=>{}};
  const location={pathname:'/',hash};
  const fetch=async(_url,options)=>{
    const input=JSON.parse(options.body);calls.push(input);
    if(input.action==='stamp'&&remainingFailures>0){
      remainingFailures--;
      return {ok:false,status:503,json:async()=>({error:'임시 통신 오류'})};
    }
    return {ok:true,status:200,json:async()=>({
      stamps:input.action==='stamp'?{[input.stop]:'2026-11-08'}:{},claimed_slot:null,
    })};
  };
  const context={window:{HAEMUNGI_CONTENT_CONFIG:{projectUrl:'https://example.invalid',publishableKey:'test'}},
    document,location,localStorage,fetch,
    setTimeout:(f,ms)=>setTask(f,ms),clearTimeout:clearTask,
    setInterval:(f,ms)=>setTask(f,ms,ms),clearInterval:clearTask,
  };
  runInNewContext(hooked,context);
  async function flush(){for(let i=0;i<15;i++)await Promise.resolve();}
  return {api:context.__hmTest,location,document,calls,advance,flush};
}

{
  const t=setup();t.api.queueStamp();t.advance(3999);await t.flush();
  assert.equal(t.calls.length,0,'No stamp before four visible seconds');
  t.advance(1);await t.flush();
  assert.deepEqual(t.calls.map(c=>c.stop),['room'],'Exactly one confirmed room visit');
  assert.equal(t.api.stampCount(),1,'The real server response determines the count');
  t.api.queueStamp();t.advance(5000);await t.flush();
  assert.equal(t.calls.length,1,'A previously stamped destination is not resent');
}
{
  const t=setup();t.api.queueStamp();t.advance(1800);
  t.document.visibilityState='hidden';t.api.queueStamp();t.advance(8000);await t.flush();
  assert.equal(t.calls.length,0,'A background tab cannot earn a stamp');
  t.document.visibilityState='visible';t.api.queueStamp();t.advance(4000);await t.flush();
  assert.equal(t.api.stampCount(),1,'Returning to a visible destination starts a new dwell');
}
{
  const t=setup();t.api.queueStamp();t.advance(2000);
  t.location.hash='#today';t.api.queueStamp();t.advance(4000);await t.flush();
  assert.deepEqual(t.calls.map(c=>c.stop),['today'],'Navigating away cancels the previous destination');
}
{
  const t=setup({failures:1});t.api.queueStamp();t.advance(4000);await t.flush();
  assert.equal(t.api.stampCount(),0,'A failed response never awards a stamp');
  t.advance(3200);await t.flush();
  assert.equal(t.api.stampCount(),1,'A verified retry restores the stamp');
  assert.equal(t.calls.length,2,'Temporary errors are retried once before success');
}
console.log('PASS passport runtime: dwell threshold, hidden-tab cancellation, route transition, server-confirmed count, idempotence and transient-error retry.');
