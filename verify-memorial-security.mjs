import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {createContext, SourceTextModule, SyntheticModule} from 'node:vm';

const source=stripTypeScriptTypes(readFileSync('supabase/functions/memorial-self-register/index.ts','utf8'));
let handler, uploaded=0, published=0;
const userFromToken={
  invalid: null,
  unverified: {email:'guardian@example.com',email_confirmed_at:null},
  verified: {email:'guardian@example.com',email_confirmed_at:'2026-11-01T00:00:00Z'},
};
const supabase={
  auth:{getUser:async token=>({data:{user:userFromToken[token]??null},error:token==='invalid'?new Error('Invalid JWT'):null})},
  storage:{from:()=>({upload:async()=>{uploaded++;return {error:null};},remove:async()=>({error:null})})},
  rpc:async()=>{published++;return {error:null};},
  from:()=>({delete:()=>({lt:async()=>({error:null})})}),
};
const context=createContext({
  crypto:globalThis.crypto, Request,Response,Blob,File,TextEncoder,Uint8Array,Array,Date,
  console,Deno:{env:{get:()=> 'test-secret'},serve:fn=>{handler=fn;}},
});
const module=new SourceTextModule(source,{context});
const dependency=new SyntheticModule(['createClient'],function(){this.setExport('createClient',()=>supabase);},{context});
await module.link(async specifier=>{
  assert.equal(specifier,'npm:@supabase/supabase-js@2.57.0');
  return dependency;
});
await module.evaluate();
assert.equal(typeof handler,'function');

const endpoint='https://test.example/functions/v1/memorial-self-register';
const send=async(token,email='guardian@example.com',origin='https://haemungi.pages.dev')=>{
  const form=new FormData();form.set('contact_email',email);
  return handler(new Request(endpoint,{method:'POST',headers:{Origin:origin,...(token?{Authorization:'Bearer '+token}:{})},body:form}));
};
assert.equal((await send(null)).status,401,'Anonymous registration must be rejected');
assert.equal((await send('invalid')).status,401,'Untrusted JWT must be rejected');
assert.equal((await send('unverified')).status,401,'Unverified email must be rejected');
assert.equal((await send('verified','impersonated@example.com')).status,403,'Contact email spoofing must be rejected');
assert.equal((await send('verified')).status,400,'Verified requests still require complete, consented data');
assert.equal((await send('verified','guardian@example.com','https://example.invalid')).status,403,'Unknown origins must be rejected');
assert.equal(uploaded,0,'Rejected requests must never upload photos');
assert.equal(published,0,'Rejected requests must never publish records');
console.log('PASS memorial security: anonymous/unverified/forged registrations blocked, no rejected photo upload or public record');
