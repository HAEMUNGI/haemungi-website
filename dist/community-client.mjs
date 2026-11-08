import {SESSION_KEY,TERMS_VERSION,cleanNickname} from './community-core.mjs';

const cfg=window.HAEMUNGI_CONTENT_CONFIG||{};
const API=cfg.projectUrl||'',KEY=cfg.publishableKey||'';
const configured=/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(API)&&/^sb_publishable_[\w-]+$/.test(KEY);
let session=null,refreshing=null;
export function getSession(){return session;}
export function getUserId(){return session?.user?.id||null;}
export function hasAccount(){return Boolean(session?.access_token&&session?.user?.email_confirmed_at);}
export function readSession(){
  try{
    const stored=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');
    session=stored?.access_token&&stored?.user?.email_confirmed_at?stored:null;
  }catch{session=null;}
  return session;
}
function persist(){
  if(session)sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));
  else sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event('haemungi:visitor'));
}
async function json(url,options={},timeout=11000){
  if(!configured)throw new Error('데이터 연결을 확인해주세요.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const response=await fetch(url,{...options,signal:controller.signal,cache:'no-store'});
    const raw=await response.text();
    let data;try{data=raw?JSON.parse(raw):null;}catch{data=null;}
    if(!response.ok){
      const error=new Error(data?.message||data?.msg||data?.error_description||data?.error||
        (response.status===401?'로그인이 만료되었습니다. 다시 로그인해주세요.':'서버 요청 오류 '+response.status));
      error.code=data?.code;
      throw error;
    }
    return data;
  }catch(err){
    if(err?.name==='AbortError')throw new Error('연결 시간이 초과되었습니다. 다시 시도해주세요.');
    throw err;
  }finally{clearTimeout(timer);}
}
export async function token(){
  if(!hasAccount())throw new Error('이메일 인증 계정으로 로그인해주세요.');
  if(session.expires_at>Date.now()/1000+90)return session.access_token;
  if(!session.refresh_token)throw new Error('로그인 시간이 끝났습니다. 다시 로그인해주세요.');
  if(!refreshing)refreshing=(async()=>{
    try{
      const next=await json(API+'/auth/v1/token?grant_type=refresh_token',{
        method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},
        body:JSON.stringify({refresh_token:session.refresh_token})
      });
      session={...next,user:next.user||session.user,expires_at:Math.floor(Date.now()/1000)+(next.expires_in||3600)};
      persist();
      return session.access_token;
    }catch(err){session=null;persist();throw err;}
    finally{refreshing=null;}
  })();
  return refreshing;
}
export async function signIn(email,password){
  const data=await json(API+'/auth/v1/token?grant_type=password',{
    method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},
    body:JSON.stringify({email,password})
  });
  if(!data.access_token||!data.user?.email_confirmed_at)throw new Error('확인 메일의 인증을 먼저 완료해주세요.');
  session={...data,expires_at:Math.floor(Date.now()/1000)+(data.expires_in||3600)};
  persist();return session;
}
export async function signUp(email,password){
  return json(API+'/auth/v1/signup?redirect_to='+encodeURIComponent(location.origin+'/community.html'),{
    method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},
    body:JSON.stringify({email,password})
  });
}
export async function signOut(){
  const jwt=session?.access_token;
  session=null;persist();
  if(jwt)try{await json(API+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+jwt}});}catch{}
}
export async function rest(table,query={},options={}){
  const params=new URLSearchParams(query);
  const method=options.method||'GET';
  const jwt=options.auth||method!=='GET'?await token():(hasAccount()?await token().catch(()=>null):null);
  const headers={apikey:KEY,Accept:'application/json',...jwt?{Authorization:'Bearer '+jwt}:{},
    ...(method!=='GET'?{'Content-Type':'application/json',Prefer:options.returnRepresentation?'return=representation':'return=minimal'}:{})};
  const url=API+'/rest/v1/'+table+(params.size?'?'+params:'');
  return json(url,{method,headers,...options.body!==undefined?{body:JSON.stringify(options.body)}:{}});
}
export async function getProfile(){
  if(!hasAccount())return null;
  const users=await rest('hm_community_profiles',{select:'user_id,nickname,avatar_gender,terms_version,terms_accepted_at',user_id:'eq.'+getUserId(),limit:1},{auth:true});
  return Array.isArray(users)?users[0]||null:null;
}
export async function saveProfile(nickname,avatar_gender,existing=false){
  const clean=cleanNickname(nickname);
  if(!clean)throw new Error('닉네임은 2~14자로 입력해주세요.');
  if(!['male','female'].includes(avatar_gender))throw new Error('아바타를 선택해주세요.');
  const user_id=getUserId();
  if(!user_id)throw new Error('먼저 로그인해주세요.');
  const body=existing?{nickname:clean,avatar_gender}:{user_id,nickname:clean,avatar_gender,terms_version:TERMS_VERSION};
  const result=await rest('hm_community_profiles',existing?{user_id:'eq.'+user_id}:{},{method:existing?'PATCH':'POST',body,returnRepresentation:true});
  return result?.[0]||{user_id,nickname:clean,avatar_gender};
}
export async function adminStatus(){
  if(!hasAccount())return false;
  const rows=await rest('hm_admins',{select:'user_id',user_id:'eq.'+getUserId(),limit:1},{auth:true});
  return Array.isArray(rows)&&rows.length>0;
}
export async function report(target_kind,target_id,reason){
  return rest('hm_community_reports',{},{
    method:'POST',body:{reporter_id:getUserId(),target_kind,target_id,reason:String(reason||'').trim().slice(0,300)}
  });
}
readSession();
