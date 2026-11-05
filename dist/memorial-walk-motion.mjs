import {LAST_STEP} from './memorial-journey-core.mjs';

export const WALK_SPEED=1.55; // Authored-path distance units / second.
export const LANE_SPEED=.34;
export const SHORE_SPEED=.58;
export const LANE_MIN=.21,LANE_MAX=.79;
export const limit=(value,min,max)=>Math.max(min,Math.min(max,Number.isFinite(value)?value:min));
const lerp=(a,b,t)=>a+(b-a)*t;

// Stage fractions traced against the actual 9:16 illustrations. Near is the
// entrance and far is the visible end of the paved walkway.
export const WALK_PATHS=Object.freeze({
  garden:{start:0,end:6,nearY:.90,farY:.615,nearX:.55,farX:.49,nearWidth:.66,farWidth:.15},
  trail:{start:6,end:11,nearY:.91,farY:.465,nearX:.50,farX:.88,nearWidth:.62,farWidth:.12},
  shore:{start:11,end:11,nearY:.88,farY:.735,nearX:.50,farX:.50,nearWidth:.66,farWidth:.40}
});

export function movementScene(distance){
  return distance>=LAST_STEP-.01?'shore':distance>=6?'trail':'garden';
}
export function movementSceneProgress(distance){
  const scene=movementScene(distance),path=WALK_PATHS[scene];
  return scene==='shore'?1:limit((distance-path.start)/(path.end-path.start),0,1);
}
export function pathPoint(scene,progress,lane=.5){
  const path=WALK_PATHS[scene];
  if(!path)throw new RangeError('Unknown memorial scene');
  const p=limit(progress,0,1),bend=p*p*(3-2*p);
  const center=lerp(path.nearX,path.farX,bend);
  const width=lerp(path.nearWidth,path.farWidth,Math.pow(p,.85));
  return {
    x:limit(center+(limit(lane,LANE_MIN,LANE_MAX)-.5)*width,0,1),
    y:lerp(path.nearY,path.farY,p),
    scale:lerp(1.02,.55,p)
  };
}
export function projectedWalkPosition(distance,lane){
  const scene=movementScene(distance);
  return pathPoint(scene,scene==='shore'?0:movementSceneProgress(distance),lane);
}
export function tapDestination(distance,lane,xFraction,yFraction){
  const scene=movementScene(distance),path=WALK_PATHS[scene];
  if(scene==='shore')return {distance:LAST_STEP,lane:limit(xFraction,LANE_MIN,LANE_MAX)};
  // A tap denotes a real point on this walkway, not arbitrary extra steps.
  const p=limit((path.nearY-yFraction)/(path.nearY-path.farY),0,1);
  const center=lerp(path.nearX,path.farX,p*p*(3-2*p));
  const width=lerp(path.nearWidth,path.farWidth,Math.pow(p,.85));
  const targetLane=limit(.5+(xFraction-center)/width,LANE_MIN,LANE_MAX);
  return {distance:lerp(path.start,path.end,p),lane:targetLane};
}
export function shoreTapDestination(xFraction,yFraction){
  const path=WALK_PATHS.shore;
  const depth=limit((path.nearY-yFraction)/(path.nearY-path.farY),0,1);
  const width=lerp(path.nearWidth,path.farWidth,depth);
  return {depth,lane:limit(.5+(xFraction-.5)/width,LANE_MIN,LANE_MAX)};
}
export function shorePoint(depth,lane){return pathPoint('shore',depth,lane);}

export function advancePose(pose,vector,deltaSeconds){
  const dt=limit(deltaSeconds,0,.06);
  const x=limit(vector.x,-1,1),y=limit(vector.y,-1,1);
  const length=Math.max(1,Math.hypot(x,y));
  return {
    distance:limit(pose.distance-y/length*WALK_SPEED*dt,0,LAST_STEP),
    lane:limit(pose.lane+x/length*LANE_SPEED*dt,LANE_MIN,LANE_MAX)
  };
}
export function advanceShorePose(pose,vector,deltaSeconds){
  const dt=limit(deltaSeconds,0,.06);
  const x=limit(vector.x,-1,1),y=limit(vector.y,-1,1);
  const length=Math.max(1,Math.hypot(x,y));
  return {
    depth:limit(pose.depth-y/length*SHORE_SPEED*dt,0,1),
    lane:limit(pose.lane+x/length*LANE_SPEED*dt,LANE_MIN,LANE_MAX)
  };
}
