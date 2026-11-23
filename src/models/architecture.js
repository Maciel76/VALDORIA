import { catalogue } from '../core/catalog.js';
import { castleWalls, castleTowers, hallWalls } from '../core/geometry.js';
import { group,cube,cyl,disc,ball,beam,roof,masonry,windowAt,archway,door,cloth,animated,fire } from './kit.js';
import { cart, stall, tree, barrel, crate, fence, light, garden } from './props.js';

function chimney(p,x,z,h) {
  masonry(p,x,z,.69,1.55,.66,h-.6,'darkStone');
  cube(p,'darkStone',x,h+.92,z,.91,.21,.85);
  for(let i=0;i<3;i++){
    const puff=animated(p,'fumaça','smoke',{phase:i/3});
    puff.position.set(x,h+.99,z);
    ball(puff,'smoke',0,0,0,.28,.35,.24,1);
  }
}

function timberFrame(p,w,d,y,h) {
  const fy=y+h/2;
  for(const sign of [-1,1]){
    const front=sign*(d/2+.032);
    for(const x of [-w/2+.07,0,w/2-.07]) cube(p,'timber',x,fy,front,.19,h,.13);
    for(const high of [y+.08,y+h-.07]) cube(p,'timber',0,high,front,w,.22,.16);
    for(const x of [-1,1]) beam(p,'timber',[x*w*.14,y+.13,front],[x*(w/2-.1),y+h-.1,front],.14,.13);
    const side=sign*(w/2+.035);
    for(const z of [-d/2+.1,-d/6,d/6,d/2-.1]) cube(p,'timber',side,fy,z,.13,h,.18);
    for(const high of [y+.05,y+h-.05]) cube(p,'timber',side,high,0,.16,.2,d);
  }
}

function house(p,{w=5,d=5,h=3.25,upper=0,wall='plaster',top='roof',stone=false,porch=false,commercial=false,shed=false,chimneyOn=true}={}) {
  const foot=Math.max(.42,Math.min(.7,h*.15));
  masonry(p,0,0,w+.12,foot,d+.13,-.34,'darkStone');
  if (stone) masonry(p,0,0,w,h,d,foot-.34);
  else {
    cube(p,wall,0,h/2+foot-.34,0,w,h,d);
    timberFrame(p,w,d,foot-.34,h);
  }
  const level=h+foot-.34;
  const secondW=upper?w+.42:w, secondD=upper?d+.38:d;
  if (upper) {
    cube(p,wall,0,level+upper/2,0,secondW,upper,secondD);
    timberFrame(p,secondW,secondD,level,upper);
    for(const side of [-1,1]) for(let x=-w/2+.36;x<w/2;x+=Math.max(.65,w/7)) {
      cube(p,'timber',x,level-.14,side*d/2,.17,.34,.49);
    }
    for(const sign of [-1,1]) for(const x of [-w*.27,0,w*.27]) windowAt(p,x,level+upper*.56,sign*(secondD/2+.077),
      .66,.90,'pane',sign<0?Math.PI:0);
  }
  const edgeY=level+upper;
  const roofHeight=w*(shed?.29:top==='straw'?.43:.47);
  if (!shed) {
    const gable=group(p);
    roof(gable,stone?'lightStone':wall,0,edgeY-.05,0,w-.02,roofHeight*.93,secondD,{tiles:false});
    if (!stone) for(const sign of [-1,1]){
      cube(p,'timber',0,edgeY+.53,sign*(secondD/2+.035),.16,1.15,.11);
      beam(p,'timber',[-w*.33,edgeY+.43,sign*(secondD/2+.06)],[w*.33,edgeY+.43,sign*(secondD/2+.06)],.13,.12);
    }
  }
  roof(p,top,0,edgeY,0,secondW+.7,roofHeight,secondD+.74,{hip:shed?1.15:0});
  door(p,0,d/2+.10,1.06,2.12);
  cube(p,'stone',0,.085,d/2+.43,1.58,.17,.62);
  for(const x of [-w*.29,w*.28]) {
    windowAt(p,x,Math.min(1.75,h*.62),d/2+.09,commercial?.95:.62,1.03,'glass');
    windowAt(p,x,Math.min(1.8,h*.62),-d/2-.09,.63,1.03,'pane',Math.PI);
  }
  if (w>4) {
    windowAt(p,w/2+.086,1.7,-d*.21,.7,1.05,'glass',Math.PI/2);
    windowAt(p,-w/2-.086,1.67,d*.17,.7,1.05,'pane',-Math.PI/2);
  }
  if (chimneyOn) chimney(p,w*.3,-d*.19,edgeY+roofHeight*.68);
  if (porch) {
    cube(p,'oak',0,.27,d/2+.43,w-.25,.32,.92);
    for(const x of [-w*.44,w*.44]) cube(p,'timber',x,1.59,d/2+.80,.23,2.68,.23);
    const canopy=cube(p,top,0,2.91,d/2+.47,w+.37,.15,1.33);
    canopy.rotation.x=.23;
  }
  if (commercial) {
    const position=d/2+.2;
    beam(p,'iron',[1.18,2.32,position],[1.18,2.32,position+.64],.075);
    cube(p,'blue',1.18,1.97,position+.65,.075,.5,.59);
    cube(p,'gold',1.13,1.97,position+.65,.025,.27,.38);
    barrel(p,-w*.32,d/2+.49,.92);
  }
}

