export const LOT_SIZE=12;
const limit=15;
const initial=[];
const sides=[['north',0,-1],['east',1,0],['south',0,1],['west',-1,0]];
const key=(x,z)=>`${x},${z}`;
const coordinates=id=>id.split(',').map(Number);
const withinMap=(x,z)=>x>=-limit&&x<limit&&z>=-limit&&z<limit;
for(let z=-2;z<2;z++)for(let x=-2;x<2;x++)initial.push(key(x,z));

const cache=new WeakMap();
export const usesLots=territory=>Array.isArray(territory?.lots);

function lotData(territory){
  const {lots}=territory;
  let data=cache.get(lots);
  if(data)return data;
  const cells=new Set([...initial,...lots]);
  const edges=[],frontier=new Set();
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(const id of cells){
    const [x,z]=coordinates(id);
    minX=Math.min(minX,x*LOT_SIZE);maxX=Math.max(maxX,(x+1)*LOT_SIZE);
    minZ=Math.min(minZ,z*LOT_SIZE);maxZ=Math.max(maxZ,(z+1)*LOT_SIZE);
    for(const [side,dx,dz] of sides){
      const neighbor=key(x+dx,z+dz);
      if(cells.has(neighbor))continue;
      edges.push({id,side,x,z});
      if(withinMap(x+dx,z+dz))frontier.add(neighbor);
    }
  }
  data={cells,edges,frontier:[...frontier],bounds:{minX,maxX,minZ,maxZ}};
  cache.set(lots,data);
  return data;
}

export const lotBounds=territory=>lotData(territory).bounds;
export const lotEdges=territory=>lotData(territory).edges;
export const availableLots=territory=>lotData(territory).frontier;
export const lotAt=(x,z)=>key(Math.floor(x/LOT_SIZE),Math.floor(z/LOT_SIZE));
export const ownsLot=(territory,id)=>lotData(territory).cells.has(id);
export const lotCenter=cell=>(cell+.5)*LOT_SIZE;

export function lotRectangle(id){
  const [x,z]=coordinates(id);
  return {minX:x*LOT_SIZE,maxX:(x+1)*LOT_SIZE,minZ:z*LOT_SIZE,maxZ:(z+1)*LOT_SIZE};
}

export function ownsLotRectangle(territory,{minX,maxX,minZ,maxZ}){
  const {cells}=lotData(territory);
  const right=Math.max(Math.floor(minX/LOT_SIZE),Math.ceil(maxX/LOT_SIZE)-1);
  const bottom=Math.max(Math.floor(minZ/LOT_SIZE),Math.ceil(maxZ/LOT_SIZE)-1);
  for(let z=Math.floor(minZ/LOT_SIZE);z<=bottom;z++){
    for(let x=Math.floor(minX/LOT_SIZE);x<=right;x++)if(!cells.has(key(x,z)))return false;
  }
  return true;
}

export function validLots(lots){
  if(!Array.isArray(lots)||lots.length>(limit*2)**2-initial.length)return false;
  const owned=new Set(initial);
  for(const id of lots){
    if(typeof id!=='string'||! /^-?\d{1,2},-?\d{1,2}$/.test(id))return false;
    const [x,z]=coordinates(id);
    if(key(x,z)!==id||!withinMap(x,z)||owned.has(id)||!sides.some(([,dx,dz])=>owned.has(key(x+dx,z+dz))))return false;
    owned.add(id);
  }
  return true;
}
