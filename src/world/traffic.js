import { buildingEconomy,objectLevel } from '../core/economy-rules.js';
import * as THREE from 'three';
import { catalogue } from '../core/catalog.js';
import { economy } from '../core/kingdom.js';
import { bridges } from '../core/water-structures.js';
import { castleTypes, containsPoint, worldBoxes, angleOf } from '../core/geometry.js';
import { random, waterLevel } from './terrain-data.js';
import { CollisionGrid, isOpenWater } from './walk.js';
import { worldObjects } from './perimeter.js';
import { group,cube,cyl,ball,beam,optimize,cloneModel } from '../models/kit.js';
import { cart } from '../models/props.js';
import { createCitizenModel,poseCitizen } from '../models/citizens.js';
import { findSwimmingCourse,horseSurface,swimmingDepth,trafficHeight,wagonSurface,wheelContacts } from './traffic-terrain.js';

export function makeRouteGraph(state, blocked) {
  if(!blocked){
    const collision=new CollisionGrid(worldObjects(state));
    blocked=(x,z)=>isOpenWater(state,x,z,undefined,.31)||collision.get(x,z).some(object=>containsPoint(object,x,z,.34));
  }
  const nodes=new Map();
  const edges=new Map();
  const cell=(x,z)=>Math.floor(x/2)+','+Math.floor(z/2);
  const key=(x,z)=>Math.round(x*4)+':'+Math.round(z*4);
  const add=(x,z,patrol=false,road=false)=>{
    if(blocked(x,z))return;
    const id=key(x,z);
    const previous=nodes.get(id);
    nodes.set(id,{id,x,z,patrol:patrol||previous?.patrol||false,road:road||previous?.road||false});
  };
  const terminals = [];
  for(const object of state.objects) {
    const item=catalogue[object.type];
    const rule=buildingEconomy(object.type,objectLevel(object));
    if(item.category==='roads'){
      add(object.x,object.z,false,!item.sidewalkOf);
      if(bridges.has(item.id))for(let m=1-item.d/2;m<item.d/2;m+=2) {
        const a=angleOf(object.rotation);
        add(object.x+Math.sin(a)*m,object.z+Math.cos(a)*m,false,true);
      }
    } else if(rule.jobs || rule.homes){
      const entry=worldBoxes(object,[{x:0,z:item.d*.5+.53,w:1,d:1}])[0];
      const nearer=worldBoxes(object,[{x:0,z:item.id==='market'?2.05:item.d*.43,w:1,d:1}])[0];
      terminals.push({...entry,closer:nearer,type:object.type});
      if(castleTypes.has(object.type)){
        for(let n=6;n<=18;n+=2){
          const position=worldBoxes(object,[{x:0,z:n,w:1,d:1}])[0];
          add(position.x,position.z,true);
        }
        if( object.open )for(let n=-2;n<6;n+=2){
          const p=worldBoxes(object,[{x:0,z:n,w:1,d:1}])[0];
          add(p.x,p.z,true);
          if(object.type==='stockade')for(const dx of [-2,2]){
            const side=worldBoxes(object,[{x:dx,z:n,w:1,d:1}])[0];
            add(side.x,side.z,true);
          }
        }
      }
    }
  }
  const cells=new Map();
  const cache = node=>{
    const index=cell(node.x,node.z);
    if(!cells.has(index)) cells.set(index,[]);
    cells.get(index).push(node);
  };
  nodes.forEach(cache);
  const validLine=(a,b)=>{
    const dist=Math.hypot(a.x-b.x,a.z-b.z);
    const samples=Math.ceil(dist/.57);
    for(let n=1;n<samples;n++) {
      const amount=n/samples;
      if(blocked(a.x+(b.x-a.x)*amount,a.z+(b.z-a.z)*amount))return false;
    }
    return true;
  };
  const near=(x,z,r)=>{
    const bins=Math.ceil(r/2), found=[];
    const x0=Math.floor(x/2),z0=Math.floor(z/2);
    for(let i=-bins;i<=bins;i++)for(let j=-bins;j<=bins;j++) {
      for(const node of cells.get((x0+i)+','+(z0+j)) || []){
        const dist=Math.hypot(x-node.x,z-node.z);
        if(dist<=r)found.push({node,dist});
      }
    }
    return found.sort((a,b)=>a.dist-b.dist);
  };
  for(const node of nodes.values()) {
    edges.set(node.id,near(node.x,node.z,2.91).filter(item=>item.node.id!==node.id && validLine(node,item.node)).map(({node})=>node.id));
  }
  for(const door of terminals){
    const connection=near(door.x,door.z,5.8).find(({node})=>validLine(door,node));
    if(!connection || blocked(door.x,door.z))continue;
    const id=key(door.x,door.z);
    if(nodes.has(id))continue;
    nodes.set(id,{id,x:door.x,z:door.z,door:true,type:door.type});
    edges.set(id,[connection.node.id]);
    edges.get(connection.node.id).push(id);
    if(!blocked(door.closer.x,door.closer.z) && validLine(door,door.closer)){
      const end=key(door.closer.x,door.closer.z);
      if(end!==id&&!nodes.has(end)){
        nodes.set(end,{id:end,x:door.closer.x,z:door.closer.z,door:true,type:door.type});
        edges.set(end,[id]);
        edges.get(id).push(end);
      }
    }
  }
  return {nodes,edges,validLine};
}
export function route(graph,start,finish,canUse=()=>true) {
  if(!start || !finish || !graph.nodes.has(start) || !graph.nodes.has(finish))return [];
  const visited=new Map([[start,null]]), list=[start];
  for(let i=0;i<list.length;i++){
    if(list[i]===finish){
      const path=[];
      for(let id=finish;id;id=visited.get(id))path.push(graph.nodes.get(id));
      return path.reverse();
    }
    for(const next of graph.edges.get(list[i])){
      if(!visited.has(next)&&canUse(graph.nodes.get(next))){visited.set(next,list[i]);list.push(next);}
    }
  }
  return [];
}

