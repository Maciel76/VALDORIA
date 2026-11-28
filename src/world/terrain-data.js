import { availableLots,lotBounds,lotRectangle,ownsLotRectangle,usesLots } from './lots.js';
import { lakeIntake,riverX,riverSurfaceWidth,waterDistance,waterLevel } from './hydrology.js';
export { inWater,riverX,riverWidth,riverSurfaceWidth,waterLevel,waterDistance,waterSurface } from './hydrology.js';

export const BASE = 180;
export const BAND = 36;
export const LIMIT = 5;
const landscapeSamples = 44;
const originalCellRadius = BASE / BAND;
export const MAX_NATURAL_OBSTACLES = (originalCellRadius * 2) ** 2 * landscapeSamples;
export const directions = ['north', 'east', 'south', 'west'];
export const terrainBaseLevel = -3.7;
export const terrainCellSize = 3;
export const sceneryBands = 3;
export const bounds = territory => usesLots(territory)?lotBounds(territory):({
  minX: -BASE - BAND * territory.west, maxX: BASE + BAND * territory.east,
  minZ: -BASE - BAND * territory.north, maxZ: BASE + BAND * territory.south
});
export const terrainBounds=territory=>usesLots(territory)?{minX:-BASE,maxX:BASE,minZ:-BASE,maxZ:BASE}:bounds(territory);

export function ownsRectangle(territory,rect){
  if(usesLots(territory))return ownsLotRectangle(territory,rect);
  const edge=bounds(territory);
  return rect.minX>=edge.minX&&rect.maxX<=edge.maxX&&rect.minZ>=edge.minZ&&rect.maxZ<=edge.maxZ;
}

export const expansionOptions=territory=>usesLots(territory)?availableLots(territory):directions.filter(side=>territory[side]<LIMIT);

export function expansionBounds(territory,direction) {
  if(usesLots(territory))return availableLots(territory).includes(direction)?lotRectangle(direction):null;
  const edge=bounds(territory);
  switch(direction){
    case 'north': return {...edge,minZ:edge.minZ-BAND,maxZ:edge.minZ};
    case 'east': return {...edge,minX:edge.maxX,maxX:edge.maxX+BAND};
    case 'south': return {...edge,minZ:edge.maxZ,maxZ:edge.maxZ+BAND};
    case 'west': return {...edge,minX:edge.minX-BAND,maxX:edge.minX};
    default: return null;
  }
}

export const insideTerritory = (x,z,edge) =>
  x>=edge.minX && x<=edge.maxX && z>=edge.minZ && z<=edge.maxZ;
export const outsideOriginalTerritory = (x,z) => Math.abs(x)>BASE || Math.abs(z)>BASE;

const transitionWidth = 12;

function reliefScale(x,z,territory) {
  if (!territory||usesLots(territory)) return 1;
  const {minX,maxX,minZ,maxZ}=bounds(territory);

  // Level the purchased land and blend back into the hills on both sides.
  const fromEdge = Math.max(
    territory.west ? -BASE-x : -Infinity,
    territory.east ? x-BASE : -Infinity,
    territory.north ? -BASE-z : -Infinity,
    territory.south ? z-BASE : -Infinity
  );
  const distance=Math.max(0,-fromEdge,minX-x,x-maxX,minZ-z,z-maxZ);
  const t = Math.min(1,distance/transitionWidth);
  return t*t*(3-2*t);
}

export function terrainHeight(x,z,seed,territory) {
  const distance = waterDistance(x,z,seed);
  const t = Math.min(1, Math.max(0,(distance+1)/9));
  const edge = t*t*(3-2*t);
  const bed = -2.5+.8*Math.min(1,Math.max(0,distance/7))-.9*Math.min(1,Math.max(0,-distance/12));
  const relief = reliefScale(x,z,territory);
  if (relief === 0 && edge === 1) return 0;

  const heart = Math.max(0, Math.min(1,(Math.hypot(x * .9,z * .83)-39)/99));
  const rolling = (Math.sin((x + seed % 51) / 33) * 6.8 + Math.cos((z - seed % 37) / 31) * 5.5 +
    Math.sin((x + z) / 19) * 2.2 + Math.cos((z - x) / 62) * 4 + 6) * heart;
  const small = Math.sin(x / 13) * Math.cos(z / 21) * .34;
  return bed*(1-edge)+(rolling+small)*edge*relief;
}

export function sceneryFade(x,z,edge) {
  const distance=Math.max(edge.minX-x,x-edge.maxX,edge.minZ-z,z-edge.maxZ);
  const t=Math.max(0,Math.min(1,(distance-BAND)/((sceneryBands-1)*BAND)));
  return t*t*(3-2*t);
}

