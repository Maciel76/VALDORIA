import { onVillagePerimeter } from './perimeter.js';
import * as THREE from 'three';
import { BAND,bounds,inWater,insideTerritory,outsideOriginalTerritory,terrainHeight,landscapeCell,
  ownedLandscapeCell,random,riverX,riverWidth,waterLevel,terrainBaseLevel,terrainCellSize,
  riverSurfaceWidth } from './terrain-data.js';
import { group,cyl,ball } from '../models/kit.js';

const dummy=new THREE.Object3D(), color=new THREE.Color();
const turf=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});
const plain=new THREE.MeshStandardMaterial({color:'#587846',roughness:1});
const evergreen=new THREE.MeshStandardMaterial({color:'white',roughness:1});
const moss=['#6c9045','#79994e','#88a056','#5f8544','#7f9b52','#668b4a'].map(value=>new THREE.Color(value));
const leaves=['#3d6744','#47734b','#5c7e46','#698349','#36593b','#4b7042'];
const dry=new THREE.Color('#ad9b70'), riverBed = new THREE.Color('#8c8264');
const plantShape=group();
const trunk=cyl(plantShape,'timber',0,0,0,1,1,.72,7);
const conifer=cyl(plantShape,'pine',0,0,0,1,1,.035,8);
const broadleaf=ball(plantShape,'leaf',0,0,0,1,1,1,1);
const stone=ball(plantShape,'stone',0,0,0,1,1,1);

function vegetationAtEdge(point,edge) {
  const x=THREE.MathUtils.clamp(point.x,edge.minX,edge.maxX);
  const z=THREE.MathUtils.clamp(point.z,edge.minZ,edge.maxZ);
  return !outsideOriginalTerritory(x,z) || Math.hypot(x-point.x,z-point.z)>3.5*point.size;
}

function markingHeight(x,z,seed,territory) {
  const ground=terrainHeight(x,z,seed,territory);
  const water=Math.abs(x-riverX(z,seed))<riverSurfaceWidth(z)?waterLevel:terrainBaseLevel;
  return Math.max(ground,water)+.28;
}

function outline(edge,seed,territory,color,opacity) {
  const points=[];
  const {minX,maxX,minZ,maxZ}=edge;
  const corners=[[minX,minZ],[maxX,minZ],[maxX,maxZ],[minX,maxZ],[minX,minZ]];
  for(let i=0;i<4;i++){
    const [x,z]=corners[i],[nextX,nextZ]=corners[i+1];
    const steps=Math.ceil(Math.hypot(nextX-x,nextZ-z)/terrainCellSize);
    for(let j=0;j<steps;j++){
      const px=x+(nextX-x)*j/steps,pz=z+(nextZ-z)*j/steps;
      points.push(new THREE.Vector3(px,markingHeight(px,pz,seed,territory),pz));
    }
  }
  const material=new THREE.LineBasicMaterial({color,transparent:true,opacity,depthTest:false,
    depthWrite:false,fog:false,toneMapped:false});
  const line=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),material);
  line.renderOrder=4;
  return line;
}

function patch(cx,cz,seed,territory) {
  const size=BAND,n=size/terrainCellSize;
  const g=new THREE.PlaneGeometry(size,size,n,n);
  g.rotateX(-Math.PI/2);
  g.translate((cx+.5)*size,0,(cz+.5)*size);
  const positions=g.attributes.position, colors=new Float32Array(positions.count*3);
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),z=positions.getZ(i);
    positions.setY(i,terrainHeight(x,z,seed,territory));
    const variation=Math.sin(x*.075+z*.082)*.49+Math.sin(x*.26-z*.35)*.24+Math.cos(z*.62+x*.55)*.23;
    color.copy(moss[Math.max(0,Math.min(5,Math.floor((variation+1)*3)))]);
    const distance=Math.abs(x-riverX(z,seed))-riverWidth(z)*.5;
    if(distance<6)color.lerp(dry, Math.min(.85,(6-distance)/9));
    if(inWater(x,z,seed))color.lerp(riverBed,.78);
    color.toArray(colors,i*3);
  }
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.computeVertexNormals();
  const land=new THREE.Mesh(g,turf);
  land.receiveShadow=true;
  return land;
}
function instances(scene, prototype, placements, {shadow=true}={}) {
  if(!placements.length)return;
  const result=new THREE.InstancedMesh(prototype.geometry,evergreen,placements.length);
  placements.forEach((point,i)=>{
    dummy.position.set(point.x,point.y,point.z);
    dummy.rotation.set(point.pitch||0,point.yaw||0,point.roll||0);
    dummy.scale.set(point.sx,point.sy,point.sz);
    dummy.updateMatrix();
    result.setMatrixAt(i,dummy.matrix);
    result.setColorAt(i,color.set(point.color));
  });
  result.castShadow=shadow;result.receiveShadow=true;
  result.computeBoundingSphere();
  scene.add(result);
}
const waterMaterial = new THREE.MeshStandardMaterial({color:'#629f9c',roughness:.37,metalness:.13,
  transparent:true,opacity:.94,side:THREE.DoubleSide});
