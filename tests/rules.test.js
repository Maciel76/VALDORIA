import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Group, PerspectiveCamera, Raycaster, Scene, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { catalogue } from '../src/core/catalog.js';
import { fortificationLevel,isVillageGate,isVillageWall,villageWallId } from '../src/core/fortifications.js';
import { villageGatePositions,villagePerimeterBounds,villageWallSections,worldObjects } from '../src/world/perimeter.js';
import { buildingFoundation, checkPlacement, containsPoint, footprint, landscapeObstacles, linePositions, objectHeight, supportHeight } from '../src/core/geometry.js';
import { collectTax, economy, edit, emptyKingdom, expansionCost, upgradeStarter, validatedKingdom } from '../src/core/kingdom.js';
import { makeKingdom } from '../src/world/demo.js';
import { BAND, BASE, bounds, expansionBounds, expansionOptions, inWater, landHeight, landscapeCell, riverX, terrainHeight, visibleTerrainHeight, waterLevel } from '../src/world/terrain-data.js';
import { Terrain } from '../src/world/terrain-render.js';
import { makeRouteGraph, route } from '../src/world/traffic.js';
import { blockedAt, CollisionGrid, supportHeightWrapper, WalkSurfaces } from '../src/world/walk.js';
import { wireStockade } from '../src/models/stockade.js';
import { KingdomCamera } from '../src/world/camera.js';

const piece=(type,x,z,rotation=0,id=type,extra={})=>({id,type,x,z,rotation,...extra});
const stateWith=(...objects)=>({...emptyKingdom(),objects});
const legacyKingdom=()=>stateWith(piece('stockade',-14,-22,0,'v-0',{open:true,wallLevel:1}),piece('hut',8,10));