function stallBuilding(p,w,d,type) {
  for(const x of [-w/2+.22,w/2-.22]) for(const z of [-d/2+.16,d/2-.16]) {
    cube(p,'timber',x,1.52,z,.24,3,.24);
    beam(p,'oak',[x,2.31,z],[x*.79,2.96,z],.16);
  }
  cube(p,'timber',0,1.55,-d/2+.1,w,3.10,.24);
  masonry(p,0,0,w+.1,.32,d+.2,-.13,'darkStone');
  roof(p,type==='smith'?'slate':type==='sawmill'?'straw':'roof',0,3.02,0,w+.65,w*.26,d+.6,{hip:.8});
  if(type==='smith'){
    masonry(p,-w*.29,-d*.19,2.3,1.14,2.1,0,'darkStone');
    fire(p,-w*.29,1.18,-d*.19,.48);
    chimney(p,-w*.29,-d*.19,3.6);
    cube(p,'timber',w*.21,.49,d*.03,.61,.95,.61);
    cube(p,'iron',w*.21,1.06,d*.03,1.08,.27,.56);
    const hammer=animated(p,'martelo','hammer');
    hammer.position.set(w*.29,1.37,d*.02);
    cube(hammer,'oak',0,.32,0,.09,.63,.09);
    cube(hammer,'iron',0,.65,0,.37,.19,.19);
  } else if (type==='sawmill'){
    for(let i=0;i<6;i++){
      const log=cyl(p,'oak',-w*.29+i%3*.4,.4+Math.floor(i/3)*.41,0,.195,d-.9);
      log.rotation.x=Math.PI/2;
    }
    cube(p,'timber',w*.24,.68,.13,1.8,.2,d*.7);
    disc(p,'lead',w*.24,.95,0,.47,.11,20).rotation.y=Math.PI/2;
  } else {
    for(const x of [-w*.24,0,w*.24]){
      cube(p,'oak',x,1.02,-d*.23,.13,1.75,d*.54);
      cube(p,'hay',x+.58,.41,-d*.34,1.08,.79,1.8);
    }
  }
}

