import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const axes=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];

function canInstance(matrix) {
  // The instancing shader handles rotation and non-uniform scale, but not shear.
  if(matrix.determinant()<=0)return false;
  axes.forEach((axis,index)=>axis.setFromMatrixColumn(matrix,index).normalize());
  return Math.abs(axes[0].dot(axes[1]))<1e-6 && Math.abs(axes[0].dot(axes[2]))<1e-6 &&
    Math.abs(axes[1].dot(axes[2]))<1e-6;
}

function geometryFormat(geometry) {
  const attributes=Object.entries(geometry.attributes).sort(([a],[b])=>a.localeCompare(b));
  if(attributes.some(([,attr])=>attr.isInterleavedBufferAttribute||attr.isInstancedBufferAttribute))return null;
  return JSON.stringify([Boolean(geometry.index),...attributes.map(([name,attr])=>
    [name,attr.itemSize,attr.normalized,attr.array.constructor.name,attr.gpuType])]);
}

export function staticMeshes(model) {
  const result=[];
  function visit(node) {
    if(!node.visible||node.userData.motion||node.userData.wave||node.name==='tecido')return;
    if(node!==model&&!node.isPointLight){
      node.updateMatrix();
      node.matrixAutoUpdate=false;
    }
    if(node.isMesh&&!node.children.length&&!node.isSkinnedMesh&&!Array.isArray(node.material)&&!node.material.transparent&&
      !node.material.transmission&&node.renderOrder===0&&node.layers.mask===1&&
      !node.customDepthMaterial&&!node.customDistanceMaterial&&!Object.keys(node.geometry.morphAttributes).length){
      result.push(node);
    }
    node.children.forEach(visit);
  }
  visit(model);
  return result;
}

export function createStaticBatches(container,nodes) {
  const materials=new Map();
  for(const node of nodes){
    node.visible=true;
    const key=[node.material.id,node.castShadow,node.receiveShadow].join(':');
    if(!materials.has(key))materials.set(key,[]);
    materials.get(key).push(node);
  }

  function add(mesh,originals) {
    const {castShadow,receiveShadow}=originals[0];
    mesh.castShadow=castShadow;
    mesh.receiveShadow=receiveShadow;
    for(const node of originals)node.visible=false;
    mesh.matrixAutoUpdate=false;
    container.add(mesh);
  }

  for(const bucket of materials.values()){
    const instances=new Map(), merges=new Map();
    const material=bucket[0].material;
    for(const mesh of bucket){
      if(!canInstance(mesh.matrixWorld))continue;
      if(!instances.has(mesh.geometry))instances.set(mesh.geometry,[]);
      instances.get(mesh.geometry).push(mesh);
    }
    for(const [geometry,repeated] of instances){
      if(repeated.length<2)continue;
      const mesh=new THREE.InstancedMesh(geometry,material,repeated.length);
      repeated.forEach((original,index)=>mesh.setMatrixAt(index,original.matrixWorld));
      mesh.computeBoundingSphere();
      add(mesh,repeated);
    }
    for(const node of bucket){
      if(!node.visible||node.matrixWorld.determinant()<=0)continue;
      const {geometry}=node;
      if(geometry.drawRange.start!==0||geometry.drawRange.count!==Infinity)continue;
      const format=geometryFormat(geometry);
      if(!format)continue;
      if(!merges.has(format))merges.set(format,[]);
      merges.get(format).push(node);
    }
    for(const sameFormat of merges.values()){
      if(sameFormat.length<2)continue;
      const parts=sameFormat.map(node=>node.geometry.clone().applyMatrix4(node.matrixWorld));
      const geometry=mergeGeometries(parts,false);
      parts.forEach(part=>part.dispose());
      if(geometry)add(new THREE.Mesh(geometry,material),sameFormat);
    }
  }
}
