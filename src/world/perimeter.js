import { bounds,directions } from './terrain-data.js';
import { fortificationLevel, isVillageWall } from '../core/fortifications.js';

const inset=4;
const cache=new WeakMap();
export { isPerimeterPiece } from '../core/fortifications.js';

export function villagePerimeterBounds(territory) {
  const {minX,maxX,minZ,maxZ}=bounds(territory);
  return {west:minX+inset,east:maxX-inset,north:minZ+inset,south:maxZ-inset};
}

export function onVillagePerimeter(x,z,territory,margin){
  const {west,east,north,south}=villagePerimeterBounds(territory);
  return (x>=west-margin&&x<=east+margin&&(Math.abs(z-north)<margin||Math.abs(z-south)<margin)) ||
    (z>=north-margin&&z<=south+margin&&(Math.abs(x-west)<margin||Math.abs(x-east)<margin));
}

export function villageGatePositions(territory) {
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
  const key=[...directions.map(direction=>state.territory[direction]),fortificationLevel(wall)].join(',');
  const previous=cache.get(state);
  if(previous?.key===key)return previous.sections;

  const {west,east,north,south}=villagePerimeterBounds(state.territory);
  const gates=villageGatePositions(state.territory);
  const sections=[];
  const add=(id,type,x,z,rotation,span)=>sections.push({
    id:'per-wall-'+id,type,x,z,rotation,span,wallLevel:fortificationLevel(wall)
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

  add('nw','squareTower',west,north,2,6);
  add('ne','squareTower',east,north,1,6);
  add('sw','squareTower',west,south,3,6);
  add('se','squareTower',east,south,0,6);
  side('north',west+3,east-3,north,0);
  side('south',west+3,east-3,south,0,gates['per-4'].x);
  side('east',north+3,south-3,east,1,gates['per-5'].z);
  side('west',north+3,south-3,west,1,gates['per-6'].z);
  cache.set(state,{key,sections});
  return sections;
}

export function worldObjects(state) {
  return [...state.objects.filter(object=>!isVillageWall(object)),...villageWallSections(state)];
}

export const starterPerimeterRoads=[
  [0,32],[1,34],[1,36],[1,38],[1,40],[1,42],[1,44],[1,46],
  ...[40,42,44,46,48,50].map(x=>[x,6]),
  ...[24,22,20,18,16,14,12,10].map(z=>[34,z]),[36,10],[36,8],
  ...[-44,-42,-40,-38,-36,-34,-32,-30,-28,-26,-24,-22,-20,-18,-16].map(x=>[x,26]),
  [-16,28],...[-14,-12,-10,-8,-6,-4,-2].map(x=>[x,28])
];
