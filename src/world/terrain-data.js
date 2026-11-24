export const BASE = 180;
export const BAND = 36;
export const LIMIT = 5;
export const directions = ['north', 'east', 'south', 'west'];
export const riverX = (z, seed) => 59 + Math.sin(z / 62 + seed % 11 * 0.15) * 16 + Math.sin(z / 22) * 3.8;
export const riverWidth = z => 11.5 + 2 * Math.cos(z / 33);
export const inWater = (x,z,seed) => Math.abs(x-riverX(z,seed)) < riverWidth(z) * .47;
export const waterLevel = -1.05;
export const terrainBaseLevel = -3.7;
export const terrainCellSize = 3;
export const riverSurfaceWidth = z => riverWidth(z)*.54;
export const bounds = territory => ({
  minX: -BASE - BAND * territory.west, maxX: BASE + BAND * territory.east,
  minZ: -BASE - BAND * territory.north, maxZ: BASE + BAND * territory.south
});

export function expansionBounds(territory,direction) {
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
  if (!territory) return 1;
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
  const distance = Math.abs(x - riverX(z,seed)) - riverWidth(z) * .47;
  const edge = Math.min(1, Math.max(0,(distance+2)/10));
  const relief = reliefScale(x,z,territory);
  if (relief === 0 && edge === 1) return 0;

  const heart = Math.max(0, Math.min(1,(Math.hypot(x * .9,z * .83)-39)/99));
  const rolling = (Math.sin((x + seed % 51) / 33) * 6.8 + Math.cos((z - seed % 37) / 31) * 5.5 +
    Math.sin((x + z) / 19) * 2.2 + Math.cos((z - x) / 62) * 4 + 6) * heart;
  const small = Math.sin(x / 13) * Math.cos(z / 21) * .34;
  return (-2.5 + Math.min(1, Math.max(0, distance / 7)) * .8) * (1-edge) + (rolling+small) * edge * relief;
}

export function visibleTerrainHeight(x,z,seed,territory) {
  const edge=bounds(territory);
  const px=Math.min(edge.maxX,Math.max(edge.minX,x));
  const pz=Math.min(edge.maxZ,Math.max(edge.minZ,z));
  const step=terrainCellSize;
  const x0=Math.floor(px/step)*step,z0=Math.floor(pz/step)*step;
  const u=(px-x0)/step,v=(pz-z0)/step;
  const h10=terrainHeight(x0+step,z0,seed,territory);
  const h01=terrainHeight(x0,z0+step,seed,territory);
  // Match the same triangle split as the PlaneGeometry used by the renderer.
  const land=u+v<=1
    ? terrainHeight(x0,z0,seed,territory)*(1-u-v)+h10*u+h01*v
    : terrainHeight(x0+step,z0+step,seed,territory)*(u+v-1)+h10*(1-v)+h01*(1-u);
  const water=Math.abs(px-riverX(pz,seed))<riverSurfaceWidth(pz)?waterLevel:-Infinity;
  return Math.max(terrainBaseLevel,land,water);
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

export function landscapeCell(cx,cz,seed) {
  const rng = random(seed + cx * 9941 + cz * 14971);
  const points = [];
  for (let i=0; i<44; i++) {
    const x = cx*BAND + rng()*BAND, z = cz*BAND + rng()*BAND;
    const chance = rng(), variation = rng(), yaw = rng()*Math.PI*2;
    const far = Math.hypot(x*.86,z);
    if (inWater(x,z,seed) || Math.abs(x-riverX(z,seed)) < 9) continue;
    if (far > 55 && chance < (far > 98 ? .61 : .25)) {
      const size = 0.65 + variation * 1.1;
      points.push({x,z,size,yaw,type:variation > .76 ? 'oak' : 'pine',collider:.32*size});
    } else if ((far > 36 && chance > .94) || (far > 48 && chance > .84)) {
      points.push({x,z,size:.35+variation*.9,yaw,type:'rock',collider:.37});
    }
  }
  return points;
}

export function ownedLandscapeCell(cx,cz,seed,edge) {
  const x=(cx+.5)*BAND,z=(cz+.5)*BAND;
  return insideTerritory(x,z,edge) && !outsideOriginalTerritory(x,z) ? landscapeCell(cx,cz,seed) : [];
}

