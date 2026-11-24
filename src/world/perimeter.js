import { bounds,directions } from './terrain-data.js';
import { LOT_SIZE,lotCenter,lotEdges,ownsLot,usesLots } from './lots.js';
import { fortificationLevel, isVillageWall } from '../core/fortifications.js';

const inset=4;
const cache=new WeakMap();
export { isPerimeterPiece } from '../core/fortifications.js';

export function villagePerimeterBounds(territory) {
  const {minX,maxX,minZ,maxZ}=bounds(territory);
  const margin=usesLots(territory)?0:inset;
  return {west:minX+margin,east:maxX-margin,north:minZ+margin,south:maxZ-margin};
}

export function onVillagePerimeter(x,z,territory,margin){
  const {west,east,north,south}=villagePerimeterBounds(territory);
  return (x>=west-margin&&x<=east+margin&&(Math.abs(z-north)<margin||Math.abs(z-south)<margin)) ||
    (z>=north-margin&&z<=south+margin&&(Math.abs(x-west)<margin||Math.abs(x-east)<margin));
}

export function villageGatePositions(territory) {
  if(usesLots(territory)){
    let row=1;
    while(ownsLot(territory,`0,${row+1}`))row++;
    return {'per-4':{x:lotCenter(0),z:(row+1)*LOT_SIZE,rotation:0}};
  }
  const {west,east,south}=villagePerimeterBounds(territory);
  return {
    'per-4':{x:1,z:south,rotation:0},
    'per-5':{x:east,z:6,rotation:1},
    'per-6':{x:west,z:26,rotation:3}
  };
}

export function villageWallSections(state) {
  const wall=state.objects.find(isVillageWall);
  if(!wall)return [];
  const territory=state.territory,lots=usesLots(territory);
  const key=lots?territory.lots:directions.map(direction=>territory[direction]).join(',');
  const level=fortificationLevel(wall);
  const previous=cache.get(state);
  if(previous?.key===key&&previous.level===level)return previous.sections;

  const {west,east,north,south}=villagePerimeterBounds(state.territory);
  const gates=villageGatePositions(state.territory);
  const sections=[];
  const add=(id,type,x,z,rotation,span)=>sections.push({
    id:'per-wall-'+id,type,x,z,rotation,span,wallLevel:level
  });
  const side=(id,start,end,at,rotation,gate)=>{
    const runs=gate===undefined?[[start,end]]:[[start,gate-4],[gate+4,end]];
    runs.forEach(([from,to],run)=>{
      const count=Math.ceil((to-from)/4);
      const span=(to-from)/count;
      for(let i=0;i<count;i++){
        const along=from+(i+.5)*span;
        add(id+'-'+run+'-'+i,'wall',rotation===0?along:at,rotation===0?at:along,rotation,span);
      }
    });
  };

  if(lots){
    const gate=gates['per-4'];
    for(const {id,side:edge,x,z} of lotEdges(territory)){
      const vertical=edge==='east'||edge==='west';
      const start=(vertical?z:x)*LOT_SIZE,end=start+LOT_SIZE;
      const at=(vertical?x+Number(edge==='east'):z+Number(edge==='south'))*LOT_SIZE;
      const entrance=edge==='south'&&at===gate.z&&gate.x>start&&gate.x<end?gate.x:undefined;
      side(`${id}-${edge}`,start,end,at,vertical?1:0,entrance);
    }
    cache.set(state,{key,level,sections});
    return sections;
  }

  add('nw','squareTower',west,north,2,6);
  add('ne','squareTower',east,north,1,6);
  add('sw','squareTower',west,south,3,6);
  add('se','squareTower',east,south,0,6);
  side('north',west+3,east-3,north,0);
  side('south',west+3,east-3,south,0,gates['per-4'].x);
  side('east',north+3,south-3,east,1,gates['per-5'].z);
  side('west',north+3,south-3,west,1,gates['per-6'].z);
  cache.set(state,{key,level,sections});
  return sections;
}

export function worldObjects(state) {
  return [...state.objects.filter(object=>!isVillageWall(object)),...villageWallSections(state)];
}