function church(p,w,d,major) {
  let body = group(p);
  body.position.z=-d*.1;
  const nv=w*.64, nd=d*.72, wallY=major?5.8:3.65;
  masonry(body,0,0,nv,wallY,nd,-.48);
  roof(body,'slate',0,wallY-.45,0,nv+.67,nv*.47,nd+.63);
  for(const sign of [-1,1]) for(let i=0;i<4;i++){
    const z=-nd/2+.58+i*(nd-1.16)/3;
    masonry(body,sign*(nv/2+.22),z,.66,wallY*.7,.69,-.3,'lightStone');
    if(i<3) windowAt(body,sign*(nv/2+.08),wallY*.58,z+nd*.115,.49,1.56,'pane',sign*Math.PI/2);
  }
  const towerW=w*(major?.30:.39), towerZ=d*.25, towerY=major?12:7.2;
  masonry(p,0,towerZ,towerW,towerY,towerW,-.52);
  for(const y of [3.1,towerY-1.7,towerY-.9]) cube(p,'lightStone',0,y,towerZ,towerW+.29,.25,towerW+.29);
  const top=cyl(p,'slate',0,towerY+1.36,towerZ,towerW*.77,3.85,0,4);
  top.rotation.y=Math.PI/4;
  const capHeight=towerY+3.4;
  beam(p,'gold',[0,capHeight-.1,towerZ],[0,capHeight+1,towerZ],.09);
  beam(p,'gold',[-.39,capHeight+.61,towerZ],[.39,capHeight+.61,towerZ],.09);
  const front=towerZ+towerW/2+.08;
  door(p,0,front,1.35,2.55);
  archway(p,0,towerY-3.05,front,.83,1.6,.2,true);
  disc(p,'lightStone',0,major?5.25:4.18,front,.65,.21);
  disc(p,'pane',0,major?5.25:4.18,front+.123,.46,.045);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;
    beam(p,'gold',[0,major?5.25:4.18,front+.16],[Math.sin(a)*.4,(major?5.25:4.18)+Math.cos(a)*.4,front+.16],.047);
  }
  cube(p,'patio',0,.08,front+.4,2.6,.17,.95);
}

export function battlement(p,x,z,w,d,h) {
  masonry(p,x,z,w,h,d,-.28);
  cube(p,'lightStone',x,h-.29,z,w+.17,.23,d+.17);
  const length=Math.max(w,d), n=Math.max(1,Math.round(length/1.46));
  for(let i=0;i<n;i++){
    const at=(i+.5)*length/n-length/2;
    const side=w>d ? d*.35 : w*.35;
    for(const sign of [-1,1]){
      cube(p,i%3===0?'lightStone':'stone',x+(w>d?at:side*sign),h+.19,z+(w>d?side*sign:at),
        w>d?.73:.41,.78,w>d?.41:.73);
    }
  }
}

function tower(p,x,z,w=4,h=9,{round=false,spire=true,banner=false}={}) {
  if (round) {
    cyl(p,'stone',x,h/2-.2,z,w*.53,h,.94,14);
    for(let i=0;i<Math.floor(h/.7);i++) cyl(p,i%3===0?'darkStone':'pebble',x,i*.7+.33,z,w*(.533-.025*i/(h/.7)),.095,1,14);
    cyl(p,'lightStone',x,h-.48,z,w*.60,.54,1,14);
    if (spire) cyl(p,'slate',x,h+w*.44,z,w*.64,w*1.02,.03,14);
  } else {
    masonry(p,x,z,w,h,w,-.44);
    cube(p,'lightStone',x,h-.30,z,w+.52,.39,w+.52);
    for(const i of [-1,1]) for(const j of [-1,0,1]){
      cube(p,'stone',x+i*w*.43,h+.08,z+j*w*.38,.57,.86,.62);
      if(j===0) cube(p,'stone',x,h+.08,z+i*w*.44,.62,.86,.57);
    }
    if (spire) {
      const top=cyl(p,'slate',x,h+w*.48,z,w*.72,w*1.05,.04,4);
      top.rotation.y=Math.PI/4;
      ball(p,'gold',x,h+w,z,.12);
    }
  }
  for(let i=0;i<3;i++) windowAt(p,x+(i%2?.62:-.15),h*.31+i*h*.21,z+w*.52,.26,.92,'glass');
  if(banner) {
    cloth(p,x,h*.74,z+w*.54,'crimson',w*.37,h*.23);
    cube(p,'gold',x,h*.68,z+w*.54+.08,.28,.38,.05);
  }
}

