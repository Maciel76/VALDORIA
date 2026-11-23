import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Group, PerspectiveCamera, Raycaster, Scene, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { catalogue } from '../src/core/catalog.js';
import { checkPlacement, containsPoint, footprint, linePositions, objectHeight, supportHeight } from '../src/core/geometry.js';
import { collectTax, economy, edit, emptyKingdom, expansionCost, upgradeStarter, validatedKingdom } from '../src/core/kingdom.js';
import { makeKingdom } from '../src/world/demo.js';
import { BAND, BASE, bounds, inWater, riverX, terrainHeight, visibleTerrainHeight, waterLevel } from '../src/world/terrain-data.js';
import { Terrain } from '../src/world/terrain-render.js';
import { makeRouteGraph, route } from '../src/world/traffic.js';
import { blockedAt, CollisionGrid, supportHeightWrapper } from '../src/world/walk.js';
import { wireStockade } from '../src/models/stockade.js';
import { KingdomCamera } from '../src/world/camera.js';

const piece=(type,x,z,rotation=0,id=type,extra={})=>({id,type,x,z,rotation,...extra});
const stateWith=(...objects)=>({...emptyKingdom(),objects});

test('catálogo tem todas as construções, fortificações, decorações e brasões',()=>{
  const count=group=>Object.values(catalogue).filter(item=>item.category===group).length;
  assert.equal(count('housing')+count('trade')+count('civic')+count('castle'),25);
  assert.equal(count('walls'),11);
  assert.equal(count('roads'),6);
  assert.equal(count('decor'),20);
  assert.equal(count('green'),14);
  assert.equal(count('banners'),12);
});

test('um quarto de volta troca dimensões e mantém colisão na orientação da peça',()=>{
  const object=piece('peasant',0,0,1);
  assert.deepEqual(footprint(object),{x:0,z:0,w:7,d:8});
  assert.equal(checkPlacement(stateWith(object),piece('hut',4,0)),'A área está ocupada.');
  assert.equal(checkPlacement(emptyKingdom(),piece('peasant',179,0)),'Fora do território.');
  assert.equal(checkPlacement(emptyKingdom(),piece('peasant',0,0),{player:{x:1,z:0}}),'Afaste-se para construir.');
  assert.equal(checkPlacement(emptyKingdom(),piece('peasant',0,0)),'');
});

test('muralhas encostam na grade modular e uma linha desfaz a cobrança inteira',()=>{
  const kingdom=emptyKingdom();
  const points=linePositions(catalogue.wall,{x:0,z:0},{x:12,z:8},0).map(point=>({...point,type:'wall'}));
  const operation=edit(kingdom,{kind:'place',points});
  assert.equal(operation.error,undefined);
  assert.equal(kingdom.objects.length,4);
  assert.equal(kingdom.gold,5000-4*48);
  assert.equal(checkPlacement(kingdom,piece('corner',16,1)),'');
  assert.equal(checkPlacement(kingdom,piece('wall',15,0)),'A área está ocupada.');
  edit(kingdom,{kind:'undo',change:operation.undo});
  assert.equal(kingdom.objects.length,0);
  assert.equal(kingdom.gold,5000);
});

test('lote reservado deixa jardins, passagem e espaços de decoração utilizáveis',()=>{
  const castle=piece('keep',0,0,0,'castle',{open:true});
  const garden=piece('bedRound',8,5,0,'garden');
  const walls=stateWith(castle,garden);
  assert.equal(checkPlacement(walls,piece('bench',8,4)),'');
  assert.equal(checkPlacement(walls,piece('bench',15,5)),'A área está ocupada.');
  const apple=piece('apple',8,5);
  assert.equal(checkPlacement(walls,apple),'');
  assert.ok(objectHeight(apple,walls.objects,walls.seed)>terrainHeight(8,5,walls.seed)+.15);
  assert.equal(checkPlacement(walls,piece('apple',9.33,5)),'A área está ocupada.');
  const homes=stateWith(piece('timber',-5.3,0,0,'first'),piece('peasant',5.2,0,0,'second'));
  assert.equal(checkPlacement(homes,piece('flowers',0,0)),'');
});

