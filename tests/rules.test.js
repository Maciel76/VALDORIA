import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, BoxGeometry, Color, Group, Matrix4, Mesh, PerspectiveCamera, Raycaster, Scene, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { catalogue, terrainPaving } from '../src/core/catalog.js';
import { riverBridgeDeck,sluiceAngle,sluiceBottom,sluiceLeafHeight,sluicePlane } from '../src/core/water-structures.js';
import { buildingLevel, buildingStyle, buildingUpgrade } from '../src/core/building-levels.js';
import { completeTraining, countTroops, trainTroop, troopTypes } from '../src/core/army.js';
import { findMission, missionProgress, missionStats, missionStatus } from '../src/core/missions.js';
import { fortificationLevel,isVillageGate,isVillageWall,villageWallId } from '../src/core/fortifications.js';
import { lakeGateId,villageGatePositions,villagePerimeterBounds,villageWallSections,waterGates,worldObjects } from '../src/world/perimeter.js';
import { buildingFoundation, checkPlacement, containsPoint, footprint, foundationSlopeTarget, getLineCandidate, landscapeObstacles, linePositions, objectHeight, sidewalkTread, snapPlacement, supportHeight } from '../src/core/geometry.js';
import { collectTax, economy, edit, emptyKingdom, expansionCost, upgradeStarter, validatedKingdom } from '../src/core/kingdom.js';
import { makeKingdom } from '../src/world/demo.js';
import { lakeCenter,lakeChannels } from '../src/world/hydrology.js';
import { BAND, BASE, bounds, expansionBounds, expansionOptions, inWater, landHeight, landscapeCell, riverX, terrainHeight, visibleTerrainHeight, waterLevel } from '../src/world/terrain-data.js';
import { Terrain } from '../src/world/terrain-render.js';
import { drapePaving, makeFoundationSlope, sidewalkStepMaterial, steppedSidewalkGeometry } from '../src/world/foundation-slope.js';
import { makeRouteGraph, route } from '../src/world/traffic.js';
import { blockedAt, CollisionGrid, supportHeightWrapper, WalkSurfaces } from '../src/world/walk.js';
import { wireAdvancedCastle,wireStockade } from '../src/models/stockade.js';
import { fitHousing } from '../src/models/housing.js';
import { readFortificationKit } from '../src/models/fortifications.js';
import { animateModel, tracks } from '../src/models/animation.js';
import { road } from '../src/models/props.js';
import { KingdomCamera } from '../src/world/camera.js';

const piece=(type,x,z,rotation=0,id=type,extra={})=>({id,type,x,z,rotation,...extra});
const stateWith=(...objects)=>({...emptyKingdom(),objects});
const legacyKingdom=()=>stateWith(piece('stockade',-14,-22,0,'v-0',{open:true,wallLevel:1}),piece('hut',8,10));

