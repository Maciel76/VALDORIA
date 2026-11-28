import { catalogue,terrainPaving } from './catalog.js';
import { isPerimeterPiece,isVillageWall } from './fortifications.js';
import { buildingLevel } from './building-levels.js';
import farmLayouts from './farm-layouts.json' with {type:'json'};
import marketLayouts from './market-layouts.json' with {type:'json'};
import sanctuaryLayouts from './sanctuary-layouts.json' with {type:'json'};
import { bridges,riverBridgeDeck,riverBridgeLength,sluiceHinge,sluicePlane } from './water-structures.js';
import { onVillagePerimeter,worldObjects } from '../world/perimeter.js';
import { BAND, bounds, directions, inWater, landHeight, landHeightRange, ownedLandscapeCell, ownsRectangle,terrainHeight, waterDistance, waterLevel } from '../world/terrain-data.js';
import { usesLots } from '../world/lots.js';

const halfTurn = Math.PI / 2;
export const angleOf = rotation => rotation * halfTurn;
export const gridRound = (value,step) => Math.round(value / step) * step;
export const fixedRotation = value => ((value % 4) + 4) % 4;
const box = (x,z,w,d) => ({x,z,w,d});
const farmColliders=farmLayouts.map(layout=>layout.map(([x,z,w,d])=>box(x,z,w,d)));
const marketColliders=marketLayouts.map(layout=>layout.map(([x,z,w,d])=>box(x,z,w,d)));
const sanctuaries=Object.fromEntries(Object.entries(sanctuaryLayouts).map(([type,levels])=>
  [type,levels.map(({w,d,solids})=>({w,d,colliders:solids.map(([x,z,w,d])=>box(x,z,w,d))}))]));
const sanctuaryLayout = object => sanctuaries[object.type]?.[buildingLevel(object)-1];

export const castleWalls = [
  box(-15,0,2,29), box(15,0,2,29), box(0,-14.5,30,2),
  box(-8.4,12,12,2), box(8.4,12,12,2)
];
export const hallWalls = [
  box(-6,-6,1,10), box(6,-6,1,10), box(0,-10.5,12,1),
  box(-4,-1.5,4,1), box(4,-1.5,4,1)
];
export const castleTowers = [[-14,-13.5],[14,-13.5],[-14,11],[14,11]];
export const stockadeWalls = [
  box(-15,0,.74,22.2), box(15,0,.74,22.2), box(0,-13.5,25.2,.74),
  box(-7.47,13.5,10.24,.74), box(7.47,13.5,10.24,.74),
  ...[-1,1].flatMap(x=>[-1,1].flatMap(z=>[.5,1.35,2.15].map(offset=>box(x*(12.6+offset),z*(13.5-offset),.89,.89))))
];
export const stockadeHall = [box(-11.45,-4.1,.27,7.5),box(-1.55,-4.1,.27,7.5),box(-6.5,-7.8,10,.27),
  box(-9.5,-.4,3.92,.31),box(-3.5,-.4,3.92,.31)];
