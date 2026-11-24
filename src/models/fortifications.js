import { animated,cloneModel,group,optimize } from './kit.js';

const offsets={wall:0,gate:12,left:12,right:12,tower:23};
const cadMaterials=new Map();

export function readFortificationKit(scene) {
  const parts=Object.fromEntries(Object.keys(offsets).map(role=>[role,group(null,role)]));
  scene.updateMatrixWorld(true);
  scene.traverse(node=>{
    if(!node.isMesh)return;
    const role=node.name.split('_',1)[0];
    if(!Object.hasOwn(parts,role))return;
    const mesh=node.clone(false);
    mesh.matrix.copy(node.matrixWorld);
    mesh.matrix.elements[12]-=offsets[role];
    mesh.matrix.decompose(mesh.position,mesh.quaternion,mesh.scale);
    const material=node.material;
    const key=[material.color.getHex(),material.roughness,material.metalness].join(':');
    if(!cadMaterials.has(key))cadMaterials.set(key,material);
    mesh.material=cadMaterials.get(key);
    parts[role].add(mesh);
  });
  if(Object.values(parts).some(part=>!part.children.length))return null;

  for(const [role,sign] of [['left',-1],['right',1]]){
    const leaf=animated(parts.gate,role,'gate',{gate:'leaf',sign:-sign});
    leaf.position.x=sign*1.96;
    parts[role].position.x=-leaf.position.x;
    leaf.add(parts[role]);
  }
  return {wall:optimize(parts.wall),gate:optimize(parts.gate),tower:optimize(parts.tower)};
}

export function castleWithFortifications(base,kit) {
  const castle=cloneModel(base);
  const obsolete=['Estacas_de_cedro','Travessas,_cordas','PortaoEsquerda','PortaoDireita','Dobradiça fixa'];
  const oldPieces=[];
  castle.traverse(node=>{
    if(obsolete.some(prefix=>node.name.startsWith(prefix)))oldPieces.push(node);
  });
  oldPieces.forEach(node=>node.removeFromParent());

  const gate=kit.gate.clone();
  gate.position.set(0,.18,13.35);
  gate.scale.x=2.36/1.96;
  castle.add(gate);
  const gateEdge=4*gate.scale.x;
  const corners=[[-gateEdge,13.5],[-12.6,13.5],[-15,11.1],[-15,-11.1],[-12.6,-13.5],
    [12.6,-13.5],[15,-11.1],[15,11.1],[12.6,13.5],[gateEdge,13.5]];
  for(let i=1;i<corners.length;i++){
    const [ax,az]=corners[i-1], [bx,bz]=corners[i];
    const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);
    const count=Math.round(length/4);
    for(let j=0;j<count;j++){
      const t=(j+.5)/count;
      const section=kit.wall.clone();
      section.position.set(ax+dx*t,.18,az+dz*t);
      section.rotation.y=-Math.atan2(dz,dx);
      section.scale.x=length/(4*count);
      castle.add(section);
    }
  }
  return castle;
}
