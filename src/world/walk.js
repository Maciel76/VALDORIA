import { bounds, inWater } from './terrain-data.js';
import { catalogue } from '../core/catalog.js';
import { containsPoint, footprint, supportHeight, gates } from '../core/geometry.js';
export { bounds } from './terrain-data.js';
export const supportHeightWrapper = (x,z,state,height) => supportHeight(x,z,state.objects,state.seed,undefined,height,false,state.territory);

export class CollisionGrid {
  cells=new Map();
  constructor(objects) {
    for(const object of objects){
      if(catalogue[object.type].category==='roads' && object.type!=='bridge')continue;
      const plot=footprint(object);
      for(let x=Math.floor((plot.x-plot.w/2-1)/8);x<=Math.floor((plot.x+plot.w/2+1)/8);x++){
        for(let z=Math.floor((plot.z-plot.d/2-1)/8);z<=Math.floor((plot.z+plot.d/2+1)/8);z++){
          const key=x+','+z;
          if(!this.cells.has(key))this.cells.set(key,[]);
          this.cells.get(key).push(object);
        }
      }
    }
  }
  get(x,z){return this.cells.get(Math.floor(x/8)+','+Math.floor(z/8))||[];}
}

export function blockedAt(state,terrain,index,x,z,radius=.24,y,passable) {
  const edge=bounds(state.territory);
  if(x<edge.minX+radius || x>edge.maxX-radius || z<edge.minZ+radius || z>edge.maxZ-radius)return true;
  const nearby=index.get(x,z);
  if(inWater(x,z,state.seed) && !state.objects.some(o=>{
    if(o.type!=='bridge'&&o.type!=='walkway')return false;
    const plot=footprint(o);
    return Math.abs(x-o.x)<plot.w/2-radius && Math.abs(z-o.z)<plot.d/2-radius;
  }))return true;
  return terrain.isSolid(x,z,radius) || nearby.some(object=>{
    const item=gates.has(object.type)&&passable?{...object,open:passable(object)}:object;
    return containsPoint(item,x,z,radius,y,state.seed,state.territory);
  });
}