const stoneCastleTowers=[-13,13].flatMap(x=>[-11.5,11.5].map(z=>[x,z]));
const roundCastleLevels=new Set([6,7,9]);
const palaceWings=[box(-4.98,-11.1,2.58,3.80),box(4.98,-11.1,2.58,3.80)];
const lookoutPosts=[5.14,9.66].flatMap(x=>[-9.12,-4.68].map(z=>box(x,z,.85,.85)));
const imperialPalace=[
  box(0,-13.86,26.9,.66),box(0,-5.12,7.55,15.1),box(0,2.55,5.27,2.58),
  ...[-1,1].flatMap(side=>[
    box(side*14.20,-2.56,.76,23.35),box(side*13.18,6.73,3.68,3.68),box(side*13.20,-12.50,3.14,3.14),
    box(side*11.98,-7.52,3.60,9.39),box(side*7.13,-11.65,6.48,2.61),box(side*10.23,-11.48,3.55,3.55),
    box(side*3.68,1.87,3.38,3.38),box(side*10.90,4.92,3.48,2.97),box(side*7.20,7.58,2.74,2.74),
    box(side*9.05,10.06,9.96,4.78),box(side*9.05,14.16,8.78,4.0),
    box(side*4.41,11.47,1.44,3.70),box(side*4.88,13.91,2.35,2.35),
    box(side*3.22,13.35,1.46,2.46),box(side*3.20,14.79,.36,4.42),
    ...[[4.66,5.3],[6.40,3.63],[12.62,5.7],[11.95,.86]].map(([x,z])=>box(side*x,z,.85,.85))
  ]),
  ...lookoutPosts
];
const imperialApproach=box(0,12.37,6.24,9.20);
const stockadeGate=object=>!object.open?[box(0,13.35,4.73,.39)]:
  [box(-2.39,12.25,.37,2.1),box(2.39,12.25,.37,2.1)];
export const gates = new Set(['keep','stockade','drawGate','woodGate','cityGate','waterGate']);
export const castleTypes = new Set(['keep','stockade']);
export const beds = new Set(['bedSquare','bedRect','bedRound','bedLong']);
export const trees = new Set(['oak','pine','cypress','willow','birch','apple','pear','cherry','shrub','deadTree']);
export const straightWalls = new Set(['wall','wallShort']);
export const modular = new Set([...straightWalls,'corner','squareTower','roundTower','woodGate','cityGate','drawGate','steps','lowWall','palisade']);

function localBoxes(object) {
  const item = catalogue[object.type];
  const {w,d,id,category} = item;
  switch (id) {
    case 'stockade': {
      const level=buildingLevel(object);
      if(level===10)return [...imperialPalace,...stockadeGate(object)];
      const towerWidth=roundCastleLevels.has(level)?3.61:2.59;
      return [...stockadeWalls,...stockadeHall,...lookoutPosts,
        ...(level>=3?[box(0,-10.52,7.42,4.65),...stoneCastleTowers.map(([x,z])=>box(x,z,towerWidth,towerWidth))]:
          [box(5.60,-.83,.52,.55),box(10,-1.82,1.15,1.08),
          box(-9.64,.72,1.55,.8),box(5.09,11.96,1.62,1)]),
        ...(level>=8?palaceWings:[]),
        box(0,3.55,level>=9?2.86:1.51,level>=9?2.86:1.51),
        ...stockadeGate(object)];
    }
    case 'keep':
      return [...castleWalls,...hallWalls,...castleTowers.map(([x,z])=>box(x,z,4,4)),
        box(-3.7,12,2.3,3.8),box(3.7,12,2.3,3.8),box(7.3,-9.1,4.55,4.55),
        ...(!object.open ? [box(0,12,5,1.1),box(0,15,4.6,1)] : [])];
    case 'wall':
    case 'wallShort':
      if(isPerimeterPiece(object))return [box(0,0,object.span??w,.98)];
      break;
    case 'squareTower':
      if(isPerimeterPiece(object))return [box(0,0,6,.98),box(0,0,.98,6),box(0,0,3,3)];
      break;
    case 'waterGate': {
      const scale=(object.span??w)/w;
      const piers=[box(-4.85*scale,0,2.3*scale,d),box(4.85*scale,0,2.3*scale,d)];
      const leaves=object.open?[-1,1].map(side=>
        box(side*sluiceHinge*scale,sluicePlane+sluiceHinge/2,.92*scale,sluiceHinge))
        : [box(0,sluicePlane,2*sluiceHinge*scale,.92)];
      return [...piers,...leaves];
    }
    case 'cityGate':
      return [box(-3,0,2,2.8),box(3,0,2,2.8),
        ...(!object.open ? [box(0,.18,4,.32)] : [box(-1.9,-.83,.27,1.95),box(1.9,-.83,.27,1.95)])];
    case 'drawGate':
    case 'woodGate': {
      const z = id === 'drawGate' ? -2.5 : 0;
      const side = id === 'drawGate' ? 2 : .8;
      return [box(-(w-side)/2,z,side,2),box((w-side)/2,z,side,2),
        ...(!object.open ? [box(0,z,w-2*side,1)] : [])];
    }
    case 'corner': return [box(0,-1,4,2),box(-1,1,2,2)];
    case 'bridge': return [box(-w/2+.12,0,.24,d), box(w/2-.12,0,.24,d)];
    case 'riverBridge': return [box(-w/2+.22,0,.42,d),box(w/2-.22,0,.42,d)];
    case 'farm': return farmColliders[buildingLevel(object)-1];
    case 'market': return marketColliders[buildingLevel(object)-1];
    case 'church':
    case 'chapel': return sanctuaryLayout(object).colliders;
    case 'abbey': return [box(-8,0,5,15),box(8,0,5,15),box(0,-6,12,5)];
    case 'manor': return [box(0,-2,8,7),box(-6,-1,4,8),box(6,-1,4,8)];
    case 'barracks': {
      const level=buildingLevel(object);
      const buildings=[box(0,-2.47,level>2?6.72:5.5,3.52)];
      if(level>=2)buildings.push(box(-4.99,-2.24,level>4?2.65:2.12,level>4?2.84:2.44));
      if(level>=3)buildings.push(box(4.99,-2.24,level>4?2.65:2.12,level>4?2.84:2.44));
      return [...buildings,box(-6.51,2.62,.22,4.96),box(6.51,2.62,.22,4.96)];
    }
    case 'arch': return [box(-w/2+.18,0,.36,.6),box(w/2-.18,0,.36,.6)];
    case 'steps':
    case 'villageWall': return [];
  }
  if (category === 'roads' || beds.has(id)) return [];
  return [box(0,0,w * (category==='decor' ? .88 : category==='housing' || category==='civic' || category==='trade' ? .86 : 1),
    d * (category==='decor' ? .85 : category==='housing' || category==='civic' || category==='trade' ? .84 : 1))];
}

