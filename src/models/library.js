import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { catalogue } from '../core/catalog.js';
import { fortificationLevel,fortificationRole } from '../core/fortifications.js';
import { group,optimize,cloneModel,materials } from './kit.js';
import { structure } from './architecture.js';
import { prop } from './props.js';
import { stockadeFallback,wireStockade } from './stockade.js';
import { castleWithFortifications,readFortificationKit } from './fortifications.js';
import { displayWagon,registerCitizenModels } from './citizens.js';

const templates=new Map();
const fortificationKits=new Map();
const assetLoads=new Map();
const assetSources=import.meta.glob('../assets/*.glb',{query:'?url',import:'default',eager:true});
const landmarkNames={church:'igreja',chapel:'capela',seal:'selo',stockade:'castelo-nivel-1',hinge:'dobradica-palicada',walls1:'muralhas-nivel-1',walls2:'muralhas-nivel-2',citizens:'moradores-e-carroca'};

export function modelSource(id) {
  const item=catalogue[id];
  const root=group(null,id);
  if (id==='stockade') stockadeFallback(root);
  else if (['housing','trade','civic','castle','walls'].includes(item.category)) structure(root,id);
  else prop(root,id);
  return optimize(root);
}
export function modelKey(object) {
  const role=fortificationRole(object);
  return role?`${object.type}:${role}:${fortificationLevel(object)}`:object.type;
}

export function template(object) {
  const {type}=object;
  const key=modelKey(object);
  if(!templates.has(key)){
    const role=fortificationRole(object);
    const kit=fortificationKits.get(fortificationLevel(object));
    if(role&&kit){
      if(role==='castle'){
        const base=templates.get(type);
        if(base)templates.set(key,castleWithFortifications(base,kit));
      } else {
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

function loadAsset(id) {
  if(assetLoads.has(id))return assetLoads.get(id);
  const url=assetSources[`../assets/${landmarkNames[id]}.glb`];
  const load=(async()=>{
      const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      const {scene}=await loader.loadAsync(url);
      scene.traverse(object=>{
        if(!object.isMesh)return;
        object.castShadow=object.receiveShadow=true;
        if(id==='seal')object.material=object.material.name.startsWith('Aro')?materials.stone:
          object.material.name.startsWith('Campo')?materials.darkStone:materials.gold;
        else object.material=materials[object.material.name] || object.material;
      });
      if(id==='citizens'){
        registerCitizenModels(scene);
        const wagon=displayWagon();
        if(wagon)templates.set('cart',wagon);
      } else if(id==='walls1'||id==='walls2'){
        const level=Number(id.at(-1));
        const kit=readFortificationKit(scene);
        if(!kit)throw new Error('Kit de fortificações incompleto.');
        fortificationKits.set(level,kit);
        for(const key of templates.keys())if(key.endsWith(':'+level))templates.delete(key);
      } else {
        if(id==='stockade'){
          await loadAsset('hinge');
          wireStockade(scene,templates.get('hinge'));
          for(const key of templates.keys())if(key.startsWith('stockade:'))templates.delete(key);
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
  const needed=new Set(['citizens']);
  for(const object of objects){
    if(object.type==='stockade'){
      needed.add('stockade');
      needed.add('hinge');
    }
    if(object.type==='keep')needed.add('seal');
    if(object.type==='church'||object.type==='chapel')needed.add(object.type);
    const role=fortificationRole(object), level=fortificationLevel(object);
    if(role&&(role!=='castle'||level>1))needed.add('walls'+level);
  }
  if(needed.size)return Promise.all([...needed].map(loadAsset));
}
export function sealFor(model) {
  const pivot=model.getObjectByName('selo-do-portao');
  if(pivot && templates.has('seal')){
    pivot.clear();
    pivot.add(cloneModel(templates.get('seal')));
  }
}