function swingLeaves(p,gap,z,height=2.75,inward=false) {
  for(const sign of [-1,1]){
    const leaf=animated(p,sign<0?'folha-esquerda':'folha-direita','gate',{gate:'leaf',sign:inward?-sign:sign});
    leaf.position.set(gap/2*sign,0,z);
    for(let i=0;i<7;i++){
      const x=-sign*(i+.5)*gap/14;
      cube(leaf,i%2?'oak':'timberLight',x,height/2,0,gap/14-.018,height-(i%3)*.085,.17);
    }
    for(const y of [height*.25,height*.70])cube(leaf,'iron',-sign*gap*.24,y,.1,gap*.48,.1,.09);
    if(inward){
      beam(leaf,'timber',[0,height*.23,-.095],[-sign*(gap/2-.12),height*.74,-.095],.16,.11);
      for(const y of [height*.25,height*.70])for(const i of [1,2,3]){
        ball(leaf,'lead',-sign*gap*.12*i,y,.16,.055);
      }
    }
  }
}

function cityGate(p,w) {
  const gap=w-4;
  for(const sign of [-1,1]){
    const x=sign*(w/2-1);
    masonry(p,x,0,2,4.86,2.8,-.36);
    tower(p,x,-.04,2,6.91,{spire:false});
    light(p,x,1.58,1.51,'torch',true);
    cloth(p,x,5.3,1.42,'crimson',.63,1.19);
  }
  const roofY=6.21;
  masonry(p,0,0,gap+.14,2.17,2.56,roofY-2.17);
  cube(p,'lightStone',0,roofY,0,gap+.18,.24,2.78);
  for(const sign of [-1,1]){
    archway(p,0,-.03,sign*1.39,gap-.13,4.17,.25,false);
    for(const x of [-1.33,0,1.33])cube(p,'stone',x,roofY+.39,sign*1.06,.73,.69,.50);
  }
  disc(p,'darkStone',0,5.17,1.34,.34,.13,9);
  disc(p,'gold',0,5.17,1.42,.21,.047,10);
  swingLeaves(p,gap,.18,3.71,true);
}

function createGate(p,w,z,fortified,height) {
  const side=fortified?2:.8, gap=w-side*2;
  for(const sign of [-1,1]) {
    const x=sign*(gap/2+side/2);
    if(fortified) {
      tower(p,x,z,side+.3,height,{spire:false});
      light(p,x,height*.42,z+1.1,'torch',true);
    } else cube(p,'timber',x,1.55,z,side,3.1,side+.09);
  }
  if (fortified) {
    archway(p,0,0,z+.92,gap-.18, height*.63,.7,false);
    masonry(p,0,z,gap+.25,height*.35,1.52,height*.59);
    const grille=animated(p,'grade-levadica','gate',{gate:'grille',height:height*.6});
    grille.position.set(0,0,z+.45);
    for(let i=0;i<9;i++) cube(grille,'iron',((i/8)-.5)*gap,height*.29,0,.1,height*.6,.14);
    for(const y of [1.08,height*.48]) cube(grille,'iron',0,y,0,gap,.13,.15);
    const bridge=animated(p,'ponte-levadica','gate',{gate:'bridge'});
    bridge.position.set(0,0,z+1.07);
    for(let i=0;i<10;i++) cube(bridge,i%2?'oak':'timberLight',0,.105,(i+.5)*.38,gap-.16,.19,.37);
    for(const x of [-gap*.44,gap*.44]) {
      cube(bridge,'timber',x,.19,1.91,.19,.22,3.83);
      beam(p,'iron',[x,2.95,z+1.04],[x,.17,z+3.5],.055);
    }
    for(const sign of [-1,1]) cloth(p,sign*(w*.35),height*.78,z+1.18,'crimson',.68,1.28);
  } else swingLeaves(p,gap,z);
}

