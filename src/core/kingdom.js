import { catalogue } from './catalog.js';
import { castleTypes, checkPlacement, collidersOverlap, containsPoint, fixedRotation, footprint, gates,
  INITIAL_HOME_LIMIT, ownsPlot, residentialCount, worldBoxes } from './geometry.js';
import {
  fortificationRole, fortificationLevel, fortificationUpgradeCost, isFixedFortification,
  isPerimeterPiece, isVillageGate, isVillageWall, villageWallId
} from './fortifications.js';
import { bounds,directions,expansionOptions,LIMIT,MAX_NATURAL_OBSTACLES,naturalObstacle } from '../world/terrain-data.js';
import { usesLots,validLots } from '../world/lots.js';
import { onVillagePerimeter, villageGatePositions, villageWallSections } from '../world/perimeter.js';

export const STARTING_GOLD = 5000;
export const HARVEST_MS = 30000;
export const MAX_OBJECTS = 4200;
export const times = ['morning','noon','sunset','night'];
const clampGold = value => Math.max(0,Math.min(1e9,value));
export const createId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)),value=>value.toString(16).padStart(2,'0')).join('');

export function emptyKingdom(now=Date.now()) {
  return { version:1, seed:5174, name:'Vale de Valdória', gold:STARTING_GOLD, nextTaxAt:now+HARVEST_MS,
    territory: Object.fromEntries(directions.map(direction=>[direction,0])),
    time:'morning', sound:false, quality:'standard', objects:[], removedLandscape:[] };
}

