import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { catalogue } from '../core/catalog.js';
import { angleOf, containsPoint, footprint, objectHeight } from '../core/geometry.js';
import { terrainHeight,inWater,waterLevel } from './terrain-data.js';
import { Terrain } from './terrain-render.js';
import { Atmosphere } from './atmosphere.js';
import { KingdomCamera } from './camera.js';
import { blockedAt,CollisionGrid } from './walk.js';
import { Traffic } from './traffic.js';
import { makeModel,sealFor,template } from '../models/library.js';
import { animateModel,tracks } from '../models/animation.js';
import { group } from '../models/kit.js';

const stoneTypes=new Set(['dirt','cobbles','gravel','paving','walkway']);
const valid=new THREE.Color('#81cc9b'), invalid=new THREE.Color('#d56156');
const worldPointer=new THREE.Vector2();
const sample=new THREE.Vector3();
const pos=new THREE.Vector3();
const selectionPoint=new THREE.Vector3();
const ghostMaterial=new THREE.MeshBasicMaterial({color:valid,transparent:true,opacity:.3,depthWrite:false,side:THREE.DoubleSide});
const badGhost=ghostMaterial.clone();badGhost.color.copy(invalid);
const edgeGeometry=new THREE.BufferGeometry().setFromPoints([[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5],[-.5,-.5]].map(([x,z])=>new THREE.Vector3(x,0,z)));
const lineValid=new THREE.LineBasicMaterial({color:'#a6ec9a',transparent:true,opacity:.92,depthTest:false});
const lineInvalid=lineValid.clone();lineInvalid.color.set('#f37a63');
const lineSelect=lineValid.clone();lineSelect.color.set('#e8bc66');

