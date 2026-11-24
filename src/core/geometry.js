import { catalogue } from './catalog.js';
import { isPerimeterPiece,isVillageWall } from './fortifications.js';
import { onVillagePerimeter,worldObjects } from '../world/perimeter.js';
import { BAND, bounds, inWater, ownedLandscapeCell, terrainHeight, waterLevel } from '../world/terrain-data.js';

const halfTurn = Math.PI / 2;
export const angleOf = rotation => rotation * halfTurn;
export const gridRound = (value,step) => Math.round(value / step) * step;
export const fixedRotation = value => ((value % 4) + 4) % 4;
const box = (x,z,w,d) => ({x,z,w,d});

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
export const gates = new Set(['keep','stockade','drawGate','woodGate','cityGate']);
export const castleTypes = new Set(['keep','stockade']);
export const beds = new Set(['bedSquare','bedRect','bedRound','bedLong']);
export const trees = new Set(['oak','pine','cypress','willow','birch','apple','pear','cherry','shrub','deadTree']);
export const straightWalls = new Set(['wall','wallShort']);
export const modular = new Set([...straightWalls,'corner','squareTower','roundTower','woodGate','cityGate','drawGate','steps','lowWall','palisade']);

function localBoxes(object) {
  const item = catalogue[object.type];
  const {w,d,id,category} = item;
  switch (id) {
    case 'stockade':
      return [...stockadeWalls,...stockadeHall,
        ...[5.14,9.66].flatMap(x=>[-9.12,-4.68].map(z=>box(x,z,.85,.85))),
        box(0,3.55,1.51,1.51),box(5.60,-.83,.52,.55),box(10,-1.82,1.15,1.08),
        box(-9.64,.72,1.55,.8),box(5.09,11.96,1.62,1),
        ...(!object.open ? [box(0,13.35,4.73,.39)] : [box(-2.39,12.25,.37,2.1),box(2.39,12.25,.37,2.1)])];
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
    case 'farm': return [box(-5.5,-3.8,6,5),box(2.5,1.4,1.1,1.1),box(5.6,1.4,1.1,1.1),box(2.5,4.7,1.1,1.1),box(5.6,4.7,1.1,1.1)];
    case 'market': return [box(-4,-3,3.4,2.5),box(0,-3,3.4,2.5),box(4,-3,3.4,2.5)];
    case 'abbey': return [box(-8,0,5,15),box(8,0,5,15),box(0,-6,12,5)];
    case 'manor': return [box(0,-2,8,7),box(-6,-1,4,8),box(6,-1,4,8)];
    case 'barracks': return [box(0,-2,w-1,5)];
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

export const footprint = object => {
  const item = catalogue[object.type];
  return worldBoxes(object,[box(0,0,object.span??item.w,item.d)])[0];
};
const overlaps = (a,b) => Math.abs(a.x-b.x) < (a.w+b.w)/2-.016 && Math.abs(a.z-b.z) < (a.d+b.d)/2-.016;
export const collidersOverlap = (first,second) => first.some(a=>second.some(b=>overlaps(a,b)));
const inside = (rect,x,z,r=0) => Math.abs(rect.x-x) < rect.w/2+r && Math.abs(rect.z-z) < rect.d/2+r;

function baseHeight(object,seed,territory) {
  if (object.type !== 'bridge') return terrainHeight(object.x,object.z,seed,territory) + .04;
  const end = angleOf(object.rotation);
  const x = Math.sin(end)*8, z = Math.cos(end)*8;
  return Math.max(waterLevel+.6, Math.min(terrainHeight(object.x-x,object.z-z,seed,territory),terrainHeight(object.x+x,object.z+z,seed,territory)));
}

export function supportHeight(x,z,objects,seed,exclude,maxY=Infinity,forPlacement=false,territory) {
  let height = terrainHeight(x,z,seed,territory);
  for (const object of objects) {
    if (object.id === exclude) continue;
    const item = catalogue[object.type];
    let surface;
    if (item.category === 'roads' && inside(footprint(object),x,z)) {
      surface = baseHeight(object,seed,territory) + (object.type==='bridge' ? .24 : .10);
      if (object.type==='bridge') {
        const turn = angleOf(object.rotation);
        const localZ = (x-object.x)*Math.sin(turn)+(z-object.z)*Math.cos(turn);
        const end = Math.max(0,(Math.abs(localZ)-6)/3);
        surface += end * (height-surface);
      }
    } else if (beds.has(object.type) && inside(footprint(object),x,z,-.18) &&
      (object.type !== 'bedRound' || Math.hypot(x-object.x,z-object.z)<1.33)) {
      surface = baseHeight(object,seed,territory) + .24;
    } else if (object.type === 'steps' && inside(footprint(object),x,z)) {
      const turn = angleOf(object.rotation);
      const localZ = (x-object.x)*Math.sin(turn)+(z-object.z)*Math.cos(turn);
      surface = baseHeight(object,seed,territory) + Math.max(0, Math.min(4.1,(3.5-localZ)*.59));
    } else if (object.type === 'stockade') {
      const [ramp,lookout,court,lodge] = worldBoxes(object,[box(7.4,.64,1.79,9.92),box(7.4,-6.9,5.15,5.15),
        box(0,0,32.9,31.63),box(-6.5,-3.9,9.9,7.4)]);
      const localZ=(x-object.x)*Math.sin(angleOf(object.rotation))+(z-object.z)*Math.cos(angleOf(object.rotation));
      if (inside(ramp,x,z)) surface=baseHeight(object,seed,territory)+.21+Math.min(5.79,Math.max(0,5.6-localZ)*.584);
      else if (!forPlacement && inside(lookout,x,z) && maxY>=baseHeight(object,seed,territory)+5.99) surface=baseHeight(object,seed,territory)+6;
      else if (inside(lodge,x,z)) surface=baseHeight(object,seed,territory)+.30;
      else if (inside(court,x,z)) surface=baseHeight(object,seed,territory)+.20;
    } else if (object.type === 'keep') {
      const ramp = worldBoxes(object,[box(-11,-1,1.8,8)])[0];
      if (inside(ramp,x,z)) {
        const turn = angleOf(object.rotation);
        const localZ = (x-object.x)*Math.sin(turn)+(z-object.z)*Math.cos(turn);
        surface = baseHeight(object,seed,territory) + Math.max(.10, Math.min(4.7,(3-localZ)*.5875));
      } else if (inside(footprint(object),x,z)) {
        const ramparts = worldBoxes(object,[box(-14.4,-.5,2.2,26),box(14.4,-.5,2.2,26),box(0,-14,26,2.3),box(-12.2,-5,3.1,1.6)]);
        if (!forPlacement && ramparts.some(rect=>inside(rect,x,z)) && maxY > baseHeight(object,seed,territory)+4.5) {
          surface = baseHeight(object,seed,territory)+4.7;
        } else {
          surface = baseHeight(object,seed,territory)+.10;
        }
      }
    } else if (straightWalls.has(object.type) && !isPerimeterPiece(object) && !forPlacement && inside(footprint(object),x,z)) {
      surface = baseHeight(object,seed,territory)+4.05;
    }
    if (surface !== undefined && surface <= maxY && (surface > height || castleTypes.has(object.type) && !inWater(x,z,seed))) height = surface;
  }
  return height;
}

export function objectHeight(object,objects,seed,territory) {
  const item = catalogue[object.type];
  if (item.category === 'roads' || beds.has(object.type) || !item.support) return baseHeight(object,seed,territory);
  return Math.max(baseHeight(object,seed,territory),supportHeight(object.x,object.z,objects,seed,object.id,Infinity,true,territory));
}

export function containsPoint(object,x,z,radius=.24,y=-Infinity,seed=0,territory) {
  const base = y > -Infinity && (castleTypes.has(object.type) || straightWalls.has(object.type))
    ? baseHeight(object,seed,territory) : Infinity;
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

export function checkPlacement(state, candidate, {ignore,player, staged=[]}={}) {
  const item = catalogue[candidate.type], claim = footprint(candidate), limit = bounds(state.territory);
  if (claim.x-claim.w/2 < limit.minX || claim.x+claim.w/2 > limit.maxX ||
      claim.z-claim.d/2 < limit.minZ || claim.z+claim.d/2 > limit.maxZ) return 'Fora do território.';
  const allowedWater = ['bridge','watermill','walkway'].includes(item.id);
  if (!allowedWater && [-.45,0,.45].some(dx=>[-.45,0,.45].some(dz=>inWater(claim.x+claim.w*dx,claim.z+claim.d*dz,state.seed)))) {
    return 'Use uma ponte ou passarela sobre a água.';
  }
  const solid = gates.has(candidate.type) ? {...candidate,open:true} : candidate;
  const nextBoxes = worldBoxes(solid);
  if (player && (containsPoint(candidate,player.x,player.z,.47) || (!item.support && !castleTypes.has(item.id) && inside(claim,player.x,player.z,.35)))) {
    return 'Afaste-se para construir.';
  }

  for (const object of [...worldObjects(state),...staged]) {
    if (ignore && object.id === ignore) continue;
    const other = catalogue[object.type];
    const junction = item.category==='roads' && other.category==='roads';
    if (junction) {
      if (candidate.x === object.x && candidate.z === object.z) return 'Já existe um piso aqui.';
      if (item.id!=='bridge' && other.id!=='bridge') continue;
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

  const enclosed=state.objects.some(isVillageWall);
  for (let cz=Math.floor((claim.z-claim.d/2-2)/BAND);cz<=Math.floor((claim.z+claim.d/2+2)/BAND);cz++) {
    for (let cx=Math.floor((claim.x-claim.w/2-2)/BAND);cx<=Math.floor((claim.x+claim.w/2+2)/BAND);cx++) {
      if (ownedLandscapeCell(cx,cz,state.seed,limit).some(p=>inside(claim,p.x,p.z,p.collider) &&
        !(enclosed&&onVillagePerimeter(p.x,p.z,state.territory,p.collider+2.4)))) return 'Há vegetação ou rocha no local.';
    }
  }
  return '';
}

export function linePositions(item, from, to, rotation) {
  const axis = item.category==='walls' ? (rotation % 2 ? 'z':'x') :
    Math.abs(to.x-from.x)>=Math.abs(to.z-from.z) ? 'x':'z';
  const length = item.category==='walls' ? item.w : 2;
  const count = Math.min(120,Math.round(Math.abs(to[axis]-from[axis])/length)+1);
  const sign = Math.sign(to[axis]-from[axis]) || 1;
  return Array.from({length:count},(_,i)=>({...from,[axis]:from[axis]+sign*i*length,rotation}));
}

export function getLineCandidate(state, item, points, options) {
  const staged = [], failures = [];
  for (const point of points) {
    const candidate = {...point,type:item.id};
    const reason = checkPlacement(state,candidate,{...options,staged});
    failures.push(reason);
    if (!reason) staged.push(candidate);
  }
  return { staged, failures, total: points.length * item.price };
}

