import * as THREE from 'three';
import { catalogue, flags } from '../core/catalog.js';
import { riverBridgeDeck } from '../core/water-structures.js';
import { random } from '../world/terrain-data.js';
import { group,cube,cyl,ball,disc,beam,roof,masonry,cloth,animated,fire,materials } from './kit.js';

export function barrel(p,x,z,s=1,y=0) {
  for(let i=0;i<3;i++){
    const bin=cyl(p,i===1?'oak':'timberLight',x,y+(.12+i*.245)*s,z,.32*s,.251*s,i===0?1.14:i===2?.87:1,11);
    if(i===0)bin.scale.z=bin.scale.x;
  }
  for(const level of [.13,.58]) cyl(p,'iron',x,y+level*s,z,.35*s,.071*s,1,11);
}

export function crate(p,x,z,s=1,y=0) {
  cube(p,'oak',x,y+s*.33,z,s*.68,s*.66,s*.62);
  for (const face of [-1,1]) {
    for(const v of [.11,.55]) cube(p,'timberLight',x,y+v*s,z+face*s*.322,s*.70,s*.103,s*.05);
    for(const u of [-.27,.27]) cube(p,'timberLight',x+u*s,y+s*.33,z+face*s*.322,s*.11,s*.65,s*.05);
    beam(p,'timberLight',[x-.23*s,y+.11*s,z+face*s*.348],[x+.23*s,y+.54*s,z+face*s*.348],.081*s);
  }
}
export function fence(p,x,z) {
  for(const side of [-1,1]){
    cube(p,'oak',x+side*.84,.56,z,.12,1.12,.14);
    cyl(p,'timberLight',x+side*.84,1.16,z,.09,.12,0,4);
  }
  for(const y of [.41,.76]) cube(p,'timberLight',x,y,z,2,.12,.105);
}
export function garden(p,x,z,w,d,rows) {
  cube(p,'soil',x,.132,z,w,.24,d);
  for(const sign of [-1,1]) {
    cube(p,rows?'oak':'stone',x+sign*w/2,.139,z,.135,.29,d+.128);
    cube(p,rows?'oak':'stone',x,.139,z+sign*d/2,w+.14,.29,.14);
  }
  const rng = random(Math.floor(w*106+d*703));
  for(let a=.33;a<w-.18;a+=rows?.55:.26) for(let b=.3;b<d-.22;b+=rows?.69:.45) {
    const xx=x-w/2+a,zz=z-d/2+b;
    if(!rows && rng()<.35) continue;
    const h=.09+rng()*.22;
    ball(p,rows?'leaf':'leafLight',xx,h+.14,zz,.125,h,.087);
    if(!rows) ball(p,['peach','white','gold'][Math.floor(rng()*3)],xx,h*2+.16,zz,.062,.046,.057);
  }
}

