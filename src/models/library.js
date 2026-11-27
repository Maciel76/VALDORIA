import { Box3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { catalogue } from '../core/catalog.js';
import { sluiceBottom,sluiceHinge,sluiceLeafHeight,sluicePlane } from '../core/water-structures.js';
import { buildingLevel, canLevel, isHousing } from '../core/building-levels.js';
import { fortificationLevel,fortificationRole } from '../core/fortifications.js';
import { group,optimize,cloneModel,materials,cube,animated } from './kit.js';
import { structure } from './architecture.js';
import { prop } from './props.js';
import { stockadeFallback,wireAdvancedCastle,wireStockade } from './stockade.js';
import { castleWithFortifications,readFortificationKit } from './fortifications.js';
import { displayWagon,registerCitizenModels } from './citizens.js';
import { fitHousing } from './housing.js';

const templates=new Map();
const fortificationKits=new Map();
const wallHeights=new WeakMap();
const assetLoads=new Map();
const assetSources=import.meta.glob('../assets/*.glb',{query:'?url',import:'default',eager:true});
const landmarkNames={church:'igreja',chapel:'capela',seal:'selo',stockade:'castelo-nivel-1',hinge:'dobradica-palicada',citizens:'moradores-e-carroca',waterGate:'comporta-do-lago'};

export function modelSource(id) {
  const item=catalogue[id];
  const root=group(null,id);
  if(id==='waterGate'){
    for(const sign of [-1,1]){
      const x=sign*4.85;
      cube(root,'stone',x,2.45,0,2.3,8.7,3.4);
      cube(root,'slate',x,7,0,2.54,.65,3.66);
      const leaf=animated(root,'Folha da comporta','gate',{gate:'sluice-wing',sign});
      leaf.position.set(sign*sluiceHinge,0,sluicePlane);
      const center=-sign*sluiceHinge/2;
      cube(leaf,'oak',center,sluiceBottom+sluiceLeafHeight/2,0,sluiceHinge,sluiceLeafHeight,.72);
      for(const y of [-1.48,.56,2.72])cube(leaf,'iron',center,y,0,sluiceHinge-.06,.21,.86);
    }
  }else if (id==='stockade') stockadeFallback(root);
  else if (['housing','trade','civic','castle','walls'].includes(item.category)) structure(root,id);
  else prop(root,id);
  return optimize(root);
}
function baseModelKey(object) {
  const role=fortificationRole(object);
  return role?`${object.type}:${role}:${fortificationLevel(object)}`:object.type;
}

function modelVariant(object) {
  if(!canLevel(object.type))return null;
  const level=buildingLevel(object);
  const shared=isHousing(object.type)&&object.type!=='noble'&&(level>1||object.type==='hut');
  const family=shared?'moradia':object.type;
  const name=`${family}-nivel-${level}`;
  return assetSources[`../assets/${name}.glb`] ? name : null;
}

export function modelKey(object){
  const variant=modelVariant(object);
  if(!variant)return baseModelKey(object);
  return variant.startsWith('moradia-')?`${object.type}:${variant}`:variant;
}

export function template(object) {
  const {type}=object;
  const variant=modelVariant(object);
  if(variant&&templates.has(variant)){
    if(!variant.startsWith('moradia-'))return templates.get(variant);
    const fitted=modelKey(object);
    if(!templates.has(fitted))templates.set(fitted,fitHousing(templates.get(variant),type));
    return templates.get(fitted);
  }
  const key=baseModelKey(object);
  if(!templates.has(key)){
    const role=fortificationRole(object);
    const kit=fortificationKits.get(fortificationLevel(object));
    if(role&&kit){
      if(role==='castle'){
        const base=templates.get(type);
        if(base)templates.set(key,castleWithFortifications(base,kit));
      } else if(kit[role]) {
        const model=kit[role].clone();
        if(role==='wall')model.scale.x=catalogue[type].w/4;
        templates.set(key,model);
      }
    }
    if(!templates.has(key))templates.set(key,templates.get(type)??modelSource(type));
  }
  return templates.get(key);
}
export function makeModel(object) { return cloneModel(template(object)); }

export function fortificationWallHeight(level){
  if(level===undefined)return sluiceBottom+sluiceLeafHeight;
  const wall=template({id:'per-wall-height',type:'wall',wallLevel:level});
  if(!wallHeights.has(wall))wallHeights.set(wall,new Box3().setFromObject(wall).max.y);
  return wallHeights.get(wall);
}

function loadAsset(id) {
  if(assetLoads.has(id))return assetLoads.get(id);
  const level=Number(/^walls(\d+)$/.exec(id)?.[1]);
  const name=level?`muralhas-nivel-${level}`:landmarkNames[id]??id;
  const url=assetSources[`../assets/${name}.glb`];
  const load=(async()=>{
      const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      const {scene}=await loader.loadAsync(url);
      const sluiceWings=new Set();
      scene.traverse(object=>{
        const sign=object.userData.sluiceSwing;
        if(id==='waterGate'&&(sign===-1||sign===1)){
          sluiceWings.add(sign);
          object.userData.motion={kind:'gate',gate:'sluice-wing',sign};
        }
        if(object.userData.farmRotor)object.userData.motion={kind:'mill',axis:'z',speed:-.87};
        if(object.userData.watermillWheel)object.userData.motion={kind:'mill',axis:'x',speed:object.userData.watermillWheel};
        if(object.userData.windmillRotor)object.userData.motion={kind:'mill',axis:'z',speed:object.userData.windmillRotor};
        if(object.userData.watermillFlow!==undefined)object.userData.motion={kind:'water-flow',phase:object.userData.watermillFlow};
        if(object.userData.nobleFountain||object.userData.marketFountain||object.userData.sanctuaryFountain){
          object.userData.motion={kind:'fountain'};
        }
        if(object.userData.marketClock)object.userData.motion={kind:'mill',axis:'z',speed:-.15};
        if(!object.isMesh)return;
        object.castShadow=object.receiveShadow=true;
        if(object.userData.watchPennant||object.userData.marketPennant)object.userData.wave={horizontal:true};
        if(id.startsWith('market-nivel-')&&object.material.transparent)object.castShadow=false;
        if(object.userData.watchFlame)object.userData.motion={kind:'flame',seed:object.position.y};
        if(id==='seal')object.material=object.material.name.startsWith('Aro')?materials.stone:
          object.material.name.startsWith('Campo')?materials.darkStone:materials.gold;
        else object.material=materials[object.material.name] || object.material;
      });
      if(id==='waterGate'&&sluiceWings.size!==2)throw new Error('Comporta sem as duas folhas laterais.');
      if(id==='citizens'){
        registerCitizenModels(scene);
        const wagon=displayWagon();
        if(wagon)templates.set('cart',wagon);
      } else if(level){
        const kit=readFortificationKit(scene);
        if(!kit)throw new Error('Kit de fortificações incompleto.');
        fortificationKits.set(level,kit);
        for(const key of templates.keys())if(key.endsWith(':'+level))templates.delete(key);
      } else {
        if(id==='stockade'){
          await loadAsset('hinge');
          wireStockade(scene,templates.get('hinge'));
          for(const key of templates.keys())if(key.startsWith('stockade:'))templates.delete(key);
        }else if(id.startsWith('stockade-nivel-')&&!wireAdvancedCastle(scene,Number(id.split('-').at(-1)))){
          throw new Error('Castelo sem as duas folhas do portão.');
        }
        templates.set(id,scene);
      }
  })().catch(()=>{
    // Allow a later load to retry while the game uses its procedural model.
    assetLoads.delete(id);
  });
  assetLoads.set(id,load);
  return load;
}

export function loadLandmarks(objects) {
  const needed=new Set(['citizens','waterGate']);
  for(const object of objects){
    const variant=modelVariant(object);
    if(object.type==='stockade'&&!variant){
      needed.add('stockade');
      needed.add('hinge');
    }
    if(object.type==='keep')needed.add('seal');
    if(!variant&&(object.type==='church'||object.type==='chapel'))needed.add(object.type);
    if(variant)needed.add(variant);
    const role=fortificationRole(object), level=fortificationLevel(object);
    if(!variant&&role&&(role!=='castle'||level>1))needed.add('walls'+level);
  }
  if(needed.size)return Promise.all([...needed].map(loadAsset));
}

export async function loadBuildingUpgrade(object){
  await loadLandmarks([object]);
  if(object.type==='stockade'&&buildingLevel(object)===2)return templates.has('stockade')&&fortificationKits.has(2);
  const variant=modelVariant(object);
  return variant?templates.has(variant):!isHousing(object.type)&&
    !['stockade','watch','farm','market','watermill','windmill','chapel','church'].includes(object.type);
}

export async function loadFortificationKit(level){
  await loadAsset('walls'+level);
  return fortificationKits.has(level);
}
export function sealFor(model) {
  const pivot=model.getObjectByName('selo-do-portao');
  if(pivot && templates.has('seal')){
    pivot.clear();
    pivot.add(cloneModel(templates.get('seal')));
  }
}

