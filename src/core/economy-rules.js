import { catalogue } from './catalog.js';

export const resources = {
  wood:'Madeira', stone:'Pedra', grain:'Grãos', food:'Alimentos', iron:'Ferro',
  coal:'Carvão', cloth:'Tecido', tools:'Ferramentas', ale:'Cerveja'
};
export const MAX_ECONOMY_LEVEL=10;
export const MAX_STOCK=1e9;
export const MAX_PUBLIC_ORDER=10000;
export const isDecoration=type=>['decor','green','lights','banners'].includes(catalogue[type]?.category);
export const economyFields={
  starterGold:[1500,0,MAX_STOCK], emptyGold:[5000,0,MAX_STOCK],
  harvestSeconds:[30,5,3600], residentGold:[3,0,10000], jobGold:[5,0,10000],
  lotCost:[620,0,1e6], lotIncrease:[110,0,1e6],
  stripCost:[670,0,1e6], stripIncrease:[420,0,1e6],
  publicOrderBonus:[0,0,100,.01]
};
export const fixedLevelCosts={stockade:450,palisade:36,villageWall:850,cityGate:250};
export const maxBuildingLevel=type=>Object.hasOwn(fixedLevelCosts,type)?2:
  catalogue[type]?.purchasable?MAX_ECONOMY_LEVEL:1;
export const defaultEconomyRules=()=>({
  ...Object.fromEntries(Object.entries(economyFields).map(([key,[value]])=>[key,value])),
  starterWall:true, buildings:{}
});

export function defaultBuildingLevels(type){
  const {homes,jobs,price}=catalogue[type];
  const first={homes,jobs,cost:price,gold:0,resource:'',quantity:0,publicOrder:isDecoration(type)?10:0};
  return Object.hasOwn(fixedLevelCosts,type)?[first,{...first,cost:fixedLevelCosts[type]}]:[first];
}

const integerIn=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
const record=value=>value&&typeof value==='object'&&!Array.isArray(value);

export function validatedEconomyRules(value){
  if(!record(value)||!record(value.buildings)||typeof value.starterWall!=='boolean')return null;
  const rules=defaultEconomyRules();
  rules.starterWall=value.starterWall;
  for(const [key,[fallback,min,max,step=1]] of Object.entries(economyFields)){
    const amount=key==='publicOrderBonus'&&value[key]===undefined?fallback:value[key];
    const scale=1/step;
    const scaled=Math.round(amount*scale);
    if(step===1?!integerIn(amount,min,max):!Number.isFinite(amount)||amount<min||amount>max||Math.abs(amount*scale-scaled)>1e-8)return null;
    rules[key]=step===1?amount:scaled/scale;
  }
  for(const [type,levels] of Object.entries(value.buildings)){
    if(!Object.hasOwn(catalogue,type)||!Array.isArray(levels)||
       levels.length<defaultBuildingLevels(type).length||levels.length>maxBuildingLevel(type))return null;
    const rows=[], decoration=isDecoration(type);
    for(const row of levels){
      if(!record(row)||!integerIn(row.homes,0,10000)||!integerIn(row.jobs,0,10000)||
         !integerIn(row.cost,0,1e6)||!integerIn(row.gold,0,1e6)||!integerIn(row.quantity,0,1e6)||
         (row.resource!==''&&!Object.hasOwn(resources,row.resource))||(!row.resource&&row.quantity!==0))return null;
      const {homes,jobs,cost,gold,resource,quantity,publicOrder=decoration?10:0}=row;
      if(!integerIn(publicOrder,0,MAX_PUBLIC_ORDER))return null;
      rows.push(decoration?{cost,publicOrder,homes:0,jobs:0,gold:0,resource:'',quantity:0}:
        {homes,jobs,cost,gold,resource,quantity,publicOrder});
    }
    rules.buildings[type]=rows;
  }
  return rules;
}

const defaults=Object.fromEntries(Object.keys(catalogue).map(type=>[type,defaultBuildingLevels(type)]));
let active=defaultEconomyRules();
export function setEconomyRules(value){
  const rules=validatedEconomyRules(value);
  if(rules)active=rules;
  return Boolean(rules);
}
export const economyRules=()=>active;

export const buildingLevels=type=>active.buildings[type]??defaults[type];
export function buildingEconomy(type,level=1){
  const levels=buildingLevels(type);
  return levels[Math.min(level,levels.length)-1];
}
export const constructionCost=type=>buildingEconomy(type).cost;
export const objectLevel=object=>object.wallLevel??object.level??1;
export function buildingUpgradeCost(object){
  const levels=active.buildings[object.type];
  return object.wallLevel===undefined&&catalogue[object.type].purchasable&&
    !Object.hasOwn(fixedLevelCosts,object.type)?levels?.[objectLevel(object)]?.cost??null:null;
}

export function validatedResources(value){
  if(!record(value))return null;
  const stock={};
  for(const [key,amount] of Object.entries(value)){
    if(!Object.hasOwn(resources,key)||!integerIn(amount,0,MAX_STOCK))return null;
    stock[key]=amount;
  }
  return stock;
}
