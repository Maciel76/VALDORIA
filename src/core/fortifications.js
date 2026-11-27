export const villageWallId = 'village-wall';
export const villageGateNames = {'per-4':'Portão sul','per-5':'Portão leste','per-6':'Portão oeste'};
export const MAX_FORTIFICATION_LEVEL = 10;

export const isPerimeterPiece = object => object.id?.startsWith('per-')===true && !object.id.startsWith('per-road-');
export const isVillageWall = object => object?.id===villageWallId;
export const isVillageGate = object => object?.type==='cityGate' && Object.hasOwn(villageGateNames,object.id);
export const isFixedFortification = object => isVillageWall(object) || isVillageGate(object) || object?.type==='waterGate';

export function fortificationRole(object) {
  if(isVillageWall(object))return 'village-wall';
  if(object.type==='stockade')return 'castle';
  if(object.type==='palisade')return 'wall';
  if(isVillageGate(object))return 'gate';
  if(isPerimeterPiece(object)){
    if(object.type==='cityGate')return 'gate';
    if(object.type==='squareTower')return 'tower';
    if(object.type==='wall'||object.type==='wallShort')return 'wall';
  }
  return null;
}

export const fortificationLevel = object => object.wallLevel ?? 1;
export const maxFortificationLevel = object => fortificationRole(object)==='castle'?2:MAX_FORTIFICATION_LEVEL;

export function fortificationUpgradeCost(object) {
  const role=fortificationRole(object);
  const level=fortificationLevel(object);
  const base=role==='village-wall'?850:isVillageGate(object)?250:role==='castle'?450:object.type==='palisade'?36:null;
  if(base===null||level>=maxFortificationLevel(object))return null;
  const upgrades=level-1;
  return Math.ceil(base*(1+.65*upgrades+.08*upgrades**2));
}

export function fortificationUpgrade(object){
  const cost=fortificationUpgradeCost(object);
  if(cost===null)return null;
  const level=fortificationLevel(object)+1;
  return {cost,level,object:{...object,wallLevel:level}};
}