test('piso, escadaria, pátio e portão respeitam os obstáculos e os apoios',()=>{
  const castle=piece('keep',0,0,0,'castle',{open:true});
  const floor=piece('paving',2,4);
  const kingdom=stateWith(castle,floor);
  const index=new CollisionGrid(kingdom.objects);
  const terrain={isSolid:()=>false};
  assert.equal(blockedAt(kingdom,terrain,index,0,12),false);
  assert.equal(blockedAt(kingdom,terrain,index,15,4),true);
  assert.equal(blockedAt(kingdom,terrain,index,0,-1.5),false);
  assert.equal(blockedAt(kingdom,terrain,index,0,-7),false);
  assert.equal(blockedAt(kingdom,terrain,index,0,-10.5),true);
  assert.ok(supportHeight(-11,-4.9,kingdom.objects,kingdom.seed)>4.4);
  assert.ok(objectHeight(piece('bench',2,4),[floor],kingdom.seed)>terrainHeight(2,4,kingdom.seed)+.12);
  assert.equal(containsPoint({...castle,open:false},0,12),true);
  const rotated={...castle,rotation:1,open:false};
  assert.equal(containsPoint(rotated,12,0),true);
  const toggle=edit(kingdom,{kind:'gate',id:castle.id});
  assert.equal(kingdom.objects[0].open,false);
  assert.equal(validatedKingdom(JSON.parse(JSON.stringify(kingdom))).objects[0].open,false);
  edit(kingdom,{kind:'undo',change:toggle.undo});
  assert.equal(kingdom.objects[0].open,true);
});

test('ponte permite atravessar a água pelo tabuleiro e bloqueia seus corrimãos',()=>{
  const kingdom=emptyKingdom();
  const z=0,x=riverX(z,kingdom.seed);
  assert.equal(inWater(x,z,kingdom.seed),true);
  const terrain={isSolid:()=>false};
  assert.equal(blockedAt(kingdom,terrain,new CollisionGrid([]),x,z),true);
  kingdom.objects.push(piece('bridge',x,z,1));
  const index=new CollisionGrid(kingdom.objects);
  assert.equal(blockedAt(kingdom,terrain,index,x,z),false);
  assert.equal(blockedAt(kingdom,terrain,index,x,z+2.35),true);
  assert.ok(supportHeight(x,z,kingdom.objects,kingdom.seed)>-1);
});

test('castelo de nível 1 preserva passagem, escada, rotação e estado do portão ao salvar',()=>{
  const fort=piece('stockade',0,0,0,'fort',{open:true});
  const kingdom=stateWith(fort);
  const terrain={isSolid:()=>false};
  const index=new CollisionGrid(kingdom.objects);
  assert.equal(blockedAt(kingdom,terrain,index,0,13.35),false);
  assert.equal(blockedAt(kingdom,terrain,index,15,0),true);
  assert.equal(blockedAt(kingdom,terrain,index,-6.5,-.4),false);
  assert.equal(blockedAt(kingdom,terrain,index,-6.5,-7.8),true);
  assert.ok(supportHeight(7.4,-4.23,kingdom.objects,kingdom.seed)>5.8);
  assert.ok(supportHeight(7.4,-7,kingdom.objects,kingdom.seed,undefined,6.4)>5.95);
  edit(kingdom,{kind:'gate',id:'fort'});
  edit(kingdom,{kind:'move',id:'fort',x:7,z:-3,rotation:1});
  const restored=validatedKingdom(JSON.parse(JSON.stringify(kingdom)));
  assert.equal(restored.objects[0].open,false);
  assert.equal(containsPoint(restored.objects[0],20.35,-3),true);
  const removal=edit(kingdom,{kind:'remove',id:'fort'});
  edit(kingdom,{kind:'undo',change:removal.undo});
  assert.deepEqual(kingdom.objects,restored.objects);
  assert.equal(upgradeStarter(stateWith(piece('keep',-14,-22,3,'v-0',{open:false}))).objects[0].type,'stockade');
  assert.equal(makeKingdom('starter').objects[0].type,'stockade');
});

