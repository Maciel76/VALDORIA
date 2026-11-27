import { BoxGeometry, DoubleSide, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, PointLight } from 'three';
import { stockadeWalls } from '../core/geometry.js';
import { random } from '../world/terrain-data.js';
import { animated,ball,beam,cloth,cube,cyl,fire,group,materials,roof } from './kit.js';
import { barrel,crate,light } from './props.js';

const leaves = [['PortaoEsquerda',-1],['PortaoDireita',1]];
const banners = [['BandeiraTorre',true],['BandeiraEntrada',false],['BandeiraGuarda',false]];
const planks=['oak','timberLight','timber','oak'];
const streamGeometry=new BoxGeometry(1,1,1);
const streamMaterial=new MeshBasicMaterial({color:'#c2f8f5',transparent:true,opacity:.60,depthWrite:false});
const pennantMaterial=new MeshStandardMaterial({color:'#a21828',side:DoubleSide,roughness:.84});

function imperialPennant(mast,scale){
  const geometry=new PlaneGeometry(1,1,16,6);
  const position=geometry.attributes.position;
  for(let i=0;i<position.count;i++){
    const u=position.getX(i)+.5,v=position.getY(i)+.5;
    const notch=(1-Math.abs(v*2-1))*u**9*.26;
    position.setXYZ(i,(u*1.63-notch)*scale,(.38+v*.52+u*.14)*scale,0);
  }
  const flag=new Mesh(geometry,pennantMaterial);
  flag.name='Flâmula imperial';
  flag.userData.wave={horizontal:true};
  mast.add(flag);
}

function hearth(root,sculpted) {
  if(sculpted)fire(root,0,.65,3.55,.82);
  else light(root,0,.19,3.55,'bonfire');
  light(root,-3.19,1.06,13.91,'torch',true);
  light(root,3.19,1.06,13.91,'torch',true);
  light(root,5.14,6.16,-4.2,'lantern',true);
  light(root,-7.56,.68,-.24,'lantern',true);

  for(let i=0;i<4;i++){
    const smoke=animated(root,'fumaça da fogueira','smoke',{phase:i/4});
    smoke.position.set(.002,.94,3.55);
    const cloud=ball(smoke,'smoke',0,0,0,.25,.30,.28,1);
    cloud.castShadow=false;
  }
  for(let i=0;i<11;i++){
    const embers=animated(root,'brasa','ember',{phase:i/11,angle:i*2.399,seed:i*.19});
    embers.position.set(0,.56,3.55);
    const spark=ball(embers,i%3?'flame':'gold',0,0,0,.034,.049,.034);
    spark.castShadow=false;
  }
}

function installHinges(root,leaf,sign,hinge) {
  const assembly=hinge?.children[0];
  if(!assembly?.children.length)return;
  assembly.updateWorldMatrix(true,true);
  const centers=new Map();
  for(const part of assembly.children){
    const shape=part.geometry;
    if(!shape)continue;
    if(!shape.boundingBox)shape.computeBoundingBox();
    const x=shape.boundingBox.getCenter(part.position.clone()).applyMatrix4(part.matrixWorld).x;
    centers.set(part,x);
  }
  for(const y of [.81,2.42]){
    const fixed=group(root,'Dobradiça fixa');
    fixed.position.set(sign*2.36,y,13.559);
    const mobile=group(leaf,'Chapa da dobradiça móvel');
    mobile.position.set(0,y,.229);
    // The SolidCraft assembly carries the millimetre scale and the axis conversion.
    const fixedParts=assembly.clone(false), mobileParts=assembly.clone(false);
    fixed.add(fixedParts);mobile.add(mobileParts);
    for(const [part,x] of centers){
      const piece=part.clone();
      piece.material=materials.iron;
      piece.castShadow=true;
      (Math.abs(x)<.039 || Math.sign(x)===sign?fixedParts:mobileParts).add(piece);
    }
  }
}

export function wireStockade(root,hinge,sculpted=true) {
  for(const [name,sign] of leaves){
    const leaf=root.getObjectByName(name);
    if(!leaf)continue;
    leaf.userData.motion={kind:'gate',gate:'leaf',sign:-sign};
    installHinges(root,leaf,sign,hinge);
  }
  for(const [name,horizontal] of banners){
    const fabric=root.getObjectByName(name);
    if(!fabric?.isMesh)continue;
    fabric.userData.wave={horizontal};
  }
  hearth(root,sculpted);
}

