export const BOARD_NAMES=Object.freeze({free:'자유게시판',qna:'Q&A',notice:'공지',guide:'이용안내'});
export const AVATAR_FILES=Object.freeze({
  male:'/assets/avatars/felt-male-idle.webp',
  female:'/assets/avatars/felt-female-idle.webp'
});
export const TERMS_VERSION='2026-11-09';
export const SESSION_KEY='hm-memorial-visitor-v1';
export const PROFILE_KEY='haemungi-walk-identity-v1';
export const maxLength=(raw,count)=>Array.from(String(raw||'').normalize('NFC').trim()).slice(0,count).join('');
export function cleanNickname(raw){
  const name=maxLength(String(raw||'').replace(/[\u0000-\u001f\u007f<>]/g,'').replace(/\s+/g,' '),14);
  return name.length>=2?name:'';
}
export function displayDate(raw){
  const date=new Date(raw);
  return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(date):'';
}
export function safeBoard(raw){return Object.hasOwn(BOARD_NAMES,raw)?raw:'free';}
export function makeAvatar(gender,alt='아바타'){
  const img=document.createElement('img');
  img.className='cm-avatar';
  img.src=AVATAR_FILES[gender]||AVATAR_FILES.male;
  img.alt=alt;
  img.width=38;img.height=45;img.loading='lazy';
  return img;
}
export function readWalkIdentity(){
  try{
    const data=JSON.parse(localStorage.getItem(PROFILE_KEY)||'null');
    const nickname=cleanNickname(data?.nickname);
    return nickname&&AVATAR_FILES[data?.gender]?{nickname,avatar_gender:data.gender}:null;
  }catch{return null;}
}
