import { catalogue } from './catalog.js';
import { castleTypes, checkPlacement, fixedRotation, gates } from './geometry.js';
import { directions, LIMIT } from '../world/terrain-data.js';
import { installStarterPerimeter } from '../world/perimeter.js';

export const STARTING_GOLD = 5000;
export const HARVEST_MS = 30000;
export const MAX_OBJECTS = 4200;
export const times = ['morning','noon','sunset','night'];
const clampGold = value => Math.max(0,Math.min(1e9,value));
export const createId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)),value=>value.toString(16).padStart(2,'0')).join('');

export function emptyKingdom(now=Date.now()) {
  return { version:1, seed:5174, name:'Vale de Valdória', gold:STARTING_GOLD, nextTaxAt:now+HARVEST_MS,
    territory: Object.fromEntries(directions.map(direction=>[direction,0])),
    time:'morning', sound:false, quality:'standard', objects:[] };
}

export function upgradeStarter(state) {
  const original=state.objects.find(object=>object.id==='v-0'&&castleTypes.has(object.type));
  if(original?.type==='keep')original.type='stockade';
  if(original&&!state.starterPerimeter)installStarterPerimeter(state,original,MAX_OBJECTS);
  return state;
}

export function economy(state) {
  const {homes,jobs} = state.objects.reduce((sum,object)=>{
    const item = catalogue[object.type];
    sum.homes += item.homes;
    sum.jobs += item.jobs;
    return sum;
  },{homes:0,jobs:0});
  const filled = Math.min(homes,jobs);
  return {homes,jobs,filled,income:homes*3+filled*5};
}

export function collectTax(state,now=Date.now()) {
  if (now < state.nextTaxAt) return false;
  state.nextTaxAt += (Math.floor((now-state.nextTaxAt)/HARVEST_MS)+1)*HARVEST_MS;
  state.gold = clampGold(state.gold + economy(state).income);
  return true;
}

export const expansionCost = (state,direction) => 670 + state.territory[direction]*420;

export function edit(state, action, player) {
  const fail = error => ({error});
  const find = () => state.objects.find(object=>object.id===action.id);
  const apply = ({remove=[],add=[],gold=0,direction,change=0}) => {
    const removed = new Set(remove.map(object=>object.id));
    const replacements = new Map(add.map(object=>[object.id,object]));
    state.objects = state.objects.flatMap(object => removed.has(object.id) ?
      replacements.has(object.id) ? [replacements.get(object.id)] : [] : [object]);
    state.objects.push(...add.filter(object=>!removed.has(object.id)));
    state.gold = clampGold(state.gold+gold);
    if (direction) state.territory[direction] += change;
    return {undo:{remove:add,add:remove,gold:-gold,direction,change:-change},objects:add};
  };
  switch (action.kind) {
    case 'place': {
      if (!action.points.length || state.objects.length+action.points.length>MAX_OBJECTS) return fail('Limite de construções atingido.');
      const items = [], cost = action.points.reduce((sum,p)=>sum+catalogue[p.type].price,0);
      if (state.gold<cost) return fail('Moedas insuficientes.');
      for (const point of action.points) {
        const object = {...point, id:createId(), rotation:fixedRotation(point.rotation)};
        if (gates.has(object.type)) object.open = true;
        const reason = checkPlacement(state,object,{player,staged:items});
        if (reason) return fail(reason);
        items.push(object);
      }
      return apply({add:items,gold:-cost});
    }
    case 'move': {
      const object = find();
      if (!object) return fail('Construção indisponível.');
      const moved = {...object,x:action.x,z:action.z,rotation:fixedRotation(action.rotation)};
      const reason = checkPlacement(state,moved,{ignore:object.id,player});
      return reason ? fail(reason) : apply({remove:[object],add:[moved]});
    }
    case 'remove': {
      const object = find();
      return object ? apply({remove:[object]}) : fail('Construção indisponível.');
    }
    case 'gate': {
      const object = find();
      if (!object || !gates.has(object.type)) return fail('Selecione um portão.');
      return apply({remove:[object],add:[{...object,open:!object.open}]});
    }
    case 'expand': {
      if (!directions.includes(action.direction)) return fail('Direção indisponível.');
      if (state.territory[action.direction] >= LIMIT) return fail('Limite de expansão atingido.');
      const cost = expansionCost(state,action.direction);
      return state.gold < cost ? fail('Moedas insuficientes.') : apply({gold:-cost,direction:action.direction,change:1});
    }
    case 'undo': return apply(action.change);
    default: return fail('Ação desconhecida.');
  }
}

export function validatedKingdom(value) {
  const validName = value && typeof value.name === 'string' && value.name.trim().length>0 && value.name.length<=38;
  if (!validName || value.version!==1 || !Number.isInteger(value.seed) || value.seed<0 || value.seed>2147483647 ||
      !Number.isInteger(value.gold) || value.gold<0 || value.gold>1e9 || !Number.isSafeInteger(value.nextTaxAt) ||
      !times.includes(value.time) || !['standard','low','high'].includes(value.quality) || typeof value.sound!=='boolean' ||
      !directions.every(key=>Number.isInteger(value.territory?.[key]) && value.territory[key]>=0 && value.territory[key]<=LIMIT) ||
      !Array.isArray(value.objects) || value.objects.length>MAX_OBJECTS) return null;
  const ids = new Set();
  const objects = [];
  const edge = { north:-180-value.territory.north*36, south:180+value.territory.south*36,
    west:-180-value.territory.west*36,east:180+value.territory.east*36 };
  for (const candidate of value.objects) {
    const {id,type,x,z,rotation,open} = candidate || {};
    if (typeof id!=='string' || !/^[a-z0-9-]{1,48}$/.test(id) || ids.has(id) || !Object.hasOwn(catalogue,type) ||
        !Number.isFinite(x) || !Number.isFinite(z) || x<edge.west || x>edge.east || z<edge.north || z>edge.south ||
        !Number.isInteger(rotation) || rotation<0 || rotation>3 ||
        (gates.has(type) && typeof open!=='boolean')) return null;
    ids.add(id);
    objects.push({id,type,x,z,rotation,...(gates.has(type)?{open}:{})});
  }
  return {
    version:1, seed:value.seed, name:value.name.trim(), gold:value.gold, nextTaxAt:value.nextTaxAt,
    time:value.time, sound:value.sound, quality:value.quality,
    territory:Object.fromEntries(directions.map(direction=>[direction,value.territory[direction]])),
    objects,
    ...(value.starterPerimeter===true?{starterPerimeter:true}:{})
  };
}

