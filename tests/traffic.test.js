import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { Scene } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createCitizenModel,poseCitizen,registerCitizenModels } from '../src/models/citizens.js';
import { emptyKingdom } from '../src/core/kingdom.js';
import { makeKingdom } from '../src/world/demo.js';
import { Traffic } from '../src/world/traffic.js';
import { Terrain } from '../src/world/terrain-render.js';
import { worldObjects } from '../src/world/perimeter.js';
import { blockedAt,CollisionGrid,isOpenWater,WalkSurfaces } from '../src/world/walk.js';
import { riverX,waterLevel } from '../src/world/terrain-data.js';
import { wagonSurface,wheelContacts } from '../src/world/traffic-terrain.js';

const file=await readFile(new URL('../src/assets/moradores-e-carroca.glb',import.meta.url));
const bytes=file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);
const {scene}=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes,'');
registerCitizenModels(scene);

test('modelos do Blender articulam a passada e giram a roda pela distância percorrida',()=>{
  const person=createCitizenModel('merchant');
  const [hip,knee,boot]=person.actor.limbs[0];
  poseCitizen(person,{phase:.08,effort:1,t:1});
  const before=[hip.rotation.x,knee.rotation.x,boot.rotation.x];
  poseCitizen(person,{phase:.78,effort:1,t:2});
  assert.notDeepEqual([hip.rotation.x,knee.rotation.x,boot.rotation.x],before);
  const wagon=createCitizenModel('wagon');
  assert.equal(wagon.actor.limbs.length,4);
  assert.ok(wagon.driver.head);
  const [first,,,last]=wagon.wheels;
  poseCitizen(wagon,{phase:.4,effort:1,t:1,distance:.48});
  assert.ok(Math.abs(first.node.rotation.x-1)<1e-8);
  assert.ok(Math.abs(last.node.rotation.x-.48/.62)<1e-8);
});

test('a ponte sustenta as quatro rodas sobre o rio',()=>{
  const state=emptyKingdom();
  const z=8,x=riverX(z,state.seed);
  const contacts=wheelContacts(x+2.75,z,Math.PI/2);
  assert.ok(contacts.every(p=>isOpenWater(state,p.x,p.z)));
  state.objects.push({id:'bridge',type:'bridge',x,z,rotation:1});
  const surfaces=new WalkSurfaces(state.objects);
  assert.ok(contacts.every(p=>!isOpenWater(state,p.x,p.z,surfaces,.13)));
  assert.ok(wagonSurface(state,surfaces,x+2.75,z,Math.PI/2).y>waterLevel);
});

test('banhista entra e sai do rio e as carroças do reino ficam em solo ou tabuleiro',()=>{
  const state=makeKingdom('demo',1);
  const scene=new Scene();
  const terrain=new Terrain(scene,state.seed,state.territory);
  const collision=new CollisionGrid(worldObjects(state));
  const surfaces=new WalkSurfaces(state.objects);
  const traffic=new Traffic(scene,(x,z,r,y,swimming)=>blockedAt(state,terrain,collision,x,z,r,y,undefined,surfaces,swimming));
  traffic.surfaces=surfaces;
  traffic.update(state,false,false);
  const swimmer=traffic.people.find(person=>person.type==='swimmer');
  const wagons=traffic.people.filter(person=>person.wagon);
  assert.ok(swimmer);
  assert.ok(wagons.length);
  const wagonStart=wagons[0].p.position.clone();
  let entered=false,returned=false,moved=false;
  for(let frame=0;frame<720;frame++){
    traffic.frame(.10,frame*.10,false);
    for(const person of wagons){
      const {x,z}=person.p.position;
      assert.ok(wheelContacts(x,z,person.p.rotation.y).every(point=>!isOpenWater(state,point.x,point.z,surfaces)));
    }
    if(swimmer.swim>.93)entered=true;
    if(entered&&swimmer.swim<.05)returned=true;
    if(wagons[0].p.position.distanceTo(wagonStart)>1)moved=true;
    if(returned&&moved)break;
  }
  assert.ok(entered&&returned&&moved);
});