test('dobradiças exportadas em milímetros preservam escala e pivôs no jogo',async()=>{
  const data=await readFile(new URL('../src/assets/dobradica-palicada.glb',import.meta.url));
  const bytes=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
  const {scene}=await new GLTFLoader().parseAsync(bytes,'');
  const castle=new Group(), left=new Group(), right=new Group();
  left.name='PortaoEsquerda';right.name='PortaoDireita';
  left.position.set(-2.36,0,13.33);right.position.set(2.36,0,13.33);
  castle.add(left,right);
  wireStockade(castle,scene);
  const fixed=castle.children.filter(node=>node.name==='Dobradiça fixa');
  assert.equal(fixed.length,4);
  assert.equal(left.children.length,2);
  assert.equal(right.children.length,2);
  assert.equal(left.userData.motion.sign,1);
  assert.equal(right.userData.motion.sign,-1);
  for(const hinge of [...fixed,...left.children,...right.children]){
    const span=new Box3().setFromObject(hinge).getSize(new Vector3());
    assert.ok(span.x>.28&&span.x<.42 && span.y<.20 && span.z<.15);
  }
});

test('grafo conecta vias e corta rotas ao fechar ou remover a passagem',()=>{
  const kingdom=stateWith(...[-4,-2,2,4].map(x=>piece('dirt',x,0,0,'r'+x)),piece('woodGate',0,0,1,'gate',{open:true}),piece('dirt',0,0,0,'middle'));
  let graph=makeRouteGraph(kingdom);
  assert.equal(route(graph,'-16:0','16:0').length,5);
  edit(kingdom,{kind:'gate',id:'gate'});
  graph=makeRouteGraph(kingdom);
  assert.equal(route(graph,'-16:0','16:0').length,0);
  kingdom.objects=kingdom.objects.filter(object=>object.id!=='gate'&&object.id!=='middle');
  assert.equal(route(makeRouteGraph(kingdom),'-16:0','16:0').length,0);
});

test('muralhas cercam o reino e os três portões ligam caminhos internos e externos',()=>{
  const state=makeKingdom('starter',1);
  const entrances=state.objects.filter(object=>object.type==='cityGate');
  const destinations=['4:184','200:24','-176:104'];
  assert.equal(entrances.length,3);
  assert.equal(state.objects.filter(object=>object.type==='squareTower').length,4);
  const openGraph=makeRouteGraph(state);
  entrances.forEach((gate,index)=>{
    assert.equal(containsPoint(gate,gate.x,gate.z),false);
    assert.ok(route(openGraph,'0:104',destinations[index]).length>0);
    edit(state,{kind:'gate',id:gate.id});
  });
  const closedGraph=makeRouteGraph(state);
  for(const destination of destinations)assert.equal(route(closedGraph,'0:104',destination).length,0);
  const collision=new CollisionGrid(state.objects), terrain={isSolid:()=>false};
  for(let x=-38;x<=47;x+=.5)assert.equal(blockedAt(state,terrain,collision,x,41),true);
  for(let x=-38;x<=44;x+=.5)assert.equal(blockedAt(state,terrain,collision,x,-41),true);
  for(let z=-41;z<=38;z+=.5){
    assert.equal(blockedAt(state,terrain,collision,-38,z),true);
    assert.equal(blockedAt(state,terrain,collision,44,z),true);
  }
});