export function tree(p,id,x,z,s=1) {
  const rng=random((catalogue[id]?.index||0)*311+1202);
  const broad=!['pine','cypress','shrub','deadTree'].includes(id);
  const h={oak:6.2,pine:6.4,cypress:5.7,willow:5.1,birch:5.8,apple:3.7,pear:4.5,cherry:4.7,shrub:1.4,deadTree:5.3}[id]*s;
  const trunk={oak:.46,pine:.30,cypress:.19,willow:.37,birch:.20,apple:.25,pear:.24,cherry:.25,shrub:.13,deadTree:.31}[id]*s;
  const m=id==='birch'?'white':'timberLight';
  cyl(p,m,x,h*.36,z,trunk,h*.74,.58,8);
  if(id==='birch') for(let i=0;i<6;i++) cube(p,'timber',x+(.07+i%3*.025)*s,i*h*.105+.33,z+.19*s,.17*s,.064*s,.025*s);
  if(id==='pine'){
    for(let i=0;i<4;i++) cyl(p,i%3===0?'pineLight':'pine',x,h*(.43+i*.14),z,h*(.31-i*.064),h*.37,.02,8);
  } else if(id==='cypress'){
    ball(p,'pine',x,h*.63,z,h*.14,h*.43,h*.15,1);
    ball(p,'pineLight',x+h*.044,h*.59,z+h*.029,h*.095,h*.26,h*.10);
  } else if(id==='shrub'){
    ball(p,'leaf',x,h*.46,z,s*.58,h*.50,s*.52,1);
    ball(p,'leafLight',x+s*.31,h*.42,z+s*.2,s*.3,h*.3,s*.34);
  } else if(id==='deadTree') {
    for(let i=0;i<7;i++){
      const a=i*Math.PI*.71,y=h*(.34+i*.045);
      const end=[x+Math.cos(a)*h*.25,y+h*.30,z+Math.sin(a)*h*.25];
      beam(p,m,[x,y,z],end,.19*s);
      beam(p,'timber',[end[0]*.72+x*.28,y+h*.24,end[2]*.72+z*.28],[end[0]+.22*s,end[1]+.53*s,end[2]-.23*s],.095*s);
    }
  } else if (broad) {
    const shades=id==='cherry'?['peach','white','peach']:id==='willow'?['leafLight','grass','leafLight']:['leaf','leafLight','pineLight'];
    const spread={oak:2.63,willow:2.25,birch:1.50,apple:1.48,pear:1.35,cherry:1.73}[id]*s;
    for(let i=0;i<8;i++){
      const a=i*Math.PI*.76, distance=(i===0?0:.36+rng()*.48)*spread;
      const ox=x+Math.cos(a)*distance,oz=z+Math.sin(a)*distance;
      const y=h*(.64+rng()*.28);
      const radius=spread*(i===0?.65:.34+rng()*.19);
      beam(p,m,[x,h*.36,z],[ox,y-radius*.13,oz],.14*s);
      const canopy=ball(p,shades[i%3],ox,y,oz,radius,radius*(id==='willow'?1.34:.80+rng()*.36),radius*.9,1);
      canopy.rotation.set(rng(),rng()*4,rng()*.2);
      if(id==='apple'||id==='pear'){
        ball(p,id==='apple'?'red':'gold',ox+radius*.43,y-radius*.53,oz+radius*.55,s*.095);
      }
    }
  }
}
export function light(p,x,y,z,id,wall=false) {
  if(id==='bonfire'){
    for(let i=0;i<10;i++){
      const a=i*Math.PI/5;
      ball(p,'darkStone',x+Math.cos(a)*.69,y+.14,z+Math.sin(a)*.69,.22,.19,.22);
    }
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2;
      beam(p,'oak',[x+Math.cos(a)*.42,y+.13,z+Math.sin(a)*.42],[x,y+.52,z],.14);
    }
    fire(p,x,y+.31,z,.65);
  } else if(id==='brazier'){
    cyl(p,'iron',x,y+.45,z,.12,.83,.79,8);
    cyl(p,'darkStone',x,y+.89,z,.19,.23,2,10);
    fire(p,x,y+.99,z,.40);
  } else {
    if(!wall) cyl(p,'timber',x,y+1.12,z,.115,2.24,.83,8);
    else beam(p,'iron',[x,y+.23,z-.12],[x,y+1.18,z+.39],.11);
    if(id==='lantern') {
      beam(p,'iron',[x,y+2.20,z],[x,y+2.20,z+.43],.065);
      cube(p,'iron',x,y+1.94,z+.42,.39,.11,.36);
      cube(p,'flame',x,y+1.77,z+.42,.24,.28,.24);
      cube(p,'iron',x,y+1.60,z+.42,.39,.07,.36);
      for(const a of [-1,1]) for(const b of [-1,1]){
        cube(p,'iron',x+a*.15,y+1.77,z+.42+b*.15,.046,.33,.046);
      }
      fire(p,x,y+1.75,z+.42,.20);
    } else {
      const edge=wall?z+.39:z, h=wall?y+1.15:y+2.24;
      cyl(p,'iron',x,h,edge,.10,.23,1.67,9);
      fire(p,x,h+.15,edge);
    }
  }
}

