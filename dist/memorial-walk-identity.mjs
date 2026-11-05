// A visitor's nickname stays on their own device. Only the existing anonymous
// numeric avatar tone is shared with nearby visitors in opt-in realtime mode.
export const WALK_IDENTITY_KEY='haemungi-walk-identity-v1';
export const MAX_WALK_NICKNAME=12;

export const FELT_AVATARS=Object.freeze({
  male:Object.freeze({
    idle:'/assets/avatars/felt-male-idle.webp',
    step:'/assets/avatars/felt-male-step.webp',
    tone:0
  }),
  female:Object.freeze({
    idle:'/assets/avatars/felt-female-idle.webp',
    step:'/assets/avatars/felt-female-step.webp',
    tone:1
  })
});

export function cleanWalkNickname(raw){
  if(typeof raw!=='string')return '';
  const cleaned=raw.normalize('NFC')
    .replace(/[\u0000-\u001f\u007f<>]/g,'')
    .replace(/\s+/g,' ').trim();
  return Array.from(cleaned).slice(0,MAX_WALK_NICKNAME).join('');
}

export function cleanWalkIdentity(raw){
  if(!raw||typeof raw!=='object'||!Object.hasOwn(FELT_AVATARS,raw.gender))return null;
  const nickname=cleanWalkNickname(raw.nickname);
  return nickname?{gender:raw.gender,nickname}:null;
}

// Older clients used tones 0..4 as robe colours. Their numerical IDs remain
// valid while newer clients render two human avatar silhouettes instead.
export function genderForTone(tone){return tone===1||tone===3?'female':'male';}