// Quarter turns preserve axis alignment. Local z points toward the model entrance.
export function worldBoxes(object, rectangles = localBoxes(object)) {
  const turn = fixedRotation(object.rotation);
  const cos = [1,0,-1,0][turn], sin = [0,1,0,-1][turn];
  return rectangles.map(r => box(object.x+r.x*cos+r.z*sin, object.z-r.x*sin+r.z*cos,
    turn % 2 ? r.d : r.w, turn % 2 ? r.w : r.d));
}

export function plotDimensions(object){
  const {w,d}=sanctuaryLayout(object)??catalogue[object.type];
  return {w:object.span??w,d};
}

export const footprint = object => {
  const {w,d}=plotDimensions(object);
  return worldBoxes(object,[box(0,0,w,d)])[0];
};
export function ownsPlot(territory,{x,z,w,d}){
  return ownsRectangle(territory,{minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});
}

export function snapPlacement(item,{x,z},rotation){
  // A one-metre sidewalk spans two integer edges, so its narrow axis is centered on a half metre.
  const offset=item.sidewalkOf ? .5 : 0;
  const offsetX=rotation%2?0:offset,offsetZ=rotation%2?offset:0;
  return {x:gridRound(x-offsetX,item.grid)+offsetX,z:gridRound(z-offsetZ,item.grid)+offsetZ};
}
export const INITIAL_HOME_LIMIT=4;
const isDwelling = item => item.category==='housing' || item.id==='inn';
export const residentialCount=objects=>objects.filter(object=>isDwelling(catalogue[object.type])).length;
const overlaps = (a,b) => Math.abs(a.x-b.x) < (a.w+b.w)/2-.016 && Math.abs(a.z-b.z) < (a.d+b.d)/2-.016;
export const collidersOverlap = (first,second) => first.some(a=>second.some(b=>overlaps(a,b)));
const inside = (rect,x,z,r=0) => Math.abs(rect.x-x) < rect.w/2+r && Math.abs(rect.z-z) < rect.d/2+r;
const edgeDistance = (rect,x,z) => {
  const dx=Math.abs(x-rect.x)-rect.w/2, dz=Math.abs(z-rect.z)-rect.d/2;
  return Math.hypot(Math.max(0,dx),Math.max(0,dz))+Math.min(0,Math.max(dx,dz));
};
const smooth = amount => {
  const t=Math.min(1,Math.max(0,amount));
  return t*t*(3-2*t);
};