function human(type) {
  const p=group(null,type);
  const cloth={farmer:'oak',merchant:'blue',guard:'iron',rider:'crimson',visitor:'pineLight'}[type] || 'oak';
  const limbs=[];
  for(const sign of [-1,1]){
    const leg=group(p,'perna');leg.position.set(sign*.137,.85,0);
    cube(leg,'timber',0,-.29,0,.17,.55,.177);
    cube(leg,'shadow',0,-.67,.058,.18,.28,.29);
    limbs.push({node:leg,sign});
    const arm=group(p,'braco');arm.position.set(sign*.298,1.34,0);
    cube(arm,cloth,0,-.145,0,.148,.33,.17);
    ball(arm,'ocher',0,-.38,.022,.087,.114,.086);
    limbs.push({node:arm,sign:-sign,scale:.68});
  }
  cube(p,cloth,0,1.09,0,.50,.67,.29);
  cube(p,'timber',0,.93,0,.51,.099,.34);
  cube(p,'gold',0,.93,.19,.082,.075,.035);
  ball(p,'ocher',0,1.57,.02,.174,.196,.17,1);
  ball(p,'timber',0,1.62,-.022,.18,.16,.13);
  if(type==='guard') {
    cyl(p,'iron',0,1.71,0,.21,.21,.67,9);
    cube(p,'iron',0,1.59,.169,.061,.22,.073);
    beam(p,'oak',[.34,.08,.05],[.35,2.04,.05],.049);
    cyl(p,'iron',.35,2.09,.05,.064,.199,0,5);
  } else {
    cyl(p,type==='merchant'?'crimson':'straw',0,1.7,0,.22,.057,1,10);
    cyl(p,type==='merchant'?'crimson':'hay',0,1.764,0,.147,.13,.67,10);
    if(type==='rider'||type==='visitor')cube(p,cloth,0,1.24,-.19,.47,.61,.10);
  }
  return {p,limbs};
}

function animal(type) {
  const p=group(null,type), limbs=[];
  if(type==='hen'){
    ball(p,'white',0,.28,0,.185,.20,.27,1);ball(p,'white',0,.48,.16,.107,.13,.112);
    ball(p,'red',0,.60,.16,.052,.061,.056);ball(p,'gold',0,.46,.27,.051,.049,.095);
    for(const side of [-1,1]){
      const leg=group(p,'pe');leg.position.set(side*.07,.25,.038);
      cube(leg,'gold',0,-.12,0,.032,.24,.032);limbs.push({node:leg,sign:side});
    }
  } else {
    const horse=type==='horse', wool=horse?'oak':'white', h=horse?1.45:.74;
    ball(p,wool,0,h,0,horse?.38:.31,horse?.33:.31,horse?.83:.49,1);
    beam(p,wool,[0,h,.54],[0,h+(horse?.49:.1),horse?.77:.47],horse?.33:.26);
    ball(p,horse?'timberLight':'shadow',0,h+(horse?.52:.18),horse?.84:.63,horse?.211:.16,.185,horse?.38:.25,1);
    for(const side of [-1,1]){
      cyl(p,horse?'oak':'shadow',side*.14,h+(horse?.72:.20),horse?.74:.55,.055,.24,.15,6);
      for(const end of [-1,1]){
        const leg=group(p,'perna');leg.position.set(side*(horse?.239:.174),h-.13,end*(horse?.48:.26));
        cube(leg,horse?'timberLight':'shadow',0,-(h-.18)*.48,0,horse?.135:.092,h-.18,horse?.139:.095);
        cube(leg,'shadow',0,-h+.16,.032,horse?.16:.11,.17,horse?.19:.15);
        limbs.push({node:leg,sign:side*end});
      }
    }
    if(horse)beam(p,'timber',[0,h+.12,-.63],[0,h-.53,-.89],.145);
  }
  return {p,limbs};
}