export function stall(p,x,z,i) {
  const color=['crimson','blue','grass'][i%3];
  for(const dx of [-1.45,1.45]) for(const dz of [-1,1]) {
    cube(p,'oak',x+dx,dz<0?1.28:1.12,z+dz,.113,dz<0?2.55:2.25,.113);
  }
  for(let j=0;j<9;j++){
    const top=cube(p,j%2?'linen':color,x+(j-4)*.38,2.41,z,.386,.055,2.34);
    top.rotation.x=.15;
    cube(p,j%2?'linen':color,x+(j-4)*.38,2.15,z+1.14,.383,.18,.056);
  }
  cube(p,'oak',x,.89,z+.7,2.87,.13,.68);
  cube(p,'timberLight',x,.41,z+.75,2.81,.80,.18);
  for(let j=0;j<4;j++){
    if(j%2)crate(p,x+(j-1.5)*.59,z+.68,.48,.92);
    else for(let a=0;a<3;a++) ball(p,i%2?'hay':'red',x+(j-1.5)*.59+a*.13,1.06,z+.71,.095,.10,.082);
  }
  barrel(p,x-1.07,z-.47,.81);
}

function wheel(p,x,y,z,r,driven) {
  const rot=driven?animated(p,'roda','wheel',{axis:'x'}):group(p,'roda');
  rot.position.set(x,y,z);
  cyl(rot,'iron',0,0,0,r*.105,.23,1,8).rotation.z=Math.PI/2;
  for(let i=0;i<10;i++){
    const a=i*Math.PI/5,b=(i+1)*Math.PI/5;
    const end=[0,Math.cos(a)*r,Math.sin(a)*r];
    beam(rot,'oak',end,[0,Math.cos(b)*r,Math.sin(b)*r],r*.14);
    beam(rot,'timberLight',[0,0,0],end,r*.078);
  }
}
export function cart(p,x,z,s=1,driven=false) {
  const model=group(p,'carroca');
  model.position.set(x,0,z);
  model.scale.setScalar(s);
  cube(model,'oak',0,.86,0,1.57,.19,2.39);
  for (const sign of [-1,1]) {
    cube(model,'timberLight',sign*.75,1.15,0,.132,.53,2.40);
    for(const q of [-1.08,0,1.08]) cube(model,'timber',sign*.82,1.15,q,.12,.59,.12);
    wheel(model,sign*.95,.60,.36,.59,driven);
    wheel(model,sign*.9,.43,-.86,.43,driven);
    beam(model,'oak',[sign*.36,.89,1.1],[sign*.45,.71,2.49],.095);
  }
  crate(model,-.37,-.52,.91,.89);
  barrel(model,.37,.48,.92,.89);
  return model;
}

function banner(p,id) {
  const i=catalogue[id].index, style=i%3;
  const z=style===1?.28:0, height=[3.1,2.63,2.34][style];
  if(style!==1) {
    cyl(p,'oak',0,height*.48,0,.061,height+.25,1,8);
    ball(p,'gold',0,height+.26,0,.091);
    if(style===2) cube(p,'darkStone',0,.21,0,.51,.43,.42);
  } else {
    cube(p,'timber',0,1.25,-.095,.15,2.50,.16);
    beam(p,'iron',[0,height-.25,-.08],[0,height+.05,.22],.080);
  }
  const flag=cloth(p,0,height,z,flags[i],.91,1.58);
  const sigil=group(flag,'brasao');
  sigil.position.set(0,-.60,.038);
  sigil.userData.emblem=true;
  switch(i){
    case 0: disc(sigil,'gold',0,0,0,.16,.03,12);
      for(let a=0;a<8;a++){const t=a*Math.PI/4;beam(sigil,'gold',[Math.cos(t)*.18,Math.sin(t)*.18,0],[Math.cos(t)*.27,Math.sin(t)*.27,0],.033);} break;
    case 1: cube(sigil,'gold',0,-.08,0,.1,.27,.025);
      for(const s of [-1,1]){beam(sigil,'gold',[s*.04,0,0],[s*.18,.18,0],.043);beam(sigil,'gold',[s*.13,.12,0],[s*.13,.24,0],.033);} break;
    case 2: for(let a=0;a<4;a++){const t=a*Math.PI/4;beam(sigil,'white',[-Math.cos(t)*.22,-Math.sin(t)*.22,0],[Math.cos(t)*.22,Math.sin(t)*.22,0],.057);} break;
    case 3: for(let a=0;a<9;a++){const t=1.15+a*.45;disc(sigil,'white',Math.cos(t)*.19,Math.sin(t)*.18,0,.081,.033,8);} break;
    case 4: for(let a=0;a<5;a++){const t=(a-2)*.56;ball(sigil,'gold',Math.sin(t)*.15,Math.cos(t)*.18-.12,0,.085,.122,.026);} break;
    case 5: for(const y of [-.13,0,.13])for(let a=0;a<6;a++){const x=(a-2.5)*.066;beam(sigil,'white',[x,y+Math.sin(a)*.041,0],[x+.066,y+Math.sin(a+1)*.041,0],.034);} break;
    case 6: for(let a=0;a<5;a++){const t=a*Math.PI*.4;disc(sigil,'white',Math.cos(t)*.117,Math.sin(t)*.117,0,.093,.04,7);} disc(sigil,'gold',0,0,.021,.076,.036,8); break;
    case 7: cube(sigil,'white',0,-.06,0,.32,.29,.04); for(const x of [-.13,0,.13])cube(sigil,'white',x,.13,0,.074,.12,.04); cube(sigil,'shadow',0,-.12,.025,.082,.176,.017);break;
    case 8: cube(sigil,'gold',0,-.06,0,.39,.11,.04);for(const x of [-.15,0,.15])beam(sigil,'gold',[x*.82,-.08,0],[x,.17,0],.071);break;
    case 9: for(const s of [-1,1]){beam(sigil,'white',[s*.26,-.12,0],[s*.10,.18,0],.061);beam(sigil,'white',[s*.10,.18,0],[0,-.09,0],.061);}break;
    case 10: for(const s of [-1,0,1])ball(sigil,'white',s*.106,s===0?.081:.016,0,.084,.107,.038);cube(sigil,'gold',0,-.11,0,.31,.057,.042);break;
    case 11: const feather=ball(sigil,'white',.04,.03,0,.092,.22,.036);feather.rotation.z=-.48;beam(sigil,'gold',[-.14,-.19,.028],[.14,.18,.027],.032);break;
  }
}

