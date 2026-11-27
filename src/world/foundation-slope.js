import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { catalogue } from '../core/catalog.js';
import { angleOf,foundationSlopeHeight,gradedLandHeight,sidewalkTread } from '../core/geometry.js';
import { materials } from '../models/kit.js';
import { pavedTread,sidewalkStonePattern } from '../models/props.js';
import { landHeight } from './terrain-data.js';
import { turf,turfColorAt } from './terrain-render.js';

function axis(center,half,run) {
  const edges=[center-half-run,center-half,center+half,center+half+run];
  return edges.slice(0,-1).flatMap((from,i)=>{
    const distance=edges[i+1]-from, segments=Math.ceil(distance/.4);
    return Array.from({length:segments},(_,j)=>from+j*distance/segments);
  }).concat(edges.at(-1));
}

export function makeFoundationSlope(foundation,{seed,territory},material=turf) {
  const {plot,run}=foundation;
  const xs=axis(plot.x,plot.w/2,run),zs=axis(plot.z,plot.d/2,run);
  const vertices=[],colors=[],indices=[];
  const color=new THREE.Color();
  for(const z of zs)for(const x of xs){
    const ground=landHeight(x,z,seed,territory);
    const y=foundationSlopeHeight(foundation,x,z,seed,territory,ground);
    vertices.push(x,y-.016,z);
    turfColorAt(x,z,seed,color);
    colors.push(color.r,color.g,color.b);
  }
  for(let row=1;row<zs.length;row++)for(let col=1;col<xs.length;col++){
    if(xs[col-1]>=plot.x-plot.w/2&&xs[col]<=plot.x+plot.w/2&&
      zs[row-1]>=plot.z-plot.d/2&&zs[row]<=plot.z+plot.d/2)continue;
    const a=(row-1)*xs.length+col-1,b=a+1,c=a+xs.length,d=c+1;
    indices.push(a,c,b,b,c,d);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='talude natural';
  mesh.receiveShadow=!material.transparent;
  return mesh;
}

export function drapePaving(geometry,matrix,slopes,{seed,territory}) {
  const fitted=geometry.clone().applyMatrix4(matrix);
  const vertices=fitted.attributes.position;
  for(let i=0;i<vertices.count;i++){
    const x=vertices.getX(i),z=vertices.getZ(i);
    vertices.setY(i,vertices.getY(i)+gradedLandHeight(x,z,slopes,seed,territory));
  }
  fitted.computeVertexNormals();
  return fitted;
}

export const sidewalkStepMaterial=materials.mortar.clone();
sidewalkStepMaterial.color.set(0xffffff);
sidewalkStepMaterial.vertexColors=true;

export function steppedSidewalkGeometry(object,slopes,{seed,territory}){
  const {w,d,treads}=catalogue[object.type], pattern=sidewalkStonePattern();
  const parts=[];
  for(let index=0;index<treads;index++){
    const {x,z,top,bottom}=sidewalkTread(object,index,slopes,seed,territory);
    const step=new THREE.Group();
    step.position.set(x,0,z);
    step.rotation.y=angleOf(object.rotation);
    pavedTread(step,w,d/treads,bottom,top,pattern);
    step.updateMatrixWorld(true);
    for(const mesh of step.children){
      const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      const count=geometry.attributes.position.count, colors=new Float32Array(count*3);
      for(let i=0;i<count;i++)mesh.material.color.toArray(colors,i*3);
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
      parts.push(geometry);
    }
  }
  const geometry=mergeGeometries(parts,false);
  for(const part of parts)part.dispose();
  return geometry;
}
