// Public, immediate archive publication. Only this server-side function holds service access.
// Publishable key is NOT authorization: Origin validation, image checks and DB rate limits apply.
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';

const allowedOrigins = new Set([
  'https://haemungi.pages.dev',
  'https://memorial.bsbktv.com',
  'https://bsbktv.com',
]);
const te = new TextEncoder();
const maxImageBytes = 900_000;
const json = (data: Record<string, unknown>, status: number, origin: string) =>
  new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
  } });

async function fingerprint(text: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', te.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, te.encode(text)));
  return Array.from(signature, n => n.toString(16).padStart(2, '0')).join('');
}
function checkWebP(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 32 || bytes.byteLength > maxImageBytes) return false;
  const label = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (label(0) !== 'RIFF' || label(8) !== 'WEBP') return false;
  const size = (bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24)) >>> 0;
  if (size + 8 !== bytes.length) return false;
  const kind = label(12);
  if (!['VP8 ', 'VP8L', 'VP8X'].includes(kind)) return false;
  let width = 0, height = 0;
  if (kind === 'VP8X') {
    width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
  } else if (kind === 'VP8 ') {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return false;
    width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
    height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
  } else {
    if (bytes[20] !== 0x2f) return false;
    width = 1 + (((bytes[22] & 0x3f) << 8) | bytes[21]);
    height = 1 + (((bytes[24] & 0x0f) << 10) | (bytes[23] << 2) | (bytes[22] >>> 6));
  }
  return width >= 48 && width <= 1280 && height >= 48 && height <= 1280;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') || '';
  if (!allowedOrigins.has(origin)) return new Response('Forbidden', { status: 403 });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'apikey, content-type',
    'Access-Control-Max-Age': '3600',
    Vary: 'Origin',
  } });
  if (req.method !== 'POST') return json({ error: '등록 방법이 올바르지 않습니다.' }, 405, origin);
  if (!req.headers.get('content-type')?.startsWith('multipart/form-data'))
    return json({ error: '사진과 신청서를 함께 보내주세요.' }, 415, origin);
  if (Number(req.headers.get('content-length') || 0) > 1_050_000)
    return json({ error: '사진 크기 제한을 초과했습니다.' }, 413, origin);

  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const endpoint = Deno.env.get('SUPABASE_URL');
  if (!secret || !endpoint) return json({ error: '등록 서비스 설정을 확인 중입니다.' }, 503, origin);

  let uploaded: string | null = null;
  const supabase = createClient(endpoint, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    // Enforce request size even if a client omits Content-Length (chunked uploads).
    const reader=req.body?.getReader();
    if(!reader)return json({error:'사진과 신청서를 함께 보내주세요.'},400,origin);
    const chunks:Uint8Array[]=[];let length=0;
    for(;;){
      const {value,done}=await reader.read();if(done)break;
      length+=(value?.byteLength||0);
      if(length>1_050_000){await reader.cancel();return json({error:'사진 크기 제한을 초과했습니다.'},413,origin);}
      if(value)chunks.push(value);
    }
    const bounded=new Request(req.url,{method:'POST',headers:req.headers,body:new Blob(chunks)});
    const form = await bounded.formData();
    if (String(form.get('website') || '').trim()) return json({ error: '등록을 처리할 수 없습니다.' }, 400, origin);
    const name = String(form.get('pet_name') || '').trim();
    const story = String(form.get('story') || '').trim();
    const farewell = String(form.get('farewell') || '').trim();
    const email = String(form.get('contact_email') || '').trim().toLowerCase();
    const born = String(form.get('born_on') || '');
    const passed = String(form.get('passed_on') || '');
    const image = form.get('photo');
    if (name.length < 1 || name.length > 60 || story.length < 1 || story.length > 900 ||
      farewell.length > 500 || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
      (born && !/^\d{4}-\d{2}-\d{2}$/.test(born)) ||
      (passed && !/^\d{4}-\d{2}-\d{2}$/.test(passed)) ||
      (born && passed && born > passed) ||
      /https?:\/\/|www\./i.test(name + story + farewell) ||
      form.get('consent_declaration') !== 'true' ||
      !(image instanceof File) || image.type !== 'image/webp') {
      return json({ error: '이름·날짜·이야기·이메일·사진·공개 동의를 확인해주세요.' }, 400, origin);
    }
    const bytes = new Uint8Array(await image.arrayBuffer());
    if (!checkWebP(bytes))
      return json({ error: '사진은 1,280px 이하의 올바른 WebP 이미지여야 합니다.' }, 413, origin);

    // Supabase's gateway sets CF-Connecting-IP or X-Forwarded-For. No IP is stored raw.
    const rawIP = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unavailable';
    const ipDigest = await fingerprint('ip:' + rawIP, secret);
    const emailDigest = await fingerprint('email:' + email, secret);
    const id = crypto.randomUUID();
    uploaded = `approved/${id}.webp`;
    const storage = supabase.storage.from('hm-memorial-published');
    const { error: uploadError } = await storage.upload(uploaded, bytes, {
      contentType: 'image/webp', upsert: false, cacheControl: '3600',
    });
    if (uploadError) throw uploadError;

    const { error: publishError } = await supabase.rpc('hm_memorial_self_publish', {
      p_id: id, p_name: name, p_born: born || null, p_passed: passed || null,
      p_story: story, p_farewell: farewell, p_email: email, p_photo_path: uploaded,
      p_ip_digest: ipDigest, p_email_digest: emailDigest,
    });
    if (publishError) {
      await storage.remove([uploaded]);uploaded = null;
      const known=/짧은 시간|하루 공개 등록|등록 내용이 올바르지 않습니다/.test(publishError.message||'');
      return json({ error: known?publishError.message:'기록을 등록하지 못했습니다. 잠시 후 다시 시도해주세요.' }, known?429:400, origin);
    }
    // Retain minimal hashed rate-limit entries only as long as needed.
    const expiry=new Date(Date.now()-7*24*60*60*1000).toISOString();
    const {error:cleanupError}=await supabase.from('hm_memorial_self_publish_limits')
      .delete().lt('created_at',expiry);
    if(cleanupError)console.info('Rate cleanup deferred');
    uploaded = null;
    return json({ id, published: true, photoCount: 1 }, 201, origin);
  } catch (err) {
    if (uploaded) await supabase.storage.from('hm-memorial-published').remove([uploaded]);
    console.warn('Memorial public register failed', err instanceof Error ? err.name : 'UnknownError');
    return json({ error: '기록을 공개하지 못했습니다. 잠시 후 다시 시도해주세요.' }, 500, origin);
  }
});
