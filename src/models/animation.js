import { MathUtils } from 'three';

export function tracks(model,seed) {
  const list=[];
  model.traverse(node=>{
    if (node.userData.wave) list.push({node,kind:'wave',horizontal:node.userData.wave.horizontal,
      emblem:node.parent.getObjectByName('brasao'),base:node.geometry.attributes.position.array.slice(),seed});
    if (node.userData.motion) list.push({node,...node.userData.motion,origin:node.position.clone(),rotation:node.rotation.clone(),seed:(node.userData.motion.seed||0)+seed});
  });
  return list;
}
export function animateModel(list,t,delta,open,reduced,initial=false) {
  for(const motion of list){
    const {node,kind,seed}=motion;
    if(kind==='gate'){
      const amount=open?1:0;
      const factor=initial || reduced?1:1-Math.exp(-delta*6);
      if(motion.gate==='bridge') node.rotation.x=MathUtils.lerp(node.rotation.x,-(1-amount)*1.49,factor);
      if(motion.gate==='grille') node.position.y=MathUtils.lerp(node.position.y,motion.height*amount,factor);
      if(motion.gate==='leaf') node.rotation.y=MathUtils.lerp(node.rotation.y,motion.sign*amount*1.46,factor);
    } else if(kind==='wave'){
      const attr=node.geometry.attributes.position;
      const wave=(x,y)=>(Math.sin(t*3.1+seed+x*5.6-y*6.1)*.128+Math.sin(t*1.7+seed+y*3)*.049)*
        Math.abs(motion.horizontal?x:y);
      if(!reduced || initial){
        for(let i=0;i<attr.count;i++) attr.setZ(i,motion.base[i*3+2]+wave(motion.base[i*3],motion.base[i*3+1]));
        attr.needsUpdate=true;
        if(motion.emblem)motion.emblem.position.z=wave(0,-.60)+.037;
      }
    } else if(kind==='ember'){
      const s=(t*.57+motion.phase)%1;
      node.visible=!reduced&&s<.86;
      node.position.set(motion.origin.x+Math.cos(motion.angle+s*4)*s*.57,motion.origin.y+s*2.43,
        motion.origin.z+Math.sin(motion.angle+s*4)*s*.54);
      node.scale.setScalar(Math.max(.05,1-s));
    } else if(kind==='mill') node.rotation[motion.axis]=motion.rotation[motion.axis]+(reduced?0:t*motion.speed);
    else if(kind==='flame') node.scale.set(reduced?1:1+Math.sin(t*10+seed)*.12,reduced?1:1+Math.sin(t*13+seed)*.24,1);
    else if(kind==='smoke'){
      const phase=(t*.48+motion.phase+seed*.104)%1;
      node.visible=!reduced;
      node.position.y=motion.origin.y+3.6*phase;
      node.position.x=motion.origin.x+phase*phase*1.26;
      node.scale.setScalar(.43+phase*.88);
    } else if(kind==='fountain') node.rotation.y=reduced?0:t*.8;
    else if(kind==='hammer') node.rotation.z=reduced?-.35:-.55+Math.sin(t*4+seed)*.75;
  }
}