export function buildingImprovementObstructed(state,previous,next) {
  const before=worldBoxes(previous),after=worldBoxes(next),plot=footprint(next);
  return worldObjects(state).some(other=>{
    if(other.id===previous.id||!overlaps(plot,footprint(other)))return false;
    const rectangles=catalogue[other.type].category==='roads'&&!bridges.has(other.type)
      ? [box(other.x,other.z,.16,.16)] : worldBoxes(other);
    return collidersOverlap(after,rectangles)&&!collidersOverlap(before,rectangles);
  });
}

const foundationCategories = new Set(['housing','trade','civic','castle']);
const foundationCache = new WeakMap();
export const maxFoundationSlopeRun=15;
export const hasFoundation = object => foundationCategories.has(catalogue[object.type].category);

export function buildingFoundation(object,seed,territory) {
  if (!hasFoundation(object)) return null;
  const {type,x,z,rotation}=object;
  const level=buildingLevel(object);
  const land=territory?directions.map(key=>territory[key]).join(','):'';
  const cached=foundationCache.get(object);
  if(cached&&cached.seed===seed&&cached.land===land&&cached.type===type&&cached.level===level&&
    cached.x===x&&cached.z===z&&cached.rotation===rotation){
    return cached.foundation;
  }
  const dimensions=sanctuaryLayout(object)??catalogue[type];
  const w=dimensions.w*(type==='watermill'?.72:type==='windmill'?.6:1);
  const d=dimensions.d*(type==='watermill'?.82:type==='windmill'?.6:1);
  const [plot]=worldBoxes(object,[box(0,0,w,d)]);
  const {low,high}=landHeightRange(plot,seed,territory);
  const foundation={w,d,plot,base:high+.04,top:high+.025,bottom:low-.12,visible:high-low>.10,
    run:Math.max(2.5,Math.min(maxFoundationSlopeRun,(high-low)*2.65))};
  foundationCache.set(object,{seed,land,type,level,x,z,rotation,foundation});
  return foundation;
}

export function foundationSlopeTarget(state,point,id) {
  const {objects,seed,territory}=state;
  const hit=id&&objects.find(object=>object.id===id);
  if(hit&&hasFoundation(hit))return hit;
  let nearest=null,distance=3.5;
  for(const object of objects){
    const foundation=buildingFoundation(object,seed,territory);
    if(!foundation)continue;
    const edge=Math.abs(edgeDistance(foundation.plot,point.x,point.z));
    if(edge<distance){nearest=object;distance=edge;}
  }
  return nearest;
}

export function foundationSlopeError(object,seed,territory) {
  if(!object||!hasFoundation(object))return 'Clique no pé de uma construção com base elevada.';
  if(object.landscaped)return 'Esta base já tem um talude natural.';
  if(!buildingFoundation(object,seed,territory).visible)return 'A base já está junto ao terreno.';
  return '';
}