test('atualização instala muralhas uma vez e preserva construções, ouro e alterações',()=>{
  const state=makeKingdom('starter',1);
  const previous=state.objects.filter(object=>!object.id.startsWith('per-'));
  const legacy={...state,objects:structuredClone(previous),gold:2538};
  delete legacy.starterPerimeter;
  const obstruction=piece('peasant',-10,-42,0,'existing-home');
  const occupied={...legacy,objects:[...legacy.objects,obstruction]};
  upgradeStarter(occupied);
  assert.ok(occupied.objects.includes(obstruction));
  assert.equal(occupied.objects.some(object=>object.id.startsWith('per-')),false);
  upgradeStarter(legacy);
  assert.equal(legacy.starterPerimeter,true);
  assert.equal(legacy.gold,2538);
  assert.deepEqual(legacy.objects.slice(0,previous.length),previous);
  const saved=validatedKingdom(legacy);
  const selected=saved.objects.find(object=>object.type==='cityGate');
  edit(saved,{kind:'remove',id:selected.id});
  upgradeStarter(saved);
  assert.equal(saved.objects.some(object=>object.id===selected.id),false);
  assert.equal(saved.objects.filter(object=>object.type==='cityGate').length,2);
});

test('cobrança, saldo insuficiente, expansão e arrecadação sobrevivem ao recarregamento',()=>{
  const now=1700000000000;
  const kingdom=emptyKingdom(now);
  let operation=edit(kingdom,{kind:'place',points:[piece('peasant',0,0),piece('smith',12,0)]});
  assert.equal(operation.error,undefined);
  assert.equal(kingdom.gold,4550);
  assert.deepEqual(economy(kingdom),{homes:5,jobs:5,filled:5,income:40});
  const cost=expansionCost(kingdom,'north');
  operation=edit(kingdom,{kind:'expand',direction:'north'});
  assert.equal(bounds(kingdom.territory).minZ,-216);
  assert.equal(kingdom.gold,4550-cost);
  edit(kingdom,{kind:'undo',change:operation.undo});
  assert.equal(bounds(kingdom.territory).minZ,-180);
  assert.equal(collectTax(kingdom,now+30000),true);
  const reloaded=validatedKingdom(JSON.parse(JSON.stringify(kingdom)));
  assert.equal(reloaded.gold,4590);
  assert.equal(collectTax(reloaded,now+30001),false);
  reloaded.gold=0;
  assert.equal(edit(reloaded,{kind:'place',points:[piece('hut',40,2)]}).error,'Moedas insuficientes.');
});

test('expansões nivelam o solo seco, mantêm o rio e persistem no salvamento',()=>{
  const zones={north:[-80,-200],east:[200,0],south:[-80,200],west:[-200,0]};
  for(const [direction,[x,z]] of Object.entries(zones)){
    const kingdom=emptyKingdom();
    const height=(x,z)=>terrainHeight(x,z,kingdom.seed,kingdom.territory);
    const original=height(x,z);
    assert.notEqual(original,0);
    const inland=height(x*.8,z*.8);
    const operation=edit(kingdom,{kind:'expand',direction});
    assert.equal(operation.error,undefined);
    assert.equal(height(x,z),0);
    assert.equal(height(x+3,z+3),0);
    assert.equal(height(x*.8,z*.8),inland);
    assert.equal(supportHeightWrapper(x,z,kingdom),0);
    edit(kingdom,{kind:'undo',change:operation.undo});
    assert.equal(height(x,z),original);
  }

  const kingdom=emptyKingdom();
  edit(kingdom,{kind:'expand',direction:'north'});
  const restored=validatedKingdom(JSON.parse(JSON.stringify(kingdom)));
  const z=-200,x=riverX(z,restored.seed);
  assert.equal(inWater(x,z,restored.seed),true);
  assert.ok(terrainHeight(x,z,restored.seed,restored.territory)<waterLevel);
  assert.equal(terrainHeight(-80,z,restored.seed,restored.territory),0);
  const {seed,territory}=restored;
  assert.ok(Math.abs(terrainHeight(-80,-BASE+.01,seed,territory))<.001);
  const road=piece('dirt',-80,z);
  restored.objects.push(road);
  assert.equal(objectHeight(road,restored.objects,seed,territory),.04);
  assert.equal(supportHeightWrapper(road.x,road.z,restored),.14);
});