function bridgeSection(parent,material,left,right,a,b,lowA,lowB,topA,topB){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([
    left,lowA,a, right,lowA,a, right,lowB,b, left,lowB,b,
    left,topA,a, right,topA,a, right,topB,b, left,topB,b,
  ],3));
  geometry.setIndex([0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,
    1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0]);
  const flat=geometry.toNonIndexed();
  geometry.dispose();
  flat.computeVertexNormals();
  const mesh=new THREE.Mesh(flat,materials[material]);
  mesh.castShadow=mesh.receiveShadow=true;
  parent.add(mesh);
}

function riverBridge(parent,w,d,rng){
  const half=d/2,arch=10;
  const soffit=z=>-.94+5.75*Math.sqrt(Math.max(0,1-(z/arch)**2));
  const stone=['stone','mortar','patio','lightStone'];
  const step=.625,count=Math.round(d/step);
  for(let i=0;i<count;i++){
    const a=-half+i*step,b=a+step;
    const topA=riverBridgeDeck(a),topB=riverBridgeDeck(b);
    const overWater=Math.abs((a+b)/2)<arch;
    const lowA=overWater?soffit(a):-2.8,lowB=overWater?soffit(b):-2.8;
    bridgeSection(parent,stone[Math.floor(rng()*3)],-w/2,w/2,a,b,lowA,lowB,topA-.09,topB-.09);
    for(let lane=0;lane<4;lane++){
      const left=-w/2+w*lane/4;
      bridgeSection(parent,stone[Math.floor(rng()*4)],left+.018,left+w/4-.018,a+.024,b-.024,
        topA-.10,topB-.10,topA,topB);
    }
    for(const side of [-1,1]){
      const x=side*(w/2-.22);
      bridgeSection(parent,i%3?'stone':'lightStone',x-.20,x+.20,a,b,topA-.12,topB-.12,topA+.78,topB+.78);
      bridgeSection(parent,'lightStone',x-.244,x+.244,a,b,topA+.72,topB+.72,topA+.85,topB+.85);
      if(overWater){
        const face=side*(w/2+.025),a1=a+.018,b1=b-.018;
        bridgeSection(parent,i%3?'lightStone':'patio',face-.06,face+.06,a1,b1,
          soffit(a1)-.055,soffit(b1)-.055,
          Math.min(topA-.12,soffit(a1)+.43),Math.min(topB-.12,soffit(b1)+.43));
      }
      if(i%8===0||i===count-1)cube(parent,'lightStone',x,(topA+topB)/2+.49,(a+b)/2,.57,1.08,.30);
    }
  }
}

