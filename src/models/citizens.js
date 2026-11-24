import * as THREE from 'three';

const templates=new Map();
const roles=['farmer','merchant','guard','rider','visitor','swimmer','horse','wagon'];
const sides=['L','R'];
const hoofOrder=['HL','FL','HR','FR'];
export const wheelLayout=[
  ['FL',-.85,.72,.48],['FR',.85,.72,.48],['RL',-.88,-.77,.62],['RR',.88,-.77,.62]
];
export const towOffset=-2.75;
const TAU=Math.PI*2;
const clamp=THREE.MathUtils.clamp, mix=THREE.MathUtils.lerp;

export function registerCitizenModels(scene) {
  for(const type of roles){
    const model=scene.getObjectByName(type);
    if(model)templates.set(type,model);
  }
}

export function displayWagon() {
  const wagon=templates.get('wagon')?.clone(true);
  wagon?.scale.setScalar(.9);
  if(wagon)wagon.position.z=-.44;
  return wagon;
}

function rig(type) {
  const model=templates.get(type)?.clone(true);
  if(!model)return null;
  const at=name=>model.getObjectByName(type+'__'+name);
  model.traverse(node=>{if(node.isMesh)node.castShadow=false;});
  const horse=type==='horse';
  const limbs=horse?hoofOrder.map(side=>[at('Leg'+side),at('Joint'+side),at('Hoof'+side)]):
    sides.map(side=>[at('Hip'+side),at('Knee'+side),at('Ankle'+side)]);
  const arms=sides.map(side=>[at('Shoulder'+side),at('Elbow'+side)]);
  return {model,body:at('Body'),head:at('Head'),neck:at('Neck'),tail:at('Tail'),limbs,arms};
}

const blob=(()=>{
  const size=32,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const falloff=Math.max(0,1-Math.hypot((x+.5)/size-.5,(y+.5)/size-.5)*2);
    data[(y*size+x)*4+3]=Math.round(255*falloff**1.4);
  }
  const texture=new THREE.DataTexture(data,size,size);
  texture.magFilter=THREE.LinearFilter;
  texture.needsUpdate=true;
  const geometry=new THREE.PlaneGeometry(2,2).rotateX(-Math.PI/2);
  return {geometry,material:new THREE.MeshBasicMaterial({
    map:texture,color:'#160c04',transparent:true,depthWrite:false,opacity:.51,polygonOffset:true,polygonOffsetFactor:-2
  })};
})();
function groundShadow(root,x,z) {
  const shade=new THREE.Mesh(blob.geometry,blob.material);
  shade.position.y=.022;
  shade.scale.set(x,1,z);
  root.add(shade);
  return shade;
}

export function createCitizenModel(type) {
  const horse=['horse','wagon','rider'].includes(type);
  const actor=rig(horse?'horse':type);
  if(!actor?.body)return null;
  const p=new THREE.Group();
  const shadow=groundShadow(p,horse?.85:.54,horse?1.43:.48);
  p.add(actor.model);
  const detail={p,actor,horse,shadow};
  if(type==='rider'){
    const rider=rig(type);
    if(rider?.body){
      rider.model.position.set(0,.92,-.3);
      rider.model.scale.setScalar(.94);
      actor.body.add(rider.model);
      detail.rider=rider;
    }
  } else if(type==='wagon'){
    const wagon=templates.get('wagon')?.clone(true);
    if(wagon){
      wagon.position.z=towOffset;
      wagon.traverse(node=>{if(node.isMesh)node.castShadow=false;});
      p.add(wagon);
      detail.wagon=wagon;
      detail.wheels=wheelLayout.map(([id,,,radius])=>({node:wagon.getObjectByName('wagon__Wheel'+id),radius}));
      groundShadow(wagon,.99,1.36);
      const driver=rig('farmer');
      if(driver?.body){
        driver.model.position.set(0,.39,.77);
        driver.model.scale.setScalar(.96);
        wagon.add(driver.model);
        detail.driver=driver;
      }
    }
  }
  return detail;
}

function stride(phase,distance,lift,duty) {
  const t=((phase%1)+1)%1;
  if(t<duty)return {forward:distance*(duty*.5-t),up:0,tip:0};
  const cycle=(t-duty)/(1-duty), smooth=cycle*cycle*(3-2*cycle);
  return {forward:distance*duty*(smooth-.5),up:Math.sin(Math.PI*cycle)*lift,tip:Math.sin(TAU*cycle)*.19};
}

