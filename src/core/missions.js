import { catalogue } from './catalog.js';
import { buildingLevel, canLevel } from './building-levels.js';
import { castleTypes } from './geometry.js';
import { economy } from './kingdom.js';
import { directions } from '../world/terrain-data.js';

export const missionChapters = [
  {name:'Fundação do reino', missions:[
    {id:'fundacao',title:'A sede do reino',xp:100,objectives:[['castles',1,'Castelo construído']]},
    {id:'moradias',title:'Portas abertas',xp:120,objectives:[['homes',2,'Construções da categoria Moradias']]},
    {id:'oficio',title:'O primeiro melhoramento',xp:130,objectives:[['level2',1,'Construção no nível 2 ou superior']]},
    {id:'expansao',title:'Além das fronteiras',xp:150,objectives:[['expansions',1,'Expansão do território']]}
  ]},
  {name:'Crescimento do reino', missions:[
    {id:'producao',title:'Um reino produtivo',xp:180,objectives:[['trade',2,'Construções de comércio ou produção']]},
    {id:'aldeia',title:'A aldeia prospera',xp:220,objectives:[['people',35,'Moradores'],['level2',3,'Construções no nível 2 ou superior']]},
    {id:'fortaleza',title:'O coração da fortaleza',xp:280,objectives:[['castleLevel',3,'Nível do melhor castelo']]},
    {id:'civico',title:'Serviços para a vila',xp:300,objectives:[['civic2',2,'Edifícios públicos no nível 2 ou superior']]}
  ]},
  {name:'Legado de Valdória', missions:[
    {id:'especialistas',title:'Mestres da construção',xp:380,objectives:[['level3',5,'Construções no nível 3 ou superior']]},
    {id:'capital',title:'A capital dos vales',xp:500,objectives:[['people',80,'Moradores'],['trade3',2,'Construções de comércio no nível 3 ou superior']]},
    {id:'legado',title:'Um legado para o reino',xp:620,objectives:[['castleLevel',5,'Nível do melhor castelo'],['level5',3,'Construções de nível 5']]}
  ]}
];
const missions=missionChapters.flatMap(chapter=>chapter.missions);

export function missionProgress(ids) {
  const completed=missions.filter(mission=>Array.isArray(ids)&&ids.includes(mission.id)).map(({id})=>id);
  const xp=missions.reduce((sum,mission)=>sum+(completed.includes(mission.id)?mission.xp:0),0);
  let level=1;
  const levelXP = n => 50*n*(n-1);
  while(xp>=levelXP(level+1))level++;
  return {completed,xp,level,start:levelXP(level),next:levelXP(level+1)};
}

export function missionStats(state) {
  const stats={castles:0,homes:0,trade:0,level2:0,level3:0,level5:0,castleLevel:0,civic2:0,trade3:0};
  const territory=state?.territory;
  stats.expansions=territory?.lots?.length ?? directions.reduce((sum,side)=>sum+(territory?.[side] ?? 0),0);
  stats.people=state ? economy(state).homes : 0;
  for(const object of state?.objects ?? []){
    if(!canLevel(object.type))continue;
    const level=buildingLevel(object);
    const {category}=catalogue[object.type];
    if(castleTypes.has(object.type)){stats.castles++;stats.castleLevel=Math.max(stats.castleLevel,level);}
    if(category==='housing')stats.homes++;
    if(category==='trade'){stats.trade++;if(level>=3)stats.trade3++;}
    if(category==='civic'&&level>=2)stats.civic2++;
    if(level>=2)stats.level2++;
    if(level>=3)stats.level3++;
    if(level>=5)stats.level5++;
  }
  return stats;
}

export function missionStatus(mission,completed,stats) {
  if(completed.includes(mission.id))return 'complete';
  if(missions.find(candidate=>!completed.includes(candidate.id))?.id!==mission.id)return 'locked';
  return mission.objectives.every(([key,target])=>stats[key]>=target) ? 'ready' : 'active';
}

export const findMission = id => missions.find(mission=>mission.id===id);