test('a malha 3D da faixa comprada usa a mesma altura plana da construção',()=>{
  const kingdom=emptyKingdom();
  const scene=new Scene();
  const terrain=new Terrain(scene,kingdom.seed,kingdom.territory);
  const parcel=()=>terrain.root.children.find(({geometry})=>
    geometry?.parameters?.width===BAND && geometry.attributes.position.getX(0)===BASE &&
    geometry.attributes.position.getZ(0)===0);

  assert.equal(parcel(),undefined);
  const operation=edit(kingdom,{kind:'expand',direction:'east'});
  terrain.update(kingdom.seed,kingdom.territory);
  const vertices=parcel().geometry.attributes.position;
  for(let i=0;i<vertices.count;i++)assert.equal(vertices.getY(i),0);

  edit(kingdom,{kind:'undo',change:operation.undo});
  terrain.update(kingdom.seed,kingdom.territory);
  assert.equal(parcel(),undefined);
});

test('a altura visível do terreno acompanha as duas faces da malha e as regiões expandidas',()=>{
  const state=emptyKingdom();
  edit(state,{kind:'expand',direction:'east'});
  const scene=new Scene();
  const terrain=new Terrain(scene,state.seed,state.territory);
  scene.updateMatrixWorld(true);
  const ground=terrain.root.children.filter(mesh=>mesh.geometry?.type==='PlaneGeometry');
  const ray=new Raycaster();
  for(const [x,z] of [[-119.2,104.4],[-117.9,105.7],[101.4,-136.8],[179.3,45.6],[195.2,46.8]]){
    ray.set(new Vector3(x,100,z), new Vector3(0,-1,0));
    const height=ray.intersectObjects(ground,false)[0].point.y;
    assert.ok(Math.abs(height-visibleTerrainHeight(x,z,state.seed,state.territory))<.0001);
  }
  assert.equal(visibleTerrainHeight(riverX(0,state.seed),0,state.seed,state.territory),waterLevel);
});

test('a câmera respeita o terreno em órbita, voo e caminhada',t=>{
  const descriptors=['document','window'].map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]);
  t.after(()=>{
    for(const [name,descriptor] of descriptors){
      if(descriptor)Object.defineProperty(globalThis,name,descriptor);
      else delete globalThis[name];
    }
  });
  globalThis.document=new EventTarget();
  globalThis.window=new EventTarget();
  const canvas=Object.assign(new EventTarget(),{style:{},ownerDocument:document,getRootNode:()=>document});
  const camera=new PerspectiveCamera(43,1.6,.1,1000);
  const navigation=new KingdomCamera(canvas,camera);
  const state=emptyKingdom();
  const floor=(x,z)=>visibleTerrainHeight(x,z,state.seed,state.territory);
  const verify=()=>assert.ok(camera.position.y>=floor(camera.position.x,camera.position.z)+1.39);
  const [x,z]=[-131,105];
  const height=floor(x,z);
  navigation.setMode('orbit',state);
  navigation.snap([x,height-12,z-30],[x,height-9,z]);
  verify();
  assert.equal(navigation.orbit.screenSpacePanning,false);
  navigation.setMode('free',state);
  navigation.keys.add('w');
  for(let frame=0;frame<10;frame++){
    navigation.frame(.03,state,()=>false);
    verify();
  }
  navigation.zoom(.5);
  verify();
  const beforeWalk=camera.position.clone();
  navigation.setMode('walk',state);
  navigation.position.set(x,height-9,z);
  navigation.frame(.02,state,()=>false);
  verify();
  navigation.setMode('free',state);
  assert.ok(camera.position.distanceTo(beforeWalk)<.0001);
});

test('demonstração determinística e validação do formato rejeitam dados corrompidos',()=>{
  assert.deepEqual(makeKingdom('demo',1),makeKingdom('demo',1));
  assert.equal(makeKingdom('empty',1).objects.length,0);
  const original=makeKingdom('demo',1);
  assert.ok(original.objects.some(object=>object.type==='keep'));
  assert.ok(validatedKingdom(original));
  assert.equal(validatedKingdom({...original,version:2}),null);
  const invalid={...original,objects:[...original.objects,original.objects[0]]};
  assert.equal(validatedKingdom(invalid),null);
});

