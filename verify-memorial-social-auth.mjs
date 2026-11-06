import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext,Script} from 'node:vm';
import {webcrypto} from 'node:crypto';

const source=readFileSync('dist/memorial-registration.js','utf8');
const html=readFileSync('dist/memorial.html','utf8');
new Script(source);
for(const id of ['oauthKakao','oauthGoogle','linkKakao','linkGoogle','plaqueKakaoLogin',
  'plaqueGoogleLogin','oauthAvailability','visitorSocialLogin','accountLinkActions'])
  assert(html.includes(`id="${id}"`),`Missing ${id}`);

class Element {
  constructor(){this.listeners={};this.hidden=false;this.disabled=false;this.textContent='';this.value='';this.open=false;
    this.children=[];this.options=this.children;this.dataset={};this.style={};this.checked=false;}
  addEventListener(name,listener){(this.listeners[name]??=[]).push(listener);}
  async fire(name){for(const listener of this.listeners[name]||[])await listener({preventDefault(){},stopImmediatePropagation(){}});}
  replaceChildren(...children){this.children.length=0;this.children.push(...children);}
  appendChild(child){this.children.push(child);return child;}
  setAttribute(name,value){this[name]=value;}
  showModal(){this.open=true;}
  close(){this.open=false;}
  focus(){}
  querySelectorAll(){return [];}
}

const sleepTick=()=>new Promise(resolve=>setImmediate(resolve));
const userId='44c1ab00-aaaa-4000-8000-000000000001';
const verifiedUser={id:userId,email:'guardian@example.com',email_confirmed_at:'2026-11-07T00:00:00Z'};
const storages=new Map();
const sessionStorage={getItem:key=>storages.get(key)??null,setItem:(key,val)=>storages.set(key,String(val)),removeItem:key=>storages.delete(key)};
const recordings=[];
let tokenUser=verifiedUser,providers={google:true,kakao:true};

function createPage(href){
  const elements=new Map();
  const $=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  const radios=[{value:'archive',checked:true,addEventListener(){}},{value:'plaque',checked:false,addEventListener(){}}];
  const form=$('applicationForm');
  form.elements={contact_email:new Element()};
  form.querySelector=()=>radios.find(r=>r.checked);
  form.querySelectorAll=()=>radios;
  const document={getElementById:$,createElement:()=>new Element()};
  let current=new URL(href);
  const location={
    get origin(){return current.origin;},get href(){return current.href;},get pathname(){return current.pathname;},
    get search(){return current.search;},get hash(){return current.hash;},set hash(value){current.hash=value;},
    assign(url){current=new URL(url,current);}
  };
  const history={replaceState(_data,_title,url){current=new URL(url,current);}};
  const fetch=async(url,options={})=>{
    const u=new URL(url);
    recordings.push({url:u.href,authorization:options.headers?.Authorization,body:options.body});
    let body=[];
    if(u.pathname==='/auth/v1/settings')body={external:providers};
    else if(u.pathname==='/auth/v1/token')body={access_token:'mock-access',refresh_token:'mock-refresh',expires_in:3600,user:tokenUser};
    else if(u.pathname==='/auth/v1/user/identities/authorize')body={url:'https://accounts.example.org/linked'};
    const response={ok:true,status:200,json:async()=>body};
    return response;
  };
  const window={HAEMUNGI_CONTENT_CONFIG:{projectUrl:'https://example.supabase.co',publishableKey:'public-key'},
    location,crypto:webcrypto};
  const context={window,location,history,sessionStorage,document,fetch,crypto:webcrypto,URL,URLSearchParams,
    Uint8Array,TextEncoder,btoa,console,Date,FormData,File,Image:class{},setTimeout,clearTimeout};
  runInNewContext(source,context,{filename:'memorial-registration.js'});
  return {elements,$,location,history,window};
}

