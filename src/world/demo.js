import { emptyKingdom, upgradeStarter } from '../core/kingdom.js';
import { catalogue } from '../core/catalog.js';
import { checkPlacement, gates } from '../core/geometry.js';

export function makeKingdom(kind='starter', now=Date.now()) {
  const state = emptyKingdom(now);
  if (kind==='empty') return state;
  if (kind==='demo') {
    state.name = 'Domínio do Alvorecer';
    state.gold = 12500;
  }
  const add = (type,x,z,rotation=0) => {
    const object = {id:`v-${state.objects.length}`,type,x,z,rotation,
      ...(gates.has(type)?{open:true}:{})};
    if (!checkPlacement(state,object)) state.objects.push(object);
  };
  const line = (type,x,z,endX,endZ) => {
    const dx=Math.sign(endX-x)*2, dz=Math.sign(endZ-z)*2;
    const steps=Math.max(Math.abs(endX-x),Math.abs(endZ-z))/2;
    for(let i=0;i<=steps;i++) add(type,x+i*dx,z+i*dz);
  };
  add(kind==='demo'?'keep':'stockade',-14,-22);
  add('church',12,-19);
  add('tavern',-22,7);
  add('timber',-12,12);
  add('peasant',-31,14,1);
  add('timber',-20,20,1);
  add('hut',-9,24,1);
  add('peasant',4,19,3);
  add('bakery',11,10,3);
  add('market',18,0,0);
  add('smith',-32,2,1);
  add('barn',29,17,2);
  add('farm',34,29,2);
  add('windmill',35,-12,3);
  add('stable',31,4,3);
  add('fountain',3,3);
  line('cobbles',0,-6,0,30);
  line('cobbles',-16,-6,-2,-6);
  line('cobbles',-16,-4,-16,4);
  line('cobbles',-36,4,-2,4);
  line('dirt',2,6,38,6);
  line('dirt',2,26,34,26);
  line('dirt',20,-8,36,-8);
  line('dirt',36,-6,36,4);
  for (let x=2;x<=6;x+=2) for(let z=0;z<=6;z+=2) add('paving',x,z);
  const decorated = [
    ['torch',-18,-6],['torch',-11,-6],['lantern',-2,6],['lantern',9,6],['lantern',-3,20],
    ['oak',-7,-6],['cherry',7,1],['cherry',6,6],['oak',-31,-10],['oak',-26,21],
    ['sun',-5,-7],['stag',2,-3],['rose',16,6],['cart',23,7,1],['fence',20,17],['fence',22,17],
    ['well',-26,10],['flowers',-18,7],['flowers',-18,19],['bench',5,5],['bedRound',9,0],['apple',9,0],
    ['crates',-28,1],['barrel',-18,9],['pear',24,15],['cypress',7,-11],['cypress',17,-11],['torch',-8,-31]
  ];
  decorated.forEach(args=>add(...args));
  if (kind==='demo') {
    [['abbey',-38,-21],['manor',-38,25],['farm',42,-27],['watch',-38,4],['roundTower',-23,31],
      ['squareTower',-8,33],['wall',-18,33],['wall',-14,33],['drawGate',-1,34],['inn',15,32],['watermill',50,5],['bridge',70,6,1]]
      .forEach(args=>add(...args));
    line('dirt',40,6,62,6);
    line('gravel',80,6,90,6);
  }
  return kind==='starter'?upgradeStarter(state):state;
}

export const buildingCount = state => state.objects.filter(object=>['housing','trade','civic','castle'].includes(catalogue[object.type].category)).length;