export function foundationSlopeHeight(foundation,x,z,seed,territory,ground) {
  const distance=edgeDistance(foundation.plot,x,z);
  if(distance>=foundation.run)return ground;
  const rise=foundation.top-ground;
  if(rise<=0)return ground;
  if(distance<=0)return foundation.top;
  const riverbank=smooth((waterDistance(x,z,seed)-.85)/1.35);
  // Fade over the last metre of owned land, including corners of purchased lots.
  const insideLand = inset => !territory||ownsRectangle(territory,{minX:x-inset,maxX:x+inset,minZ:z-inset,maxZ:z+inset});
  if(!riverbank||!insideLand(0))return ground;
  let land=1;
  if(!insideLand(land)){
    let low=0,high=1;
    for(let step=0;step<5;step++){
      const middle=(low+high)/2;
      if(insideLand(middle))low=middle;
      else high=middle;
    }
    land=smooth(low);
  }
  return ground+rise*(1-smooth(distance/foundation.run))*riverbank*land;
}

export function gradedLandHeight(x,z,objects,seed,territory,ground=landHeight(x,z,seed,territory)) {
  let height=ground;
  for(const object of objects){
    if(!object.landscaped)continue;
    const foundation=buildingFoundation(object,seed,territory);
    if(foundation?.visible)height=Math.max(height,foundationSlopeHeight(foundation,x,z,seed,territory,ground));
  }
  return height;
}

export function sidewalkTread(object,index,objects,seed,territory){
  const {w,d,treads}=catalogue[object.type], depth=d/treads;
  const [plot]=worldBoxes(object,[box(0,(index+.5)*depth-d/2,w,depth)]);
  const crossed=object.rotation%2;
  let low=Infinity,high=-Infinity;
  for(let across=-2;across<=2;across++)for(let along=-1;along<=1;along++){
    const x=plot.x+(crossed?along*depth/2:across*w/4);
    const z=plot.z+(crossed?across*w/4:along*depth/2);
    const ground=gradedLandHeight(x,z,objects,seed,territory);
    low=Math.min(low,ground);high=Math.max(high,ground);
  }
  return {...plot,bottom:low-.06,top:high+.14};
}

function sidewalkStepHeight(object,x,z,objects,seed,territory){
  const {d,treads}=catalogue[object.type], turn=angleOf(object.rotation);
  const along=(x-object.x)*Math.sin(turn)+(z-object.z)*Math.cos(turn);
  const index=Math.max(0,Math.min(treads-1,Math.floor((along+d/2)*treads/d)));
  return sidewalkTread(object,index,objects,seed,territory).top;
}

function baseHeight(object,seed,territory) {
  if(object.type==='waterGate')return waterLevel+.15;
  if (hasFoundation(object)) return buildingFoundation(object,seed,territory).base;
  if (!bridges.has(object.type)) return terrainHeight(object.x,object.z,seed,territory) + .04;
  const end = angleOf(object.rotation);
  const approach=object.type==='riverBridge'?riverBridgeLength/2-.55:8;
  const x=Math.sin(end)*approach,z=Math.cos(end)*approach;
  const ground=object.type==='riverBridge'?landHeight:terrainHeight;
  return Math.max(waterLevel+.6,Math.min(ground(object.x-x,object.z-z,seed,territory),ground(object.x+x,object.z+z,seed,territory)));
}