export class WorldView {
  constructor(host) {
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(43,1,.10,1000);
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.04;
    this.renderer.localClippingEnabled=true;
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate=false;
    this.canvas=this.renderer.domElement;
    this.canvas.className='world-canvas';
    this.canvas.tabIndex=0;
    this.canvas.setAttribute('aria-label','Mundo 3D de Valdória');
    host.append(this.canvas);
    this.scene.background=new THREE.Color('#c4d9b6');
    this.atmosphere=new Atmosphere(this.scene);
    this.hud=group(this.scene,'indicadores');
    this.root=group(this.scene,'reino');
    this.navigation=new KingdomCamera(this.canvas,this.camera);
    this.preview=group(this.scene,'prévia');this.ray=new THREE.Raycaster();
    this.selectedLine=new THREE.Line(edgeGeometry,lineSelect);this.selectedLine.renderOrder=3;this.selectedLine.visible=false;this.hud.add(this.selectedLine);
    this.traffic=new Traffic(this.scene,(...args)=>this.blocked(...args));
    this.drawables=new Map();this.roadBatches=new Map();this.staticBatches=new Map();
    this.motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
    this.reduced=this.motionPreference.matches;
    this.motionPreference.addEventListener('change',event=>{this.reduced=event.matches;});
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.host=host;
    this.metrics={seconds:0,samples:0,frames:0,fps:0,calls:0,triangles:0};
    this.resize();
    this.renderer.setAnimationLoop(ms=>this.frame(ms));
  }
  resize() {
    const width=this.host.clientWidth,height=this.host.clientHeight;
    if(!width||!height)return;
    const max=this.state?.quality==='high'?1.7:this.state?.quality==='low'?.75:1.25;
    this.renderer.setPixelRatio(Math.min(max,window.devicePixelRatio||1));
    this.renderer.setSize(width,height,false);
    this.camera.aspect=width/height;
    this.camera.updateProjectionMatrix();
    this.navigation.resize();
  }
  blocked(x,z,radius,y,objects) {
    if(!this.state)return false;
    const walking=typeof y==='number';
    return blockedAt(this.state,this.terrain,this.collision,x,z,radius,y,walking?object=>{
      const entry=this.drawables.get(object.id);
      if(!entry) return object.open;
      const bridge=entry.motion.find(node=>node.gate==='bridge');
      const leaf=entry.motion.find(node=>node.gate==='leaf');
      return bridge?Math.abs(bridge.node.rotation.x)<.32:leaf?Math.abs(leaf.node.rotation.y)>1.11:object.open;
    }:undefined);
  }
  placeAt(evt) {
    if(!this.state)return null;
    const box=this.canvas.getBoundingClientRect();
    if(this.navigation.mode==='walk' && document.pointerLockElement===this.canvas) worldPointer.set(0,0);
    else worldPointer.set((evt.clientX-box.left)/box.width*2-1,-(evt.clientY-box.top)/box.height*2+1);
    this.camera.updateMatrixWorld();
    this.ray.setFromCamera(worldPointer,this.camera);
    const ray=this.ray.ray;
    const {seed,territory}=this.state;
    let height=Infinity,travel=0;
    for(let i=0;i<200;i++,travel+=Math.max(.72,travel*.036)){
      ray.at(travel,sample);
      const ground=inWater(sample.x,sample.z,seed)?waterLevel:terrainHeight(sample.x,sample.z,seed,territory);
      if(sample.y<=ground){
        const fraction=Number.isFinite(height)?height/(height+ground-sample.y):1;
        return ray.at(Math.max(0,travel-Math.max(.72,(travel-.72)*.035)*(1-fraction)),pos).clone();
      }
      height=sample.y-ground;
    }
    return null;
  }
  pick(event) {
    const ground=this.placeAt(event);
    const hit=this.ray.intersectObjects([...this.drawables.values()].map(entry=>entry.model),true)
      .find(({object})=>object.isMesh&&object.name!=='fumaça');
    if(hit){
      let model=hit.object;
      while(model.parent && !model.userData.uid)model=model.parent;
      if(model.userData.uid)return model.userData.uid;
    }
    if(!ground)return null;
    return this.state.objects.findLast(o=>{
      if(!stoneTypes.has(o.type))return false;
      const rect=footprint(o);
      return Math.abs(ground.x-o.x)<rect.w/2 && Math.abs(ground.z-o.z)<rect.d/2;
    })?.id ?? null;
  }
  setPreview(points,type,failed) {
    this.clearPreview();
    const source=template(type);
    const reuse=points.length>15;
    for(const [i,point] of points.entries()){
      const y=objectHeight({...point,type},this.state.objects,this.state.seed,this.state.territory);
      const mark=new THREE.Line(edgeGeometry,failed[i]?lineInvalid:lineValid);
      const item=catalogue[type];mark.scale.set(item.w,1,item.d);mark.position.set(point.x,y+.12,point.z);
      mark.rotation.y=angleOf(point.rotation);mark.renderOrder=3;this.preview.add(mark);
      if(reuse && i!==0 && i!==points.length-1)continue;
      const ghost=source.clone(true);
      ghost.traverse(object=>{
        if(object.isMesh){object.material=failed[i]?badGhost:ghostMaterial;object.castShadow=object.receiveShadow=false;}
        if(object.isPointLight)object.visible=false;
      });
      ghost.position.set(point.x,y,point.z);ghost.rotation.y=angleOf(point.rotation);
      this.preview.add(ghost);
    }
  }
  clearPreview(){this.preview.clear();}
  markObject(object) {
    this.selectedLine.visible=Boolean(object);
    this.selectionCorners=null;
    if(!object)return;

    const item=catalogue[object.type];
    const {seed,territory,objects}=this.state;
    const y=objectHeight(object,objects,seed,territory);
    this.selectedLine.position.set(object.x,y+.16,object.z);
    this.selectedLine.scale.set(item.w,1,item.d);
    this.selectedLine.rotation.y=angleOf(object.rotation);

    const entry=this.drawables.get(object.id);
    const box=entry?new THREE.Box3().setFromObject(entry.model):new THREE.Box3();
    if(box.isEmpty()){
      const plot=footprint(object);
      box.min.set(object.x-plot.w/2,y,object.z-plot.d/2);
      box.max.set(object.x+plot.w/2,y+.16,object.z+plot.d/2);
    }
    const {min,max}=box;
    this.selectionCorners=[];
    for(const x of [min.x,max.x])for(const height of [min.y,max.y])for(const z of [min.z,max.z]){
      this.selectionCorners.push(new THREE.Vector3(x,height,z));
    }
  }
  projectSelection() {
    if(!this.selectionCorners)return null;
    const width=this.host.clientWidth,height=this.host.clientHeight;
    if(!width||!height)return null;

    this.camera.updateMatrixWorld();
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    for(const corner of this.selectionCorners){
      selectionPoint.copy(corner).project(this.camera);
      if(selectionPoint.z<-1||selectionPoint.z>1)continue;
      const x=(selectionPoint.x+1)*width/2,y=(1-selectionPoint.y)*height/2;
      left=Math.min(left,x);right=Math.max(right,x);
      top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
    if(right<0||left>width||bottom<0||top>height)return null;
    return {
      x:(left+right)/2,y:(top+bottom)/2,
      radius:Math.hypot(right-left,bottom-top)/2,width,height,
    };
  }
  drop(entry) {
    entry.model.removeFromParent();
    for(const motion of entry.motion)if(motion.kind==='wave')motion.node.geometry.dispose();
    this.finishConstruction(entry);
  }
  beginConstruction(entry) {
    const stage={plane:new THREE.Plane(new THREE.Vector3(0,-1,0),entry.y+.13),buckets:new Map(),meshes:[]};
    entry.model.traverse(node=>{
      if(!node.isMesh||Array.isArray(node.material))return;
      const material=node.material;
      if(!stage.buckets.has(material)){
        const clipped=material.clone();clipped.clippingPlanes=[stage.plane];stage.buckets.set(material,clipped);
      }
      stage.meshes.push([node,material]);
      node.material=stage.buckets.get(material);
    });
    stage.top=new THREE.Box3().setFromObject(entry.model).max.y;
    entry.stage=stage;
  }
  finishConstruction(entry) {
    if(!entry.stage)return;
    for(const [node,material] of entry.stage.meshes)node.material=material;
    for(const material of entry.stage.buckets.values())material.dispose();
    entry.stage=null;
  }
  setState(state,{created=[],refreshRoutes=true}={}) {
    this.state=state;
    const previousTerrain=this.terrain?.key;
    if(!this.terrain)this.terrain=new Terrain(this.scene,state.seed,state.territory);
    else this.terrain.update(state.seed,state.territory);
    this.atmosphere.set(state.time);
    this.atmosphere.setFocus(this.navigation.orbit.target);
    if(this.quality!==state.quality){
      this.quality=state.quality;
      this.renderer.shadowMap.enabled=state.quality!=='low';
      for(const entry of this.roadBatches.values()) entry.group.traverse(node=>{if(node.isInstancedMesh)node.material.needsUpdate=true;});
      this.resize();
    }
    this.collision=new CollisionGrid(state.objects);
    const list=new Map(state.objects.map(object=>[object.id,object]));
    for(const [id,entry] of this.drawables){
      const object=list.get(id);
      if(!object||object.type!==entry.modelType){this.drop(entry);this.drawables.delete(id);}
    }
    const allRoads=new Map();
    const newSet=new Set(created);
    this.atmosphere.fires.length=0;
    for(const object of state.objects){
      if(stoneTypes.has(object.type)){
        if(!allRoads.has(object.type))allRoads.set(object.type,[]);
        allRoads.get(object.type).push(object);continue;
      }
      let entry=this.drawables.get(object.id);
      if(!entry){
        const model=makeModel(object.type);
        if(object.type==='keep')sealFor(model);
        model.userData.uid=object.id;
        this.root.add(model);
        entry={model,modelType:object.type,motion:tracks(model,object.x*.29+object.z*.37+object.id.length),birth:!this.reduced&&newSet.has(object.id)?this.clock??0:null};
        this.drawables.set(object.id,entry);
        animateModel(entry.motion,this.clock||0,0,object.open,this.reduced,true);
      }
      const y=objectHeight(object,state.objects,state.seed,state.territory);
      if(entry.stage)entry.stage.top+=y-entry.y;
      entry.model.position.set(object.x,y,object.z);
      entry.model.rotation.y=angleOf(object.rotation);
      entry.y=y;entry.open=object.open;
      entry.layout=[object.id,object.type,object.x,y,object.z,object.rotation].join(',');
      if(entry.birth!=null&&!entry.stage)this.beginConstruction(entry);
      this.atmosphere.mark(entry.model);
    }
    this.batchRoads(allRoads);
    this.batchBuildings();
    if(refreshRoutes)this.traffic.update(state,false,this.reduced,this.terrain.key!==previousTerrain);
    this.renderer.shadowMap.needsUpdate=true;
  }
  batchBuildings() {
    const regions=new Map();
    this.root.updateMatrixWorld(true);
    for(const entry of this.drawables.values()){
      if(entry.birth!=null)continue;
      const {x,z}=entry.model.position;
      const key=Math.floor((x+48)/96)+','+Math.floor((z+48)/96);
      if(!regions.has(key))regions.set(key,[]);
      regions.get(key).push(entry);
    }
    const clear=key=>{
      const batch=this.staticBatches.get(key);
      if(!batch)return;
      batch.container.traverse(node=>node.geometry?.dispose());
      batch.container.removeFromParent();this.staticBatches.delete(key);
    };
    for(const key of this.staticBatches.keys())if(!regions.has(key))clear(key);
    for(const [key,entries] of regions){
      const layout=entries.map(entry=>entry.layout).join('|');
      if(this.staticBatches.get(key)?.layout===layout)continue;
      clear(key);
      const buckets=new Map();
      const catalogueMesh=node=>{
        if(node.userData.motion||node.userData.wave||node.name==='tecido')return;
        if(node.isMesh&&!Array.isArray(node.material)&&!node.material.transparent){
          node.visible=true;
          if(!buckets.has(node.material))buckets.set(node.material,[]);
          buckets.get(node.material).push(node);
        }
        node.children.forEach(catalogueMesh);
      };
      for(const entry of entries)catalogueMesh(entry.model);
      const container=group(this.root,'Estruturas '+key);
      for(const [material,nodes] of buckets){
        if(nodes.length<2)continue;
        const parts=nodes.map(node=>{
          const copy=node.geometry.index?node.geometry.toNonIndexed():node.geometry.clone();
          for(const name of Object.keys(copy.attributes))if(name!=='position'&&name!=='normal'&&!(name==='uv'&&material.map))copy.deleteAttribute(name);
          return copy.applyMatrix4(node.matrixWorld);
        });
        const merged=mergeGeometries(parts,false);
        parts.forEach(part=>part.dispose());
        if(!merged)continue;
        for(const node of nodes)node.visible=false;
        const mesh=new THREE.Mesh(merged,material);mesh.castShadow=mesh.receiveShadow=true;
        container.add(mesh);
      }
      this.staticBatches.set(key,{container,layout});
    }
  }
  batchRoads(allRoads) {
    for(const [id,bundle] of this.roadBatches){
      if(!allRoads.has(id)){
        bundle.group.traverse(mesh=>{if(mesh.isInstancedMesh)mesh.dispose();});
        bundle.group.removeFromParent();this.roadBatches.delete(id);
      }
    }
    for(const [id,roads] of allRoads){
      const how=roads.map(o=>[o.x,o.z,o.rotation].join(',')).join('|')+'/'+this.terrain.key;
      const saved=this.roadBatches.get(id);
      if(saved?.key===how)continue;
      if(saved){saved.group.traverse(mesh=>{if(mesh.isInstancedMesh)mesh.dispose();});saved.group.removeFromParent();}
      const container=group(this.root,'vias '+id), model=template(id);
      model.updateMatrixWorld(true);
      model.traverse(node=>{
        if(!node.isMesh)return;
        const mesh=new THREE.InstancedMesh(node.geometry,node.material,roads.length);
        const dummy=new THREE.Object3D();
        roads.forEach((o,i)=>{
          dummy.position.set(o.x,objectHeight(o,this.state.objects,this.state.seed,this.state.territory),o.z);
          dummy.rotation.y=angleOf(o.rotation);dummy.updateMatrix();
          mesh.setMatrixAt(i,dummy.matrix.multiply(node.matrixWorld));
        });
        mesh.receiveShadow=true;
        mesh.computeBoundingSphere();
        container.add(mesh);
      });
      this.roadBatches.set(id,{group:container,key:how});
    }
  }
  frame(ms) {
    if(document.hidden || !this.state || this.suspended?.()){this.previous=ms;return;}
    const raw=Math.max(.002,(ms-(this.previous||ms))/1000);
    const dt = Math.min(.05,raw), t=ms/1000;
    this.previous=ms;this.clock=t;
    const movementTime=Math.min(.24,raw);
    const steps=this.navigation.mode==='walk'?Math.ceil(movementTime/.05):1;
    for(let step=0;step<steps;step++)this.navigation.frame(movementTime/steps,this.state,(...args)=>this.blocked(...args));
    const focus=this.navigation.mode==='walk'?this.navigation.position:this.navigation.orbit.target;
    if(!this.focus || this.focus.distanceTo(focus)>12){
      this.focus=focus.clone();this.atmosphere.setFocus(focus);this.renderer.shadowMap.needsUpdate=true;
    }
    let finished=false;
    for(const entry of this.drawables.values()){
      const distance=entry.model.position.distanceToSquared(this.camera.position);
      if(distance<32000)animateModel(entry.motion,t,dt,entry.open,this.reduced);
      if(entry.stage){
        const progress=this.reduced?1:Math.min(1,(t-entry.birth)/.82);
        const reveal=progress<.24?.12*progress/.24:progress<.67?.12+.49*(progress-.24)/.43:.61+.39*(progress-.67)/.33;
        entry.stage.plane.constant=entry.y+.13+Math.max(.15,entry.stage.top-entry.y-.13)*reveal;
        if(progress===1){entry.birth=null;finished=true;this.finishConstruction(entry);}
      }
    }
    if(finished){this.batchBuildings();this.renderer.shadowMap.needsUpdate=true;}
    if(!this.reduced)this.terrain.animate(t);
    if(!this.lighting || t-this.lighting>.12){this.atmosphere.update(this.camera,t,this.reduced);this.lighting=t;}
    else this.atmosphere.sky.position.copy(this.camera.position);
    this.traffic.frame(dt,t,this.reduced);
    this.renderer.render(this.scene,this.camera);
    const metrics=this.metrics;
    metrics.seconds+=raw;metrics.frames++;metrics.samples+=dt;
    if(metrics.seconds>=2){
      metrics.fps=metrics.frames/metrics.seconds;metrics.frames=metrics.seconds=0;
      metrics.calls=this.renderer.info.render.calls;metrics.triangles=this.renderer.info.render.triangles;
      this.canvas.dataset.fps=metrics.fps.toFixed(1);
      this.canvas.dataset.calls=metrics.calls;
    }
    this.onFrame?.(t);
  }
}

