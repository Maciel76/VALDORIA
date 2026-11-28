import { buildingLevel } from './building-levels.js';

export const troopRanges={melee:'Corpo a corpo',medium:'Média distância',long:'Longa distância'};
export const troopTypes=[
  ['recruit','Recruta da vila','melee',12,7,32,5],
  ['slinger','Fundibulário','medium',17,9,45,6],
  ['archer','Arqueiro do vale','long',23,11,65,8],
  ['spearman','Lanceiro','melee',27,19,92,10],
  ['crossbow','Besteiro','medium',36,22,125,12],
  ['bow-guard','Arqueiro veterano','long',43,27,165,14],
  ['sword-guard','Espadachim da guarda','melee',49,39,220,16],
  ['royal-crossbow','Besteiro da coroa','medium',62,43,290,19],
  ['royal-archer','Arqueiro real','long',73,49,380,22],
  ['imperial-guard','Guardião Imperial','melee',86,70,490,25],
].map(([id,name,range,power,defense,cost,seconds],i)=>({id,name,range,power,defense,cost,seconds,level:i+1}));

const units=new Map(troopTypes.map(troop=>[troop.id,troop]));
const orderLimit=20;
const armyLimit=100000;
export const getTroop = id => units.get(id);
export const countTroops = state => Object.values(state.army?.reserve??{}).reduce((count,value)=>count+value,0);
export const hasTraining = (state,id) => Boolean(state.army?.orders.some(order=>order.barracks===id));

export function completeTraining(state,now=Date.now()) {
  const {army}=state;
  if(!army?.orders.some(order=>order.readyAt<=now))return false;
  const orders=[];
  for(const order of army.orders){
    if(order.readyAt>now)orders.push(order);
    else army.reserve[order.unit]=(army.reserve[order.unit]??0)+order.amount;
  }
  army.orders=orders;
  return true;
}

export function trainTroop(state,barracksId,unitId,amount,now=Date.now()) {
  const barracks=state.objects.find(object=>object.type==='barracks'&&object.id===barracksId);
  const unit=getTroop(unitId);
  if(!barracks||!unit)return 'Selecione uma unidade no quartel.';
  if(buildingLevel(barracks)<unit.level)return `Disponível no quartel de nível ${unit.level}.`;
  if(!Number.isInteger(amount)||amount<1||amount>orderLimit)return 'Escolha entre 1 e 20 soldados.';
  const army=state.army??{reserve:{},orders:[]};
  if(army.orders.length>=orderLimit)return 'A fila de treinamento está cheia.';
  const total=countTroops(state)+army.orders.reduce((n,order)=>n+order.amount,0);
  if(total+amount>armyLimit)return 'Limite de tropas atingido.';
  const cost=unit.cost*amount;
  if(state.gold<cost)return 'Moedas insuficientes.';
  const start=army.orders.filter(order=>order.barracks===barracksId).reduce((t,order)=>Math.max(t,order.readyAt),now);
  state.gold-=cost;
  army.orders.push({barracks:barracksId,unit:unit.id,amount,readyAt:start+unit.seconds*amount*1000});
  state.army=army;
  return '';
}

export function validatedArmy(value,objects) {
  if(!value||typeof value.reserve!=='object'||!value.reserve||Array.isArray(value.reserve)||
    !Array.isArray(value.orders)||value.orders.length>orderLimit)return null;
  const reserve={};
  let count=0;
  for(const [id,amount] of Object.entries(value.reserve)){
    if(!getTroop(id)||!Number.isInteger(amount)||amount<1||amount>armyLimit)return null;
    reserve[id]=amount;
    count+=amount;
  }
  const barracks=new Set(objects.filter(object=>object.type==='barracks').map(object=>object.id));
  const lastEnd=new Map();
  const orders=[];
  for(const order of value.orders){
    if(!order)return null;
    const {barracks:id,unit,amount,readyAt}=order;
    const details=getTroop(unit);
    if(!details||!barracks.has(id)||!Number.isInteger(amount)||amount<1||amount>orderLimit||
      !Number.isSafeInteger(readyAt)||readyAt<0||readyAt-amount*details.seconds*1000<(lastEnd.get(id)??0))return null;
    lastEnd.set(id,readyAt);
    count+=amount;
    orders.push({barracks:id,unit,amount,readyAt});
  }
  return count<=armyLimit?{reserve,orders}:null;
}
