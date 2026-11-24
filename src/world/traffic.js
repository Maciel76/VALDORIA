import * as THREE from 'three';
import { catalogue } from '../core/catalog.js';
import { castleTypes, containsPoint, worldBoxes, angleOf } from '../core/geometry.js';
import { random } from './terrain-data.js';
import { CollisionGrid, supportHeightWrapper } from './walk.js';
import { worldObjects } from './perimeter.js';
import { group,cube,cyl,ball,beam,optimize,cloneModel } from '../models/kit.js';
import { cart } from '../models/props.js';

export function makeRouteGraph(state, blocked) {
  if(!blocked){
    const collision=new CollisionGrid(worldObjects(state));
    blocked=(x,z)=>collision.get(x,z).some(object=>containsPoint(object,x,z,.34));
  }
  const nodes=new Map();
  const edges=new Map();
  const cell=(x,z)=>Math.floor(x/2)+','+Math.floor(z/2);
  const key=(x,z)=>Math.round(x*4)+':'+Math.round(z*4);
  const add=(x,z,patrol=false)=>{
    if(blocked(x,z))return;
    const id=key(x,z);
    nodes.set(id,{id,x,z,patrol:patrol||nodes.get(id)?.patrol||false});
  };
  const terminals = [];
  for(const object of state.objects) {
    const item=catalogue[object.type];
    if(item.category==='roads'){
      add(object.x,object.z);
      if(item.id==='bridge')for(let m=-8;m<=8;m+=2) {
        const a=angleOf(object.rotation);
        add(object.x+Math.sin(a)*m,object.z+Math.cos(a)*m);
      }
    } else if(item.jobs || item.homes){
      const entry=worldBoxes(object,[{x:0,z:item.d*.5+.53,w:1,d:1}])[0];
      const nearer=worldBoxes(object,[{x:0,z:item.d*.43,w:1,d:1}])[0];
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
export function route(graph,start,finish) {
  if(!start || !finish || !graph.nodes.has(start) || !graph.nodes.has(finish))return [];
  const visited=new Map([[start,null]]), list=[start];
  for(let i=0;i<list.length;i++){
    if(list[i]===finish){
      const path=[];
      for(let id=finish;id;id=visited.get(id))path.push(graph.nodes.get(id));
      return path.reverse();
    }
    for(const next of graph.edges.get(list[i])){
      if(!visited.has(next)){visited.set(next,list[i]);list.push(next);}
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

export class Traffic {
  constructor(scene,isBlocked) { this.root=group(scene,'moradores');this.isBlocked=isBlocked;this.people=[];this.remotes=new Map();this.elapsed=0; }
  update(state,paused,reduced,terrainChanged) {
    const continuing=this.state===state;
    this.state=state;
    const {seed,objects}=state;
    this.graph=makeRouteGraph(state,(x,z)=>this.isBlocked(x,z,.31,undefined,objects));
    this.nodes=[...this.graph.nodes.values()].filter(n=>this.graph.edges.get(n.id).length>0);
    this.doors=this.nodes.filter(node=>node.door); 
    this.patrol=this.nodes.filter(node=>node.patrol);
    this.rng=random(seed+1974+state.objects.length);
    if(!continuing || paused || !this.nodes.length){
      this.people.forEach(person=>person.p.removeFromParent());
      this.people=[];
    }
    if(paused || !this.nodes.length)return;
    const houses=objects.filter(o=>catalogue[o.type].homes).length;
    const count=houses?Math.min(state.quality==='low'?8:18,Math.max(6,houses*2+4)):0;
    const kinds=['farmer','merchant','guard','wagon','hen','sheep','horse','rider'];
    for(const person of this.people.splice(count))person.p.removeFromParent();
    for(const person of this.people){
      const before=person.p.position;
      if(terrainChanged)before.y=supportHeightWrapper(before.x,before.z,state,undefined,this.surfaces);
      if(this.graph.nodes.has(person.current.id) && person.path.every(node=>this.graph.nodes.has(node.id)) &&
        person.path.every((node,i)=>this.graph.edges.get(i?person.path[i-1].id:person.current.id)?.includes(node.id)))continue;
      const nearest=this.nodes.filter(node=>Math.hypot(node.x-before.x,node.z-before.z)<8)
        .sort((a,b)=>Math.hypot(a.x-before.x,a.z-before.z)-Math.hypot(b.x-before.x,b.z-before.z));
      const accessible=nearest.find(node=>this.graph.validLine({x:before.x,z:before.z},node));
      person.current=accessible||nearest[0]||this.nodes[0];person.path=accessible?[accessible]:[];
      if(!accessible)before.set(person.current.x,supportHeightWrapper(person.current.x,person.current.z,state,undefined,this.surfaces),person.current.z);
      person.wait=.9+this.rng()*.8;
    }
    for(let i=this.people.length;i<count;i++){
      const type=kinds[i%kinds.length], person=character(type);
      const spawn=this.nodes[Math.floor(this.rng()*this.nodes.length)];
      const offset=(this.rng()-.5)*.54;
      person.p.position.set(spawn.x+offset,supportHeightWrapper(spawn.x,spawn.z,state,undefined,this.surfaces),spawn.z-offset);
      person.p.rotation.y=this.rng()*Math.PI*2;person.p.visible=true;
      const speed={wagon:1.6,horse:1.9,rider:1.72,hen:.66,sheep:.83}[type]||1.17;
      const entry={...person,type,speed,current:spawn,offset,path:[],phase:i*.58,wait:.05+i*.22,inside:false,walking:false};
      this.root.add(person.p);
      this.people.push(entry);
    }
  }
  plan(person) {
    const group=person.type==='merchant' || person.type==='farmer' ? this.doors : this.nodes;
    const choices=person.type==='guard'&&this.patrol.length&&this.rng()<.69?this.patrol:group.length?group:this.nodes;
    for(let i=0;i<7;i++){
      const target=choices[Math.floor(this.rng()*choices.length)];
      const path=route(this.graph,person.current.id,target?.id);
      if(path.length>2){person.path=path.slice(1);return;}
    }
    person.wait=1.6;
  }
  frame(dt,t,reduced) {
    this.elapsed+=dt;
    for(const person of this.people){
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
            if(!person.path.length && person.current.door && ['farmer','merchant'].includes(person.type)){
              person.wait=1.7+this.rng()*2;
              person.inside=true;person.p.visible=false;
            }
          } else {
            const step=Math.min(person.speed*dt,distance);
            const x=person.p.position.x+(dx/distance)*step,z=person.p.position.z+(dz/distance)*step;
            const crowd=this.people.some(other=>other!==person && other.walking &&
              Math.hypot(other.p.position.x-x,other.p.position.z-z)<.43);
            if(!crowd && !this.isBlocked(x,z,.17)){
              person.p.rotation.y=Math.atan2(dx,dz);
              person.p.position.set(x,supportHeightWrapper(x,z,this.state,undefined,this.surfaces),z);
              person.walking=true;
              person.blocked=0;
            } else {
              person.blocked=(person.blocked||0)+dt;
              if(person.blocked>1.4){person.path=[];person.wait=.9;person.blocked=0;}
            }
          }
        }
      }
      const swing=!reduced&&person.walking?Math.sin(t*8+person.phase)*.65:0;
      for(const limb of person.limbs)limb.node.rotation.x=swing*limb.sign*limb.scale;
      if(!reduced&&person.walking)for(const wheel of person.wheels)wheel.rotation.x+=dt*person.speed*1.12;
    }
    for(const { model, target } of this.remotes.values()){
      const walking=model.p.position.distanceToSquared(target.position)>.035;
      model.p.position.lerp(target.position,Math.min(1,dt*5));
      model.p.rotation.y=target.angle;
      for(const limb of model.limbs)limb.node.rotation.x=walking&&!reduced?Math.sin(t*8)*.56*limb.sign*limb.scale:0;
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

