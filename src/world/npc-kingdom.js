import { checkPlacement, gates } from '../core/geometry.js';
import { emptyKingdom } from '../core/kingdom.js';
import { npcSite } from './npc-sites.js';

const surroundings = {
  'npc-grifo': {time:'morning',buildings:['smith','stable','timber','watch']},
  'npc-avelar': {time:'noon',buildings:['farm','barn','windmill','hut']},
  'npc-vidral': {time:'sunset',buildings:['church','market','manor','bakery']},
  'npc-lumen': {time:'morning',buildings:['tavern','peasant','well','hut']},
  'npc-bruma': {time:'sunset',buildings:['chapel','timber','watch','well']}
};

export function npcKingdom(id) {
  const kingdom = npcSite(id);
  if (!kingdom) return null;
  const {time,buildings} = surroundings[id];
  const state = {...emptyKingdom(0),name:kingdom.name,time};
  const add = (type,x,z,rotation=0) => {
    const object = {id:'npc-'+state.objects.length,type,x,z,rotation,...(gates.has(type)?{open:true}:{})};
    if (!checkPlacement(state,object)) state.objects.push(object);
  };
  add(kingdom.preview,-14,-22);
  buildings.forEach((type,i)=>add(type,...[[12,-19],[-22,7],[19,21],[-9,24]][i],i));
  for (let z=-6;z<=26;z+=2) add('cobbles',0,z);
  for (let x=-14;x<0;x+=2) add('dirt',x,-6);
  add('torch',-13,-4);
  add('torch',2,12);
  return {kingdom,state};
}
