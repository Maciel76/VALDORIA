export const villageWallId = 'village-wall';
export const villageGateNames = {'per-4':'Portão sul','per-5':'Portão leste','per-6':'Portão oeste'};

export const isPerimeterPiece = object => object.id?.startsWith('per-')===true && !object.id.startsWith('per-road-');
export const isVillageWall = object => object?.id===villageWallId;
export const isVillageGate = object => object?.type==='cityGate' && Object.hasOwn(villageGateNames,object.id);
export const isFixedFortification = object => isVillageWall(object) || isVillageGate(object);

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

export function fortificationUpgradeCost(object) {
  const role=fortificationRole(object);
  if(!role||fortificationLevel(object)!==1)return null;
  if(role==='village-wall')return 850;
  if(isVillageGate(object))return 250;
  if(role==='castle')return 450;
  if(object.type==='palisade')return 36;
  return null;
}