function stairs(p,x,z,w,d,height,base=.02) {
  for(let i=0;i<13;i++){
    const current=base+(i+1)*height/13;
    const dz=d/13;
    cube(p,i%3===0?'lightStone':'stone',x,current-height/26,z+d/2-(i+.5)*dz,w,height/13+.02,dz+.016);
  }
}
function keep(p) {
  cube(p,'darkStone',0,-.47,-.15,31.9,.87,31.05);
  cube(p,'patio',0,.036,-.15,31.2,.1,30.7);
  for(let x=-12;x<=12;x+=1.08) for(let z=-10;z<=11;z+=.88) {
    if(Math.abs(x)>4 && (x*13+z*8)%5>2) continue;
    cube(p,(Math.round(x*3+z*3)%5===0)?'lightStone':'pebble',x,.095,z,1.04,.042,.83);
  }
  for(const {x,z,w,d} of castleWalls) battlement(p,x,z,w,d,4.68);
  for(const [i,[x,z]] of castleTowers.entries()) tower(p,x,z,4.2,i>1?8.6:10.8,{round:i%2===0});
  createGate(p,9.5,12,true,7.1);
  stairs(p,-11,-1,1.76,8,4.65);
  cube(p,'stone',-12.2,4.64,-5,3.1,.17,1.6);
  for (const {x,z,w,d} of hallWalls) masonry(p,x,z,w,6.8,d,0);
  archway(p,0,0,-.93,3.55,4.2,.26,false);
  cube(p,'lightStone',0,5.58,-1.41,12.65,2.24,.67);
  windowAt(p,0,5.46,-.98,1.55,1.25,'pane');
  roof(p,'slate',0,6.77,-6.2,13.8,5.8,11.65);
  tower(p,7.3,-9.1,4.55,13.9,{banner:true});
  // Stone seal reserved for an external GLB when it is available.
  const seal=group(p,'selo-do-portao');
  seal.position.set(0,5.6,12.85);
  disc(seal,'gold',0,0,0,.38,.15,10);
  for(const x of [-5.43,5.43]){
    for(const z of [-8.5,-4.8]) fire(p,x,2.1,z,.28);
    cloth(p,x*.66,4.15,-.94,'crimson',.91,1.9);
  }
  for(const x of [-2.9,2.9]) {
    cube(p,'oak',x,.76,-7.1,1.05,.15,4);
    for(const z of [-8.55,-5.65]) cube(p,'timber',x,.37,z,.28,.7,.28);
  }
  windowAt(p,3.87,3.5,-.8,.59,1.1,'glass');
  windowAt(p,-3.87,3.5,-.8,.59,1.1,'glass');
  cube(p,'crimson',0,.106,-6.15,1.68,.021,7);
}

