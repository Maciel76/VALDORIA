import { bounds,directions,terrainHeight } from './terrain-data.js';
import { lakeIntake,waterDistance } from './hydrology.js';
import { LOT_SIZE,lotCenter,lotEdges,ownsLot,usesLots } from './lots.js';
import { fortificationLevel, isVillageWall } from '../core/fortifications.js';

const inset=4;
const cache=new WeakMap();
const lakeside=new WeakMap();
export const lakeGateId='comporta-lago';
const coord=value=>String(Math.round(value*4)).replace('-','n');
export const validWaterGateId=id=>typeof id==='string'&&
  (id===lakeGateId||/^comporta-[hv]-n?[0-9]{1,4}-n?[0-9]{1,4}$/.test(id));

function waterRuns(start,end,at,rotation,seed){
  const distance=along=>rotation ? waterDistance(at,along,seed) : waterDistance(along,at,seed);
  const runs=[];
  let a=start,from=distance(a),wet=from<0?start:null;
  while(a<end){
    const b=Math.min(end,a+.75),to=distance(b);
    if((from<0)!==(to<0)){
      const cross=a+(b-a)*from/(from-to);
      if(to<0)wet=cross;
      else{runs.push([wet,cross]);wet=null;}
    }
    a=b;from=to;
  }
  if(wet!==null)runs.push([wet,end]);
  return runs;
}

function waterGate(id,from,to,at,rotation){
  const center=(from+to)/2;
  return {id,type:'waterGate',span:to-from,x:rotation?at:center,z:rotation?center:at,rotation};
}

function lakeGate(state){
  let gate=lakeside.get(state);
  if(gate)return gate;
  const {x,z}=lakeIntake;
  const [[start,end]]=waterRuns(z-18,z+20,x,1,state.seed);
  gate=waterGate(lakeGateId,start-2,end+2,x,1);
  lakeside.set(state,gate);
  return gate;
}

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
  if(previous?.key===key&&previous.level===level&&previous.seed===state.seed)return previous.sections;

  const {west,east,north,south}=villagePerimeterBounds(state.territory);
  const gates=villageGatePositions(state.territory);
  const sections=[];
  const add=(id,type,x,z,rotation,span)=>sections.push({
    id:'per-wall-'+id,type,x,z,rotation,span,wallLevel:level
  });
  const side=(id,start,end,at,rotation,gate)=>{
    const landGate=gate===undefined?[]:[[gate-4,gate+4]];
    const wet=waterRuns(start,end,at,rotation,state.seed).map(([from,to])=>
      [Math.max(start,from-1.85),Math.min(end,to+1.85)]);
    const gaps=[...landGate,...wet].sort((a,b)=>a[0]-b[0]);
    const runs=[];
    let cursor=start;
    for(const [from,to] of gaps){
      if(from>cursor)runs.push([cursor,from]);
      cursor=Math.max(cursor,to);
    }
    if(cursor<end)runs.push([cursor,end]);
    for(const [from,to] of wet){
      const banks=runs.filter(([a,b])=>b===from||a===to).map(([a,b])=>{
        const half=(b-a)/Math.ceil((b-a)/4)/2;
        const along=b===from?b-half:a+half;
        return terrainHeight(rotation?at:along,rotation?along:at,state.seed,territory)+.04;
      });
      const wallBase=banks.length?Math.max(...banks):undefined;
      // A broad crossing uses several narrower openings with stone piers between them.
      const count=Math.ceil((to-from)/22);
      for(let i=0;i<count;i++){
        const a=from+(to-from)*i/count,b=from+(to-from)*(i+1)/count;
        if(b-a<3.8||landGate.some(([left,right])=>a<right&&b>left))continue;
        sections.push({...waterGate('comporta-'+(rotation?'v':'h')+'-'+coord(at)+'-'+coord((a+b)/2),a,b,at,rotation),wallLevel:level,wallBase});
      }
    }
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
    const borders=new Map();
    for(const {side:edge,x,z} of lotEdges(territory)){
      const vertical=edge==='east'||edge==='west';
      const at=(vertical?x+Number(edge==='east'):z+Number(edge==='south'))*LOT_SIZE;
      const id=`${edge}-${at}`;
      if(!borders.has(id))borders.set(id,{edge,at,vertical,cells:[]});
      borders.get(id).cells.push(vertical?z:x);
    }
    for(const [id,{edge,at,vertical,cells}] of borders){
      cells.sort((a,b)=>a-b);
      for(let i=0;i<cells.length;){
        const first=cells[i++];
        let last=first;
        while(cells[i]===last+1)last=cells[i++];
        const start=first*LOT_SIZE,end=(last+1)*LOT_SIZE;
        const entrance=edge==='south'&&at===gate.z&&gate.x>start&&gate.x<end?gate.x:undefined;
        side(`${id}-${first}`,start,end,at,vertical?1:0,entrance);
      }
    }
    cache.set(state,{key,level,seed:state.seed,sections});
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
  cache.set(state,{key,level,seed:state.seed,sections});
  return sections;
}

export function waterGates(state) {
  const closed=new Set(state.closedWaterGates);
  const crossings=villageWallSections(state).filter(object=>object.type==='waterGate');
  const intake=lakeGate(state);
  const overlap=crossings.findIndex(gate=>Math.hypot(gate.x-intake.x,gate.z-intake.z)<4);
  const wall=state.objects.find(isVillageWall);
  if(overlap<0)crossings.push({...intake,wallLevel:wall?fortificationLevel(wall):undefined});
  else crossings[overlap]={...crossings[overlap],id:lakeGateId};
  return crossings.map(gate=>({...gate,open:!closed.has(gate.id)}));
}

export function worldObjects(state) {
  return [...state.objects.filter(object=>!isVillageWall(object)),
    ...villageWallSections(state).filter(object=>object.type!=='waterGate'),...waterGates(state)];
}