const roadSubstrate=new THREE.BoxGeometry(1,1,1,8,1,8);
const sidewalkSubstrate=new THREE.BoxGeometry(1,1,1,4,1,8);
const pavingSlab=new THREE.BoxGeometry(1,1,1,3,1,3);

function stoneSlabs(p,w,d,cols,rows,top,rng,subdivide){
  const tileW=w/cols,tileD=d/rows, thickness=.041;
  const stones=['stone','mortar','pebble','patio','lightStone'];
  for(let x=0;x<cols;x++)for(let z=0;z<rows;z++){
    const material=stones[Math.floor(rng()*stones.length)];
    const slab=cube(p,material,(x+.5)*tileW-w/2,top-thickness/2,(z+.5)*tileD-d/2,
      tileW*(.88+rng()*.08),thickness,tileD*(.84+rng()*.09));
    if(subdivide)slab.geometry=pavingSlab;
    slab.rotation.y=(rng()-.5)*.108;
  }
}

export function pavedTread(p,w,d,bottom,top,rng){
  const mortarTop=top-.041;
  cube(p,'mortar',0,(mortarTop+bottom)/2,0,w,mortarTop-bottom,d);
  stoneSlabs(p,w,d,2,1,top,rng,true);
}

export const sidewalkStonePattern=()=>random(182+catalogue.sidewalkPaving.index*51);

export function road(p,id) {
  const item=catalogue[id], {w,d}=item;
  const rng=id==='sidewalkPaving'||item.treads?sidewalkStonePattern():random(182+item.index*51);
  if(item.treads){
    const depth=d/item.treads;
    for(let i=0;i<item.treads;i++){
      const tread=group(p);
      tread.position.z=(i+.5)*depth-d/2;
      pavedTread(tread,w,depth,0,.16+i*.12,rng);
    }
    return;
  }
  if(id==='terrainSlope'){
    const apron=new THREE.PlaneGeometry(6,4,12,8).rotateX(-Math.PI/2);
    const points=apron.attributes.position;
    for(let i=0;i<points.count;i++){
      const x=points.getX(i),z=points.getZ(i);
      const t=Math.min(1,Math.hypot(Math.max(0,Math.abs(x)-1.15),Math.max(0,Math.abs(z)-.6))/1.55);
      points.setY(i,1.2*(1-t*t*(3-2*t)));
    }
    apron.computeVertexNormals();
    p.add(new THREE.Mesh(apron,materials.grass));
    cube(p,'patio',0,1.24,0,2.3,.14,1.2);
    return;
  }
  if(id==='riverBridge')return riverBridge(p,w,d,rng);
  if(id==='bridge'||id==='walkway'){
    const bridge=id==='bridge', count=bridge?42:6;
    for(let i=0;i<count;i++){
      const z=(i+.5)*d/count-d/2;
      const y=bridge ? .16-Math.max(0,Math.abs(z)-6)*.09:.025;
      cube(p,i%4?'oak':'timberLight',0,y,z,w,.16,d/count-.023);
    }
    if(bridge){
      for(const x of [-w/2+.12,w/2-.12]){
        for(let z=-8.5;z<9;z+=1.7) cube(p,'timber',x,.62-Math.max(0,Math.abs(z)-6)*.09,z,.17,1,.18);
        for(const y of [.44,1.075]){
          beam(p,'timberLight',[x,y-.22,-9],[x,y,-6],.13);
          beam(p,'timberLight',[x,y,-6],[x,y,6],.13);
          beam(p,'timberLight',[x,y,6],[x,y-.22,9],.13);
        }
      }
    }
  } else {
    const surface=item.sidewalkOf??id;
    const material={dirt:'straw',gravel:'patio',paving:'mortar',cobbles:'darkStone',walkway:'timber'}[surface];
    const substrate=cube(p,material,0,.014,0,w,.052,d);
    substrate.geometry=item.sidewalkOf?sidewalkSubstrate:roadSubstrate;
    if(surface==='walkway'){
      const boards=8;
      for(let i=0;i<boards;i++){
        const plank=cube(p,i%3?'oak':'timberLight',0,.054,(i+.5)*d/boards-d/2,w-.035,.04,d/boards-.018);
        plank.geometry=pavingSlab;
      }
    } else if(surface==='cobbles'||surface==='paving'){
      const size=surface==='cobbles'?.4:item.sidewalkOf?.5:1;
      stoneSlabs(p,w,d,Math.round(w/size),Math.round(d/size),.0745,rng,surface==='paving');
    } else for(let i=0;i<w*d*5;i++){
      const radius=.029+rng()*(surface==='gravel'?.065:.039);
      ball(p,surface==='dirt'?(i%2?'soil':'hay'):(i%3?'lightStone':'mortar'),
        (rng()-.5)*(w-.09),.038,(rng()-.5)*(d-.09),radius,.019,radius*.71);
    }
  }
}