export function supportHeight(x,z,objects,seed,exclude,maxY=Infinity,forPlacement=false,territory) {
  const ground=landHeight(x,z,seed,territory);
  const grading=gradedLandHeight(x,z,objects,seed,territory,ground);
  let height = grading<=maxY ? grading : ground;
  for (const object of objects) {
    if (object.id === exclude) continue;
    const item = catalogue[object.type];
    let surface;
    if (item.category === 'roads' && inside(footprint(object),x,z,.00001)) {
      surface = item.treads ? sidewalkStepHeight(object,x,z,objects,seed,territory) : terrainPaving.has(object.type) ? grading+.14 :
        baseHeight(object,seed,territory) + (object.type==='bridge' ? .24 : .10);
      if (bridges.has(object.type)) {
        const turn=angleOf(object.rotation);
        const localZ=(x-object.x)*Math.sin(turn)+(z-object.z)*Math.cos(turn);
        if(object.type==='riverBridge')surface+=riverBridgeDeck(localZ)-.10;
        else {
          const end=Math.max(0,(Math.abs(localZ)-6)/3);
          surface+=end*(height-surface);
        }
      }
    } else if (beds.has(object.type) && inside(footprint(object),x,z,-.18) &&
      (object.type !== 'bedRound' || Math.hypot(x-object.x,z-object.z)<1.33)) {
      surface = baseHeight(object,seed,territory) + .24;
    } else if (object.type === 'steps' && inside(footprint(object),x,z)) {
      const turn = angleOf(object.rotation);
      const localZ = (x-object.x)*Math.sin(turn)+(z-object.z)*Math.cos(turn);
      surface = baseHeight(object,seed,territory) + Math.max(0, Math.min(4.1,(3.5-localZ)*.59));
    } else if (object.type === 'stockade') {
      const base=baseHeight(object,seed,territory);
      const imperial=buildingLevel(object)===10;
      const [ramp,lookout,court,extra] = worldBoxes(object,[box(7.4,.64,1.79,9.92),box(7.4,-6.9,5.15,5.15),
        box(0,0,32.9,31.63),imperial?imperialApproach:box(-6.5,-3.9,9.9,7.4)]);
      const localZ=(x-object.x)*Math.sin(angleOf(object.rotation))+(z-object.z)*Math.cos(angleOf(object.rotation));
      if (inside(ramp,x,z)) surface=base+.21+Math.min(5.79,Math.max(0,5.6-localZ)*.584);
      else if (!forPlacement && inside(lookout,x,z) && maxY>=base+5.99) surface=base+6;
      else if (imperial && inside(extra,x,z)) {
        const rise=localZ>12.60
          ? Math.max(0,Math.min(7,Math.ceil((16.97-localZ)/.48)))*(.744/7)
          : Math.min(.744,(localZ-11.80)*.29+.744);
        surface=base+.216+Math.max(0,rise);
      }
      else if (!imperial && inside(extra,x,z)) surface=base+.30;
      else if (inside(court,x,z)) surface=base+.20;
    } else if (object.type === 'keep') {
      const base=baseHeight(object,seed,territory);
      const ramp = worldBoxes(object,[box(-11,-1,1.8,8)])[0];
      if (inside(ramp,x,z)) {
        const turn = angleOf(object.rotation);
        const localZ = (x-object.x)*Math.sin(turn)+(z-object.z)*Math.cos(turn);
        surface = base + Math.max(.10, Math.min(4.7,(3-localZ)*.5875));
      } else if (inside(footprint(object),x,z)) {
        const ramparts = worldBoxes(object,[box(-14.4,-.5,2.2,26),box(14.4,-.5,2.2,26),box(0,-14,26,2.3),box(-12.2,-5,3.1,1.6)]);
        if (!forPlacement && ramparts.some(rect=>inside(rect,x,z)) && maxY > base+4.5) {
          surface = base+4.7;
        } else {
          surface = base+.10;
        }
      }
    } else if (straightWalls.has(object.type) && !isPerimeterPiece(object) && !forPlacement && inside(footprint(object),x,z)) {
      surface = baseHeight(object,seed,territory)+4.05;
    }
    if((surface===undefined||surface>maxY)&&hasFoundation(object)){
      const foundation=buildingFoundation(object,seed,territory);
      if(foundation.visible&&inside(foundation.plot,x,z))surface=foundation.top;
    }
    if (surface !== undefined && surface <= maxY && (surface > height || castleTypes.has(object.type) && !inWater(x,z,seed))) height = surface;
  }
  return height;
}

