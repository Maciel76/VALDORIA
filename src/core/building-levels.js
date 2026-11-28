import { catalogue } from './catalog.js';
import { fortificationLevel, fortificationUpgradeCost } from './fortifications.js';

const buildings = new Set(['housing','trade','civic','castle']);
export const MAX_BUILDING_LEVEL = 5;
const housingStyles=[
  'Casebre de palha','Casa do oleiro','Casa de enxaimel','Casa da varanda',
  'Casa de cantaria','Casa do torreão','Solar dos jardins','Palacete das arcadas',
  'Residência da corte','Vila real',
];
const watchStyles=[
  'Posto de madeira','Vigia coberta','Guarita de enxaimel','Torre ameada',
  'Torre redonda','Torre do sino','Torre da galeria','Torre do pendão',
  'Farol da coroa','Torre de Vigia Imperial',
];
const farmStyles=[
  'Fazenda com pomar','Chácara cercada','Sítio do celeiro','Pomar irrigado',
  'Quinta de pedra','Fazenda do lagar','Herdade em terraços','Quinta das estufas',
  'Fazenda da coroa','Herdade imperial',
];
const nobleStyles=[
  'Casa nobre de pedra','Solar dos arcos','Solar dos frontões','Casa do mirante',
  'Solar do claustro','Solar dos vitrais','Palacete dos jardins','Residência do duque',
  'Palacete ducal','Palacete Imperial',
];
const marketStyles=[
  'Mercado','Feira de pavilhões','Mercado dos telheiros','Praça dos mercadores',
  'Mercado de cantaria','Mercado do relógio','Grande Bazar','Galeria de vidro',
  'Mercado da coroa','Mercado Imperial',
];
const watermillStyles=[
  'Moinho d’água','Moinho da ribeira','Azenha de enxaimel','Azenha de cantaria',
  'Moinho da ponte','Moinho de comportas','Moinho dos dois canais','Moinho do aqueduto',
  'Moinho da coroa','Moinho Imperial',
];
const windmillStyles=[
  'Moinho de vento','Moinho da colina','Moinho de enxaimel','Torre de cantaria',
  'Moinho da galeria','Moinho do celeiro','Moinho dos seis ventos','Moinho das arcadas',
  'Moinho da coroa','Moinho Imperial do Vento',
];
const chapelStyles=[
  'Capela','Capela do Campanário','Capela dos Arcos','Capela da Rosácea',
  'Capela do Claustro','Capela dos Vitrais','Capela do Mirante','Santuário da Aurora',
  'Santuário da Coroa','Santuário Imperial',
];
const churchStyles=[
  'Igreja de pedra','Igreja Paroquial','Igreja dos Contrafortes','Igreja dos Vitrais',
  'Igreja das Duas Torres','Igreja do Claustro','Basílica das Arcadas','Basílica da Coroa',
  'Catedral de Valdória','Catedral Imperial',
];
const barracksStyles=[
  'Quartel da guarda','Pátio dos fundibulários','Campo dos arqueiros','Quartel dos lanceiros',
  'Fortim dos besteiros','Academia do arco','Quartel da guarda real','Fortaleza dos instrutores',
  'Academia da Coroa','Academia Imperial',
];
const detailedStyles={watch:watchStyles,farm:farmStyles,noble:nobleStyles,market:marketStyles,
  watermill:watermillStyles,windmill:windmillStyles,chapel:chapelStyles,church:churchStyles,barracks:barracksStyles};
export const isHousing = type => catalogue[type]?.category==='housing';
export const maxBuildingLevel = type => type==='stockade'||Object.hasOwn(detailedStyles,type)||isHousing(type)?10:MAX_BUILDING_LEVEL;
export const canLevel = type => buildings.has(catalogue[type]?.category) || ['squareTower','roundTower'].includes(type);

export function buildingLevel(object) {
  return object.type==='stockade' ? Math.max(object.level ?? 1,fortificationLevel(object)) : object.level ?? 1;
}

export function buildingStyle(object) {
  const styles=detailedStyles[object.type]??(isHousing(object.type)?housingStyles:null);
  if(!styles)return null;
  const level=buildingLevel(object);
  return level===1?catalogue[object.type].name:styles[level-1];
}

export function buildingYield(object) {
  const {homes,jobs} = catalogue[object.type];
  const bonus = buildingLevel(object)-1;
  return {homes:homes ? homes+Math.max(1,Math.floor(homes/4))*bonus : 0,
    jobs:jobs ? jobs+Math.max(1,Math.floor(jobs/5))*bonus : 0};
}

export function buildingUpgrade(object) {
  if(!object || !canLevel(object.type))return null;
  const level=buildingLevel(object);
  if(level>=maxBuildingLevel(object.type))return null;
  if(object.type==='stockade' && level===1) {
    return {cost:fortificationUpgradeCost(object),level:2,object:{...object,wallLevel:2}};
  }
  const cost=Math.ceil(catalogue[object.type].price*(45+(level-1)*22)/500)*5;
  return {cost,level:level+1,object:{...object,level:level+1}};
}