export function wireAdvancedCastle(root,level) {
  const leaves=new Map(),masts=[];
  root.traverse(node=>{
    if([-1,1].includes(node.userData.castleLeaf))leaves.set(node.userData.castleLeaf,node);
    if(node.userData.castleFlag)masts.push(node);
  });
  if(leaves.size!==2)return false;
  for(const [sign,node] of leaves)node.userData.motion={kind:'gate',gate:'leaf',sign:-sign};
  for(const mast of masts){
    if(mast.userData.flagScale)imperialPennant(mast,mast.userData.flagScale);
    else cloth(mast,.69,.46,0,'crimson',1.37,1.08);
  }
  if(level<9)fire(root,0,.49,3.55,.66);
  if(level===10){
    for(const x of [-9.05,9.05]){
      const flow=new InstancedMesh(streamGeometry,streamMaterial,24);
      flow.name='Reflexos da cascata';
      flow.userData.motion={kind:'cascade',seed:x};
      flow.position.x=x;
      flow.frustumCulled=false;
      root.add(flow);
    }
    for(const x of [-2.75,2.75]){
      const lantern=new PointLight('#ffc66a',17,7,2);
      lantern.position.set(x,2.23,14.36);
      root.add(lantern);
    }
  }
  return true;
}

export function stockadeFallback(root) {
  const rng=random(8091);
  cube(root,'soil',0,-.47,0,32.8,1.32,31.6);
  cube(root,'grass',0,.19,0,32.73,.08,31.53);
  cube(root,'soil',0,.231,6.7,3.3,.025,17.9);
  for(const {x,z,w,d} of stockadeWalls){
    const long=w>d, size=long?w:d, segments=Math.max(1,Math.round(size/.62));
    for(let i=0;i<segments;i++){
      const each=(i+.5)*size/segments-size/2;
      const px=x+(long?each:0), pz=z+(long?0:each);
      const height=2.86+rng()*.73;
      cyl(root,planks[i%4],px,.17+height/2,pz,.325,height,.85,7);
      cyl(root,'oak',px,.17+height+.36,pz,.279,.73,0,7);
    }
  }
  for(const [name,sign] of leaves){
    const leaf=group(root,name);
    leaf.position.set(sign*2.36,0,13.33);
    for(let i=0;i<7;i++)cube(leaf,planks[i%4],-sign*(i+.5)*.327,1.68,0,.310,2.97+(i%3)*.09,.198);
    for(const y of [.79,2.45])cube(leaf,'timber',-sign*1.14,y,.144,2.3,.223,.11);
    beam(leaf,'oak',[-sign*.16,.66,-.15],[-sign*2.12,2.83,-.15],.17);
    cube(leaf,'iron',-sign*2.08,1.48,.183,.32,.15,.09);
  }
  const hall=group(root,'Guarnição');hall.position.set(-6.5,0,-4.1);
  cube(hall,'stone',0,.14,0,10,.29,7.4);
  for(const side of [-1,1]){
    cube(hall,'oak',side*4.95,1.56,0,.19,2.69,7.42);
    cube(hall,'timberLight',side*2.94,1.56,3.7,4.02,2.69,.18);
    for(const z of [-3.7,0,3.7])cube(hall,'timber',side*4.92,1.6,z,.23,2.9,.24);
  }
  cube(hall,'timberLight',0,1.56,-3.7,10,2.7,.20);
  const thatch=group(hall);thatch.rotation.y=Math.PI/2;
  roof(thatch,'straw',0,2.85,0,9.83,2.95,10.97,{});
  const tower=group(root,'Vigia');tower.position.set(7.4,0,-6.9);
  for(const x of [-2.26,2.26])for(const z of [-2.22,2.22]){
    cube(tower,'timber',x,4.49,z,.43,8.6,.45);
    cube(tower,'stone',x,.33,z,.84,.33,.85);
    beam(tower,'timberLight',[x,.51,z],[x,5.75,-z],.21);
  }
  cube(tower,'oak',0,5.92,0,5.15,.16,5.15);
  for(const s of [-1,1])cube(tower,'timberLight',s*2.6,6.62,0,.15,1.17,5.25);
  roof(tower,'straw',0,8.69,0,6.27,1.73,6.23,{hip:2.5});
  cube(tower,'timber',0,11.18,0,.10,2.2,.11);
  cloth(tower,0,11.97,.04,'crimson',.9,.77);
  cloth(root,-4.52,3.13,13.91,'crimson',.94,1.77);
  for(let i=0;i<16;i++)cube(root,'oak',7.4,.24+(i+1)*.353,5.6-(i+.5)*.62,1.77,.17,.64);
  for(const [x,z] of [[-9.7,.72],[5.7,-.83],[5.69,11.87],[9.5,-1.81]])barrel(root,x,z,.85,.2);
  for(const [x,z] of [[-10.1,-1.27],[-3.21,.93],[9.91,-.58],[4.31,11.9]])crate(root,x,z,.73,.2);
  for(let i=0;i<40;i++){
    const x=(rng()-.5)*32,z=(i%2?1:-1)*(13.65+rng()*1.5);
    if(Math.abs(x)<2.8&&z>0)continue;
    const s=.11+rng()*.32;
    ball(root,i%2?'lightStone':'darkStone',x,.24,z,s*1.35,s,s*.83);
    ball(root,'leafLight',x+s*.7,.25,z-.2,s*.70,s*.68,s*.8);
  }
  wireStockade(root,undefined,false);
}

