import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const colors = {
  stone:'#a99d81', lightStone:'#c2b497', darkStone:'#746d60', mortar:'#8c8070', pebble:'#9f937c',
  lime:'#e3cb9e', ocher:'#cda773', plaster:'#d9bc85', timber:'#503522', timberLight:'#835938',
  oak:'#99683c', roof:'#9e5136', redTile:'#b96041', clay:'#843f33', slate:'#3f5660', slateLight:'#576d74',
  straw:'#b98e45', hay:'#d4af61', shadow:'#302722', iron:'#4e4b43', lead:'#6e746c',
  pane:'#6d8d8b', glass:'#ffc465', linen:'#eed6a3', crimson:'#892f37', blue:'#305b65',
  red:'#bd4336', gold:'#e4aa49', patio:'#ab9a7f', soil:'#725136', grass:'#6b793c',
  leaf:'#597d40', leafLight:'#829646', pine:'#385d45', pineLight:'#58794e',
  peach:'#da8990', white:'#efe1c6', water:'#51a09e', spray:'#81c4bb',
  flame:'#ff9b38', smoke:'#aaa697', soot:'#42433a'
};
export const materials = Object.fromEntries(Object.entries(colors).map(([key,value])=>[key,new THREE.MeshStandardMaterial({
  name:key,color:value,roughness:key==='water'?.26:key==='iron'?.55:.94,
  metalness:key==='iron'?.22:0,
  ...(key==='flame'?{emissive:'#ff7a0d',emissiveIntensity:1.65}:{}),
  ...(key==='glass'?{emissive:'#ff9a2e',emissiveIntensity:.03}:{}),
  ...(key==='smoke'?{transparent:true,opacity:.27,depthWrite:false}:{}),
  ...(key==='water'?{transparent:true,opacity:.84}:{}),
  ...(key==='pane'?{emissive:'#ff9a2e',emissiveIntensity:.02}:{}),
})]));
const geometry = new Map();
const cached = (key,make) => {
  if (!geometry.has(key)) geometry.set(key,make());
  return geometry.get(key);
};
export const group = (parent,name='') => {
  const result = new THREE.Group();
  result.name=name;
  parent?.add(result);
  return result;
};
function mesh(parent, geometry, material, x,y,z,sx=1,sy=1,sz=1) {
  const result = new THREE.Mesh(geometry,typeof material==='string'?materials[material]:material);
  result.position.set(x,y,z);
  result.scale.set(sx,sy,sz);
  result.castShadow=result.receiveShadow=true;
  parent.add(result);
  return result;
}
export const cube = (p,m,x,y,z,w,h,d)=>mesh(p,cached('box',()=>new THREE.BoxGeometry(1,1,1)),m,x,y,z,w,h,d);
export const cyl = (p,m,x,y,z,r,h,taper=1,segments=10) => mesh(p,cached(`c${taper},${segments}`,
  ()=>new THREE.CylinderGeometry(taper,1,1,segments)),m,x,y,z,r,h,r);
export const ball = (p,m,x,y,z,rx,ry=rx,rz=rx,detail=0) => mesh(p,cached('ico'+detail,
  ()=>new THREE.IcosahedronGeometry(1,detail)),m,x,y,z,rx,ry,rz);