const base='https://haemungi.pages.dev/memorial.html';
const first=createPage(base+'?login=1#entrance');
await sleepTick();
assert.equal(first.$('oauthKakao').disabled,false);
assert.equal(first.$('oauthGoogle').disabled,false);
assert.equal(first.$('quickLoginForm').hidden,false);
await first.$('oauthKakao').fire('click');
const start=new URL(first.location.href);
assert.equal(start.pathname,'/auth/v1/authorize');
assert.equal(start.searchParams.get('provider'),'kakao');
assert.equal(start.searchParams.get('code_challenge_method'),'s256');
assert.match(start.searchParams.get('code_challenge'),/^[A-Za-z0-9_-]{43}$/);
assert.equal(start.searchParams.get('redirect_to'),base+'?memorial_oauth=1');
assert.match(JSON.parse(storages.get('hm-memorial-oauth-pkce-v1')).verifier,/^[A-Za-z0-9_-]{43}$/);

const callback=createPage(base+'?memorial_oauth=1&code=single-use-code');
await sleepTick();await sleepTick();
const exchange=recordings.find(r=>r.url.includes('grant_type=pkce'));
assert(exchange,'Code must be exchanged against Supabase Auth');
const params=JSON.parse(exchange.body);
assert.equal(params.auth_code,'single-use-code');
assert.match(params.code_verifier,/^[A-Za-z0-9_-]{43}$/);
assert.equal(callback.location.hash,'#apply');
assert.equal(callback.$('visitorLoginDialog').open,true);
assert.equal(callback.$('quickAccountEmail').textContent,'로그인됨 · guardian@example.com');
assert.equal(callback.$('linkGoogle').disabled,false);
assert(!callback.location.href.includes('code='));
assert(!storages.has('hm-memorial-oauth-pkce-v1'));

await callback.$('linkGoogle').fire('click');
assert.equal(callback.location.href,'https://accounts.example.org/linked');
const link=recordings.find(r=>r.url.includes('/user/identities/authorize'));
assert.equal(link.authorization,'Bearer mock-access');
assert.equal(new URL(link.url).searchParams.get('skip_http_redirect'),'true');

const linked=createPage(base+'?memorial_oauth=1&code=linking-code');
await sleepTick();await sleepTick();
assert.match(linked.$('quickLoginStatus').textContent,/연결되었습니다/);
assert.equal(JSON.parse(storages.get('hm-memorial-visitor-v1')).user.id,userId);

await linked.$('linkGoogle').fire('click');
tokenUser={...verifiedUser,id:'44c1ab00-bbbb-4000-8000-000000000099'};
const wrong=createPage(base+'?memorial_oauth=1&code=another-identity');
await sleepTick();await sleepTick();
assert.match(wrong.$('quickLoginStatus').textContent,/기존 회원과 다른 계정/);
assert.equal(JSON.parse(storages.get('hm-memorial-visitor-v1')).user.id,userId);
assert(!wrong.location.href.includes('another-identity'));

providers={google:false,kakao:false};
const unavailable=createPage(base);
await sleepTick();
assert.equal(unavailable.$('oauthKakao').disabled,true);
assert.equal(unavailable.$('oauthGoogle').disabled,true);
assert.match(unavailable.$('oauthAvailability').textContent,/설정이 아직 완료되지/);
storages.clear();
providers={google:true,kakao:true};
tokenUser={id:'44c1ab00-cccc-4000-8000-000000000003',email:null,email_confirmed_at:null};
const noEmailStart=createPage(base);
await sleepTick();
await noEmailStart.$('oauthKakao').fire('click');
const noEmailCallback=createPage(base+'?memorial_oauth=1&code=no-email-account');
await sleepTick();await sleepTick();
assert.match(noEmailCallback.$('visitorAuthStatus').textContent,/확인된 이메일이 없어/);
assert.equal(noEmailCallback.$('applicationForm').elements.contact_email.readOnly,false);
assert.match(noEmailCallback.$('quickLoginStatus').textContent,/이메일 로그인이나 고객지원/);
console.log('PASS social auth: provider availability, S256 PKCE, single-use exchange, safe account linking, UID guard, callback cleanup, missing-email handling.');
