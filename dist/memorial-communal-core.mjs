export function cleanPetQuery(value){
  return String(value||'').trim().replace(/[^\p{L}\p{N} \-]/gu,'').slice(0,60);
}
export function formatRemaining(milliseconds){
  const seconds=Math.max(0,Math.ceil((Number(milliseconds)||0)/1000));
  return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
}
export function isRoomEligible(pet){
  return !!pet && typeof pet.id==='string' && pet.slot_index===null;
}
export function photoForPublicPet(row,projectUrl){
  const path=String(row?.photo_path||'');
  if(path==='approved/65123d76-a511-47cb-8125-7d4863eac0ab.jpg')return '/memorial/leo-tribute.jpg';
  const thumbnail=String(row?.thumbnail_path||'');
  if(/^thumbs\/[a-f0-9-]{36}\.webp$/.test(thumbnail))
    return projectUrl+'/storage/v1/object/public/hm-memorial-published/'+thumbnail;
  if(!/^approved\/[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$/.test(path))return '';
  return projectUrl+'/storage/v1/object/public/hm-memorial-published/'+path;
}
