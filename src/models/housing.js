import { catalogue } from '../core/catalog.js';
import { group } from './kit.js';

const sourceWidth=9,sourceDepth=8;

export function fitHousing(scene,type){
  const root=group(null,type);
  const {w,d}=catalogue[type];
  const add=(width,depth,height,x=0,z=0)=>{
    const model=scene.clone();
    model.scale.set(width/sourceWidth,height,depth/sourceDepth);
    model.position.set(x,0,z);
    root.add(model);
  };
  if(type==='terrace'){
    for(const side of [-1,1])add(w*.454,d,side===-1?.96:.81,side*w*.246);
  }else if(type==='manor'){
    add(8.6,7.2,1.13,0,-2);
    for(const side of [-1,1])add(4.2,7.9,.67,side*6,-1);
  }else{
    const height={hut:.79,peasant:.91,timber:1}[type]??1;
    add(w,d,height);
  }
  return root;
}