export function sceneryHeight(x,z,seed,territory,edge,fade=sceneryFade(x,z,edge)) {
  const height=terrainHeight(x,z,seed,territory);
  return height+(terrainBaseLevel-height)*fade;
}

function triangleHeight(x,z,heightAt) {
  const step=terrainCellSize;
  const x0=Math.floor(x/step)*step,z0=Math.floor(z/step)*step;
  const u=(x-x0)/step,v=(z-z0)/step;
  const h10=heightAt(x0+step,z0);
  const h01=heightAt(x0,z0+step);
  // Match the same triangle split as the PlaneGeometry used by the renderer.
  const land=u+v<=1
    ? heightAt(x0,z0)*(1-u-v)+h10*u+h01*v
    : heightAt(x0+step,z0+step)*(u+v-1)+h10*(1-v)+h01*(1-u);
  return Math.max(terrainBaseLevel,land);
}

export function landHeight(x,z,seed,territory) {
  return triangleHeight(x,z,(px,pz)=>terrainHeight(px,pz,seed,territory));
}

export function sceneryWaterDistance(x,z,seed,edge) {
  return waterDistance(x,z,seed)-.85+sceneryFade(x,z,edge)*(riverSurfaceWidth(z)+1);
}

export function visibleTerrainHeight(x,z,seed,territory) {
  const edge=terrainBounds(territory);
  const water=sceneryWaterDistance(x,z,seed,edge)<0?waterLevel:-Infinity;
  const ground=triangleHeight(x,z,(px,pz)=>sceneryHeight(px,pz,seed,territory,edge));
  return Math.max(ground,water);
}

export function landHeightRange({x,z,w,d},seed,territory) {
  const minX=x-w/2,maxX=x+w/2,minZ=z-d/2,maxZ=z+d/2;
  const step=terrainCellSize;
  const axis=(lo,hi)=>{
    const points=[lo,hi];
    for(let q=Math.ceil(lo/step)*step;q<hi;q+=step)if(q>lo)points.push(q);
    return points;
  };
  let low=Infinity,high=-Infinity;
  const sample=(px,pz)=>{
    const height=landHeight(px,pz,seed,territory);
    low=Math.min(low,height);high=Math.max(high,height);
  };
  const rows=axis(minZ,maxZ);
  for(const px of axis(minX,maxX))for(const pz of rows)sample(px,pz);
  // Extrema of the clipped terrain triangles can also lie where a diagonal meets the lot edge.
  for(const px of [minX,maxX])for(const sum of axis(px+minZ,px+maxZ))sample(px,sum-px);
  for(const pz of [minZ,maxZ])for(const sum of axis(pz+minX,pz+maxX))sample(sum-pz,pz);
  return {low,high};
}

export function random(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function landscapeCell(cx,cz,seed,includeFlooded=false) {
  const rng = random(seed + cx * 9941 + cz * 14971);
  const points = [];
  for (let i=0; i<landscapeSamples; i++) {
    const x = cx*BAND + rng()*BAND, z = cz*BAND + rng()*BAND;
    const chance = rng(), variation = rng(), yaw = rng()*Math.PI*2;
    const far = Math.hypot(x*.86,z);
    const sluiceApproach=Math.abs(x-lakeIntake.x)<7&&Math.abs(z-lakeIntake.z)<11;
    if (Math.abs(x-riverX(z,seed))<9 ||
        (!includeFlooded&&(sluiceApproach||waterDistance(x,z,seed)<1.55))) continue;
    const id=`${cx},${cz}:${i}`;
    if (far > 55 && chance < (far > 98 ? .61 : .25)) {
      const size = 0.65 + variation * 1.1;
      points.push({id,x,z,size,yaw,type:variation > .76 ? 'oak' : 'pine',collider:.32*size});
    } else if ((far > 36 && chance > .94) || (far > 48 && chance > .84)) {
      points.push({id,x,z,size:.35+variation*.9,yaw,type:'rock',collider:.37});
    }
  }
  return points;
}

export const landscapeCellKey = id => id.split(':',1)[0];

export function naturalObstacle(id,seed) {
  if (typeof id!=='string' || !/^-?\d,-?\d:\d{1,2}$/.test(id)) return null;
  const [cx,cz]=landscapeCellKey(id).split(',').map(Number);
  if ([cx,cz].some(value=>value < -originalCellRadius || value >= originalCellRadius)) return null;
  return landscapeCell(cx,cz,seed,true).find(point=>point.id===id) ?? null;
}

export function ownedLandscapeCell(cx,cz,seed,edge) {
  const x=(cx+.5)*BAND,z=(cz+.5)*BAND;
  return insideTerritory(x,z,edge) && !outsideOriginalTerritory(x,z) ? landscapeCell(cx,cz,seed) : [];
}