export const disc = (p,m,x,y,z,r,d,sides=12) =>{
  const model=cyl(p,m,x,y,z,r,d,1,sides);
  model.rotation.x=Math.PI/2;
  return model;
};
export function beam(p,m,a,b,width,depth=width) {
  const start=new THREE.Vector3(...a), finish=new THREE.Vector3(...b);
  const delta=finish.clone().sub(start);
  const position=start.addScaledVector(delta,.5);
  const result=cube(p,m,position.x,position.y,position.z,width,delta.length(),depth);
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
  return result;
}
export function roof(p,m,x,y,z,w,h,d,{hip=0,tiles=true}={}) {
  const points=[-w/2,0,-d/2, w/2,0,-d/2, w/2,0,d/2, -w/2,0,d/2, 0,h,-d/2+hip, 0,h,d/2-hip];
  const model=cached(`roof:${w},${h},${d},${hip}`,()=>{
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    g.setIndex([0,4,1,3,2,5,0,3,5,0,5,4,1,4,5,1,5,2,0,1,2,0,2,3]);
    const out=g.toNonIndexed();
    out.computeVertexNormals();
    return out;
  });
  mesh(p,model,m,x,y,z);
  const accent = {roof:'redTile',clay:'roof',slate:'slateLight',straw:'hay',crimson:'red',blue:'pineLight'}[m] || m;
  const tileColumns = Math.ceil(d/.72);
  if (tiles) {
    for (const sign of [-1,1]) for (let i=1;i<=6;i++) {
      const fraction=(i-.5)/6;
      const edge=w*.5*fraction, ht=h*(1-fraction);
      const limit=d/2-hip*(1-fraction);
      const gap=Math.max(.65,2*limit/tileColumns);
      for(let j=0;j<tileColumns;j++) {
        const depth=-limit+(j+.5)*gap + (i%2)*gap*.17;
        if (depth>limit-.14 || (j*17+i*13+sign)%5===0) continue;
        const tile=cube(p,(j+i*2)%4===0?accent:m,x+sign*edge,y+ht+.027,z+depth,w/13+.03,.055,gap*.93);
        tile.rotation.z=-sign*Math.atan2(h,w/2);
      }
    }
  }
  beam(p,accent,[x,y+h+.03,z-d/2+hip],[x,y+h+.03,z+d/2-hip],.17);
  if (!hip) for (const sign of [-1,1]) {
    const zEdge=z+sign*(d/2+.035);
    beam(p,'timber',[x-w/2,y,zEdge],[x,y+h,zEdge],.16,.12);
    beam(p,'timber',[x,y+h,zEdge],[x+w/2,y,zEdge],.16,.12);
  }
}