function mill(p,w,d,water) {
  if(water){
    house(p,{w:w*.67,d:d*.76,h:3.39,top:'slate',stone:true});
    const wheel=animated(p,'roda-dagua','mill',{axis:'x',speed:.70});
    wheel.position.set(w*.40,1.92,-.42);
    wheel.rotation.y=Math.PI/2;
    for(const side of [-1,1]){
      for(let i=0;i<12;i++){
        const a=i*Math.PI/6, b=(i+1)*Math.PI/6, r=1.86;
        beam(wheel,'oak',[Math.cos(a)*r,Math.sin(a)*r,side*.34],[Math.cos(b)*r,Math.sin(b)*r,side*.34],.19);
      }
    }
    wheel.userData.motion.axis='z';
    for(let i=0;i<10;i++){
      const a=i*Math.PI*.2;
      const plank=cube(wheel,'timberLight',Math.cos(a)*1.88,Math.sin(a)*1.88,0,.38,.16,.7);
      plank.rotation.z=a;
      beam(wheel,'oak',[0,0,.07],[Math.cos(a)*1.89,Math.sin(a)*1.89,.07],.18);
    }
  } else {
    const Y=8.4;
    cyl(p,'stone',0,(Y-.4)/2,0,w*.28,Y,.78,12);
    for(let i=1;i<13;i++) cyl(p,i%3?'pebble':'lightStone',0,i*Y/13,0,w*(.283-.063*i/13),.09,1,12);
    cyl(p,'slate',0,Y+1.59,0,w*.285,3.39,.025,12);
    door(p,0,w*.273,1.04,1.99);
    for(const y of [3.65,6.45]) windowAt(p,-.65,y,w*(.283-y*.007),.39,.64,'pane');
    const blades=animated(p,'pas-do-moinho','mill',{axis:'z',speed:.38});
    blades.position.set(0,Y-.65,w*.28+.3);
    for(let i=0;i<4;i++){
      const arm=group(blades);
      arm.rotation.z=i*Math.PI/2;
      cube(arm,'timber',0,2.88,0,.20,5.66,.24);
      cube(arm,'linen',.42,3.57,.025,.84,3.91,.095);
      for(let j=0;j<9;j++) cube(arm,'oak',.42,1.68+j*.47,.089,.86,.055,.062);
    }
    disc(blades,'iron',0,0,.16,.33,.24,9);
  }
}