test('catálogo tem todas as construções, fortificações, decorações e brasões',()=>{
  const count=group=>Object.values(catalogue).filter(item=>item.category===group).length;
  assert.equal(count('housing')+count('trade')+count('civic')+count('castle'),25);
  assert.equal(count('walls'),13);
  assert.deepEqual(Object.values(catalogue).filter(item=>item.category==='walls'&&item.purchasable)
    .map(item=>item.id),['villageWall','woodGate','palisade']);
  assert.equal(count('roads'),14);
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

test('o talude comprado adapta a base girada, sustenta o caminho e persiste com desfazer',()=>{
  const house=piece('peasant',-143,104,1);
  const paving=piece('paving',-138,104);
  const state=stateWith(house,paving), {seed,territory}=state;
  const before=state.gold, slope=buildingFoundation(house,seed,territory);
  const edge=slope.plot.x+slope.plot.w/2;
  assert.equal(foundationSlopeTarget(state,{x:edge+.7,z:house.z}),house);
  assert.equal(foundationSlopeTarget(state,{x:0,z:0}),null);
  assert.ok(edit(state,{kind:'place',points:[piece('terrainSlope',0,0)]}).error);

  const purchase=edit(state,{kind:'landscape-foundation',id:house.id});
  assert.equal(purchase.error,undefined);
  assert.equal(state.gold,before-catalogue.terrainSlope.price);
  assert.ok(edit(state,{kind:'landscape-foundation',id:house.id}).error);
  assert.equal(validatedKingdom(state).objects[0].landscaped,true);

  const surfaces=new WalkSurfaces(state.objects,seed,territory);
  const x=edge+1.5,z=house.z;
  const natural=landHeight(x,z,seed,territory);
  const paved=supportHeightWrapper(x,z,state,Infinity,surfaces);
  const toe=edge+slope.run+.4;
  assert.ok(paved>natural+1&&paved<slope.top);
  assert.equal(supportHeightWrapper(toe,z,state,Infinity,surfaces),landHeight(toe,z,seed,territory));
  const mesh=makeFoundationSlope(slope,state);
  const hit=new Raycaster(new Vector3(x,70,z),new Vector3(0,-1,0)).intersectObject(mesh)[0];
  assert.ok(Math.abs(hit.point.y-(paved-.14))<.06);
  mesh.geometry.dispose();

  edit(state,{kind:'undo',change:purchase.undo});
  assert.equal(state.gold,before);
  assert.equal(state.objects[0].landscaped,undefined);
  assert.ok(supportHeightWrapper(x,z,state,Infinity)<paved-1);
});

test('calçadas giradas compartilham o perfil da borda em toda a descida do talude',()=>{
  const hill=piece('peasant',-143,104,1,'house',{landscaped:true});
  const state=stateWith(hill);
  const tile=new BoxGeometry(2,.052,2,8,1,8);
  const first=drapePaving(tile,new Matrix4().makeTranslation(-138,.054,104),[hill],state);
  const second=drapePaving(tile,new Matrix4().makeRotationY(Math.PI/2).setPosition(-136,.054,104),[hill],state);
  const boundary=geometry=>{
    const {position}=geometry.attributes;
    const profile=new Map();
    for(let i=0;i<position.count;i++){
      const z=position.getZ(i), y=position.getY(i);
      if(Math.abs(position.getX(i)+137)<.00001)profile.set(z,Math.max(profile.get(z)??-Infinity,y));
    }
    return [...profile.entries()].sort((a,b)=>a[0]-b[0]);
  };
  const edge=boundary(first);
  assert.equal(edge.length,9);
  assert.deepEqual(edge,boundary(second));
  assert.ok(Math.abs(edge[0][1]-edge.at(-1)[1])>.025);
  for(const [z,y] of edge)assert.ok(y>supportHeight(-137,z,[hill],state.seed,undefined,Infinity,false,state.territory)+.07);
  for(const geometry of [tile,first,second])geometry.dispose();
});

test('calçadas estreitas encaixam nas ruas, constroem em linha e podem ser percorridas a pé',()=>{
  const item=catalogue.sidewalkPaving;
  const styles=Object.values(catalogue).filter(candidate=>candidate.sidewalkOf);
  assert.deepEqual(styles.map(candidate=>candidate.sidewalkOf),['dirt','cobbles','gravel','paving','walkway','paving']);
  assert.ok(styles.every(candidate=>candidate.w===1&&candidate.d===2&&candidate.line&&terrainPaving.has(candidate.id)));
  assert.deepEqual(snapPlacement(item,{x:1.6,z:.1},0),{x:1.5,z:0});
  assert.deepEqual(snapPlacement(item,{x:.1,z:1.6},1),{x:0,z:1.5});
  const street=piece('paving',0,0);
  const state=stateWith(street);
  const path=linePositions(item,{x:1.5,z:0},{x:1.5,z:4},0).map(point=>({...point,type:item.id}));
  assert.deepEqual(path.map(point=>point.z),[0,2,4]);
  assert.deepEqual(linePositions(item,{x:1.5,z:0},{x:3.5,z:0},0).map(point=>point.x),[1.5,2.5,3.5]);
  const purchase=edit(state,{kind:'place',points:path});
  assert.equal(purchase.error,undefined);
  assert.equal(checkPlacement(state,piece(item.id,.5,0)),'Já existe um piso aqui.');
  assert.equal(checkPlacement(state,piece(item.id,1.5,1)),'Já existe um piso aqui.');
  assert.equal(validatedKingdom(state).objects.filter(object=>object.type===item.id).length,3);
  const graph=makeRouteGraph(state);
  assert.equal(graph.nodes.get('6:0').road,false);
  assert.ok(route(graph,'6:0','6:16').length>0);

  const model=new Group();
  road(model,item.id);
  model.updateMatrixWorld(true);
  assert.deepEqual([new Box3().setFromObject(model).min.x,new Box3().setFromObject(model).max.x],[-.5,.5]);
  assert.equal(model.children[0].geometry.parameters.widthSegments,4);
});

test('a calçada com degraus vira com a peça e usa o mesmo piso no desenho e na caminhada',()=>{
  const hill=piece('watch',-143,104,1,'tower',{landscaped:true});
  const state=stateWith(hill);
  const result=edit(state,{kind:'place',points:[piece('sidewalkSteps',-138,105.5,1)]});
  assert.equal(result.error,undefined);
  const [stairs]=result.objects;
  const {seed,territory}=state;
  const treads=Array.from({length:catalogue.sidewalkSteps.treads},(_,i)=>sidewalkTread(stairs,i,[hill],seed,territory));
  assert.ok(treads[0].top-treads.at(-1).top>.5);
  assert.ok(treads.slice(1).every((tread,i)=>tread.top<treads[i].top&&treads[i].top-tread.top<.3));
  const geometry=steppedSidewalkGeometry(stairs,[hill],state);
  const mesh=new Mesh(geometry,sidewalkStepMaterial);
  for(const tread of treads){
    assert.equal(supportHeight(tread.x,tread.z,state.objects,seed,undefined,Infinity,false,territory),tread.top);
    const ray=new Raycaster(new Vector3(tread.x,tread.top+2,tread.z+.25),new Vector3(0,-1,0));
    assert.ok(Math.abs(ray.intersectObject(mesh)[0].point.y-tread.top)<.00001);
  }
  const flat=new Group();
  road(flat,'sidewalkPaving');
  const palette=new Set(flat.children.map(slab=>slab.material.color.getHexString()));
  const colors=geometry.attributes.color, color=new Color();
  const steppedPalette=new Set(Array.from({length:colors.count},(_,i)=>color.fromBufferAttribute(colors,i).getHexString()));
  assert.ok(sidewalkStepMaterial.vertexColors&&steppedPalette.size>=3);
  for(const stone of palette)assert.ok(steppedPalette.has(stone));
  geometry.dispose();
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

test('a ponte alta pode ser comprada e apoia a travessia sobre o rio',()=>{
  const state=emptyKingdom();
  const z=54,x=Math.round(riverX(z,state.seed)*2)/2;
  const bridge=piece('riverBridge',x,z,1);
  assert.equal(catalogue.riverBridge.purchasable,true);
  assert.equal(checkPlacement(state,{...bridge,rotation:0}),'Gire a ponte para apoiar as duas pontas nas margens.');
  const purchase=edit(state,{kind:'place',points:[bridge]});
  assert.equal(purchase.error,undefined);
  assert.equal(state.gold,5000-catalogue.riverBridge.price);

  const surfaces=new WalkSurfaces(state.objects);
  const terrain={isSolid:()=>false};
  const collision=new CollisionGrid(state.objects);
  assert.equal(blockedAt(state,terrain,collision,x,z,.24,undefined,undefined,surfaces),false);
  assert.equal(blockedAt(state,terrain,collision,x,z+2.82,.24,undefined,undefined,surfaces),true);
  const base=objectHeight(state.objects[0],state.objects,state.seed,state.territory);
  assert.ok(Math.abs(supportHeightWrapper(x,z,state,undefined,surfaces)-base-riverBridgeDeck(0))<1e-8);
  const graph=makeRouteGraph(state);
  assert.ok(route(graph,`${Math.round((x-14)*4)}:${z*4}`,`${Math.round((x+14)*4)}:${z*4}`).length>2);
  edit(state,{kind:'undo',change:purchase.undo});
  assert.equal(state.objects.length,0);
  assert.equal(state.gold,5000);
});

test('a comporta abre as duas folhas para fora do vão e volta a fechar',async()=>{
  const data=await readFile(new URL('../src/assets/comporta-do-lago.glb',import.meta.url));
  const {scene}=await new GLTFLoader().parseAsync(Uint8Array.from(data).buffer,'');
  scene.traverse(node=>{
    const sign=node.userData.sluiceSwing;
    if(sign===-1||sign===1)node.userData.motion={kind:'gate',gate:'sluice-wing',sign};
  });
  const motion=tracks(scene,0);
  assert.deepEqual(motion.map(item=>item.sign).sort(),[-1,1]);
  const descend=new Raycaster(new Vector3(.12,20,sluicePlane),new Vector3(0,-1,0));
  animateModel(motion,0,0,true,true);
  scene.updateMatrixWorld(true);
  for(const item of motion){
    assert.equal(item.node.rotation.y,item.sign*sluiceAngle);
    const box=new Box3().setFromObject(item.node);
    assert.ok(item.sign<0?box.max.x<-3.7:box.min.x>3.7,JSON.stringify(box));
  }
  assert.ok(descend.intersectObject(scene,true).every(hit=>hit.point.y<-.15));
  animateModel(motion,0,0,false,true);
  scene.updateMatrixWorld(true);
  const top=Math.max(...descend.intersectObject(scene,true).map(hit=>hit.point.y));
  assert.ok(Math.abs(top-(sluiceBottom+sluiceLeafHeight))<.01);
});

test('o lago é alimentado pelo rio e devolve água pelo canal de saída',()=>{
  for(const seed of [0,5174,123456]){
    const [entrance,exit]=lakeChannels(seed);
    for(const path of [entrance,exit])for(let i=1;i<path.length;i++){
      const [x,z]=path[i-1],[nextX,nextZ]=path[i];
      for(let t=0;t<=1;t+=.25)assert.equal(inWater(x+(nextX-x)*t,z+(nextZ-z)*t,seed),true);
    }
    for(const [x,z] of [entrance[0],exit.at(-1)])assert.equal(x,riverX(z,seed));
    assert.ok(terrainHeight(lakeCenter.x,lakeCenter.z,seed)<waterLevel);
  }
});

test('comportas substituem o muro sobre a água e guardam o estado aberto ou fechado',()=>{
  const state=emptyKingdom();
  assert.equal(edit(state,{kind:'buy-village-wall'}).error,undefined);
  const {north,south}=villagePerimeterBounds(state.territory);
  for(const z of [north,south]){
    assert.ok(waterGates(state).some(gate=>gate.z===z&&inWater(gate.x,z,state.seed)));
    assert.ok(!villageWallSections(state).some(piece=>piece.type==='wall'&&piece.z===z&&inWater(piece.x,z,state.seed)));
  }
  const intake=()=>waterGates(state).find(gate=>gate.id===lakeGateId);
  const open=intake();
  assert.equal(open.open,true);
  assert.equal(containsPoint(open,open.x,open.z),false);
  const closed=edit(state,{kind:'gate',id:lakeGateId});
  assert.equal(closed.error,undefined);
  assert.equal(containsPoint(intake(),open.x+sluicePlane,open.z),true);
  const restored=validatedKingdom(JSON.parse(JSON.stringify(state)));
  assert.equal(waterGates(restored).find(gate=>gate.id===lakeGateId).open,false);
  edit(state,{kind:'undo',change:closed.undo});
  assert.equal(intake().open,true);
  assert.equal(edit(state,{kind:'gate',id:'comporta-h-0-0'}).error,'Comporta indisponível.');
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
  assert.deepEqual(saved.objects.filter(isVillageGate).map(fortificationLevel),[2,1,1]);
  assert.equal(edit(saved,{kind:'upgrade-gate',id:gate.id}).objects[0].wallLevel,3);
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

test('muralha e portão progridem até 10, mantêm o portão fechado e preservam o progresso ao salvar',()=>{
  const state=makeKingdom('starter',1);
  state.gold=100_000;
  assert.equal(edit(state,{kind:'gate',id:'per-4'}).error,undefined);
  let lastWallCost=0,lastGateCost=0;
  for(let target=2;target<=10;target++){
    const wall=edit(state,{kind:'upgrade-walls',id:villageWallId});
    const gate=edit(state,{kind:'upgrade-gate',id:'per-4'});
    assert.equal(wall.objects[0].wallLevel,target);
    assert.ok(wall.undo.gold>lastWallCost);
    assert.ok(gate.undo.gold>lastGateCost);
    lastWallCost=wall.undo.gold;lastGateCost=gate.undo.gold;
    assert.equal(gate.objects[0].wallLevel,target);
    assert.equal(gate.objects[0].open,false);
    assert.ok(villageWallSections(state).every(section=>section.wallLevel===target));
  }
  const loaded=validatedKingdom(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(loaded,state);
  assert.ok(edit(loaded,{kind:'upgrade-walls',id:villageWallId}).error);
  assert.ok(edit(loaded,{kind:'upgrade-gate',id:'per-4'}).error);
  assert.equal(loaded.gold,state.gold);
  const expansion=edit(loaded,{kind:'expand',direction:'0,2'});
  assert.equal(expansion.error,undefined);
  const gate=loaded.objects.find(isVillageGate);
  assert.deepEqual([gate.z,gate.open,gate.wallLevel],[36,false,10]);
  gate.wallLevel=11;
  assert.equal(validatedKingdom(loaded),null);
});

test('cada um dos oito novos kits tem muro e torre distintos e um portão com duas folhas móveis',async()=>{
  const heights=[];
  for(let level=3;level<=10;level++){
    const data=await readFile(new URL(`../src/assets/muralhas-nivel-${level}.glb`,import.meta.url));
    const gltf=await new GLTFLoader().parseAsync(Uint8Array.from(data).buffer,'');
    const kit=readFortificationKit(gltf.scene);
    assert.ok(kit,`kit ${level}`);
    const wall=new Box3().setFromObject(kit.wall),tower=new Box3().setFromObject(kit.tower);
    assert.ok(Math.abs(wall.min.x+2)<.035&&Math.abs(wall.max.x-2)<.035);
    assert.ok(tower.max.y>wall.max.y);
    heights.push(wall.max.y);
    const motion=tracks(kit.gate,0);
    assert.equal(motion.length,2);
    const passage=new Raycaster(new Vector3(.13,1.28,3.5),new Vector3(0,0,-1));
    const facade=new Raycaster(new Vector3(1.55,4.36+(level-3)*.177,3.5),new Vector3(0,0,-1));
    for(const open of [false,true,false]){
      animateModel(motion,0,0,open,false,true);
      kit.gate.updateMatrixWorld(true);
      assert.equal(passage.intersectObject(kit.gate,true).length===0,open,`passagem no nível ${level}`);
      assert.ok(facade.intersectObject(kit.gate,true).length,`alvenaria acima do arco no nível ${level}`);
    }
  }
  assert.ok(heights.every((height,i)=>!i||height>heights[i-1]));
});

test('o castelo avança até o nível 10 sem alterar seu lote, portão ou muralha externa',()=>{
  const state=makeKingdom('starter',1);
  state.gold=100_000;
  edit(state,{kind:'gate',id:'v-0'});
  const start=state.objects.find(object=>object.id==='v-0'),plot=footprint(start);
  const wall=state.objects.find(isVillageWall);
  const buy=()=>edit(state,{kind:'upgrade-building',id:'v-0'});
  let last;
  for(let level=2;level<=10;level++){
    const castle=state.objects.find(object=>object.id==='v-0'),upgrade=buildingUpgrade(castle);
    assert.equal(upgrade.level,level);
    const balance=state.gold;
    const result=buy();
    assert.equal(result.error,undefined);
    assert.equal(state.gold,balance-upgrade.cost);
    assert.equal(result.objects[0].open,false);
    assert.deepEqual(footprint(result.objects[0]),plot);
    last=result;
  }
  const loaded=validatedKingdom(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(loaded,state);
  assert.ok(buy().error);
  assert.equal(state.objects.find(isVillageWall),wall);
  assert.ok(edit(state,{kind:'undo',change:last.undo}).objects.length);
  assert.equal(buildingLevel(state.objects.find(object=>object.id==='v-0')),9);
  assert.equal(state.gold,loaded.gold+last.undo.gold);
  loaded.objects.find(object=>object.id==='v-0').level=11;
  assert.equal(validatedKingdom(loaded),null);
});

test('cada novo castelo tem silhueta própria, cabe no lote e abre o portão com duas folhas',async()=>{
  let previousHeight=0;
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  for(let level=3;level<=10;level++){
    const data=await readFile(new URL(`../src/assets/stockade-nivel-${level}.glb`,import.meta.url));
    const {scene}=await loader.parseAsync(Uint8Array.from(data).buffer,'');
    assert.ok(wireAdvancedCastle(scene,level));
    const size=new Box3().setFromObject(scene);
    assert.ok(size.min.x>=-17&&size.max.x<=17&&size.min.z>=-17&&size.max.z<=17);
    assert.ok(size.max.y>previousHeight,`altura do castelo ${level}: ${size.max.y}`);
    previousHeight=size.max.y;
    const motion=tracks(scene,0);
    assert.equal(motion.filter(item=>item.gate==='leaf').length,2);
    assert.ok(motion.some(item=>item.kind==='wave'));
    const ray=new Raycaster(new Vector3(.13,1.46,16.5),new Vector3(0,0,-1),0,5);
    for(const open of [false,true,false]){
      animateModel(motion,0,0,open,false,true);
      scene.updateMatrixWorld(true);
      assert.equal(ray.intersectObject(scene,true).length===0,open,`passagem no castelo ${level}`);
    }
    const castle=piece('stockade',0,0,0,'castelo',{wallLevel:2,level,open:true});
    assert.equal(containsPoint(castle,0,13.35),false);
    assert.equal(containsPoint(castle,0,-10.52),true);
    assert.ok(supportHeight(7.4,-7,[castle],5174,undefined,6.4)>5.95);
    if(level===10){
      const cascades=motion.filter(item=>item.kind==='cascade');
      assert.equal(cascades.length,2);
      const before=cascades[0].node.instanceMatrix.array.slice();
      animateModel(motion,1.57,.016,true,false);
      assert.notDeepEqual(cascades[0].node.instanceMatrix.array,before);
      for(const rotation of [0,1,2,3]){
        const rotated={...castle,rotation};
        const at=z=>[Math.sin(rotation*Math.PI/2)*z,Math.cos(rotation*Math.PI/2)*z];
        const base=objectHeight(rotated,[rotated],5174);
        const gate=at(13.35);
        assert.ok(supportHeight(...at(13.35),[rotated],5174)>base+.95);
        assert.ok(supportHeight(...at(16.8),[rotated],5174)<base+.36);
        assert.equal(containsPoint(rotated,...gate),false);
        assert.equal(containsPoint({...rotated,open:false},...gate),true);
      }
    }
  }
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
  assert.equal(economy(state).homes,24);
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

test('cada construção habitável soma sua lotação, inclusive em salvamentos antigos',()=>{
  const capacities={hut:3,peasant:5,timber:8,terrace:12,noble:10,manor:16,inn:4,farm:4,
    abbey:12,barracks:10,stockade:12,keep:30,smith:0,watch:0};
  const buildings=Object.keys(capacities).map((type,index)=>piece(type,index*8,0,0,type,
    ['stockade','keep'].includes(type)?{open:true}:{}));
  for(const object of buildings) {
    assert.equal(economy(stateWith(object)).homes,capacities[object.type]);
  }
  const restored=validatedKingdom(JSON.parse(JSON.stringify(stateWith(...buildings))));
  assert.equal(economy(restored).homes,126);
  const initial=makeKingdom('starter',1);
  assert.deepEqual(economy(initial),{homes:12,jobs:7,filled:7,income:71});
});

test('melhorias cobram ouro, aumentam população e preservam o nível em cópias antigas e novas',()=>{
  const house=piece('hut',0,0);
  const state=stateWith(house,piece('dirt',4,4));
  assert.equal(buildingLevel(house),1);
  assert.equal(validatedKingdom({...state,objects:[{...house,level:11}]}),null);
  assert.equal(validatedKingdom({...state,objects:[piece('bakery',0,0,0,'bakery',{level:6})]}),null);
  assert.match(edit(state,{kind:'upgrade-building',id:'dirt'}).error,/não tem melhorias/);
  const first=edit(state,{kind:'upgrade-building',id:'hut'});
  assert.equal(state.gold,4950);
  assert.equal(economy(state).homes,4);
  assert.equal(validatedKingdom(structuredClone(state)).objects[0].level,2);
  edit(state,{kind:'undo',change:first.undo});
  assert.equal(economy(state).homes,3);
  assert.equal(state.gold,5000);
  for(let level=2;level<=10;level++)assert.equal(edit(state,{kind:'upgrade-building',id:'hut'}).objects[0].level,level);
  assert.equal(buildingUpgrade(state.objects[0]),null);
  const starter=makeKingdom('starter');
  assert.equal(edit(starter,{kind:'upgrade-walls',id:'v-0'}).error,undefined);
  assert.equal(buildingLevel(starter.objects[0]),2);
  assert.equal(edit(starter,{kind:'upgrade-building',id:'v-0'}).error,undefined);
  const restored=validatedKingdom(starter).objects[0];
  assert.deepEqual([buildingLevel(restored),restored.wallLevel],[3,2]);
});

test('os dez modelos de moradia têm formas próprias e cabem nos lotes do catálogo',async()=>{
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const types=Object.values(catalogue).filter(item=>item.category==='housing');
  const shapes=new Set();
  const styles=new Set();
  for(let level=1;level<=10;level++){
    const data=await readFile(new URL(`../src/assets/moradia-nivel-${level}.glb`,import.meta.url));
    const {scene}=await loader.parseAsync(Uint8Array.from(data).buffer,'');
    const bounds=new Box3().setFromObject(scene);
    shapes.add(bounds.getSize(new Vector3()).toArray().map(n=>n.toFixed(2)).join(','));
    styles.add(buildingStyle({...piece('hut',0,0),level}));
    for(const item of types.filter(item=>item.id!=='noble')){
      const house=fitHousing(scene,item.id);
      const size=new Box3().setFromObject(house);
      assert.ok(size.min.x>=-item.w/2&&size.max.x<=item.w/2,`${item.id} ${level}: largura`);
      assert.ok(size.min.z>=-item.d/2&&size.max.z<=item.d/2,`${item.id} ${level}: profundidade`);
    }
  }
  assert.equal(shapes.size,10);
  assert.equal(styles.size,10);
  for(const item of types){
    const state={...stateWith(piece(item.id,0,0)),gold:100000};
    for(let level=2;level<=10;level++){
      assert.equal(edit(state,{kind:'upgrade-building',id:item.id}).objects[0].level,level);
      assert.equal(validatedKingdom(structuredClone(state)).objects[0].level,level);
    }
    assert.equal(buildingUpgrade(state.objects[0]),null);
  }
});

test('a torre de vigia troca de modelo até o nível 10 e mantém lote e melhorias no salvamento',async()=>{
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const state=stateWith(piece('watch',0,0,1));
  state.gold=25000;
  const shapes=new Set();
  const styles=new Set();
  const plot=footprint(state.objects[0]);
  for(let level=1;level<=10;level++){
    const tower=state.objects[0];
    assert.equal(buildingLevel(tower),level);
    assert.equal(economy(state).jobs,level+2);
    assert.deepEqual(footprint(tower),plot);
    assert.deepEqual(validatedKingdom(structuredClone(state)),state);
    styles.add(buildingStyle(tower));
    const data=await readFile(new URL(`../src/assets/watch-nivel-${level}.glb`,import.meta.url));
    const {scene}=await loader.parseAsync(Uint8Array.from(data).buffer,'');
    const bounds=new Box3().setFromObject(scene);
    assert.ok(bounds.min.x>=-3&&bounds.max.x<=3&&bounds.min.z>=-3&&bounds.max.z<=3);
    shapes.add(bounds.getSize(new Vector3()).toArray().map(size=>size.toFixed(2)).join(','));
    if(level===4||level===9)assert.ok(scene.children.some(node=>node.userData.watchFlame));
    if(level===7||level===10)assert.ok(scene.children.some(node=>node.userData.watchPennant));
    if(level===10)break;
    const upgrade=buildingUpgrade(tower);
    const gold=state.gold;
    assert.equal(edit(state,{kind:'upgrade-building',id:'watch'}).error,undefined);
    assert.equal(state.gold,gold-upgrade.cost);
  }
  assert.equal(shapes.size,10);
  assert.equal(styles.size,10);
  assert.equal(buildingUpgrade(state.objects[0]),null);
  assert.equal(validatedKingdom({...state,objects:[{...state.objects[0],level:11}]}),null);
});

test('a fazenda evolui até o nível 10 com modelos próprios, capacidade e moinho no mesmo lote',async()=>{
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const state=stateWith(piece('farm',0,0));
  const plot=footprint(state.objects[0]);
  const shapes=new Set();
  for(let level=1;level<=10;level++){
    const farm=state.objects[0];
    assert.equal(buildingLevel(farm),level);
    assert.deepEqual(footprint(farm),plot);
    assert.equal(economy(state).homes,level+3);
    assert.equal(economy(state).jobs,level+7);
    assert.deepEqual(validatedKingdom(structuredClone(state)),state);
    const asset=await readFile(new URL(`../src/assets/farm-nivel-${level}.glb`,import.meta.url));
    const {scene}=await loader.parseAsync(Uint8Array.from(asset).buffer,'');
    const bounds=new Box3().setFromObject(scene);
    assert.ok(bounds.min.x>=-9&&bounds.max.x<=9&&bounds.min.z>=-7.5&&bounds.max.z<=7.5);
    let triangles=0;
    scene.traverse(node=>{if(node.isMesh)triangles+=node.geometry.index?.count??node.geometry.attributes.position.count;});
    shapes.add(`${bounds.max.y.toFixed(2)}/${triangles}`);
    assert.equal(scene.children.some(node=>node.userData.farmRotor),level>=9);
    if(level<10)assert.equal(edit(state,{kind:'upgrade-building',id:'farm'}).error,undefined);
  }
  assert.equal(shapes.size,10);
  assert.equal(buildingUpgrade(state.objects[0]),null);
  assert.equal(validatedKingdom({...state,objects:[{...state.objects[0],level:11}]}),null);
});

test('a fazenda preserva pisos e o jogador que ocupam a área da melhoria',()=>{
  const farm=piece('farm',0,0,1);
  const floor=piece('dirt',-4.7,-4.4);
  const state=stateWith(farm,floor);
  const action={kind:'upgrade-building',id:'farm'};
  assert.equal(containsPoint(farm,floor.x,floor.z),false);
  assert.equal(containsPoint({...farm,level:2},floor.x,floor.z),true);
  assert.match(edit(state,action).error,/espaço da nova estrutura/);
  assert.equal(state.gold,5000);
  state.objects=[farm];
  const player={x:floor.x,z:floor.z,y:objectHeight(farm,[farm],state.seed,state.territory)};
  assert.match(edit(state,action,player).error,/Afaste-se/);
  const {undo}=edit(state,action);
  assert.equal(buildingLevel(state.objects[0]),2);
  edit(state,{kind:'undo',change:undo});
  assert.deepEqual(state.objects,[farm]);
  assert.equal(state.gold,5000);
});

test('as dez casas nobres usam modelos próprios e chegam a 28 moradores no mesmo lote',async()=>{
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const state=stateWith(piece('noble',0,0,3));
  state.gold=25000;
  const estate=footprint(state.objects[0]);
  const styles=new Set(),shapes=new Set();
  for(let level=1;level<=10;level++){
    const house=state.objects[0];
    assert.equal(buildingLevel(house),level);
    assert.equal(economy(state).homes,10+(level-1)*2);
    assert.deepEqual(footprint(house),estate);
    assert.deepEqual(validatedKingdom(structuredClone(state)),state);
    styles.add(buildingStyle(house));
    const model=await readFile(new URL(`../src/assets/noble-nivel-${level}.glb`,import.meta.url));
    const {scene}=await loader.parseAsync(Uint8Array.from(model).buffer,'');
    const bounds=new Box3().setFromObject(scene);
    assert.ok(bounds.min.x>=-5.5&&bounds.max.x<=5.5&&bounds.min.z>=-5&&bounds.max.z<=5);
    shapes.add(bounds.getSize(new Vector3()).toArray().map(size=>size.toFixed(2)).join(','));
    if(level===10){
      assert.equal(scene.children.filter(node=>node.userData.nobleFountain).length,2);
      assert.equal(buildingUpgrade(house),null);
    }else{
      assert.equal(edit(state,{kind:'upgrade-building',id:'noble'}).error,undefined);
    }
  }
  assert.equal(styles.size,10);
  assert.equal(shapes.size,10);
});

test('o mercado cresce a cada nível e mantém a passagem aberta dentro do lote',async()=>{
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const state=stateWith(piece('market',0,0));
  const original=footprint(state.objects[0]);
  let height=0;
  for(let level=1;level<=10;level++){
    const market=state.objects[0];
    assert.equal(buildingLevel(market),level);
    assert.equal(economy(state).jobs,8+level);
    assert.deepEqual(footprint(market),original);
    assert.deepEqual(validatedKingdom(structuredClone(state)),state);
    const model=await readFile(new URL(`../src/assets/market-nivel-${level}.glb`,import.meta.url));
    const {scene}=await loader.parseAsync(Uint8Array.from(model).buffer,'');
    const bounds=new Box3().setFromObject(scene);
    assert.ok(bounds.min.x>=-6.5&&bounds.max.x<=6.5&&bounds.min.z>=-5.5&&bounds.max.z<=5.5);
    assert.ok(bounds.max.y>height,`nível ${level}: ${bounds.max.y} > ${height}`);
    height=bounds.max.y;
    for(const rotation of [0,1,2,3]){
      const rotated={...market,rotation};
      for(const z of [2,3,4,5]){
        const angle=rotation*Math.PI/2;
        assert.equal(containsPoint(rotated,z*Math.sin(angle),z*Math.cos(angle),.34),false);
      }
    }
    if(level===6)assert.ok(scene.children.some(node=>node.userData.marketClock));
    if(level===8)assert.ok(scene.children.some(node=>node.material?.transparent));
    if(level<10)assert.equal(edit(state,{kind:'upgrade-building',id:'market'}).error,undefined);
  }
  assert.equal(buildingUpgrade(state.objects[0]),null);
});

test('as novas bancas do mercado preservam o espaço de construções e do jogador',()=>{
  const market=piece('market',0,0,2);
  const road=piece('paving',-3.93,-1.21);
  const state=stateWith(market,road);
  const action={kind:'upgrade-building',id:'market'};
  assert.equal(containsPoint(market,road.x,road.z),false);
  assert.equal(containsPoint({...market,level:2},road.x,road.z),true);
  assert.match(edit(state,action).error,/espaço da nova estrutura do mercado/);
  state.objects=[market];
  const player={x:road.x,z:road.z,y:objectHeight(market,[market],state.seed,state.territory)};
  assert.match(edit(state,action,player).error,/Afaste-se/);
  assert.equal(buildingLevel(state.objects[0]),1);
  assert.equal(state.gold,5000);
});

test('o moinho d’água tem dez modelos com rodas articuladas no mesmo lote',async()=>{
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const state=stateWith(piece('watermill',0,0,1));
  state.gold=25000;
  const original=footprint(state.objects[0]);
  const heights=new Set();
  for(let level=1;level<=10;level++){
    const mill=state.objects[0];
    assert.equal(buildingLevel(mill),level);
    assert.equal(economy(state).jobs,5+level);
    assert.deepEqual(footprint(mill),original);
    assert.deepEqual(validatedKingdom(structuredClone(state)),state);
    const model=await readFile(new URL(`../src/assets/watermill-nivel-${level}.glb`,import.meta.url));
    const {scene}=await loader.parseAsync(Uint8Array.from(model).buffer,'');
    const bounds=new Box3().setFromObject(scene);
    assert.ok(bounds.min.x>=-5.5&&bounds.max.x<=5.5&&bounds.min.z>=-5&&bounds.max.z<=5,
      `limites no nível ${level}: ${bounds.min.toArray()} / ${bounds.max.toArray()}`);
    heights.add(bounds.max.y.toFixed(2));
    const wheels=scene.children.filter(node=>node.userData.watermillWheel);
    assert.equal(wheels.length,level===7||level===10?2:1);
    for(const wheel of wheels){
      assert.ok(wheel.children.some(node=>node.isMesh));
      assert.ok(wheel.userData.watermillWheel>0);
      wheel.userData.motion={kind:'mill',axis:'x',speed:wheel.userData.watermillWheel};
    }
    const motion=tracks(scene,0);
    animateModel(motion,2,.016,false,false);
    assert.ok(wheels.every(wheel=>wheel.rotation.x>.5));
    if(level>=8)assert.ok(scene.children.some(node=>node.userData.watermillFlow!==undefined));
    if(level<10)assert.equal(edit(state,{kind:'upgrade-building',id:'watermill'}).error,undefined);
  }
  assert.equal(heights.size,10);
  assert.equal(buildingUpgrade(state.objects[0]),null);
  assert.equal(validatedKingdom({...state,objects:[{...state.objects[0],level:11}]}),null);
});

test('capelas e igrejas crescem até o nível 10 e preservam terreno e salvamento',async()=>{
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  for(const [type,legacy,width,depth] of [['chapel','capela',15,19],['church','igreja',26,32]]){
    const state=stateWith(piece(type,0,0));
    state.gold=30000;
    const styles=new Set();
    let oldHeight=0;
    for(let level=1;level<=10;level++){
      const object=state.objects[0];
      assert.equal(buildingLevel(object),level);
      assert.deepEqual(validatedKingdom(structuredClone(state)),state);
      styles.add(buildingStyle(object));
      const sized=footprint(object);
      const file=level===1?legacy:`${type}-nivel-${level}`;
      const model=await readFile(new URL(`../src/assets/${file}.glb`,import.meta.url));
      const {scene}=await loader.parseAsync(Uint8Array.from(model).buffer,'');
      const b=new Box3().setFromObject(scene,true);
      assert.ok(b.max.y>oldHeight,`${type} ${level}: ${b.max.y} > ${oldHeight}`);
      assert.ok(b.min.x>=-sized.w/2&&b.max.x<=sized.w/2&&b.min.z>=-sized.d/2&&b.max.z<=sized.d/2,
        `${type} ${level}: ${b.min.toArray()} / ${b.max.toArray()}`);
      oldHeight=b.max.y;
      if(level<10)assert.equal(edit(state,{kind:'upgrade-building',id:type}).error,undefined);
    }
    assert.equal(styles.size,10);
    assert.deepEqual(footprint(state.objects[0]),{x:0,z:0,w:width,d:depth});
    const axial={...state.objects[0],rotation:1};
    assert.deepEqual(footprint(axial),{x:0,z:0,w:depth,d:width});
    const foundation=buildingFoundation(axial,state.seed,state.territory);
    assert.deepEqual(foundation.plot,footprint(axial));
    assert.equal(buildingUpgrade(state.objects[0]),null);
  }
});

test('a ampliação de uma igreja respeita construções existentes, limites e a prévia de movimento',()=>{
  const edge=piece('church',173,0,0,'church',{level:5});
  const state=stateWith(edge);
  const action={kind:'upgrade-building',id:'church'};
  assert.match(edit(state,action).error,/16 × 21 m.*Fora do território/);
  assert.equal(state.gold,5000);
  assert.equal(validatedKingdom({...state,objects:[{...edge,level:6}]}),null);
  const previous=piece('church',0,0,0,'church',{level:5});
  state.objects=[previous,piece('hut',10.5,0)];
  assert.match(edit(state,action).error,/A área está ocupada/);
  const large={...previous,level:10};
  const [preview]=getLineCandidate({...state,objects:[large]},catalogue.church,[{x:168,z:0,rotation:0}],
    {ignore:large.id,moving:large}).failures;
  assert.equal(preview,'Fora do território.');
  assert.match(edit({...state,objects:[large]},{kind:'move',x:168,z:0,rotation:0,id:large.id}).error,
    /Fora do território/);
});

test('os dez quartéis continuam no lote e cada melhoria desbloqueia uma tropa mais forte com retrato',async()=>{
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const state=stateWith(piece('barracks',0,0));
  state.gold=30000;
  const ranges=new Set();
  let previousPower=0,previousDefense=0;
  for(const unit of troopTypes){
    const {id,level,power,defense,range}=unit;
    assert.equal(buildingLevel(state.objects[0]),level);
    assert.ok(power>previousPower&&defense>previousDefense);
    previousPower=power;previousDefense=defense;ranges.add(range);
    const model=await readFile(new URL(`../src/assets/barracks-nivel-${level}.glb`,import.meta.url));
    const {scene}=await loader.parseAsync(Uint8Array.from(model).buffer,'');
    const {min,max}=new Box3().setFromObject(scene,true);
    assert.ok(min.x>=-7&&max.x<=7&&min.z>=-5.5&&max.z<=5.5);
    const portrait=await readFile(new URL(`../public/tropas/${id}.png`,import.meta.url));
    assert.equal(portrait.toString('ascii',1,4),'PNG');
    assert.equal(trainTroop(state,'barracks',id,1,10_000),'');
    completeTraining(state,10_000+unit.seconds*1000);
    if(level===10)break;
    assert.match(trainTroop(state,'barracks',troopTypes[level].id,1),/nível/);
    assert.equal(edit(state,{kind:'upgrade-building',id:'barracks'}).error,undefined);
  }
  assert.equal(countTroops(state),10);
  assert.deepEqual([...ranges],['melee','medium','long']);
  assert.equal(buildingUpgrade(state.objects[0]),null);
});

test('a fila de tropas é sequencial por quartel, persiste e credita cada ordem uma vez',()=>{
  const first=piece('barracks',0,0),second=piece('barracks',25,0,0,'second',{level:2});
  const state=stateWith(first,second);
  const now=25_000;
  assert.match(trainTroop(state,first.id,'slinger',1,now),/nível 2/);
  assert.match(trainTroop(state,first.id,'recruit',21,now),/1 e 20/);
  assert.equal(state.army,undefined);
  assert.equal(trainTroop(state,first.id,'recruit',2,now),'');
  assert.equal(trainTroop(state,first.id,'recruit',1,now),'');
  assert.equal(trainTroop(state,second.id,'slinger',1,now),'');
  assert.equal(state.gold,4859);
  assert.deepEqual(state.army.orders.map(order=>order.readyAt),[35_000,40_000,31_000]);
  assert.match(edit(state,{kind:'remove',id:first.id}).error,/treinamento/);
  assert.match(edit(state,{kind:'undo',change:{remove:[first]}}).error,/treinamento/);
  assert.equal(validatedKingdom({...state,objects:[first]}),null);
  const reordered=structuredClone(state);
  reordered.army.orders.reverse();
  assert.equal(validatedKingdom(reordered),null);
  const restored=validatedKingdom(structuredClone(state));
  assert.deepEqual(restored,state);
  assert.equal(completeTraining(restored,31_000),true);
  assert.equal(countTroops(restored),1);
  assert.equal(completeTraining(restored,31_000),false);
  assert.equal(completeTraining(restored,40_000),true);
  assert.deepEqual(restored.army,{reserve:{slinger:1,recruit:3},orders:[]});
  assert.equal(edit(restored,{kind:'remove',id:first.id}).error,undefined);
  assert.equal(countTroops(validatedKingdom(restored)),4);
});

test('as pás dos dez moinhos de vento giram sem sair do lote',async()=>{
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const state=stateWith(piece('windmill',0,0,1));
  state.gold=20000;
  const plot=footprint(state.objects[0]);
  const styles=new Set();
  let tipHeight=0;
  for(let level=1;level<=10;level++){
    const mill=state.objects[0];
    assert.equal(buildingLevel(mill),level);
    assert.equal(economy(state).jobs,level+4);
    assert.deepEqual(footprint(mill),plot);
    assert.deepEqual(validatedKingdom(structuredClone(state)),state);
    styles.add(buildingStyle(mill));
    const model=await readFile(new URL(`../src/assets/windmill-nivel-${level}.glb`,import.meta.url));
    const {scene}=await loader.parseAsync(Uint8Array.from(model).buffer,'');
    const rotors=scene.children.filter(node=>node.userData.windmillRotor);
    assert.equal(rotors.length,1);
    const [rotor]=rotors;
    let radius=0;
    for(const child of rotor.children){
      const positions=child.geometry.attributes.position;
      for(let i=0;i<positions.count;i++)radius=Math.max(radius,Math.hypot(positions.getX(i),positions.getY(i)));
    }
    assert.ok(radius<=4.5&&radius>2);
    assert.ok(rotor.position.y+radius>tipHeight);
    tipHeight=rotor.position.y+radius;
    rotor.userData.motion={kind:'mill',axis:'z',speed:rotor.userData.windmillRotor};
    const motion=tracks(scene,0);
    for(const t of [0,2.1,5.4,8.7]){
      animateModel(motion,t,.016,false,false);
      assert.equal(rotor.rotation.z,t*rotor.userData.windmillRotor);
      const box=new Box3().setFromObject(scene,true);
      assert.ok(box.min.x>=-4.5&&box.max.x<=4.5&&box.min.z>=-4.5&&box.max.z<=4.5);
    }
    animateModel(motion,9,.016,false,true);
    assert.equal(rotor.rotation.z,0);
    if(level<10)assert.equal(edit(state,{kind:'upgrade-building',id:'windmill'}).error,undefined);
  }
  assert.equal(styles.size,10);
  assert.equal(buildingUpgrade(state.objects[0]),null);
});

test('o livro libera objetivos em ordem e conta XP uma vez por missão',()=>{
  const starter=makeKingdom('starter');
  assert.equal(missionStatus(findMission('fundacao'),[],missionStats(starter)),'ready');
  assert.equal(missionStatus(findMission('legado'),[],missionStats(starter)),'locked');
  const progress=missionProgress(['fundacao','fundacao','inexistente']);
  assert.deepEqual(progress,{completed:['fundacao'],xp:100,level:2,start:100,next:300});
  assert.equal(missionStatus(findMission('moradias'),progress.completed,missionStats(starter)),'active');
  assert.equal(missionStatus(findMission('moradias'),progress.completed,missionStats(stateWith(piece('hut',0,0),piece('manor',15,0)))),'ready');
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