const models=new Map();
function character(type) {
  const detailed=createCitizenModel(type);
  if(detailed)return detailed;
  if(!models.has(type)){
    const created=['hen','sheep','horse','wagon'].includes(type)?animal(type==='wagon'?'horse':type):human(type);
    if(type==='wagon')cart(created.p,0,-2.9,.87,true);
    else if(type==='rider'){
      const horse=animal('horse');
      created.p.position.set(0,1.2,-.17);created.p.scale.setScalar(.81);
      horse.p.add(created.p);created.p=horse.p;created.limbs.push(...horse.limbs);
    }
    created.limbs.forEach(({node,sign,scale=1})=>node.userData.motion={kind:'stride',sign,scale});
    models.set(type,optimize(created.p));
  }
  const p=cloneModel(models.get(type)), limbs=[],wheels=[];
  p.traverse(node=>{
    if(node.userData.motion?.kind==='stride')limbs.push({node,...node.userData.motion});
    if(node.name==='roda')wheels.push(node);
  });
  return {p,limbs,wheels};
}

const citizenTypes=['farmer','merchant','guard','wagon','hen','sheep','horse','rider'];
const speeds={wagon:1.62,horse:1.88,rider:1.76,hen:.66,sheep:.83,swimmer:1.22};
const rippleGeometry=new THREE.RingGeometry(.87,1,28).rotateX(-Math.PI/2);
const rippleMaterial=new THREE.MeshBasicMaterial({color:'#b8d8cc',transparent:true,opacity:.35,depthWrite:false});
const angleDelta=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
const blend=THREE.MathUtils.lerp;

