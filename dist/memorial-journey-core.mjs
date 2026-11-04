// Scene progression is purely client-side; no private memorial records are stored here.
export const LAST_STEP=11;
export const PUBLIC_STAR_PAGE_SIZE=18;
export function clampStep(value){return Math.max(0,Math.min(LAST_STEP,Math.round(Number(value)||0)));}
export function sceneForStep(value){const step=clampStep(value);return step<6?'garden':step<11?'trail':'shore';}
export function sceneProgress(value){const step=clampStep(value),scene=sceneForStep(step);
  return scene==='garden'?step/6:scene==='trail'?(step-6)/5:1;
}
export function relayYForStep(value){return .93-(clampStep(value)/LAST_STEP)*.36;}
export function sceneForRelayY(value){if(!Number.isFinite(value))return null;
  const step=Math.round((.93-value)/.36*LAST_STEP);return sceneForStep(step);
}
export function cleanPublicStar(row){
  if(!row || !/^[0-9a-f-]{36}$/i.test(row.id||''))return null;
  const name=typeof row.pet_name==='string'?row.pet_name.trim():'';
  if(!name || name.length>40)return null;
  return {id:row.id,name,published_at:row.published_at};
}
export function starPosition(row,index){
  // Stable, sparse placement on the open section of the shore sky.
  let hash=2166136261;
  for(const c of String(row.id))hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
  const col=index%3,band=Math.floor(index/3)%6;
  const drift=(hash%21-10)/10;
  return {x:13+col*25+drift*4,y:12+band*6.3+(hash%5)};
}
export function publicStarsUrl(api,cursor){
  const url=new URL(api+'/rest/v1/hm_memorial_public');
  url.searchParams.set('select','id,pet_name,published_at');
  url.searchParams.set('order','published_at.desc,id.desc');
  url.searchParams.set('limit',String(PUBLIC_STAR_PAGE_SIZE+1));
  if(cursor && /^\d{4}-\d\d-\d\dT/.test(cursor.published_at||'') && /^[0-9a-f-]{36}$/i.test(cursor.id||'')){
    url.searchParams.set('or','(published_at.lt.'+cursor.published_at+
      ',and(published_at.eq.'+cursor.published_at+',id.lt.'+cursor.id+'))');
  }
  return url.href;
}