export function starterKingdom(now=Date.now()){
  const state={...emptyKingdom(now),gold:1500,territory:{lots:[]}};
  state.objects=[{id:'v-0',type:'stockade',x:0,z:-5,rotation:0,wallLevel:1,open:true},
    ...makeVillageFortifications(state.territory)];
  return state;
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

export const expansionCost = (state,direction) => usesLots(state.territory)
  ? 620+state.territory.lots.length*110 : 670+state.territory[direction]*420;

export function edit(state, action, player) {
  const fail = error => ({error});
  const find = () => state.objects.find(object=>object.id===action.id);
  const apply = ({remove=[],add=[],gold=0,direction,lot,change=0}) => {
    const removed = new Set(remove.map(object=>object.id));
    const replacements = new Map(add.map(object=>[object.id,object]));
    state.objects = state.objects.flatMap(object => removed.has(object.id) ?
      replacements.has(object.id) ? [replacements.get(object.id)] : [] : [object]);
    state.objects.push(...add.filter(object=>!removed.has(object.id)));
    state.gold = clampGold(state.gold+gold);
    if (direction||lot) {
      if(lot)state.territory={lots:change>0?[...state.territory.lots,lot]:state.territory.lots.filter(id=>id!==lot)};
      else state.territory[direction] += change;
      if (state.objects.some(isVillageWall)){
        const positions=villageGatePositions(state.territory);
        state.objects=state.objects.map(object=>isVillageGate(object)?{...object,...positions[object.id]}:object);
      }
    }
    return {undo:{remove:add,add:remove,gold:-gold,direction,lot,change:-change},objects:add};
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
    case 'clear-landscape': {
      if(usesLots(state.territory))return fail('Os lotes adquiridos já estão limpos.');
      const {ids}=action;
      if (!Array.isArray(ids) || !ids.length) return fail('Essa área já está limpa.');
      if (ids.length>MAX_NATURAL_OBSTACLES || new Set(ids).size!==ids.length) return fail('Seleção de terreno inválida.');
      const removed=state.removedLandscape??[];
      const previous=new Set(removed);
      const enclosed=state.objects.some(isVillageWall);
      const obstacles=ids.map(id=>naturalObstacle(id,state.seed));
      if (obstacles.some(point=>!point || previous.has(point.id) ||
          (enclosed&&onVillagePerimeter(point.x,point.z,state.territory,point.collider+2.4)))) {
        return fail('A seleção inclui obstáculos indisponíveis.');
      }
      state.removedLandscape=[...removed,...ids];
      return {undo:{restoreLandscape:obstacles},objects:[]};
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
      if(usesLots(state.territory)){
        const lot=action.direction;
        if(!expansionOptions(state.territory).includes(lot))return fail('Selecione um lote vizinho disponível.');
        const cost=expansionCost(state,lot);
        return state.gold<cost?fail('Moedas insuficientes.'):apply({lot,gold:-cost,change:1});
      }
      if (!directions.includes(action.direction)) return fail('Direção indisponível.');
      if (state.territory[action.direction] >= LIMIT) return fail('Limite de expansão atingido.');
      const cost = expansionCost(state,action.direction);
      return state.gold < cost ? fail('Moedas insuficientes.') : apply({gold:-cost,direction:action.direction,change:1});
    }
    case 'undo': {
      if(action.change.lot&&player&&ownsPlot(state.territory,{x:player.x,z:player.z,w:0,d:0})){
        const previous={lots:state.territory.lots.filter(id=>id!==action.change.lot)};
        if(!ownsPlot(previous,{x:player.x,z:player.z,w:.5,d:.5}))return fail('Volte para o território anterior antes de desfazer.');
      }
      const obstacles=action.change.restoreLandscape;
      if (!obstacles) return apply(action.change);
      if (player && obstacles.some(point=>Math.hypot(point.x-player.x,point.z-player.z)<point.collider+.43)) {
        return fail('Afaste-se para restaurar os obstáculos.');
      }
      const restoring=new Set(obstacles.map(point=>point.id));
      state.removedLandscape=state.removedLandscape.filter(id=>!restoring.has(id));
      return {objects:[]};
    }
    default: return fail('Ação desconhecida.');
  }
}

export function validatedKingdom(value) {
  const lots=usesLots(value?.territory);
  const validTerritory=lots?validLots(value.territory.lots):value?.territory?.lots===undefined&&
    directions.every(key=>Number.isInteger(value?.territory?.[key])&&value.territory[key]>=0&&value.territory[key]<=LIMIT);
  const validName = value && typeof value.name === 'string' && value.name.trim().length>0 && value.name.length<=38;
  if (!validName || value.version!==1 || !Number.isInteger(value.seed) || value.seed<0 || value.seed>2147483647 ||
      !Number.isInteger(value.gold) || value.gold<0 || value.gold>1e9 || !Number.isSafeInteger(value.nextTaxAt) ||
      !times.includes(value.time) || !['standard','low','high'].includes(value.quality) || typeof value.sound!=='boolean' ||
      !validTerritory ||
      !Array.isArray(value.objects) || value.objects.length>MAX_OBJECTS) return null;
  const ids = new Set();
  const objects = [];
  const edge=bounds(value.territory);
  for (const candidate of value.objects) {
    const {id,type,x,z,rotation,open,wallLevel} = candidate || {};
    if (typeof id!=='string' || !/^[a-z0-9-]{1,48}$/.test(id) || ids.has(id) || !Object.hasOwn(catalogue,type) ||
        ((id===villageWallId)!==(type==='villageWall')) ||
        !Number.isFinite(x) || !Number.isFinite(z) || x<edge.minX || x>edge.maxX || z<edge.minZ || z>edge.maxZ ||
        !Number.isInteger(rotation) || rotation<0 || rotation>3 ||
        (gates.has(type) && typeof open!=='boolean') ||
        (wallLevel!==undefined && (![1,2].includes(wallLevel)||!fortificationRole({id,type})))) return null;
    ids.add(id);
    const object={id,type,x,z,rotation,...(gates.has(type)?{open}:{}),...(wallLevel===undefined?{}:{wallLevel})};
    if(lots&&!isFixedFortification(object)&&!ownsPlot(value.territory,footprint(object)))return null;
    objects.push(object);
  }
  if(lots&&(!ids.has(villageWallId)||(!value.territory.lots.length&&residentialCount(objects)>INITIAL_HOME_LIMIT)))return null;
  if (ids.has(villageWallId)){
    const positions=villageGatePositions(value.territory);
    const byId=new Map(objects.map(object=>[object.id,object]));
    for(const [id,position] of Object.entries(positions)){
      const gate=byId.get(id);
      if(!isVillageGate(gate)||gate.x!==position.x||gate.z!==position.z||gate.rotation!==position.rotation)return null;
    }
    if(objects.some(object=>isPerimeterPiece(object)&&(!isVillageGate(object)||!Object.hasOwn(positions,object.id))))return null;
  }
  const legacyLandscape=value.removedLandscape===undefined;
  const removedLandscape=legacyLandscape?(value.removedTrees===undefined?[]:value.removedTrees):value.removedLandscape;
  if (!Array.isArray(removedLandscape) || removedLandscape.length>MAX_NATURAL_OBSTACLES ||
      new Set(removedLandscape).size!==removedLandscape.length || removedLandscape.some(id=>{
        const point=naturalObstacle(id,value.seed);
        return !point || (legacyLandscape&&point.type==='rock');
      })) return null;
  return {
    version:1, seed:value.seed, name:value.name.trim(), gold:value.gold, nextTaxAt:value.nextTaxAt,
    time:value.time, sound:value.sound, quality:value.quality,
    territory:lots?{lots:[...value.territory.lots]}:Object.fromEntries(directions.map(direction=>[direction,value.territory[direction]])),
    objects, removedLandscape:[...removedLandscape],
    ...(value.starterPerimeter===true?{starterPerimeter:true}:{})
  };
}

