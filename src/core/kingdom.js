import { catalogue } from './catalog.js';
import { castleTypes, checkPlacement, collidersOverlap, containsPoint, fixedRotation, gates, worldBoxes } from './geometry.js';
import {
  fortificationRole, fortificationLevel, fortificationUpgradeCost, isFixedFortification,
  isPerimeterPiece, isVillageGate, isVillageWall, villageWallId
} from './fortifications.js';
import { directions, LIMIT } from '../world/terrain-data.js';
import { villageGatePositions, villageWallSections } from '../world/perimeter.js';

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
  if(original){
    original.type='stockade';
    original.wallLevel??=1;
  }
  if(!state.objects.some(isVillageWall)){
    const legacy=state.objects.filter(isPerimeterPiece);
    if(legacy.length){
      const preserved=state.objects.filter(object=>!isPerimeterPiece(object));
      const perimeter=makeVillageFortifications(state.territory,legacy);
      if(preserved.length+perimeter.length<=MAX_OBJECTS)state.objects=[...preserved,...perimeter];
    }
  }
  return state;
}

function makeVillageFortifications(territory,legacy=[]){
  const level=legacy.some(object=>!gates.has(object.type)&&fortificationLevel(object)===2)?2:1;
  const wall={id:villageWallId,type:'villageWall',x:0,z:0,rotation:0,wallLevel:level};
  const entrances=Object.entries(villageGatePositions(territory)).map(([id,position])=>{
    const gate=legacy.find(object=>isVillageGate(object)&&object.id===id);
    return {id,type:'cityGate',...position,open:gate?.open??true,wallLevel:gate?fortificationLevel(gate):1};
  });
  return [wall,...entrances];
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
    if (direction) {
      state.territory[direction] += change;
      if (state.objects.some(isVillageWall)){
        const positions=villageGatePositions(state.territory);
        state.objects=state.objects.map(object=>isVillageGate(object)?{...object,...positions[object.id]}:object);
      }
    }
    return {undo:{remove:add,add:remove,gold:-gold,direction,change:-change},objects:add};
  };
  switch (action.kind) {
    case 'buy-village-wall': {
      if (state.objects.some(isVillageWall)) return fail('A vila já tem uma muralha.');
      const cost=catalogue.villageWall.price;
      if (state.gold<cost) return fail('Moedas insuficientes.');
      const perimeter=makeVillageFortifications(state.territory);
      if (state.objects.some(isPerimeterPiece)) return fail('O perímetro existente precisa ser atualizado.');
      if (state.objects.length+perimeter.length>MAX_OBJECTS) return fail('Limite de construções atingido.');
      const proposed={...state,objects:perimeter};
      const atPerimeter=[...perimeter.filter(isVillageGate),...villageWallSections(proposed)];
      if (player&&atPerimeter.some(object=>containsPoint(object,player.x,player.z,.47))) {
        return fail('Afaste-se do limite do território para construir a muralha.');
      }
      if (collidersOverlap(atPerimeter.flatMap(object=>worldBoxes(object)),state.objects.flatMap(object=>worldBoxes(object)))) {
        return fail('Há uma construção no traçado da muralha. Mova-a para liberar o perímetro.');
      }
      return apply({add:perimeter,gold:-cost});
    }
    case 'place': {
      if (!action.points.length || state.objects.length+action.points.length>MAX_OBJECTS) return fail('Limite de construções atingido.');
      if (action.points.some(point=>!Object.hasOwn(catalogue,point.type)||!catalogue[point.type].purchasable)) {
        return fail('Peça indisponível na loja.');
      }
      if (action.points.some(point=>point.type==='villageWall')) return fail('Compre a muralha inteira na loja.');
      const items = [], cost = action.points.reduce((sum,p)=>sum+catalogue[p.type].price,0);
      if (state.gold<cost) return fail('Moedas insuficientes.');
      for (const point of action.points) {
        const object = {type:point.type,x:point.x,z:point.z,id:createId(),rotation:fixedRotation(point.rotation)};
        if (fortificationRole(object)) object.wallLevel = 1;
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
      if (isFixedFortification(object)) return fail('A posição acompanha os limites do território.');
      const moved = {...object,x:action.x,z:action.z,rotation:fixedRotation(action.rotation)};
      const reason = checkPlacement(state,moved,{ignore:object.id,player});
      return reason ? fail(reason) : apply({remove:[object],add:[moved]});
    }
    case 'remove': {
      const object = find();
      if (isFixedFortification(object)) return fail('Esta estrutura faz parte do perímetro da vila.');
      return object ? apply({remove:[object]}) : fail('Construção indisponível.');
    }
    case 'gate': {
      const object = find();
      if (!object || !gates.has(object.type)) return fail('Selecione um portão.');
      return apply({remove:[object],add:[{...object,open:!object.open}]});
    }
    case 'upgrade-walls':
    case 'upgrade-gate': {
      const object = find();
      const cost = object ? fortificationUpgradeCost(object) : null;
      const gateUpgrade=action.kind==='upgrade-gate';
      if (cost===null||gateUpgrade!==isVillageGate(object)) {
        return fail(gateUpgrade?'Melhoria de portão indisponível.':'Melhoria de muralha indisponível.');
      }
      if (state.gold<cost) return fail('Moedas insuficientes.');
      return apply({remove:[object],add:[{...object,wallLevel:2}],gold:-cost});
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
    const {id,type,x,z,rotation,open,wallLevel} = candidate || {};
    if (typeof id!=='string' || !/^[a-z0-9-]{1,48}$/.test(id) || ids.has(id) || !Object.hasOwn(catalogue,type) ||
        ((id===villageWallId)!==(type==='villageWall')) ||
        !Number.isFinite(x) || !Number.isFinite(z) || x<edge.west || x>edge.east || z<edge.north || z>edge.south ||
        !Number.isInteger(rotation) || rotation<0 || rotation>3 ||
        (gates.has(type) && typeof open!=='boolean') ||
        (wallLevel!==undefined && (![1,2].includes(wallLevel)||!fortificationRole({id,type})))) return null;
    ids.add(id);
    objects.push({id,type,x,z,rotation,...(gates.has(type)?{open}:{}),...(wallLevel===undefined?{}:{wallLevel})});
  }
  if (ids.has(villageWallId)){
    const positions=villageGatePositions(value.territory);
    const byId=new Map(objects.map(object=>[object.id,object]));
    for(const [id,position] of Object.entries(positions)){
      const gate=byId.get(id);
      if(!isVillageGate(gate)||gate.x!==position.x||gate.z!==position.z||gate.rotation!==position.rotation)return null;
    }
    if(objects.some(object=>isPerimeterPiece(object)&&!isVillageGate(object)))return null;
  }
  return {
    version:1, seed:value.seed, name:value.name.trim(), gold:value.gold, nextTaxAt:value.nextTaxAt,
    time:value.time, sound:value.sound, quality:value.quality,
    territory:Object.fromEntries(directions.map(direction=>[direction,value.territory[direction]])),
    objects,
    ...(value.starterPerimeter===true?{starterPerimeter:true}:{})
  };
}

