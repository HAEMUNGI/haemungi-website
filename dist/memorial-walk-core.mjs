// Browser-agnostic, bounded state helpers for the opt-in memorial walk.
// No memorial records, user accounts, or photographs enter the realtime channel.
export const ROOM_COUNT = 8;
export const ROOM_CAP = 12;
export const VISIBLE_PEERS = ROOM_CAP - 1;
export const MOVE_INTERVAL_MS = 12000;
export const MIN_X = 0.12;
export const MAX_X = 0.88;
export const MIN_Y = 0.57;
export const MAX_Y = 0.93;
export const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
export function normalPosition(x, y) {
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {x:clamp(x,MIN_X,MAX_X), y:clamp(y,MIN_Y,MAX_Y)};
}
export function safeVisitor(id, meta) {
  if (!ID_PATTERN.test(id) || !meta || typeof meta !== 'object') return null;
  const pos = normalPosition(meta.x,meta.y);
  if (!pos || !Number.isInteger(meta.tone) || meta.tone < 0 || meta.tone > 4) return null;
  return {id,x:pos.x,y:pos.y,tone:meta.tone};
}
export function presenceSnapshot(payload) {
  const result = Object.create(null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return result;
  for (const [id,row] of Object.entries(payload).slice(0,64)) {
    const metas = Array.isArray(row?.metas) ? row.metas.slice(0,3) : [];
    const clean = metas.filter(meta => meta && typeof meta.phx_ref === 'string' && meta.phx_ref.length < 128);
    if (clean.length && ID_PATTERN.test(id)) result[id] = {metas:clean};
  }
  return result;
}
export function applyPresenceDiff(current, diff) {
  const next = Object.assign(Object.create(null),current);
  for (const [id,row] of Object.entries(diff?.joins||{}).slice(0,64)) {
    if (!ID_PATTERN.test(id) || !Array.isArray(row?.metas)) continue;
    const old = next[id]?.metas||[];
    const added = row.metas.filter(m => typeof m?.phx_ref === 'string' && m.phx_ref.length < 128);
    next[id]={metas:[...old.filter(m => !added.some(a => a.phx_ref===m.phx_ref)),...added].slice(0,3)};
  }
  for (const [id,row] of Object.entries(diff?.leaves||{}).slice(0,64)) {
    if (!next[id]) continue;
    const removed = new Set((row?.metas||[]).map(m => m?.phx_ref));
    const left = next[id].metas.filter(m => !removed.has(m.phx_ref));
    if (left.length) next[id]={metas:left}; else delete next[id];
  }
  return next;
}
export function activeVisitors(presence, selfId, at) {
  const result=[];
  for (const [id,row] of Object.entries(presence||{})) {
    if (id===selfId) continue;
    for (const meta of row.metas||[]) {
      const visitor=safeVisitor(id,meta);
      if (visitor) {result.push({...visitor,distance:Math.hypot(visitor.x-at.x,visitor.y-at.y)});break;}
    }
  }
  return result.sort((a,b)=>a.distance-b.distance).slice(0,VISIBLE_PEERS);
}
export function roomPlan(seed) {
  const start=((seed%ROOM_COUNT)+ROOM_COUNT)%ROOM_COUNT;
  return [start,(start+3)%ROOM_COUNT,(start+5)%ROOM_COUNT];
}
export function roomTopic(index) {
  if (!Number.isInteger(index) || index < 0 || index >= ROOM_COUNT) throw Error('Invalid room index');
  return 'realtime:hm-memorial-garden-v1-'+String(index+1).padStart(2,'0');
}
export function wireMessage(topic,event,payload,ref,joinRef) {
  return JSON.stringify({topic,event,payload,ref:String(ref),join_ref:joinRef===null?null:String(joinRef)});
}