export function objectHeight(object,objects,seed,territory) {
  const item = catalogue[object.type];
  if(item.treads)return sidewalkStepHeight(object,object.x,object.z,objects,seed,territory)-.10;
  if(terrainPaving.has(object.type))return gradedLandHeight(object.x,object.z,objects,seed,territory)+.04;
  if (item.category === 'roads' || beds.has(object.type) || !item.support) return baseHeight(object,seed,territory);
  return Math.max(baseHeight(object,seed,territory),supportHeight(object.x,object.z,objects,seed,object.id,Infinity,true,territory));
}

export function containsPoint(object,x,z,radius=.24,y=-Infinity,seed=0,territory,foundationObject=object) {
  const foundation=y>-Infinity?buildingFoundation(foundationObject,seed,territory):null;
  if(foundation?.visible&&foundation.top>y+.79&&inside(foundation.plot,x,z,radius))return true;
  const base = y > -Infinity && (castleTypes.has(object.type) || straightWalls.has(object.type))
    ? foundation?.base??baseHeight(object,seed,territory) : Infinity;
  if(object.type==='stockade' && y>base+5.03){
    const rails=worldBoxes(object,[box(4.825,-6.9,.24,5.15),box(9.975,-6.9,.24,5.15),box(7.4,-9.475,5.15,.24),
      box(5.66,-4.325,1.65,.23),box(9.14,-4.325,1.65,.23),box(6.50,.64,.11,9.92),box(8.3,.64,.11,9.92)]);
    return rails.some(rect=>inside(rect,x,z,radius));
  }
  const elevated = (object.type === 'keep' && y > base+4.55) ||
    (straightWalls.has(object.type) && !isPerimeterPiece(object) && y > base+3.95);
  const side = catalogue[object.type].d*.4;
  const walkBoxes = elevated ? (object.type === 'keep'
    ? worldBoxes(object,[box(-15.7,0,.32,29),box(15.7,0,.32,29),box(0,-14.9,30,.32),...hallWalls])
    : worldBoxes(object,[box(0,-side,catalogue[object.type].w,.24),box(0,side,catalogue[object.type].w,.24)]) ) : worldBoxes(object);
  return walkBoxes.some(rect => inside(rect,x,z,radius));
}

export const landscapeBlocked = 'Há vegetação ou rocha no local.';

export function* landscapeObstacles(state,claim) {
  if(usesLots(state.territory))return;
  const limit=bounds(state.territory);
  const enclosed=state.objects.some(isVillageWall);
  for (let cz=Math.floor((claim.z-claim.d/2-2)/BAND);cz<=Math.floor((claim.z+claim.d/2+2)/BAND);cz++) {
    for (let cx=Math.floor((claim.x-claim.w/2-2)/BAND);cx<=Math.floor((claim.x+claim.w/2+2)/BAND);cx++) {
      for (const point of ownedLandscapeCell(cx,cz,state.seed,limit)) {
        if (inside(claim,point.x,point.z,point.collider) && !state.removedLandscape?.includes(point.id) &&
            !(enclosed&&onVillagePerimeter(point.x,point.z,state.territory,point.collider+2.4))) yield point;
      }
    }
  }
}