test('catálogo tem todas as construções, fortificações, decorações e brasões',()=>{
  const count=group=>Object.values(catalogue).filter(item=>item.category===group).length;
  assert.equal(count('housing')+count('trade')+count('civic')+count('castle'),25);
  assert.equal(count('walls'),12);
  assert.deepEqual(Object.values(catalogue).filter(item=>item.category==='walls'&&item.purchasable)
    .map(item=>item.id),['villageWall','woodGate','palisade']);
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

test('o alicerce acompanha o relevo do lote inteiro, sustenta a borda e se recalcula após expandir',()=>{
  const house=piece('peasant',-173,104,1);
  const state=stateWith(house), {seed,territory}=state;
  const grade=buildingFoundation(house,seed,territory);
  assert.equal(grade.visible,true);
  assert.equal(grade.plot.w,7);
  assert.equal(grade.plot.d,8);
  assert.ok(grade.base>terrainHeight(house.x,house.z,seed,territory)+1);
  assert.equal(objectHeight(house,state.objects,seed,territory),grade.base);
  for(let dx=-grade.plot.w/2;dx<=grade.plot.w/2;dx+=.25){
    for(let dz=-grade.plot.d/2;dz<=grade.plot.d/2;dz+=.25){
      const ground=landHeight(house.x+dx,house.z+dz,seed,territory);
      assert.ok(grade.top>ground && grade.bottom<ground);
    }
  }

  const corners=[-1,1].flatMap(i=>[-1,1].map(j=>{
    const x=house.x+i*(grade.plot.w/2-.1),z=house.z+j*(grade.plot.d/2-.1);
    return {x,z,y:landHeight(x,z,seed,territory)};
  }));
  const {x,z,y}=corners.sort((a,b)=>a.y-b.y)[0];
  const index=new CollisionGrid(state.objects),surfaces=new WalkSurfaces(state.objects),terrain={isSolid:()=>false};
  assert.equal(supportHeightWrapper(x,z,state,Infinity,surfaces),grade.top);
  assert.equal(blockedAt(state,terrain,index,x,z,.02,y,undefined,surfaces),true);
  assert.equal(blockedAt(state,terrain,index,x,z,.02,grade.top,undefined,surfaces),false);

  territory.west=1;
  assert.notEqual(buildingFoundation(house,seed,territory).base,grade.base);
});

test('remover uma árvore natural libera o lote e a passagem, persiste e permite desfazer',()=>{
  const state=emptyKingdom();
  const tree=landscapeCell(-1,-4,state.seed).find(point=>point.id==='-1,-4:8');
  const hut=piece('hut',-12,-110);
  const ray=new Raycaster(new Vector3(tree.x,90,tree.z),new Vector3(0,-1,0));
  const terrain=new Terrain(new Scene(),state.seed,state.territory);
  const root=terrain.root;

  assert.equal(terrain.pickObstacle(ray,100),tree.id);
  assert.equal(terrain.isSolid(tree.x,tree.z,0),true);
  assert.equal(checkPlacement(state,hut),'Há vegetação ou rocha no local.');
  assert.ok(edit(state,{kind:'clear-landscape',ids:['5,0:0']}).error);
  const removal=edit(state,{kind:'clear-landscape',ids:[tree.id]});
  assert.equal(removal.error,undefined);
  assert.ok(edit(state,{kind:'clear-landscape',ids:[tree.id]}).error);
  assert.equal(terrain.update(state.seed,state.territory,false,state.removedLandscape),true);
  assert.equal(terrain.root,root);
  assert.equal(terrain.pickObstacle(ray,100),null);
  assert.equal(terrain.isSolid(tree.x,tree.z,0),false);

  const saved=validatedKingdom(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(saved.removedLandscape,[tree.id]);
  assert.equal(validatedKingdom({...saved,removedLandscape:[tree.id,tree.id]}),null);
  assert.deepEqual(validatedKingdom({...saved,removedLandscape:undefined,removedTrees:[tree.id]}).removedLandscape,[tree.id]);
  assert.deepEqual(validatedKingdom({...saved,removedLandscape:undefined}).removedLandscape,[]);
  const construction=edit(state,{kind:'place',points:[hut]});
  assert.equal(construction.error,undefined);
  edit(state,{kind:'undo',change:construction.undo});
  assert.ok(edit(state,{kind:'undo',change:removal.undo},tree).error);
  assert.deepEqual(state.removedLandscape,[tree.id]);
  assert.equal(edit(state,{kind:'undo',change:removal.undo}).error,undefined);
  terrain.update(state.seed,state.territory,false,state.removedLandscape);
  assert.equal(terrain.pickObstacle(ray,100),tree.id);
  assert.equal(terrain.isSolid(tree.x,tree.z,0),true);
  assert.equal(checkPlacement(state,hut),'Há vegetação ou rocha no local.');
});

test('limpar área remove rochas e árvores do lote e restaura apenas a limpeza mais recente',()=>{
  const state=emptyKingdom();
  const alreadyRemoved='-1,-4:8';
  assert.equal(edit(state,{kind:'clear-landscape',ids:[alreadyRemoved]}).error,undefined);
  const plot={x:-45,z:-93,w:38,d:30};
  const obstacles=[...landscapeObstacles(state,plot)];
  const rock=obstacles.find(point=>point.type==='rock');
  const tree=obstacles.find(point=>point.type!=='rock');
  assert.ok(rock&&tree);
  const terrain=new Terrain(new Scene(),state.seed,state.territory,false,state.removedLandscape);
  terrain.showClearing({minX:-45,maxX:-44,minZ:-93,maxZ:-92},state.territory,true);
  const marker=terrain.clearing.children.find(node=>node.isMesh);
  assert.ok(marker.geometry.attributes.position.array.every(Number.isFinite));
  terrain.showClearing(null);
  const build=piece('hut',Math.round(rock.x),Math.round(rock.z));
  assert.equal(checkPlacement(state,build),'Há vegetação ou rocha no local.');
  assert.equal(terrain.isSolid(rock.x,rock.z,0),true);
  const rockRay=new Raycaster(new Vector3(rock.x,terrainHeight(rock.x,rock.z,state.seed,state.territory)+rock.size,rock.z),new Vector3(0,-1,0));
  assert.equal(terrain.pickObstacle(rockRay,rock.size),rock.id);
  assert.equal(terrain.rockNear(rock.x+.32,rock.z,.55),rock.id);
  const ids=obstacles.map(point=>point.id);
  assert.ok(edit(state,{kind:'clear-landscape',ids:[...ids,'5,0:0']}).error);
  assert.deepEqual(state.removedLandscape,[alreadyRemoved]);
  const clearing=edit(state,{kind:'clear-landscape',ids});
  assert.equal(clearing.error,undefined);
  terrain.update(state.seed,state.territory,false,state.removedLandscape);
  assert.equal(terrain.isSolid(rock.x,rock.z,0),false);
  assert.equal(terrain.obstacleAt(tree.id),undefined);
  assert.equal(terrain.pickObstacle(rockRay,rock.size),null);
  assert.equal(checkPlacement(state,build),'');
  assert.equal(state.gold,5000);
  assert.deepEqual(validatedKingdom(state).removedLandscape,[alreadyRemoved,...ids]);
  edit(state,{kind:'undo',change:clearing.undo});
  terrain.update(state.seed,state.territory,false,state.removedLandscape);
  assert.deepEqual(state.removedLandscape,[alreadyRemoved]);
  assert.equal(terrain.isSolid(rock.x,rock.z,0),true);
  assert.equal(checkPlacement(state,build),'Há vegetação ou rocha no local.');
});

test('muralhas encostam na grade modular e uma linha desfaz a cobrança inteira',()=>{
  const kingdom=emptyKingdom();
  const points=linePositions(catalogue.palisade,{x:0,z:0},{x:12,z:8},0).map(point=>({...point,type:'palisade'}));
  const operation=edit(kingdom,{kind:'place',points});
  assert.equal(operation.error,undefined);
  assert.equal(kingdom.objects.length,4);
  assert.equal(kingdom.gold,5000-4*catalogue.palisade.price);
  assert.equal(checkPlacement(kingdom,piece('corner',16,1)),'');
  assert.equal(checkPlacement(kingdom,piece('wall',15,0)),'A área está ocupada.');
  edit(kingdom,{kind:'undo',change:operation.undo});
  assert.equal(kingdom.objects.length,0);
  assert.equal(kingdom.gold,5000);
  assert.ok(edit(kingdom,{kind:'place',points:[piece('wall',0,0)]}).error);
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

test('a loja instala um perímetro no território já ampliado, cobra uma vez e permite desfazer',()=>{
  const state=legacyKingdom();
  assert.equal(state.objects.some(isVillageWall),false);
  state.starterPerimeter=true;
  upgradeStarter(state);
  assert.equal(state.objects.some(isVillageWall),false);
  assert.equal(edit(state,{kind:'expand',direction:'west'}).error,undefined);
  assert.equal(villageWallSections(state).length,0);
  const before=structuredClone(state);
  const purchase=edit(state,{kind:'buy-village-wall'});
  assert.equal(purchase.error,undefined);
  assert.equal(state.gold,before.gold-catalogue.villageWall.price);
  assert.equal(purchase.objects.length,4);
  assert.ok(purchase.objects.every(object=>object.wallLevel===1));
  assert.equal(state.objects.find(object=>object.id==='per-6').x,-212);
  assert.ok(villageWallSections(state).some(section=>section.x===-212));
  assert.ok(edit(state,{kind:'buy-village-wall'}).error);
  assert.equal(state.gold,before.gold-catalogue.villageWall.price);
  assert.deepEqual(validatedKingdom(state),state);
  edit(state,{kind:'undo',change:purchase.undo});
  assert.deepEqual(state,before);
  assert.equal(upgradeStarter(state).objects.some(isVillageWall),false);

  const poor={...emptyKingdom(),gold:catalogue.villageWall.price-1};
  assert.ok(edit(poor,{kind:'buy-village-wall'}).error);
  assert.equal(poor.objects.length,0);
  assert.ok(edit(state,{kind:'place',points:[piece('villageWall',0,0)]}).error);
  const blocked=stateWith(piece('hut',0,-176));
  assert.match(edit(blocked,{kind:'buy-village-wall'}).error,/traçado/);
  assert.equal(blocked.gold,5000);
  assert.equal(blocked.objects.length,1);
});

test('uma muralha cerca todo o território, com quatro esquinas e três acessos',()=>{
  const state=legacyKingdom();
  assert.equal(edit(state,{kind:'buy-village-wall'}).error,undefined);
  const entrances=state.objects.filter(isVillageGate);
  assert.equal(state.objects.filter(isVillageWall).length,1);
  assert.equal(entrances.length,3);
  assert.equal(villageWallSections(state).filter(object=>object.type==='squareTower').length,4);
  assert.ok(villageWallSections(state).every(section=>!state.objects.some(object=>object.id===section.id)));

  const {west,east,north,south}=villagePerimeterBounds(state.territory);
  const terrain={isSolid:()=>false};
  const open=new CollisionGrid(worldObjects(state));
  for(const gate of entrances) {
    assert.equal(blockedAt(state,terrain,open,gate.x,gate.z),false);
    edit(state,{kind:'gate',id:gate.id});
  }
  const closed=new CollisionGrid(worldObjects(state));
  for(let x=west;x<=east;x+=.5){
    assert.equal(blockedAt(state,terrain,closed,x,north),true);
    assert.equal(blockedAt(state,terrain,closed,x,south),true);
  }
  for(let z=north;z<=south;z+=.5){
    assert.equal(blockedAt(state,terrain,closed,west,z),true);
    assert.equal(blockedAt(state,terrain,closed,east,z),true);
  }
});

test('migração une as peças antigas, conserva construções e recupera o nível e estado de cada portão',()=>{
  const starter=legacyKingdom();
  const regular=starter.objects.filter(object=>!isVillageWall(object)&&!isVillageGate(object));
  const saved={
    ...starter,gold:2538,
    objects:[...regular,piece('wall',-12,-41,0,'per-10',{wallLevel:2}),
      piece('cityGate',1,41,0,'per-4',{open:false,wallLevel:1}),
      piece('cityGate',44,6,1,'per-5',{open:true,wallLevel:2})]
  };
  const legacy=validatedKingdom(saved);
  upgradeStarter(legacy);
  assert.equal(legacy.gold,2538);
  assert.deepEqual(legacy.objects.slice(0,regular.length),regular);
  assert.equal(legacy.objects.find(isVillageWall).wallLevel,2);
  assert.equal(legacy.objects.some(object=>object.id==='per-10'),false);
  assert.deepEqual(legacy.objects.filter(isVillageGate).map(({wallLevel,open})=>[wallLevel,open]),
    [[1,false],[2,true],[1,true]]);
  const migrated=structuredClone(legacy);
  upgradeStarter(legacy);
  assert.deepEqual(validatedKingdom(legacy),migrated);
});

test('muralha inteira, portões e castelo têm melhorias independentes e reversíveis',()=>{
  const state=legacyKingdom();
  assert.equal(edit(state,{kind:'buy-village-wall'}).error,undefined);
  const gate=state.objects.find(isVillageGate);
  edit(state,{kind:'gate',id:gate.id});
  const before=structuredClone(state);
  const result=edit(state,{kind:'upgrade-walls',id:villageWallId});
  assert.equal(result.error,undefined);
  assert.equal(state.gold,before.gold-850);
  assert.deepEqual(result.objects.map(object=>object.id),[villageWallId]);
  assert.ok(villageWallSections(state).every(section=>section.wallLevel===2));
  assert.ok(state.objects.filter(isVillageGate).every(object=>object.wallLevel===1));
  assert.equal(state.objects.find(object=>object.id==='v-0').wallLevel,1);

  assert.ok(edit(state,{kind:'upgrade-walls',id:gate.id}).error);
  assert.ok(edit(state,{kind:'upgrade-gate',id:villageWallId}).error);
  assert.ok(edit(state,{kind:'remove',id:gate.id}).error);
  assert.ok(edit(state,{kind:'move',id:villageWallId,x:10,z:10,rotation:0}).error);
  const gateResult=edit(state,{kind:'upgrade-gate',id:gate.id});
  assert.equal(gateResult.error,undefined);
  assert.equal(state.gold,before.gold-850-250);
  assert.deepEqual(gateResult.objects.map(object=>[object.id,object.wallLevel,object.open]),[[gate.id,2,false]]);
  const saved=validatedKingdom(state);
  assert.deepEqual(saved,state);
  assert.ok(edit(saved,{kind:'upgrade-gate',id:gate.id}).error);
  assert.deepEqual(saved.objects.filter(isVillageGate).map(fortificationLevel),[2,1,1]);
  edit(state,{kind:'undo',change:gateResult.undo});
  edit(state,{kind:'undo',change:result.undo});
  assert.deepEqual(state,before);
  const poor={...state,gold:1};
  assert.ok(edit(poor,{kind:'upgrade-walls',id:villageWallId}).error);
  assert.deepEqual(poor.objects,before.objects);

  const separate=emptyKingdom();
  const placed=edit(separate,{kind:'place',points:[piece('palisade',0,0,0,'wall',{wallLevel:2})]}).objects[0];
  assert.equal(placed.wallLevel,1);
  assert.equal(edit(separate,{kind:'upgrade-walls',id:placed.id}).objects[0].wallLevel,2);
});

test('expandir ou desfazer reposiciona a muralha e o portão sem perder as melhorias',()=>{
  const state=legacyKingdom();
  assert.equal(edit(state,{kind:'buy-village-wall'}).error,undefined);
  edit(state,{kind:'upgrade-walls',id:villageWallId});
  edit(state,{kind:'upgrade-gate',id:'per-5'});
  edit(state,{kind:'gate',id:'per-5'});
  const before=structuredClone(state);
  const expansion=edit(state,{kind:'expand',direction:'east'});
  const gate=state.objects.find(object=>object.id==='per-5');
  assert.ok(villageWallSections(state).some(section=>section.x===212));
  assert.deepEqual([gate.x,gate.wallLevel,gate.open],[villageGatePositions(state.territory)['per-5'].x,2,false]);
  assert.equal(gate.x,212);
  assert.deepEqual(validatedKingdom(state),state);
  edit(state,{kind:'undo',change:expansion.undo});
  assert.deepEqual(state,before);
  assert.ok(villageWallSections(state).every(section=>section.x<=176&&section.wallLevel===2));
});

test('o novo reino começa apenas com castelo e paliçada e avança por lotes vizinhos',()=>{
  const state=makeKingdom('starter',1);
  assert.deepEqual(state.objects.map(object=>object.type),['stockade','villageWall','cityGate']);
  assert.equal(state.gold,1500);
  assert.deepEqual(bounds(state.territory),{minX:-24,maxX:24,minZ:-24,maxZ:24});
  assert.ok(expansionOptions(state.territory).every(id=>!['2,2','-3,-3'].includes(id)));
  assert.deepEqual(expansionBounds(state.territory,'0,2'),{minX:0,maxX:12,minZ:24,maxZ:36});
  const houses=[-17,-6,6,17].map(x=>piece('hut',x,18));
  assert.equal(edit(state,{kind:'place',points:houses}).error,undefined);
  assert.match(checkPlacement(state,piece('hut',20,3)),/até 4 moradias/);
  assert.ok(edit(state,{kind:'expand',direction:'0,3'}).error);
  const before=structuredClone(state);
  const price=expansionCost(state,'0,2');
  const first=edit(state,{kind:'expand',direction:'0,2'});
  assert.equal(first.error,undefined);
  assert.equal(state.gold,before.gold-price);
  assert.equal(state.objects.find(isVillageGate).z,36);
  assert.ok(!villageWallSections(state).some(section=>section.z===24&&section.x>0&&section.x<12));
  assert.ok(villageWallSections(state).some(section=>section.z===24&&section.x<0));
  assert.equal(checkPlacement(state,piece('hut',6,29)),'');
  assert.equal(checkPlacement(state,piece('hut',18,29)),'Fora do território.');
  assert.ok(expansionOptions(state.territory).includes('0,3'));
  assert.ok(expansionCost(state,'0,3')>price);
  assert.match(edit(state,{kind:'expand',direction:'0,3'}).error,/insuficientes/);
  assert.deepEqual(validatedKingdom(JSON.parse(JSON.stringify(state))),state);
  assert.equal(validatedKingdom({...state,territory:{lots:['0,3']}}),null);
  assert.ok(edit(state,{kind:'undo',change:first.undo},{x:6,z:30}).error);
  assert.equal(edit(state,{kind:'undo',change:first.undo}).error,undefined);
  assert.deepEqual(state,before);
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

test('a faixa visível perde o relevo e os obstáculos ao comprar e volta ao desfazer',()=>{
  const kingdom=emptyKingdom();
  const scene=new Scene();
  const terrain=new Terrain(scene,kingdom.seed,kingdom.territory);
  const parcel=()=>terrain.root.children.find(({geometry})=>
    geometry?.parameters?.width===BAND && geometry.attributes.position.getX(0)===BASE &&
    geometry.attributes.position.getZ(0)===0);

  const original=Array.from(parcel().geometry.attributes.position.array);
  const plant=landscapeCell(BASE/BAND,0,kingdom.seed).find(({x,z})=>x>BASE+5&&x<BASE+BAND-5&&z>5&&z<BAND-5);
  assert.ok(plant);
  const decoration=piece('hut',plant.x,plant.z);
  assert.equal(checkPlacement(kingdom,decoration),'Fora do território.');
  const strip=expansionBounds(kingdom.territory,'east');
  assert.deepEqual(strip,{minX:BASE,maxX:BASE+BAND,minZ:-BASE,maxZ:BASE});
  terrain.showExpansion(strip,kingdom.territory);
  assert.ok(terrain.expansion);
  assert.deepEqual(Array.from(parcel().geometry.attributes.position.array),original);
  const operation=edit(kingdom,{kind:'expand',direction:'east'});
  terrain.update(kingdom.seed,kingdom.territory);
  const vertices=parcel().geometry.attributes.position;
  for(let i=0;i<vertices.count;i++)assert.equal(vertices.getY(i),0);
  assert.equal(terrain.expansion,null);
  assert.equal(terrain.isSolid(plant.x,plant.z,.24),false);
  assert.equal(checkPlacement(kingdom,decoration),'');
  assert.equal(expansionBounds(kingdom.territory,'east').minX,strip.maxX);

  edit(kingdom,{kind:'undo',change:operation.undo});
  terrain.update(kingdom.seed,kingdom.territory);
  assert.deepEqual(Array.from(parcel().geometry.attributes.position.array),original);
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
  const target=navigation.orbit.target.clone();
  navigation.keys.add('w');
  navigation.frame(.1,state,()=>false);
  assert.ok(navigation.orbit.target.z<target.z-3);
  navigation.keys.delete('w');
  navigation.keys.add('d');
  navigation.frame(.1,state,()=>false);
  assert.ok(navigation.orbit.target.x>target.x+3);
  verify();
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
  navigation.keys.add('w');
  navigation.frame(.02,state,()=>false);
  assert.ok(navigation.position.z<z);
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