export function prop(p,id) {
  const item=catalogue[id];
  if(item.category==='banners') return banner(p,id);
  if(item.category==='roads') return road(p,id);
  if(item.category==='lights'||id==='brazier') return light(p,0,0,0,id);
  if(item.category==='green'){
    if(id==='bedRound'){
      cyl(p,'stone',0,.12,0,1.5,.24,1,20);
      cyl(p,'soil',0,.245,0,1.34,.045,1,20);
      for(let i=0;i<18;i++){const a=i*Math.PI/9;const block=cube(p,i%3?'pebble':'lightStone',Math.cos(a)*1.43,.19,Math.sin(a)*1.43,.16,.23,.47);block.rotation.y=-a;}
    } else if(id.startsWith('bed')){
      cube(p,'soil',0,.115,0,item.w,item.d*.0+.23,item.d);
      const material=id==='bedSquare'?'stone':'oak';
      for(const s of [-1,1]){
        cube(p,material,s*(item.w/2-.075),.13,0,.15,.27,item.d);
        cube(p,material,0,.13,s*(item.d/2-.075),item.w,.27,.15);
      }
    } else tree(p,id,0,0);
    return;
  }
  switch(id){
    case 'bench': case 'table':
      for(const x of [-.69,.69]) for(const z of [-.20,.20]) cube(p,'iron',x,.27,z,.11,.53,.11);
      for(const z of [-.17,0,.17]) cube(p,'oak',0,id==='table'?.85:.54,z,1.95,.10,.15);
      if(id==='bench'){
        for(const x of [-.69,.69]) cube(p,'iron',x,.72,-.24,.096,.46,.087);
        cube(p,'timberLight',0,.85,-.248,1.99,.14,.092);
      } else {
        for(const z of [-.66,.66]) {
          cube(p,'oak',0,.46,z,2.49,.12,.25);
          for(const x of [-.63,.63]) cube(p,'timber',x,.25,z,.13,.47,.13);
        }
        for(const x of [-.53,.53]) cube(p,'timber',x,.48,0,.12,.95,.14);
      }
      break;
    case 'well':
      cyl(p,'stone',0,.43,0,1.22,.86,1,16);
      cyl(p,'darkStone',0,.89,0,1.05,.05,1,16);
      cyl(p,'water',0,.918,0,.83,.03,1,16);
      for(const x of [-.96,.96]) cube(p,'oak',x,1.81,0,.17,2.03,.17);
      roof(p,'straw',0,2.68,0,2.57,.92,1.94,{tiles:false});
      beam(p,'oak',[-1.1,1.77,0],[1.12,1.77,0],.14);
      beam(p,'iron',[0,1.75,0],[0,1.25,0],.032);
      cyl(p,'oak',0,1.12,0,.18,.32,1.2,9);
      break;
    case 'fountain': {
      cyl(p,'darkStone',0,.19,0,2.14,.34,1,16);
      cyl(p,'water',0,.43,0,1.96,.055,1,16);
      for(let i=0;i<18;i++){
        const a=i*Math.PI/9;
        const edge=cube(p,i%3?'stone':'lightStone',Math.cos(a)*2.03,.41,Math.sin(a)*2.03,.27,.32,.72);
        edge.rotation.y=-a;
      }
      cyl(p,'stone',0,.67,0,.44,.76,.68,12);
      cyl(p,'lightStone',0,1.08,0,.22,.23,3,12);
      cyl(p,'darkStone',0,1.25,0,.38,.11,.55,12);
      const spray=animated(p,'jato','fountain');
      for(let i=0;i<13;i++){
        const a=i*Math.PI*2/13;
        ball(spray,'spray',Math.cos(a)*.29,1.42+(i%3)*.086,Math.sin(a)*.29,.04,.18,.039);
      }
      break;
    }
    case 'statue':
      masonry(p,0,0,1.34,.73,1.34,-.06);
      cyl(p,'lightStone',0,1.36,0,.46,1.29,.73,8);
      ball(p,'stone',0,2.17,0,.279,.34,.25,1);
      beam(p,'stone',[-.27,1.74,0],[-.49,1.29,.21],.22);
      beam(p,'stone',[.27,1.74,0],[.56,1.52,.32],.22);
      beam(p,'iron',[.53,.77,.30],[.55,2.61,.27],.084);
      break;
    case 'barrel': barrel(p,0,0,1.08); break;
    case 'crates': crate(p,-.36,.11,.9);crate(p,.35,-.04,.93);crate(p,.20,-.12,.64,.61);break;
    case 'logs':
      for(let i=0;i<9;i++){
        const wood=cyl(p,i%2?'oak':'timberLight',((i%3)-1)*.31,.17+Math.floor(i/3)*.24,0,.135,.96+(i%3)*.08,1,8);
        wood.rotation.x=Math.PI/2;
        disc(p,'hay',wood.position.x,wood.position.y,wood.scale.y*.50,.106,.026,8);
      }
      break;
    case 'cart': cart(p,0,-.28,.82); break;
    case 'stall': stall(p,0,0,0); break;
    case 'sign':
      cube(p,'oak',0,1.13,0,.113,2.25,.12);
      cube(p,'blue',0,1.91,.093,.57,.29,.11);
      for(const y of [1.86,1.96])cube(p,'gold',0,y,.155,.31,.027,.018);
      break;
    case 'scarecrow':
      beam(p,'oak',[0,0,0],[0,2.12,0],.10);
      beam(p,'oak',[-.65,1.49,0],[.65,1.49,0],.11);
      cyl(p,'blue',0,1.34,0,.28,.68,.78,7);
      ball(p,'hay',0,1.88,0,.20,.27,.19);
      cyl(p,'straw',0,2.10,0,.33,.07,1,10);
      cyl(p,'straw',0,2.24,0,.23,.26,.25,10);
      break;
    case 'fence': fence(p,0,0);break;
    case 'flowers': case 'planter': garden(p,0,0,item.w-.16,item.d-.16,false);break;
    case 'arch':
      for(const x of [-1.18,1.18]) cube(p,'oak',x,1.12,0,.19,2.26,.18);
      for(let i=0;i<8;i++){
        const a=i*Math.PI/8,b=(i+1)*Math.PI/8;
        beam(p,'oak',[Math.cos(a)*1.18,2.08+Math.sin(a)*.75,0],[Math.cos(b)*1.18,2.08+Math.sin(b)*.75,0],.148);
        ball(p,'leaf',Math.cos(a)*1.2,2.17+Math.sin(a)*.73,.19,.34,.29,.22,1);
        if(i%2)ball(p,'peach',Math.cos(a)*1.31,2.17+Math.sin(a)*.73,.29,.083);
      }
      break;
    case 'target':
      for(const x of [-.34,.34]) beam(p,'oak',[x,0,-.21],[x*.6,1.52,.08],.099);
      ['timberLight','linen','crimson','gold'].forEach((color,i)=>disc(p,color,0,1.34,.10+i*.045,.50-i*.115,.08,18));
      break;
    case 'rack':
      for(const x of [-.81,.81]) cube(p,'oak',x,.65,0,.12,1.27,.13);
      cube(p,'oak',0,.72,0,1.7,.12,.11);
      for(const x of [-.52,-.22,.12,.64]){
        beam(p,'timberLight',[x,.09,.19],[x,1.71,.04],.066);
        cyl(p,'iron',x,1.77,.05,.087,.24,0,5);
      }
      disc(p,'crimson',.30,.77,.18,.32,.12,8);
      disc(p,'gold',.30,.77,.27,.091,.09,8);
      break;
    case 'sundial':
      cyl(p,'lightStone',0,.39,0,.44,.76,.62,10);
      cyl(p,'stone',0,.82,0,.52,.10,1,12);
      beam(p,'iron',[0,.89,-.32],[0,1.21,.22],.072);
      cube(p,'iron',0,.895,.04,.071,.10,.57);
      break;
    default: throw new Error('Adereço ausente: '+id);
  }
}

