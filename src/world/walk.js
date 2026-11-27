import { inWater, terrainBounds } from './terrain-data.js';
import { catalogue } from '../core/catalog.js';
import { bridges } from '../core/water-structures.js';
import { beds, buildingFoundation, containsPoint, footprint, hasFoundation, maxFoundationSlopeRun,
  supportHeight, gates, straightWalls } from '../core/geometry.js';
export { bounds } from './terrain-data.js';
const empty=[];
const cellKey=(x,z)=>Math.floor(x/8)+','+Math.floor(z/8);

function addToCells(cells,object,padding) {
  const plot=footprint(object);
  for(let x=Math.floor((plot.x-plot.w/2-padding)/8);x<=Math.floor((plot.x+plot.w/2+padding)/8);x++){
    for(let z=Math.floor((plot.z-plot.d/2-padding)/8);z<=Math.floor((plot.z+plot.d/2+padding)/8);z++){
      const key=x+','+z;
      if(!cells.has(key))cells.set(key,[]);
      cells.get(key).push(object);
    }
  }
}

export const supportHeightWrapper = (x,z,state,height,surfaces) => supportHeight(
  x,z,surfaces?.get(x,z)??state.objects,state.seed,undefined,height,false,state.territory);

export class WalkSurfaces {
  cells=new Map();
  constructor(objects,seed,territory) {
    for(const object of objects){
      const padding=object.landscaped?(seed===undefined?maxFoundationSlopeRun:buildingFoundation(object,seed,territory).run)+2:0;
      if(catalogue[object.type].category==='roads'||beds.has(object.type)||hasFoundation(object)||
        straightWalls.has(object.type)||object.type==='steps')addToCells(this.cells,object,padding);
    }
  }

  get(x,z){return this.cells.get(cellKey(x,z))??empty;}
}

export class CollisionGrid {
  cells=new Map();
  constructor(objects) {
    for(const object of objects){
      if(catalogue[object.type].category==='roads' && !bridges.has(object.type))continue;
      addToCells(this.cells,object,1);
    }
  }
  get(x,z){return this.cells.get(cellKey(x,z))??empty;}
}

export function isOpenWater(state,x,z,surfaces,radius=0) {
  return inWater(x,z,state.seed) && !(surfaces?.get(x,z)??state.objects).some(object=>{
    if(!bridges.has(object.type)&&object.type!=='walkway')return false;
    const plot=footprint(object);
    return Math.abs(x-object.x)<plot.w/2-radius && Math.abs(z-object.z)<plot.d/2-radius;
  });
}

export function blockedAt(state,terrain,index,x,z,radius=.24,y,passable,surfaces,swimming=false) {
  const edge=terrainBounds(state.territory);
  if(x<edge.minX+radius||x>edge.maxX-radius||z<edge.minZ+radius||z>edge.maxZ-radius)return true;
  const nearby=index.get(x,z);
  if(!swimming && isOpenWater(state,x,z,surfaces,radius))return true;
  return terrain.isSolid(x,z,radius) || nearby.some(object=>{
    const item=gates.has(object.type)&&passable?{...object,open:passable(object)}:object;
    return containsPoint(item,x,z,radius,y,state.seed,state.territory,object);
  });
}

