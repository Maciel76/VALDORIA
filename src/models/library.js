import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { catalogue } from '../core/catalog.js';
import { group,optimize,cloneModel,materials } from './kit.js';
import { structure } from './architecture.js';
import { prop } from './props.js';
import { stockadeFallback,wireStockade } from './stockade.js';

const templates=new Map();
const loaders=new Map();
const assetSources=import.meta.glob('../assets/*.glb',{query:'?url',import:'default',eager:true});
const landmarkNames={church:'igreja',chapel:'capela',seal:'selo',stockade:'castelo-nivel-1',hinge:'dobradica-palicada'};

export function modelSource(id) {
  const item=catalogue[id];
  const root=group(null,id);
  if (id==='stockade') stockadeFallback(root);
  else if (['housing','trade','civic','castle','walls'].includes(item.category)) structure(root,id);
  else prop(root,id);
  return optimize(root);
}
export function template(id) {
  if (!templates.has(id)) templates.set(id,modelSource(id));
  return templates.get(id);
}
export function makeModel(id) { return cloneModel(template(id)); }

export async function loadLandmarks() {
  const requests=Object.entries(landmarkNames);
  for(const [id,filename] of requests){
    const url=assetSources[`../assets/${filename}.glb`];
    if(!url) continue;
    loaders.set(id,new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url).then(gltf=>{
      gltf.scene.traverse(object=>{
        if(object.isMesh){
          object.castShadow=object.receiveShadow=true;
          if(id==='seal')object.material=object.material.name.startsWith('Aro')?materials.stone:
            object.material.name.startsWith('Campo')?materials.darkStone:materials.gold;
          else object.material=materials[object.material.name] || object.material;
        }
      });
      templates.set(id,gltf.scene);
      return true;
    }).catch(()=>false));
  }
  await Promise.all(loaders.values());
  if(templates.has('stockade'))wireStockade(templates.get('stockade'),templates.get('hinge'));
}
export function sealFor(model) {
  const pivot=model.getObjectByName('selo-do-portao');
  if(pivot && templates.has('seal')){
    pivot.clear();
    pivot.add(cloneModel(templates.get('seal')));
  }
}