const streamClock={value:0};
waterMaterial.onBeforeCompile=shader=>{
  shader.uniforms.streamClock=streamClock;
  shader.vertexShader='varying vec3 streamPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>',
    '#include <begin_vertex>\nstreamPosition=(modelMatrix*vec4(position,1.)).xyz;');
  shader.fragmentShader='varying vec3 streamPosition; uniform float streamClock;\n'+shader.fragmentShader.replace('#include <color_fragment>',
    '#include <color_fragment>\nfloat wave=sin(streamPosition.z*1.1+sin(streamPosition.x*.37)+streamClock*.9);\nfloat streak=sin(streamPosition.z*.38+streamPosition.x*2.+streamClock*.45);\ndiffuseColor.rgb *= .94+.08*wave+.11*pow(max(0.,streak),7.);');
};
const foam = new THREE.MeshBasicMaterial({color:'#b1d0ad',transparent:true,opacity:.31,depthWrite:false});

function river(scene,minZ,maxZ,seed) {
  const vertices=[],indices=[];
  const edge = [[],[]];
  for(let z=minZ;z<=maxZ;z+=2){
    const x=riverX(z,seed),w=riverSurfaceWidth(z);
    const index=vertices.length/3;
    vertices.push(x-w,waterLevel,z,x+w,waterLevel,z);
    if(index>0)indices.push(index-2,index,index-1,index,index+1,index-1);
    for(const [i,sign] of [-1,1].entries()) if(Math.round(z/2)%8<5){
      const side=x+(w-.48)*sign;
      const off=i*.025;
      edge[i].push(side,waterLevel+.021+off,z,side+sign*.17,waterLevel+.021+off,z,side+.20,waterLevel+.021+off,z+1.9);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const stream=new THREE.Mesh(geometry,waterMaterial);
  stream.receiveShadow=true;
  scene.add(stream);
  for(const positions of edge){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    scene.add(new THREE.Mesh(geometry,foam));
  }
}

export class Terrain {
  constructor(scene,seed,territory,enclosed=false) { this.scene=scene;this.update(seed,territory,enclosed); }

  update(seed,territory,enclosed=false) {
    const key=seed+JSON.stringify(territory)+enclosed;
    if(this.key===key)return;
    this.key=key;
    if(this.root){
      this.showExpansion(null);
      this.root.traverse(node=>{
        if(node.isInstancedMesh) node.dispose();
        else if(node.geometry) node.geometry.dispose();
      });
      this.border.material.dispose();
      this.root.removeFromParent();
    }
    const root=this.root=group(this.scene,'terreno');
    const edge=bounds(territory);
    const {minX,maxX,minZ,maxZ}=edge;
    this.obstacles=new Map();
    // Group vegetation by region for frustum culling and walking collision lookup.
    for(let cz=minZ/BAND-1;cz<=maxZ/BAND;cz++){
      for(let cx=minX/BAND-1;cx<=maxX/BAND;cx++){
        root.add(patch(cx,cz,seed,territory));
        const trunks=[],pines=[],oaks=[],stones=[];
        const owned=insideTerritory((cx+.5)*BAND,(cz+.5)*BAND,edge);
        const plants=owned
          ? ownedLandscapeCell(cx,cz,seed,edge).filter(p=>!enclosed||
            !onVillagePerimeter(p.x,p.z,territory,p.collider+2.4))
          : landscapeCell(cx,cz,seed).filter(p=>vegetationAtEdge(p,edge));
        if(owned&&plants.length)this.obstacles.set(cx+','+cz,plants);
        const rng=random(seed+cx*11273+cz*41481);
        for(const p of plants){
          const y=terrainHeight(p.x,p.z,seed,territory), s=p.size;
          const detail = rng();
          if(p.type==='rock'){
            stones.push({...p,y:y+.22*s,sx:.93*s,sy:s*.62,sz:s*.75,color:detail>.65?'#908d77':'#777c6b'});
            continue;
          }
          const tint=leaves[Math.floor(detail*leaves.length)];
          trunks.push({...p,y:y+1.75*s,sx:.32*s,sy:3.8*s,sz:.32*s,color:'#735038'});
          if(p.type==='pine'){
            for(let j=0;j<3;j++) pines.push({...p,y:y+(2.8+j*1.23)*s,sx:(2.05-j*.45)*s,sy:3.1*s,sz:(2.05-j*.45)*s,color:j===1&&detail>.3?'#63814d':tint});
          } else {
            for(let j=0;j<5;j++){
              const a=j*Math.PI*.6;
              oaks.push({...p,x:p.x+Math.cos(a)*j*.37*s,z:p.z+Math.sin(a)*j*.38*s,y:y+(5.35-.25*j)*s,
                sx:(2.17-j*.18)*s,sy:(1.72-j*.14)*s,sz:(2.01-j*.15)*s,color:j===3?'#799251':tint});
            }
          }
        }
        instances(root,trunk,trunks);instances(root,conifer,pines);instances(root,broadleaf,oaks);instances(root,stone,stones);
      }
    }
    const groundCover=new Map(),rng=random(seed+719);
    for(let i=0;i<3050;i++){
      const x=(rng()-.5)*256,z=(rng()-.5)*239;
      if(inWater(x,z,seed)||Math.abs(x-riverX(z,seed))<7)continue;
      if(Math.hypot(x,z)<60 && rng()<.55)continue;
      const scale=.15+rng()*.42,y=terrainHeight(x,z,seed,territory);
      const key=Math.floor(x/54)+','+Math.floor(z/54);
      if(!groundCover.has(key))groundCover.set(key,{grass:[],flowers:[]});
      const {grass,flowers}=groundCover.get(key);
      grass.push({x,y:y+scale*.35,z,yaw:rng()*6,sx:.11,sy:scale,sz:.092,color:rng()>.4?'#728b3c':'#534f2d'});
      if(i%6===0) flowers.push({x,y:y+scale*.9,z,yaw:i,sx:.052,sy:.075,sz:.048,color:i%4?'#dbbc6f':'#f0dfb2'});
    }
    for(const {grass,flowers} of groundCover.values()){
      instances(root,conifer,grass,{shadow:false});instances(root,broadleaf,flowers,{shadow:false});
    }
    const skirt=new THREE.Mesh(new THREE.PlaneGeometry(1600,1600),plain);
    skirt.rotation.x=-Math.PI/2;skirt.position.y=terrainBaseLevel;skirt.receiveShadow=true;
    root.add(skirt);
    river(root,minZ-120,maxZ+120,seed);
    this.border=outline(edge,seed,territory,'#f9dc97',.76);
    this.border.visible=false;root.add(this.border);
    this.waterSeed=seed;
    root.updateMatrixWorld(true);
    root.traverse(node=>{node.matrixAutoUpdate=false;});
  }

  showExpansion(edge,territory,purchased=false) {
    if(this.expansion){
      this.expansion.traverse(node=>{node.geometry?.dispose();node.material?.dispose();});
      this.expansion.removeFromParent();
      this.expansion=null;
    }
    if(!edge)return;
    const {minX,maxX,minZ,maxZ}=edge;
    const width=maxX-minX,depth=maxZ-minZ;
    const geometry=new THREE.PlaneGeometry(width,depth,width/terrainCellSize,depth/terrainCellSize);
    geometry.rotateX(-Math.PI/2);
    geometry.translate((minX+maxX)/2,0,(minZ+maxZ)/2);
    const vertices=geometry.attributes.position;
    for(let i=0;i<vertices.count;i++){
      vertices.setY(i,markingHeight(vertices.getX(i),vertices.getZ(i),this.waterSeed,territory));
    }
    const color=purchased?'#b7ff9b':'#ffd578';
    const fill=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,
      opacity:purchased?.17:.33,depthWrite:false,fog:false,toneMapped:false}));
    fill.renderOrder=2;
    this.expansion=group(this.root,'faixa de expansão');
    this.expansion.add(fill,outline(edge,this.waterSeed,territory,color,1));
  }

  isSolid(x,z,radius) {
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
      const group=this.obstacles.get((Math.floor(x/BAND)+dx)+','+(Math.floor(z/BAND)+dz));
      if(group?.some(p=>Math.hypot(x-p.x,z-p.z)<p.collider+radius))return true;
    }
    return false;
  }
  animate(seconds) {
    streamClock.value=seconds;
    waterMaterial.roughness=.37+Math.sin(seconds*.76+this.waterSeed)*.032;
    foam.opacity=.28+Math.sin(seconds*.75)*.08;
  }
}

