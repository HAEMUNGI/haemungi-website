// HAEMUNGI World Passport. Private progress and plaque reward are managed only
// by this service-role Edge Function. Client stamps are never trusted for claims.
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';

const allowedOrigins=new Set(['https://haemungi.pages.dev','https://memorial.bsbktv.com','https://bsbktv.com']);
const stops=new Set(['home','videos','cards','daily','goods','room','about','today','creator','emoticons','playground','memorial','temple','christmas']);
const json=(data:unknown,status:number,origin:string)=>new Response(JSON.stringify(data),{
  status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
    'Access-Control-Allow-Origin':origin,Vary:'Origin'},
});
const digest=async(input:string,secret:string)=>{
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),
    {name:'HMAC',hash:'SHA-256'},false,['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(input)))].map(b=>b.toString(16).padStart(2,'0')).join('');
};
const invalid=()=>({error:'여권 정보를 확인하지 못했습니다. 새 여권을 발급받아주세요.'});

Deno.serve(async req=>{
  const origin=req.headers.get('origin')||'';
  if(!allowedOrigins.has(origin))return new Response('Forbidden',{status:403});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{
    'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Access-Control-Allow-Headers':'apikey, authorization, content-type',
    'Access-Control-Max-Age':'3600',Vary:'Origin',
  }});
  if(req.method!=='POST')return json({error:'요청 방식이 올바르지 않습니다.'},405,origin);
  if(Number(req.headers.get('content-length')||0)>4500)
    return json({error:'여권 요청 크기를 초과했습니다.'},413,origin);
  const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),url=Deno.env.get('SUPABASE_URL');
  if(!url||!secret)return json({error:'여권 서비스를 준비하고 있습니다.'},503,origin);
  const supabase=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  try{
    const body=await req.json();
    if(!body||typeof body!=='object'||Array.isArray(body))return json(invalid(),400,origin);
    const action=String(body.action||'');
    if(action==='create'){
      const rawIp=req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'';
      const ipDigest=rawIp?await digest('passport-ip:'+rawIp,secret):null;
      if(ipDigest){
        const since=new Date(Date.now()-86400000).toISOString();
        const {count,error:countError}=await supabase.from('hm_world_passports')
          .select('id',{count:'exact',head:true}).eq('ip_digest',ipDigest).gte('created_at',since);
        if(countError)throw countError;
        if((count||0)>=10)return json({error:'이 연결에서 오늘 발급할 수 있는 여권 수를 초과했습니다.'},429,origin);
      }
      const id=crypto.randomUUID(),token=crypto.randomUUID()+'-'+crypto.randomUUID();
      const secretDigest=await digest('passport:'+token,secret);
      const {error}=await supabase.from('hm_world_passports').insert({id,secret_digest:secretDigest,ip_digest:ipDigest});
      if(error)throw error;
      return json({id,token,stamps:{},claimed_slot:null},201,origin);
    }
    const id=String(body.id||''),token=String(body.token||'');
    if(!/^[0-9a-f-]{36}$/.test(id)||!/^[0-9a-f-]{36}-[0-9a-f-]{36}$/.test(token))
      return json(invalid(),401,origin);
    const secretDigest=await digest('passport:'+token,secret);
    if(action==='status'){
      const {data,error}=await supabase.from('hm_world_passports')
        .select('stamps,claimed_slot,claimed_at').eq('id',id).eq('secret_digest',secretDigest).maybeSingle();
      if(error)throw error;
      return data?json({stamps:data.stamps,claimed_slot:data.claimed_slot,claimed:!!data.claimed_at},200,origin):json(invalid(),401,origin);
    }
    if(action==='stamp'){
      const stop=String(body.stop||'');
      if(!stops.has(stop))return json({error:'방문 장소를 확인할 수 없습니다.'},400,origin);
      const {data,error}=await supabase.rpc('hm_world_passport_stamp',{p_id:id,p_digest:secretDigest,p_stop:stop});
      if(error){
        const known=/천천히|방문 도장|여권/.test(error.message||'');
        return json({error:known?error.message:'도장을 찍지 못했습니다. 잠시 후 다시 시도해주세요.'},known?429:400,origin);
      }
      return json({stamps:data},200,origin);
    }
    if(action==='claim'){
      const match=req.headers.get('authorization')?.match(/^Bearer\s+([^\s]+)$/i);
      if(!match)return json({error:'이메일 인증을 마친 계정으로 로그인해주세요.'},401,origin);
      const {data:{user},error:authError}=await supabase.auth.getUser(match[1]);
      if(authError||!user?.id||!user.email_confirmed_at)
        return json({error:'인증된 이메일 계정으로 다시 로그인해주세요.'},401,origin);
      if(body.consent!==true)return json({error:'안식관 공개 범위에 동의해 주세요.'},400,origin);
      const memorialId=String(body.memorial_id||'');
      if(!/^[0-9a-f-]{36}$/.test(memorialId))return json({error:'명패로 등록할 아이를 선택해주세요.'},400,origin);
      const {data,error}=await supabase.rpc('hm_world_passport_claim',{
        p_id:id,p_digest:secretDigest,p_user:user.id,p_memorial:memorialId,
      });
      if(error){
        const known=/여권|도장|이미|본인이|자리|명패|확인/.test(error.message||'');
        return json({error:known?error.message:'명패를 발급하지 못했습니다. 잠시 후 다시 시도해주세요.'},400,origin);
      }
      return json({claimed:true,slot:Number(data)},201,origin);
    }
    return json({error:'알 수 없는 여권 작업입니다.'},400,origin);
  }catch(err){
    console.warn('Passport request failed',err instanceof Error?err.name:'UnknownError');
    return json({error:'여권 서비스를 연결하지 못했습니다. 잠시 후 다시 시도해주세요.'},500,origin);
  }
});
