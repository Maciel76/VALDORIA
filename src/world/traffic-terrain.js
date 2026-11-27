import { bridges } from '../core/water-structures.js';
import { footprint } from '../core/geometry.js';
import { inWater,riverX,riverWidth,terrainHeight,visibleTerrainHeight,waterLevel } from './terrain-data.js';
import { isOpenWater,supportHeightWrapper } from './walk.js';
import { wheelLayout,towOffset } from '../models/citizens.js';

export function trafficHeight(state,surfaces,x,z) {
  const support=supportHeightWrapper(x,z,state,undefined,surfaces);
  return isOpenWater(state,x,z,surfaces)?support:Math.max(support,visibleTerrainHeight(x,z,state.seed,state.territory));
}

export function wheelContacts(x,z,heading) {
  const cos=Math.cos(heading),sin=Math.sin(heading);
  return wheelLayout.map(([,localX,axleZ])=>{
    const offset=towOffset+axleZ;
    return {x:x+localX*cos+offset*sin,z:z-localX*sin+offset*cos};
  });
}

export function wagonSurface(state,surfaces,x,z,heading) {
  const [fl,fr,rl,rr]=wheelContacts(x,z,heading).map(p=>trafficHeight(state,surfaces,p.x,p.z));
  return {
    y:(fl+fr+rl+rr)/4,
    pitch:Math.atan2((rl+rr-fl-fr)/2,1.49),
    roll:Math.atan2((fr+rr-fl-rl)/2,1.73)
  };
}

export function horseSurface(state,surfaces,x,z,heading) {
  const sin=Math.sin(heading),cos=Math.cos(heading);
  const front=trafficHeight(state,surfaces,x+sin*.68,z+cos*.68);
  const rear=trafficHeight(state,surfaces,x-sin*.68,z-cos*.68);
  return {pitch:Math.max(-.27,Math.min(.27,Math.atan2(rear-front,1.36))),roll:0};
}

export function swimmingDepth(state,surfaces,x,z) {
  return isOpenWater(state,x,z,surfaces)?Math.max(0,waterLevel-terrainHeight(x,z,state.seed,state.territory)):0;
}

// Find a short route from a road to a clear stretch of water and back.
export function findSwimmingCourse(state,surfaces,nodes,blocked) {
  const seed=state.seed;
  const roadside=nodes.filter(node=>node.road && !inWater(node.x,node.z,seed))
    .map(node=>({node,distance:Math.abs(node.x-riverX(node.z,seed))}))
    .filter(({distance})=>distance<31)
    .sort((a,b)=>a.distance-b.distance).slice(0,28).map(({node})=>node);
  const banks=[15,-7,24,-20,33,-37,45].map(z=>({id:'bank-'+z,x:riverX(z,seed)-riverWidth(z)*.56-3.0,z}));
  const crossings=state.objects.filter(object=>bridges.has(object.type)||object.type==='walkway').map(footprint);
  function clear(a,b){
    const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.55));
    for(let i=1;i<=steps;i++){
      const t=i/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
      if(blocked(x,z,.23,undefined,true))return false;
    }
    return true;
  }
  for(const node of [...roadside,...banks]){
    if(blocked(node.x,node.z,.23))continue;
    const side=Math.sign(node.x-riverX(node.z,seed));
    const z=node.z;
    const bank={x:riverX(z,seed)+side*(riverWidth(z)*.56+.8),z};
    const entry={x:riverX(z,seed)+side*riverWidth(z)*.24,z};
    if(!clear(node,bank)||!clear(bank,entry) || swimmingDepth(state,surfaces,entry.x,entry.z)<.7)continue;
    for(const direction of [1,-1]){
      const next=z+direction*8;
      const stretch={x:riverX(next,seed)+side*riverWidth(next)*.20,z:next};
      if(crossings.some(plot=>Math.abs(plot.z-(z+next)/2)<6+plot.d/2 &&
        Math.abs(plot.x-riverX(plot.z,seed))<riverWidth(plot.z)*.6+plot.w/2))continue;
      if(swimmingDepth(state,surfaces,stretch.x,stretch.z)<.7||!clear(entry,stretch))continue;
      return {start:node,path:[bank,entry,stretch,entry,bank,node]};
    }
  }
  return null;
}