const stonePalette = ['stone','lightStone','stone','pebble','mortar'];
export function masonry(target,x,z,w,h,d,base=0,contrast='stone') {
  cube(target,contrast,x,base+h/2,z,w,h,d);
  const rng=(i,j)=>((i*13+j*7+Math.floor((w+d)*17))%19)/19;
  const rows=Math.ceil(h/.64);
  for (let row=0;row<rows;row++) {
    const y=base+(row+.5)*h/rows;
    for (const axis of [0,1]) {
      const length=axis===0?w:d, thick=axis===0?d:w;
      const columns=Math.max(1,Math.ceil(length/1.23));
      for(let i=0;i<columns;i++) {
        const fraction=(i+.5)/columns + (row%2?.13:-.13)/columns;
        const lateral=(fraction-.5)*length;
        if ((i+row*2)%5===1 && axis) continue;
        const shade = stonePalette[(i+3*row+axis)%stonePalette.length];
        for(const sign of [-1,1]) {
          const offset=thick/2-.01;
          const size=(length/columns)*(.83+rng(i,row)*.1);
          cube(target,shade,x+(axis===0?lateral:offset*sign),y,z+(axis===0?offset*sign:lateral),
            axis===0?size:.12,h/rows*(.76+rng(row,i)*.2),axis===0?.12:size);
        }
      }
    }
  }
}
export function windowAt(parent,x,y,z,w=.65,h=1,kind='glass',rotation=0) {
  const model=group(parent);
  model.position.set(x,y,z);
  model.rotation.y=rotation;
  cube(model,'lightStone',0,-h*.51,.034,w+.25,.15,.23);
  cube(model,'timber',0,0,0,w+.13,h+.15,.14);
  cube(model,kind,0,0,.08,w,h,.028);
  cube(model,'timber',0,0,.11,.075,h+.04,.045);
  cube(model,'timber',0,.03,.11,w+.02,.075,.045);
  return model;
}
export function archway(p,x,y,z,w,h,d=.2,cap=true,stone='lightStone') {
  const r=w/2, vertical=h-r;
  for (const xEdge of [-r,r]) cube(p,stone,x+xEdge,y+vertical/2,z,.24,vertical+.04,d);
  for(let i=0;i<9;i++){
    const a=(i+.5)*Math.PI/9;
    const tile=cube(p,i===4?'lightStone':stone,x+Math.cos(a)*r,y+vertical+Math.sin(a)*r,z,
      Math.max(.19,r*.35),.22,d);
    tile.rotation.z=a-Math.PI/2;
  }
  if (cap) {
    cube(p,'shadow',x,y+vertical/2,z-.035,w-.18,vertical,.09);
    disc(p,'shadow',x,y+vertical,z-.04,r-.12,.1);
  }
}
export function door(p,x,z,w=1.03,h=1.98) {
  archway(p,x,0,z,w+.35,h+.10,.19,false);
  for(let i=0;i<5;i++) cube(p,i%2?'oak':'timberLight',x+(i-2)*w/5,h/2-.06,z+.025,w/5-.015,h-.12,.11);
  for(const level of [.55,1.51]) cube(p,'iron',x,level,z+.09,w,.075,.045);
  ball(p,'gold',x+w*.3,1,z+.14,.075);
}
export function cloth(parent,x,y,z,color='crimson',width=.86,height=1.45) {
  const pivot=group(parent,'tecido');
  pivot.position.set(x,y,z);
  const g=new THREE.PlaneGeometry(width,height,10,8);
  g.translate(0,-height/2,0);
  const material= typeof color==='string' && materials[color] ? materials[color].color : color;
  const flag=mesh(pivot,g,new THREE.MeshStandardMaterial({color:material,side:THREE.DoubleSide,roughness:1}),0,0,0);
  flag.userData.wave={width,height};
  beam(parent,'oak',[x-width*.66,y+.035,z],[x+width*.66,y+.035,z],.07);
  return pivot;
}
export function animated(parent,name,kind, data={}) {
  const result=group(parent,name);
  result.userData.motion={kind,...data};
  return result;
}
export function fire(p,x,y,z,size=.33) {
  const flame=animated(p,'chama','flame',{seed:x+z});
  flame.position.set(x,y,z);
  cyl(flame,'flame',0,size*.22,0,size*.45,size*.9,.22,6);
  ball(flame,'gold',0,size*.09,0,size*.35,size*.38,size*.28);
  const light=new THREE.PointLight(0xff9138,13*size/.33,8,1.9);
  light.name='luz de fogo';
  light.position.y=.4;
  flame.add(light);
  return flame;
}
export function optimize(root) {
  root.updateMatrixWorld(true);
  function pack(section) {
    const buckets=new Map();
    function visit(object) {
      if (object!==section && (object.userData.motion || object.userData.wave || object.name==='tecido' || object.type==='PointLight')) {
        if (object.userData.motion) pack(object);
        return;
      }
      if (object.isMesh && !Array.isArray(object.material)) {
        const kind=object.material;
        if (!buckets.has(kind)) buckets.set(kind,[]);
        buckets.get(kind).push(object);
      }
      [...object.children].forEach(visit);
    }
    visit(section);
    const inverse=section.matrixWorld.clone().invert();
    for(const [material,meshes] of buckets) {
      if (meshes.length<2) continue;
      const copies=meshes.map(object=>{
        const source=object.geometry;
        const data=source.index?source.toNonIndexed():source.clone();
        data.deleteAttribute('uv');
        return data.applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      });
      const merged=mergeGeometries(copies,false);
      copies.forEach(copy=>copy.dispose());
      if (!merged) continue;
      meshes.forEach(object=>object.removeFromParent());
      const result=new THREE.Mesh(merged,material);
      result.castShadow=result.receiveShadow=true;
      section.add(result);
    }
  }
  pack(root);
  return root;
}

export function cloneModel(template) {
  const result=template.clone(true);
  result.traverse(object=>{
    if (object.userData.wave) object.geometry=object.geometry.clone();
  });
  return result;
}