function placeFoot([hip,knee,ankle], forward, vertical, footPitch, backward=false) {
  const upper=Math.hypot(knee.position.y,knee.position.z), lower=-ankle.position.y;
  const reach=Math.min(upper+lower-.0001,Math.hypot(forward,vertical));
  const bend=Math.acos(clamp((reach**2-upper**2-lower**2)/(2*upper*lower),-1,1))*(backward?-1:1);
  const rest=-Math.atan2(knee.position.z,-knee.position.y);
  const hipAngle=Math.atan2(-forward,vertical)-Math.atan2(lower*Math.sin(bend),upper+lower*Math.cos(bend));
  hip.rotation.x=hipAngle-rest;
  knee.rotation.x=bend+rest;
  ankle.rotation.x=footPitch-hip.rotation.x-knee.rotation.x;
}

function poseHuman(actor,phase,effort,t,swim) {
  const {body,limbs,arms,head}=actor;
  const pace=phase*TAU;
  body.rotation.x=mix(.04*effort,1.38,swim);
  body.rotation.z=mix(Math.sin(pace)*.034*effort,Math.sin(pace)*.13,swim);
  body.position.y=mix(-.047+Math.cos(pace*2)*.017*effort,.13+Math.sin(t*3.1)*.026,swim);
  head.rotation.x=-swim*.58+Math.sin(pace*2)*.022*effort;
  head.rotation.y=Math.sin(t*.76)*.10*(1-effort)*(1-swim);
  for(let i=0;i<2;i++){
    const sign=i===0?-1:1;
    const foot=stride(phase+i*.5,1.04,.15,.59);
    placeFoot(limbs[i],foot.forward*effort,.935+body.position.y-.109-foot.up*effort,foot.tip*effort);
    const [hip,knee,ankle]=limbs[i];
    hip.rotation.x=mix(hip.rotation.x,Math.sin(pace*2+i*Math.PI)*.26,swim);
    knee.rotation.x=mix(knee.rotation.x,.32+Math.sin(pace*2+i*Math.PI)*.26,swim);
    ankle.rotation.x=mix(ankle.rotation.x,.20,swim);
    const [arm,elbow]=arms[i];
    const stroke=pace+i*Math.PI;
    arm.rotation.x=mix(Math.cos(stroke)*.31*effort,-1.38-Math.cos(stroke)*1.50,swim);
    arm.rotation.z=sign*mix(.072,.28+.16*Math.sin(stroke),swim);
    elbow.rotation.x=mix(-.16-Math.max(0,Math.cos(stroke))*.27*effort,-.38-.65*Math.max(0,Math.sin(stroke)),swim);
  }
}

function poseHorse(actor,phase,effort,t,slope) {
  const {body,limbs,neck,head,tail}=actor, pace=phase*TAU;
  body.position.y=-.062+Math.cos(pace*2)*.022*effort;
  body.rotation.x=slope.pitch+Math.sin(pace*2)*.018*effort;
  body.rotation.z=slope.roll+Math.sin(pace)*.023*effort;
  neck.rotation.x=Math.sin(pace*2+.50)*.093*effort+Math.sin(t*1.55)*.02;
  head.rotation.x=-neck.rotation.x*.42+Math.sin(pace*2)*.03*effort;
  head.rotation.y=Math.sin(t*.85)*.055;
  tail.rotation.y=Math.sin(t*2.8)*(.14+effort*.14);
  tail.rotation.x=Math.cos(pace)*.11*effort;
  for(let i=0;i<4;i++){
    const foot=stride(phase-i*.25,1.46,.23,.65);
    placeFoot(limbs[i],foot.forward*effort,1.30+body.position.y-.107-foot.up*effort,foot.tip*effort,i%2===0);
  }
}

export function poseCitizen(model,{phase,effort,t,swim=0,distance=0,slope={pitch:0,roll:0},reduced=false}) {
  if(!model.actor)return;
  const motion=reduced?0:effort;
  if(model.horse)poseHorse(model.actor,phase,motion,reduced?0:t,slope);
  else poseHuman(model.actor,phase,motion,reduced?0:t,swim);
  model.shadow.visible=swim<.23;
  const seated=model.rider??model.driver;
  if(seated){
    const driving=Boolean(model.driver);
    seated.body.rotation.x=.12+Math.sin(phase*TAU*2)*motion*.057;
    seated.head.rotation.y=reduced?0:Math.sin(t*.9)*.09;
    for(let i=0;i<2;i++){
      const [hip,knee,ankle]=seated.limbs[i];
      const [shoulder,elbow]=seated.arms[i];
      hip.rotation.set(driving?-1.49:-.91,0,(i===0?-1:1)*(driving?.14:.44));
      knee.rotation.x=driving?1.56:1.41;
      ankle.rotation.x=-.29;
      shoulder.rotation.x=driving?-.88:-.61;
      elbow.rotation.x=driving?-.46:-.85;
    }
  }
  if(!reduced)for(const {node,radius} of model.wheels??[])if(node)node.rotation.x=(node.rotation.x+distance/radius)%TAU;
}

