import {LAST_STEP} from './memorial-journey-core.mjs';

export const WALK_SPEED=1.55; // Scene-distance units per second at full deflection.
export const LANE_SPEED=.34; // Full path width fraction per second.
export function limit(value,min,max){return Math.max(min,Math.min(max,Number.isFinite(value)?value:min));}
export function advancePose(pose,vector,deltaSeconds){
  const dt=limit(deltaSeconds,0,.06);
  const x=limit(vector.x,-1,1),y=limit(vector.y,-1,1);
  const length=Math.max(1,Math.hypot(x,y));
  return {
    distance:limit(pose.distance-y/length*WALK_SPEED*dt,0,LAST_STEP),
    lane:limit(pose.lane+x/length*LANE_SPEED*dt,.21,.79)
  };
}
export function movementScene(distance){
  return distance>=LAST_STEP-.01?'shore':distance>=6?'trail':'garden';
}
export function movementSceneProgress(distance){
  const scene=movementScene(distance);
  return scene==='garden'?limit(distance/6,0,1):scene==='trail'?limit((distance-6)/5,0,1):1;
}
export function tapDestination(distance,lane,xFraction,yFraction){
  // Tapping the upper path walks forward; tapping below the avatar walks backward.
  // Taps on scenery always stay inside the authored walkway, never teleport.
  const targetLane=limit(xFraction,.21,.79);
  const amount=yFraction<.77?1.8:-1.25;
  return {distance:limit(distance+amount,0,LAST_STEP),lane:targetLane};
}