export function checkPlacement(state, candidate, {ignore,player, staged=[]}={}) {
  const item = catalogue[candidate.type], claim = footprint(candidate);
  if(!ownsPlot(state.territory,claim))return 'Fora do território.';
  if(isDwelling(item)&&usesLots(state.territory)&&!state.territory.lots.length&&
      residentialCount([...state.objects.filter(object=>object.id!==ignore),...staged])>=INITIAL_HOME_LIMIT){
    return 'O território inicial comporta até 4 moradias. Compre um lote para construir mais.';
  }
  if(item.id==='riverBridge'){
    if(!inWater(candidate.x,candidate.z,state.seed))return 'Centralize a ponte sobre o rio.';
    const ends=worldBoxes(candidate,[-1,1].flatMap(side=>
      [-1,1].map(edge=>box(edge*(item.w/2-.25),side*(item.d/2-.55),0,0))));
    if(ends.some(({x,z})=>inWater(x,z,state.seed)))return 'Gire a ponte para apoiar as duas pontas nas margens.';
  }
  const allowedWater = bridges.has(item.id)||item.id==='watermill'||item.id==='walkway';
  if (!allowedWater && [-.45,0,.45].some(dx=>[-.45,0,.45].some(dz=>inWater(claim.x+claim.w*dx,claim.z+claim.d*dz,state.seed)))) {
    return 'Use uma ponte ou passarela sobre a água.';
  }
  const solid = gates.has(candidate.type) ? {...candidate,open:true} : candidate;
  const nextBoxes = worldBoxes(solid);
  if (player && (containsPoint(candidate,player.x,player.z,.47,player.y,state.seed,state.territory) ||
      (!item.support && !castleTypes.has(item.id) && inside(claim,player.x,player.z,.35)))) {
    return 'Afaste-se para construir.';
  }

  for (const object of [...worldObjects(state),...staged]) {
    if (ignore && object.id === ignore) continue;
    const other = catalogue[object.type];
    const junction = item.category==='roads' && other.category==='roads';
    if (junction) {
      if (candidate.x === object.x && candidate.z === object.z) return 'Já existe um piso aqui.';
      if((item.sidewalkOf||other.sidewalkOf)&&overlaps(claim,footprint(object)))return 'Já existe um piso aqui.';
      if (!bridges.has(item.id) && !bridges.has(other.id)) continue;
      if (!collidersOverlap(nextBoxes,worldBoxes(object))) continue;
    }
    const joined = modular.has(item.id) && modular.has(other.id);
    const decoration = item.support || other.support;
    const occupied = (joined || decoration) ?
      collidersOverlap(nextBoxes,worldBoxes(gates.has(other.id)?{...object,open:true}:object)) :
      overlaps(claim,footprint(object));
    const floorCovered = !nextBoxes.length && item.category === 'roads' &&
      worldBoxes(object).some(rect=>inside(rect,candidate.x,candidate.z));
    const gardenConflict = beds.has(item.id) && (beds.has(other.id) || (!trees.has(other.id) && other.category!=='roads')) &&
      worldBoxes(object).some(rect=>overlaps(claim,rect)) ||
      beds.has(item.id) && beds.has(other.id) && overlaps(claim,footprint(object));
    const treeOverBed = trees.has(item.id) && beds.has(other.id) && overlaps(claim,footprint(object));
    const tooNearBedEdge = treeOverBed && (!inside(footprint(object),candidate.x,candidate.z, -Math.max(item.w,item.d)/2) ||
      other.id==='bedRound' && Math.hypot(candidate.x-object.x,candidate.z-object.z) + item.w/2 > 1.34);
    if (occupied || floorCovered || gardenConflict || tooNearBedEdge) return 'A área está ocupada.';
  }

  return landscapeObstacles(state,claim).next().done ? '' : landscapeBlocked;
}

export function linePositions(item, from, to, rotation) {
  const axis = item.category==='walls' ? (rotation % 2 ? 'z':'x') :
    Math.abs(to.x-from.x)>=Math.abs(to.z-from.z) ? 'x':'z';
  const alongWidth = axis===(rotation%2?'z':'x');
  const length = item.category==='walls'||alongWidth ? item.w : item.d;
  const count = Math.min(120,Math.round(Math.abs(to[axis]-from[axis])/length)+1);
  const sign = Math.sign(to[axis]-from[axis]) || 1;
  return Array.from({length:count},(_,i)=>({...from,[axis]:from[axis]+sign*i*length,rotation}));
}

export function getLineCandidate(state, item, points, {moving,...options}={}) {
  const staged = [], failures = [];
  for (const point of points) {
    const candidate = {...moving,...point,type:item.id};
    const reason = checkPlacement(state,candidate,{...options,staged});
    failures.push(reason);
    if (!reason) staged.push(candidate);
  }
  return { staged, failures, total: points.length * item.price };
}