export class Traffic {
  constructor(scene,isBlocked) { this.root=group(scene,'moradores');this.isBlocked=isBlocked;this.people=[];this.remotes=new Map(); }
  update(state,paused,reduced,terrainChanged) {
    const continuing=this.state===state;
    this.state=state;
    this.graph=makeRouteGraph(state,(x,z)=>this.isBlocked(x,z,.31));
    this.nodes=[...this.graph.nodes.values()].filter(n=>this.graph.edges.get(n.id).length>0);
    this.roads=this.nodes.filter(node=>node.road);
    this.doors=this.nodes.filter(node=>node.door);
    this.patrol=this.nodes.filter(node=>node.patrol);
    this.rng=random(state.seed+1974+state.objects.length);
    const previousCourse=this.swimCourse;
    this.swimCourse=findSwimmingCourse(state,this.surfaces,this.roads,this.isBlocked);
    if(!continuing || paused || !this.nodes.length){
      this.people.forEach(person=>person.p.removeFromParent());
      this.people=[];
    }
    if(paused || !this.nodes.length)return;
    const count=Math.min(state.quality==='low'?8:18,Math.ceil(economy(state).homes/2));
    for(const person of this.people.splice(count))person.p.removeFromParent();
    for(let i=0;i<count;i++){
      const type=this.swimCourse&&i===count-1?'swimmer':citizenTypes[i%citizenTypes.length];
      let person=this.people[i];
      if(person?.type===type){
        if(type==='swimmer'){
          if(!terrainChanged&&previousCourse?.start.id===this.swimCourse.start.id&&
            previousCourse?.path[2].z===this.swimCourse.path[2].z)continue;
        }else{
          const before=person.p.position;
          if(terrainChanged)before.y=trafficHeight(state,this.surfaces,before.x,before.z);
          if(this.graph.nodes.has(person.current.id) && person.path.every((node,index)=>
              this.graph.edges.get(index?person.path[index-1].id:person.current.id)?.includes(node.id)))continue;
          if(type!=='wagon'){
            const nearby=this.nodes.filter(node=>Math.hypot(node.x-before.x,node.z-before.z)<8)
              .sort((a,b)=>Math.hypot(a.x-before.x,a.z-before.z)-Math.hypot(b.x-before.x,b.z-before.z));
            const accessible=nearby.find(node=>this.graph.validLine(before,node));
            if(accessible){person.current=accessible;person.path=[accessible];person.wait=.7;continue;}
          }
        }
      }
      person?.p.removeFromParent();
      this.people[i]=this.spawn(type,i);
    }
  }
  canTravel(type,x,z,heading) {
    if(type==='swimmer')return !this.isBlocked(x,z,.23,undefined,true);
    if(this.isBlocked(x,z,type==='wagon'?.36:.19))return false;
    return type!=='wagon'||wheelContacts(x,z,heading).every(point=>!this.isBlocked(point.x,point.z,.13));
  }
  spawn(type,index) {
    let spawn=type==='swimmer'?this.swimCourse.start:null, heading=this.rng()*Math.PI*2;
    let firstStop;
    if(type==='wagon'){
      const start=Math.floor(this.rng()*this.roads.length);
      for(let i=0;i<this.roads.length;i++){
        const road=this.roads[(start+i)%this.roads.length];
        const next=this.graph.edges.get(road.id).map(id=>this.graph.nodes.get(id)).find(node=>{
          if(!node.road)return false;
          const yaw=Math.atan2(node.x-road.x,node.z-road.z);
          return this.canTravel(type,road.x,road.z,yaw)&&this.canTravel(type,node.x,node.z,yaw);
        });
        if(next){spawn=road;firstStop=next;heading=Math.atan2(next.x-road.x,next.z-road.z);break;}
      }
      if(!spawn||!this.canTravel(type,spawn.x,spawn.z,heading))type='horse';
    }
    if(type!=='swimmer'&&type!=='wagon')spawn=this.nodes[Math.floor(this.rng()*this.nodes.length)];
    const model=character(type);
    model.p.name=type;
    const offset=['swimmer','wagon'].includes(type)?0:(this.rng()-.5)*.36;
    const x=spawn.x+offset,z=spawn.z-offset;
    model.p.position.set(x,trafficHeight(this.state,this.surfaces,x,z),z);
    model.p.rotation.y=heading;
    const person={...model,type,speed:speeds[type]||1.17,current:spawn,offset,path:firstStop?[firstStop]:[],phase:index*.16,
      effort:0,swim:0,wait:type==='swimmer'?.7:.05+index*.18,inside:false,walking:false};
    if(type==='swimmer'){
      person.wake=new THREE.Mesh(rippleGeometry,rippleMaterial);
      person.wake.visible=false;person.p.add(person.wake);
    }
    this.animate(person,0,0,0,false);
    this.root.add(person.p);
    return person;
  }
  plan(person) {
    if(person.type==='swimmer'){
      const course=this.swimCourse;
      if(course)person.path=[...course.path];
      return;
    }
    const wagon=person.type==='wagon';
    const group=wagon?this.roads:person.type==='merchant'||person.type==='farmer'?this.doors:this.nodes;
    const choices=person.type==='guard'&&this.patrol.length&&this.rng()<.69?this.patrol:group.length?group:this.nodes;
    for(let i=0;i<10;i++){
      const target=choices[Math.floor(this.rng()*choices.length)];
      const path=route(this.graph,person.current.id,target?.id,node=>!wagon||node.road);
      if(path.length<=2)continue;
      if(wagon&&i<8){
        const yaw=Math.atan2(path[1].x-path[0].x,path[1].z-path[0].z);
        if(Math.abs(angleDelta(person.p.rotation.y,yaw))>1.7)continue;
      }
      person.path=path.slice(1);return;
    }
    person.wait=1.6;
  }
  animate(person,dt,t,distance,reduced) {
    const root=person.p;
    const water=person.type==='swimmer'?swimmingDepth(this.state,this.surfaces,root.position.x,root.position.z):0;
    const swim=THREE.MathUtils.smoothstep(water,.22,.78);
    person.swim=blend(person.swim,swim,Math.min(1,dt*6));
    if(person.type==='swimmer'){
      root.position.y=blend(trafficHeight(this.state,this.surfaces,root.position.x,root.position.z),waterLevel-.26,person.swim);
      person.wake.visible=person.swim>.62&&!reduced;
      person.wake.position.set(0,waterLevel+.022-root.position.y,-.56);
      const ripple=.43+(t*.6)%1*.67;
      person.wake.scale.set(ripple,1,ripple*1.32);
    }
    person.effort=blend(person.effort,distance>0?1:0,Math.min(1,dt*11));
    person.phase+=person.swim>.35?Math.max(dt*.62,distance/1.20):distance/(person.horse?1.46:1.04);
    if(person.wagon){
      const {y,pitch,roll}=wagonSurface(this.state,this.surfaces,root.position.x,root.position.z,root.rotation.y);
      person.wagon.position.y=y-root.position.y;
      person.wagon.rotation.x=pitch;
      person.wagon.rotation.z=roll;
    }
    if(person.actor){
      const slope=person.horse?horseSurface(this.state,this.surfaces,root.position.x,root.position.z,root.rotation.y):undefined;
      poseCitizen(person,{phase:person.phase,effort:person.effort,t,swim:person.swim,distance,slope,reduced});
      return;
    }
    const swing=reduced?0:Math.sin(person.phase*Math.PI*2)*.61*person.effort;
    for(const limb of person.limbs)limb.node.rotation.x=swing*limb.sign*limb.scale;
    if(!reduced)for(const wheel of person.wheels)wheel.rotation.x+=distance*1.6;
  }
  frame(dt,t,reduced) {
    for(const person of this.people){
      let traveled=0;
      person.walking=false;
      if(person.wait>0){
        person.wait-=dt;
        if(person.wait<=0 && person.inside){person.p.visible=true;person.inside=false;}
      } else {
        if(!person.path.length)this.plan(person);
        const node=person.path[0];
        if(node){
          const px=node.x+person.offset,pz=node.z-person.offset;
          const dx=px-person.p.position.x,dz=pz-person.p.position.z, distance=Math.hypot(dx,dz);
          if(distance<.12){
            person.current=person.path.shift();
            if(!person.path.length&&person.type==='swimmer')person.wait=2.4;
            else if(!person.path.length && person.current.door && ['farmer','merchant'].includes(person.type)){
              person.wait=1.7+this.rng()*2;
              person.inside=true;person.p.visible=false;
            }
          } else {
            const heading=Math.atan2(dx,dz), turn=angleDelta(person.p.rotation.y,heading);
            const nextHeading=person.p.rotation.y+Math.max(-dt*3.4,Math.min(dt*3.4,turn));
            const pace=person.speed*(1-person.swim*.21);
            const step=Math.abs(turn)>1.1?0:Math.min(pace*dt,distance);
            const x=person.p.position.x+(dx/distance)*step,z=person.p.position.z+(dz/distance)*step;
            const crowd=this.people.some(other=>other!==person && other.walking &&
              Math.hypot(other.p.position.x-x,other.p.position.z-z)<.43);
            if(!crowd && this.canTravel(person.type,x,z,nextHeading)){
              person.p.rotation.y=nextHeading;
              person.p.position.set(x,trafficHeight(this.state,this.surfaces,x,z),z);
              traveled=step;
              person.walking=step>0;
              person.blocked=0;
            } else {
              person.blocked=(person.blocked||0)+dt;
              if(person.blocked>1.4){person.path=[];person.wait=.9;person.blocked=0;}
            }
          }
        }
      }
      this.animate(person,dt,t,traveled,reduced);
    }
    for(const { model, target } of this.remotes.values()){
      const beforeX=model.p.position.x,beforeZ=model.p.position.z;
      model.p.position.lerp(target.position,Math.min(1,dt*5));
      model.p.rotation.y+=angleDelta(model.p.rotation.y,target.angle)*Math.min(1,dt*8);
      const speed=Math.hypot(model.p.position.x-beforeX,model.p.position.z-beforeZ);
      if(model.actor){
        model.phase=(model.phase||0)+Math.min(speed,dt*2.5)/1.04;
        poseCitizen(model,{phase:model.phase,effort:Math.min(1,speed/Math.max(.001,dt*1.10)),t,reduced});
      }else for(const limb of model.limbs)limb.node.rotation.x=speed>.003&&!reduced?Math.sin(t*8)*.56*limb.sign*limb.scale:0;
    }
  }
  showPlayers(players) {
    for(const [id,entry] of this.remotes) if(!players.some(player=>player.id===id)){
      entry.model.p.removeFromParent();this.remotes.delete(id);
    }
    for(const player of players){
      const target={position:new THREE.Vector3(player.x,player.y,player.z),angle:player.angle};
      if(this.remotes.has(player.id)){this.remotes.get(player.id).target=target;continue;}
      const model=character('visitor');model.p.position.copy(target.position);
      this.root.add(model.p);this.remotes.set(player.id,{target,model});
    }
  }
}