export function structure(p,id) {
  const {w,d,index}=catalogue[id];
  const a=w*.84,b=d*.78;
  if(id==='hut') house(p,{w:a,d:b,h:2.25,wall:'lime',top:'straw',shed:true});
  else if(id==='peasant') house(p,{w:a,d:b,h:2.95,wall:'plaster',top:'roof'});
  else if(id==='timber') house(p,{w:a,d:b,h:2.84,upper:2.15,wall:'lime',top:'roof'});
  else if(id==='terrace') for(const sign of [-1,1]){
    const side=group(p);side.position.x=sign*w*.228;
    house(side,{w:w*.423,d:b,h:2.83,upper:sign<0?1.79:0,wall:sign<0?'ocher':'lime',top:sign<0?'clay':'straw'});
  }
  else if(id==='noble') house(p,{w:a,d:b,h:5.7,top:'slate',stone:true,porch:true});
  else if(id==='manor' || id==='abbey') {
    for(const sign of [-1,0,1]){
      const wing=group(p);wing.position.set(sign*w*.353,0,sign?(id==='abbey'?.0:-1):-d*.28);
      if(sign) wing.rotation.y=Math.PI/2;
      house(wing,{w:sign?d*.63:w*.44,d:sign?w*.23:d*.42,h:sign?3.62:5.3,stone:id==='abbey'||sign===0,top:sign?'roof':'slate',porch:!sign});
    }
    if(id==='abbey') { garden(p,0,3,5,4,false); light(p,4,0,4,'lantern'); }
  }
  else if(id==='tavern') house(p,{w:a,d:b,h:2.87,upper:1.82,wall:'ocher',top:'clay',porch:true,commercial:true});
  else if(id==='inn') {
    house(p,{w:w*.84,d:d*.73,h:2.89,upper:2.33,wall:'lime',top:'slate',porch:true,commercial:true});
    cloth(p,-3.4,4.53,d*.39+.28,'blue',.67,1.16);
  }
  else if(id==='bakery') {
    house(p,{w:a,d:b,h:2.85,wall:'ocher',top:'straw',commercial:true});
    const oven=cyl(p,'stone',w*.33,.72,d*.24,1.16,1.44,.72,12);
    oven.rotation.z=.09;
    fire(p,w*.33,.69,d*.42,.23);
  }
  else if(id==='smith'||id==='sawmill'||id==='stable') stallBuilding(p,a,b,id);
  else if(id==='market') for(const [i,x] of [-4,0,4].entries()) stall(p,x,-3,i);
  else if(id==='windmill'||id==='watermill') mill(p,w,d,id==='watermill');
  else if(id==='barn') {
    house(p,{w:a,d:b,h:3.42,wall:'timberLight',top:'straw',shed:true,chimneyOn:false});
    cube(p,'oak',0,1.52,b/2+.16,2.67,2.9,.23);
    for(const sign of [-1,1]) beam(p,'timber',[sign*1.13,.23,b/2+.3],[sign*.054,2.8,b/2+.3],.16);
  }
  else if(id==='farm') {
    const shack=group(p);shack.position.set(-5.5,0,-3.8);
    house(shack,{w:5.7,d:4.6,h:2.35,top:'straw',wall:'timberLight'});
    garden(p,-3.39,3.43,6.2,5.4,true);
    for(const x of [2.5,5.6]) for(const z of [1.4,4.7]) tree(p,'apple',x,z,.6);
    for(let x=-7;x<8;x+=1.98) fence(p,x,7.31);
  }
  else if(id==='church'||id==='chapel') church(p,w,d,id==='church');
  else if(id==='council') {
    house(p,{w:a,d:b,h:4.25,upper:1.34,top:'slate',stone:true,porch:true});
    cloth(p,0,4.62,b/2+.36,'crimson',1.07,1.65);
    for(const x of [-2.3,2.3]) cyl(p,'lightStone',x,1.45,b/2+.81,.21,2.73,.83,10);
  }
  else if(id==='barracks') {
    const bldg=group(p);bldg.position.z=-2;
    house(bldg,{w:w*.8,d:4.7,h:3.58,top:'slate',stone:true});
    for(const sign of [-1,1]) crate(p,sign*w*.33,2.7,1.1);
  }
  else if(id==='watch') {
    for(const x of [-1.79,1.79]) for(const z of [-1.79,1.79]){
      cube(p,'timber',x,3.18,z,.32,6.35,.32);
      beam(p,'oak',[x,.5,z],[x,6,-z],.21);
      beam(p,'oak',[x,.5,z],[-x,6,z],.21);
    }
    stairs(p,.2,0,1.3,4.8,5.8);
    cube(p,'timber',0,6,0,4.1,.33,4.1);
    cube(p,'timberLight',0,7,0,4.02,2.31,4.02);
    for(const side of [-1,1]) windowAt(p,side*.94,7.19,2.08,.55,.77);
    roof(p,'straw',0,8.09,0,4.84,2.12,4.82,{hip:1.2});
  }
  else if(id==='keep') keep(p);
  else if(id==='wall'||id==='wallShort') battlement(p,0,0,w,d,4.05);
  else if(id==='corner') { battlement(p,0,-1,4,2,4.05); battlement(p,-1,1,2,2,4.05); }
  else if(id==='squareTower'||id==='roundTower') tower(p,0,0,id==='squareTower'?w:5.5,id==='roundTower'?9.6:8.7,{round:id==='roundTower',spire:id==='roundTower',banner:true});
  else if(id==='cityGate') cityGate(p,w);
  else if(id==='drawGate'||id==='woodGate') createGate(p,w,id==='drawGate'?-2.5:0,id==='drawGate',7);
  else if(id==='steps') stairs(p,0,0,w,d,4.13);
  else if(id==='lowWall') {
    masonry(p,0,0,4,.9,.62,-.13);
    cube(p,'lightStone',0,.76,0,4,.2,.7);
  }
  else if(id==='palisade') {
    for(let i=0;i<8;i++) {
      const x=-1.75+i*.5,height=2.4+(i*7%5)*.12;
      cyl(p,i%2?'oak':'timberLight',x,height/2,0,.245,height,.93,7);
      cyl(p,'oak',x,height+.27,0,.228,.55,0,7);
    }
    for(const y of [.77,1.79]) cube(p,'timber',0,y,-.27,4,.18,.15);
  } else throw new Error('Modelo arquitetônico ' + index + ' ausente: ' + id);
}

