import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { catalogue,terrainPaving } from '../core/catalog.js';
import { sluiceBottom,sluiceLeafHeight } from '../core/water-structures.js';
import { fortificationRole,isVillageWall,villageWallId } from '../core/fortifications.js';
import { buildingLevel } from '../core/building-levels.js';
import { lakeGateId,villageWallSections,worldObjects } from './perimeter.js';
import { angleOf, buildingFoundation, footprint, gradedLandHeight, hasFoundation, objectHeight, plotDimensions } from '../core/geometry.js';
import { BAND,bounds,expansionBounds,landHeight,terrainHeight,inWater,waterLevel } from './terrain-data.js';
import { availableLots,lotAt,LOT_SIZE,usesLots } from './lots.js';
import { Terrain,turf,turfColorAt } from './terrain-render.js';
import { Atmosphere } from './atmosphere.js';
import { KingdomCamera } from './camera.js';
import { blockedAt,CollisionGrid,WalkSurfaces } from './walk.js';
import { Traffic } from './traffic.js';
import { createStaticBatches,staticMeshes } from './static-batches.js';
import { drapePaving,makeFoundationSlope,sidewalkStepMaterial,steppedSidewalkGeometry } from './foundation-slope.js';
import { fortificationWallHeight,makeModel,modelKey,sealFor,template } from '../models/library.js';
import { animateModel,tracks } from '../models/animation.js';
import { group } from '../models/kit.js';

const stoneTypes=new Set([...terrainPaving,'walkway']);
const regionKey=(x,z)=>Math.floor((x+24)/48)+','+Math.floor((z+24)/48);
const valid=new THREE.Color('#81cc9b'), invalid=new THREE.Color('#d56156');
const worldPointer=new THREE.Vector2();
const sample=new THREE.Vector3();
const pos=new THREE.Vector3();
const selectionPoint=new THREE.Vector3();
const ghostMaterial=new THREE.MeshBasicMaterial({color:valid,transparent:true,opacity:.3,depthWrite:false,side:THREE.DoubleSide});
const badGhost=ghostMaterial.clone();badGhost.color.copy(invalid);
const edgeGeometry=new THREE.BufferGeometry().setFromPoints([[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5],[-.5,-.5]].map(([x,z])=>new THREE.Vector3(x,0,z)));
const foundationGeometry=new THREE.BoxGeometry(1,1,1,4,1,4);
const foundationColor=new THREE.Color();
const lineValid=new THREE.LineBasicMaterial({color:'#a6ec9a',transparent:true,opacity:.92,depthTest:false});
const lineInvalid=lineValid.clone();lineInvalid.color.set('#f37a63');
const lineSelect=lineValid.clone();lineSelect.color.set('#e8bc66');
const pavingTransform=({x,z,rotation})=>new THREE.Matrix4().makeRotationY(angleOf(rotation)).setPosition(x,.04,z);

function addFoundation(model,material=turf) {
  const mesh=new THREE.Mesh(foundationGeometry,material);
  mesh.name='alicerce';
  mesh.castShadow=mesh.receiveShadow=!material.transparent;
  mesh.matrixAutoUpdate=false;
  model.add(mesh);
  return mesh;
}

function positionFoundation(mesh,foundation,object,seed) {
  const {w,d,base,top,bottom,visible}=foundation;
  mesh.visible=visible;
  mesh.scale.set(w,top-bottom,d);
  mesh.position.y=(top+bottom)/2-base;
  mesh.updateMatrix();
  if(!visible||!object)return;
  if(mesh.geometry===foundationGeometry){
    mesh.geometry=foundationGeometry.clone();
    const count=mesh.geometry.attributes.position.count;
    mesh.geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(count*3),3));
  }
  const {position,color}=mesh.geometry.attributes;
  const angle=angleOf(object.rotation),cos=Math.cos(angle),sin=Math.sin(angle);
  for(let i=0;i<position.count;i++){
    const x=position.getX(i)*w,z=position.getZ(i)*d;
    turfColorAt(object.x+x*cos+z*sin,object.z-x*sin+z*cos,seed,foundationColor);
    color.setXYZ(i,foundationColor.r,foundationColor.g,foundationColor.b);
  }
  color.needsUpdate=true;
}

export class WorldView {
  constructor(host) {
    this.scene=new THREE.Scene();
    this.scene.matrixAutoUpdate=false;
    this.camera=new THREE.PerspectiveCamera(43,1,.10,4600);
    this.territoryCamera=new THREE.OrthographicCamera(-1,1,1,-1,.1,1000);
    this.territoryCamera.up.set(0,0,-1);
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
    this.root.matrixAutoUpdate=false;
    this.navigation=new KingdomCamera(this.canvas,this.camera);
    this.preview=group(this.scene,'prévia');this.ray=new THREE.Raycaster();
    this.selectedLine=new THREE.Line(edgeGeometry,lineSelect);this.selectedLine.renderOrder=3;this.selectedLine.visible=false;this.hud.add(this.selectedLine);
    this.wallSelection=new THREE.LineSegments(new THREE.BufferGeometry(),lineSelect);
    this.wallSelection.renderOrder=3;this.wallSelection.visible=false;this.hud.add(this.wallSelection);
    this.traffic=new Traffic(this.scene,(...args)=>this.blocked(...args));
    this.drawables=new Map();this.roadBatches=new Map();this.staticBatches=new Map();
    this.motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
    this.reduced=this.motionPreference.matches;
    this.motionPreference.addEventListener('change',event=>{this.reduced=event.matches;});
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.host=host;
    this.metrics={seconds:0,frames:0,fps:0,calls:0,triangles:0};
    this.renderScale=1;
    this.fastSamples=0;
    this.resize();
    this.renderer.setAnimationLoop(ms=>this.frame(ms));
  }
  resize() {
    const width=this.host.clientWidth,height=this.host.clientHeight;
    if(!width||!height)return;
    const max=this.state?.quality==='high'?1.7:this.state?.quality==='low'?.75:1.25;
    const ratio=Math.min(max,window.devicePixelRatio||1)*this.renderScale;
    if(this.bufferWidth===width&&this.bufferHeight===height&&this.renderer.getPixelRatio()===ratio)return;
    this.bufferWidth=width;this.bufferHeight=height;
    this.renderer.setDrawingBufferSize(width,height,ratio);
    this.canvas.dataset.renderScale=ratio.toFixed(2);
    this.camera.aspect=width/height;
    this.camera.updateProjectionMatrix();
    this.navigation.resize();
  }
  focusCastle(object){
    const entry=this.drawables.get(object.id);
    if(!entry){this.navigation.focusCastle(object.x,object.z);return;}
    const peak=new THREE.Box3().setFromObject(entry.model).max.y;
    this.navigation.focusCastle(object.x,object.z,entry.y,peak-entry.y,
      object.type==='stockade'&&buildingLevel(object)===10?object.rotation:null);
  }
  showTerritory(direction,panel) {
    clearTimeout(this.expansionTimer);
    this.territoryPreview=panel?{direction,panel}:null;
    this.hud.visible=this.preview.visible=!panel;
    this.navigation.orbit.enabled=!panel&&this.navigation.mode!=='walk';
    if(!this.terrain)return;
    const {territory}=this.state;
    const lots=usesLots(territory);
    this.terrain.border.visible=Boolean(panel)&&!lots;
    this.terrain.showLots(panel&&lots?territory:null,lots?availableLots(territory):[]);
    this.terrain.showExpansion(panel?expansionBounds(territory,direction):null,territory);
  }
  showPurchasedExpansion(strip) {
    this.showTerritory(null,null);
    this.navigation.focusExpansion(strip,this.state);
    this.terrain.showExpansion(strip,this.state.territory,true);
    this.expansionTimer=setTimeout(()=>this.terrain.showExpansion(null),4300);
  }
  frameTerritory() {
    const {minX,maxX,minZ,maxZ}=bounds(this.state.territory);
    const {width,height,top}=this.canvas.getBoundingClientRect();
    const available=Math.max(1,this.territoryPreview.panel.getBoundingClientRect().top-top);
    const padding=usesLots(this.state.territory)?LOT_SIZE:BAND;
    const scale=Math.max((maxX-minX+padding*2)/Math.max(1,width-24),
      (maxZ-minZ+padding*2)/Math.max(1,available-24));
    const camera=this.territoryCamera;
    const x=(minX+maxX)/2,z=(minZ+maxZ)/2;
    camera.left=-width*scale/2;
    camera.right=-camera.left;
    camera.top=available*scale/2;
    camera.bottom=camera.top-height*scale;
    camera.position.set(x,200,z);
    camera.lookAt(x,0,z);
    camera.updateProjectionMatrix();
    return camera;
  }
  pickExpansion(event){
    const rect=this.canvas.getBoundingClientRect(),camera=this.frameTerritory();
    camera.updateMatrixWorld();
    worldPointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
    this.ray.setFromCamera(worldPointer,camera);
    const {x,z}=this.ray.ray.origin;
    const id=lotAt(x,z);
    return availableLots(this.state.territory).includes(id)?id:null;
  }
  adjustResolution(fps) {
    if(this.quality==='high')return;
    const minimum=this.quality==='low'?.67:.55;
    let scale=this.renderScale;
    this.fastSamples=fps>54?this.fastSamples+1:0;
    if(fps<27)scale=Math.max(minimum,Math.round((scale-.15)*100)/100);
    else if(this.fastSamples>=4){
      scale=Math.min(1,Math.round((scale+.10)*100)/100);
      this.fastSamples=0;
    }
    if(scale!==this.renderScale){
      this.renderScale=scale;
      this.resize();
    }
  }
  blocked(x,z,radius,y,swimming) {
    if(!this.state)return false;
    const walking=typeof y==='number';
    return blockedAt(this.state,this.terrain,this.collision,x,z,radius,y,walking?object=>{
      const entry=this.drawables.get(object.id);
      if(!entry) return object.open;
      const sluice=entry.motion.find(node=>node.gate==='sluice-wing');
      if(sluice)return object.open&&Math.abs(sluice.node.rotation.y-sluice.rotation.y)>=Math.PI/2;
      const bridge=entry.motion.find(node=>node.gate==='bridge');
      const leaf=entry.motion.find(node=>node.gate==='leaf');
      return bridge?Math.abs(bridge.node.rotation.x)<.32:leaf?Math.abs(leaf.node.rotation.y)>1.11:object.open;
    }:undefined,this.surfaces,swimming);
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
      const nearby=this.surfaces?.get(sample.x,sample.z)??[];
      let ground=inWater(sample.x,sample.z,seed)?waterLevel:terrainHeight(sample.x,sample.z,seed,territory);
      if(nearby.some(object=>object.landscaped)){
        const natural=landHeight(sample.x,sample.z,seed,territory);
        const graded=gradedLandHeight(sample.x,sample.z,nearby,seed,territory,natural);
        if(graded>natural+.001)ground=graded;
      }
      if(sample.y<=ground){
        const fraction=Number.isFinite(height)?height/(height+ground-sample.y):1;
        return ray.at(Math.max(0,travel-Math.max(.72,(travel-.72)*.035)*(1-fraction)),pos).clone();
      }
      height=sample.y-ground;
    }
    return null;
  }
  pick(event,ground=this.placeAt(event),{foundationsOnly=false}={}) {
    if(!this.state)return null;
    const models=[];
    for(const entry of this.drawables.values()){
      if(foundationsOnly&&!entry.foundation)continue;
      if(!entry.pickBounds||this.ray.ray.intersectsBox(entry.pickBounds))models.push(entry.model);
    }
    const hit=this.ray.intersectObjects(models,true)
      .find(({object})=>object.isMesh&&object.name!=='fumaça');
    const groundDistance=ground?this.ray.ray.origin.distanceTo(ground):Infinity;
    const obstacle=foundationsOnly?null:this.terrain.pickObstacle(this.ray,Math.min(hit?.distance??Infinity,groundDistance+.4));
    if(obstacle)return obstacle;
    if(hit){
      let model=hit.object;
      while(model.parent && !model.userData.uid)model=model.parent;
      if(model.userData.uid)return model.userData.uid;
    }
    if(!ground||foundationsOnly)return null;
    const road=this.state.objects.findLast(o=>{
      if(!stoneTypes.has(o.type))return false;
      const rect=footprint(o);
      return Math.abs(ground.x-o.x)<rect.w/2 && Math.abs(ground.z-o.z)<rect.d/2;
    });
    if(road)return road.id;
    const radius=Math.min(1.25,groundDistance*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))*10/this.host.clientHeight);
    return this.terrain.rockNear(ground.x,ground.z,radius);
  }
  showSlopePreview(object,failed) {
    this.disposeSlopePreview();
    if(!object||object.landscaped)return;
    const foundation=buildingFoundation(object,this.state.seed,this.state.territory);
    if(!foundation?.visible)return;
    this.slopePreview=makeFoundationSlope(foundation,this.state,failed?badGhost:ghostMaterial);
    this.preview.add(this.slopePreview);
  }
  disposeSlopePreview() {
    if(!this.slopePreview)return;
    this.slopePreview.removeFromParent();
    this.slopePreview.geometry.dispose();
    this.slopePreview=null;
  }
  setPreview(points,object,failed) {
    this.clearPreview();
    const {type}=object;
    const source=template(object);
    const reuse=points.length>15;
    for(const [i,point] of points.entries()){
      const object={...point,type};
      const {objects,seed,territory}=this.state;
      const foundation=buildingFoundation(object,seed,territory);
      const y=foundation?.base??objectHeight(object,objects,seed,territory);
      const mark=new THREE.Line(edgeGeometry,failed[i]?lineInvalid:lineValid);
      const item=catalogue[type];mark.scale.set(item.w,1,item.d);mark.position.set(point.x,y+.12,point.z);
      mark.rotation.y=angleOf(point.rotation);mark.renderOrder=3;this.preview.add(mark);
      if(reuse && i!==0 && i!==points.length-1)continue;
      if(terrainPaving.has(type)){
        this.previewPaving(object,source,failed[i]?badGhost:ghostMaterial);
        continue;
      }
      const ghost=source.clone(true);
      ghost.traverse(object=>{
        if(object.isMesh){object.material=failed[i]?badGhost:ghostMaterial;object.castShadow=object.receiveShadow=false;}
        if(object.isPointLight)object.visible=false;
      });
      if(foundation?.visible)positionFoundation(addFoundation(ghost,failed[i]?badGhost:ghostMaterial),foundation);
      ghost.position.set(point.x,y,point.z);ghost.rotation.y=angleOf(point.rotation);
      this.preview.add(ghost);
    }
  }
  previewPaving(object,source,material) {
    const slopes=this.surfaces.get(object.x,object.z).filter(candidate=>candidate.landscaped);
    const add=geometry=>{
      const mesh=new THREE.Mesh(geometry,material);
      mesh.userData.fittedPaving=true;
      this.preview.add(mesh);
    };
    if(catalogue[object.type].treads){
      add(steppedSidewalkGeometry(object,slopes,this.state));
      return;
    }
    const transform=pavingTransform(object), matrix=new THREE.Matrix4();
    source.updateMatrixWorld(true);
    source.traverse(node=>{
      if(!node.isMesh)return;
      add(drapePaving(node.geometry,matrix.multiplyMatrices(transform,node.matrixWorld),slopes,this.state));
    });
  }
  disposePavingPreview() {
    for(const node of this.preview.children.filter(child=>child.userData.fittedPaving)){
      node.removeFromParent();
      node.geometry.dispose();
    }
  }
  setMovePreview(object,point,failed) {
    if(this.moving?.id!==object.id){
      this.clearPreview();
      const entry=this.drawables.get(object.id);
      const model=entry?.model??makeModel(object);
      const marker=new THREE.Line(edgeGeometry,lineValid);
      const {w,d}=plotDimensions(object);
      marker.scale.set(w,1,d);marker.renderOrder=3;
      this.moving={id:object.id,entry,model,marker};
      if(entry){
        if(entry.slope)entry.slope.visible=false;
        this.finishConstruction(entry);
        entry.birth=null;
        for(const mesh of entry.staticMeshes)mesh.visible=true;
        this.batchBuildings();
      }else{
        model.traverse(node=>{if(node.isMesh){node.castShadow=false;node.receiveShadow=true;}});
        this.batchRoads();
      }
      if(terrainPaving.has(object.type))model.visible=false;
      this.preview.add(model,marker);
    }
    Object.assign(this.moving,{object,point,failed});
    this.positionMovePreview();
  }
  positionMovePreview() {
    const {object,point,failed,entry,model,marker}=this.moving;
    const {objects,seed,territory}=this.state;
    const placed={...object,...point};
    const foundation=buildingFoundation(placed,seed,territory);
    const y=foundation?.base??objectHeight(placed,objects,seed,territory);
    if(entry?.foundation)positionFoundation(entry.foundation,foundation,placed,seed);
    if(placed.landscaped)this.showSlopePreview({...placed,landscaped:false},failed);
    if(terrainPaving.has(placed.type)){
      this.disposePavingPreview();
      this.previewPaving(placed,template(placed),failed?badGhost:ghostMaterial);
    }
    model.position.set(point.x,y,point.z);
    model.rotation.y=angleOf(point.rotation);
    marker.position.set(point.x,y+.13,point.z);
    marker.rotation.y=model.rotation.y;
    marker.material=failed?lineInvalid:lineValid;
    this.renderer.shadowMap.needsUpdate=true;
  }
  clearPreview() {
    this.disposeSlopePreview();
    this.disposePavingPreview();
    this.preview.clear();
    if(!this.moving)return;
    const {id,entry,model}=this.moving;
    this.moving=null;
    if(entry){
      if(entry.slope)entry.slope.visible=true;
      const placed=this.state.objects.find(object=>object.id===id);
      if(placed){
        model.position.set(placed.x,entry.y,placed.z);
        model.rotation.y=angleOf(placed.rotation);
        if(entry.foundation){
          const {seed,territory}=this.state;
          positionFoundation(entry.foundation,buildingFoundation(placed,seed,territory),placed,seed);
        }
        this.root.add(model);
      }
      this.batchBuildings();
    }else this.batchRoads();
    this.renderer.shadowMap.needsUpdate=true;
  }
  markObject(object,natural=false) {
    const perimeter=isVillageWall(object);
    this.selectedLine.visible=Boolean(object)&&!perimeter;
    this.wallSelection.visible=perimeter;
    this.selectionCorners=null;
    if(!object)return;
    if(natural){
      const {seed,territory}=this.state;
      const y=terrainHeight(object.x,object.z,seed,territory);
      const rock=object.type==='rock',width=Math.max(1,(rock?2:2.4)*object.size);
      this.selectedLine.position.set(object.x,y+.16,object.z);
      this.selectedLine.scale.set(width,1,width);
      this.selectedLine.rotation.y=0;
      this.selectionCorners=[new THREE.Vector3(object.x,y,object.z),
        new THREE.Vector3(object.x,y+object.size*(rock?.8:6.8),object.z)];
      return;
    }
    if(perimeter){
      const points=[];
      const {seed,territory}=this.state;
      for(const section of villageWallSections(this.state)){
        if(section.type!=='wall')continue;
        const vertical=section.rotation%2;
        const y=terrainHeight(section.x,section.z,seed,territory)+.25;
        for(const end of [-1,1]){
          points.push(new THREE.Vector3(section.x+(vertical?-.75:end*section.span/2),y,
            section.z+(vertical?end*section.span/2:-.75)));
        }
      }
      this.wallSelection.geometry.dispose();
      this.wallSelection.geometry=new THREE.BufferGeometry().setFromPoints(points);
      return;
    }

    const {w,d}=plotDimensions(object);
    const {seed,territory,objects}=this.state;
    const y=objectHeight(object,objects,seed,territory);
    this.selectedLine.position.set(object.x,y+.16,object.z);
    this.selectedLine.scale.set(w,1,d);
    this.selectedLine.rotation.y=angleOf(object.rotation);
    if(fortificationRole(object)||object.type==='waterGate')return;

    const entry=this.drawables.get(object.id);
    const box=entry?.pickBounds ?? (entry?new THREE.Box3().setFromObject(entry.model):new THREE.Box3());
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
      x:(left+right)/2,y:(top+bottom)/2,top,bottom,
      radius:Math.hypot(right-left,bottom-top)/2,width,height,
    };
  }
  drop(entry) {
    entry.model.removeFromParent();
    if(entry.slope){entry.slope.removeFromParent();entry.slope.geometry.dispose();}
    if(entry.foundation&&entry.foundation.geometry!==foundationGeometry)entry.foundation.geometry.dispose();
    for(const {kind,node} of entry.motion){
      if(kind==='wave')node.geometry.dispose();
      if(kind==='cascade')node.dispose();
    }
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
    const enclosed=state.objects.some(isVillageWall);
    let terrainChanged=true;
    if(!this.terrain)this.terrain=new Terrain(this.scene,state.seed,state.territory,enclosed,state.removedLandscape);
    else terrainChanged=this.terrain.update(state.seed,state.territory,enclosed,state.removedLandscape);
    if(this.terrain.key!==previousTerrain&&this.territoryPreview){
      const {direction,panel}=this.territoryPreview;
      this.showTerritory(direction,panel);
    }
    this.atmosphere.set(state.time);
    this.atmosphere.setFocus(this.navigation.orbit.target);
    if(this.quality!==state.quality){
      this.quality=state.quality;
      this.renderScale=1;
      this.fastSamples=0;
      this.metrics.frames=this.metrics.seconds=0;
      this.renderer.shadowMap.enabled=state.quality!=='low';
      for(const entry of this.roadBatches.values()) entry.group.traverse(node=>{if(node.isInstancedMesh)node.material.needsUpdate=true;});
      this.resize();
    }
    const visibleObjects=worldObjects(state);
    this.terrain.setLakeFlow(visibleObjects.find(object=>object.id===lakeGateId)?.open??true);
    if(this.indexedObjects!==state.objects||this.indexedWaterGates!==state.closedWaterGates||this.terrain.key!==previousTerrain){
      this.indexedObjects=state.objects;
      this.indexedWaterGates=state.closedWaterGates;
      this.collision=new CollisionGrid(visibleObjects);
      this.surfaces=new WalkSurfaces(state.objects,state.seed,state.territory);
      this.navigation.surfaces=this.traffic.surfaces=this.surfaces;
    }
    const list=new Map(visibleObjects.map(object=>[object.id,object]));
    const movingObject=list.get(this.moving?.id);
    if(this.moving&&(!movingObject||(this.moving.entry&&template(movingObject)!==this.moving.entry.source)))this.clearPreview();
    for(const [id,entry] of this.drawables){
      const object=list.get(id);
      if(!object||modelKey(object)!==entry.modelKey||template(object)!==entry.source){
        this.drop(entry);this.drawables.delete(id);
      }
    }
    const allRoads=this.roadGroups=new Map();
    const newSet=new Set(created);
    this.atmosphere.fires.length=0;
    for(const object of visibleObjects){
      if(stoneTypes.has(object.type)){
        const key=object.type+':'+regionKey(object.x,object.z);
        if(!allRoads.has(key))allRoads.set(key,[]);
        allRoads.get(key).push(object);continue;
      }
      let entry=this.drawables.get(object.id);
      if(!entry){
        const model=makeModel(object);
        if(object.type==='keep')sealFor(model);
        model.userData.uid=object.span===undefined||object.type==='waterGate'?object.id:villageWallId;
        this.root.add(model);
        entry={model,source:template(object),modelKey:modelKey(object),staticMeshes:staticMeshes(model),motion:tracks(model,object.x*.29+object.z*.37+object.id.length),birth:!this.reduced&&newSet.has(object.id)?this.clock??0:null};
        if(hasFoundation(object))entry.foundation=addFoundation(model);
        this.drawables.set(object.id,entry);
        animateModel(entry.motion,this.clock||0,0,object.open,this.reduced,true);
      }
      const foundation=buildingFoundation(object,state.seed,state.territory);
      const y=foundation?.base??objectHeight(object,state.objects,state.seed,state.territory);
      if(entry.stage)entry.stage.top+=y-entry.y;
      entry.model.position.set(object.x,y,object.z);
      entry.model.rotation.y=angleOf(object.rotation);
      if(object.span!==undefined)entry.model.scale.x=object.span/catalogue[object.type].w;
      if(object.type==='waterGate'){
        const top=(object.wallBase??y)+fortificationWallHeight(object.wallLevel);
        const scale=Math.max(.2,(top-y-sluiceBottom)/sluiceLeafHeight);
        for(const wing of entry.motion){
          if(wing.gate!=='sluice-wing')continue;
          wing.node.scale.y=scale;
          wing.node.position.y=wing.origin.y+sluiceBottom*(1-scale);
        }
      }
      entry.y=y;entry.open=object.open;
      const layout=[object.id,entry.modelKey,object.x,y,object.z,object.rotation,object.span,foundation?.bottom,foundation?state.seed:''].join(',');
      const slopeLayout=object.landscaped&&foundation?.visible?layout+'/'+this.terrain.key:null;
      if(entry.slopeLayout!==slopeLayout){
        if(entry.slope){entry.slope.removeFromParent();entry.slope.geometry.dispose();}
        entry.slope=slopeLayout?makeFoundationSlope(foundation,state):null;
        entry.slopeLayout=slopeLayout;
        if(entry.slope){entry.slope.visible=object.id!==this.moving?.id;this.root.add(entry.slope);}
      }
      if(foundation&&entry.layout!==layout){
        positionFoundation(entry.foundation,foundation,object,state.seed);
        entry.foundationVisible=foundation.visible;
      }
      if(!entry.motion.length&&entry.layout!==layout){
        entry.pickBounds=new THREE.Box3().setFromObject(entry.model);
      }
      entry.layout=layout;
      if(entry.birth!=null&&!entry.stage)this.beginConstruction(entry);
      this.atmosphere.mark(entry.model);
    }
    this.batchRoads();
    this.batchBuildings();
    if(this.moving)this.positionMovePreview();
    if(refreshRoutes)this.traffic.update(state,false,this.reduced,terrainChanged);
    this.renderer.shadowMap.needsUpdate=true;
  }
  batchBuildings() {
    const regions=new Map();
    this.root.updateMatrixWorld(true);
    for(const [id,entry] of this.drawables){
      if(entry.birth!=null||id===this.moving?.id)continue;
      const {x,z}=entry.model.position;
      const key=regionKey(x,z);
      if(!regions.has(key))regions.set(key,[]);
      regions.get(key).push(entry);
    }
    const clear=key=>{
      const batch=this.staticBatches.get(key);
      if(!batch)return;
      for(const node of batch.container.children){
        if(node.isInstancedMesh)node.dispose();
        else node.geometry.dispose();
      }
      batch.container.removeFromParent();this.staticBatches.delete(key);
    };
    for(const key of this.staticBatches.keys())if(!regions.has(key))clear(key);
    for(const [key,entries] of regions){
      const previous=this.staticBatches.get(key);
      const layout=entries.map(entry=>entry.layout);
      if(previous&&entries.length===previous.entries.length&&entries.every((entry,index)=>
        entry===previous.entries[index]&&layout[index]===previous.layout[index]))continue;
      clear(key);
      const container=group(this.root,'Estruturas '+key);
      container.matrixAutoUpdate=false;
      createStaticBatches(container,entries.flatMap(entry=>entry.foundationVisible?[...entry.staticMeshes,entry.foundation]:entry.staticMeshes));
      this.staticBatches.set(key,{container,entries,layout});
    }
  }
  batchRoads() {
    const allRoads=this.roadGroups;
    const dispose=bundle=>{
      bundle.group.traverse(mesh=>{
        if(mesh.isInstancedMesh)mesh.dispose();
        else if(mesh.isMesh)mesh.geometry.dispose();
      });
      bundle.group.removeFromParent();
    };
    for(const [id,bundle] of this.roadBatches){
      if(!allRoads.has(id)){
        dispose(bundle);this.roadBatches.delete(id);
      }
    }
    for(const [id,grouped] of allRoads){
      const roads=this.moving&&!this.moving.entry?grouped.filter(road=>road.id!==this.moving.id):grouped;
      const draped=terrainPaving.has(grouped[0].type);
      const slopes=roads.map(o=>draped?this.surfaces.get(o.x,o.z).filter(object=>object.landscaped):[]);
      const how=roads.map((o,i)=>[o.x,o.z,o.rotation,...slopes[i].map(s=>[s.id,s.x,s.z,s.rotation].join(','))].join(','))
        .join('|')+'/'+this.terrain.key;
      const saved=this.roadBatches.get(id);
      if(saved?.key===how)continue;
      if(saved){dispose(saved);this.roadBatches.delete(id);}
      if(!roads.length)continue;
      const container=group(this.root,'vias '+id);
      container.matrixAutoUpdate=false;
      if(catalogue[roads[0].type].treads){
        const tiles=roads.map((object,i)=>steppedSidewalkGeometry(object,slopes[i],this.state));
        const geometry=mergeGeometries(tiles,false);
        for(const tile of tiles)tile.dispose();
        const mesh=new THREE.Mesh(geometry,sidewalkStepMaterial);
        mesh.castShadow=mesh.receiveShadow=true;
        container.add(mesh);
        this.roadBatches.set(id,{group:container,key:how});
        continue;
      }
      const model=template(roads[0]);
      model.updateMatrixWorld(true);
      const transforms=roads.map(o=>draped?pavingTransform(o):new THREE.Matrix4().makeRotationY(angleOf(o.rotation))
        .setPosition(o.x,objectHeight(o,this.state.objects,this.state.seed,this.state.territory),o.z));
      const transform=new THREE.Matrix4();
      model.traverse(node=>{
        if(!node.isMesh)return;
        if(draped){
          const tiles=transforms.map((road,i)=>
            drapePaving(node.geometry,transform.multiplyMatrices(road,node.matrixWorld),slopes[i],this.state));
          const geometry=mergeGeometries(tiles,false);
          for(const tile of tiles)tile.dispose();
          const mesh=new THREE.Mesh(geometry,node.material);
          mesh.receiveShadow=true;
          container.add(mesh);
          return;
        }
        const mesh=new THREE.InstancedMesh(node.geometry,node.material,transforms.length);
        transforms.forEach((road,i)=>mesh.setMatrixAt(i,transform.multiplyMatrices(road,node.matrixWorld)));
        mesh.matrixAutoUpdate=false;
        mesh.receiveShadow=true;
        mesh.computeBoundingSphere();
        container.add(mesh);
      });
      this.roadBatches.set(id,{group:container,key:how});
    }
  }
  frame(ms) {
    if(document.hidden || !this.state || this.suspended?.()){
      this.previous=undefined;
      this.fastSamples=0;
      this.metrics.frames=this.metrics.seconds=0;
      return;
    }
    const raw=Math.max(.002,(ms-(this.previous||ms))/1000);
    const dt = Math.min(.05,raw), t=ms/1000;
    this.previous=ms;this.clock=t;
    const movementTime=Math.min(.24,raw);
    if(!this.territoryPreview){
      const steps=this.navigation.mode==='walk'?Math.ceil(movementTime/.05):1;
      for(let step=0;step<steps;step++)this.navigation.frame(movementTime/steps,this.state,(...args)=>this.blocked(...args));
    }
    const camera=this.territoryPreview?this.frameTerritory():this.camera;
    this.scene.fog.density=this.territoryPreview?.0015:.004*Math.min(1,170/Math.max(1,camera.position.y));
    const focus=this.navigation.mode==='walk'?this.navigation.position:this.navigation.orbit.target;
    if(!this.focus || this.focus.distanceTo(focus)>12){
      this.focus=focus.clone();this.atmosphere.setFocus(focus);this.renderer.shadowMap.needsUpdate=true;
    }
    let finished=false;
    for(const entry of this.drawables.values()){
      const distance=entry.model.position.distanceToSquared(camera.position);
      if(distance<32000||entry.modelKey==='waterGate')animateModel(entry.motion,t,dt,entry.open,this.reduced);
      if(entry.stage){
        const progress=this.reduced?1:Math.min(1,(t-entry.birth)/.82);
        const reveal=progress<.24?.12*progress/.24:progress<.67?.12+.49*(progress-.24)/.43:.61+.39*(progress-.67)/.33;
        entry.stage.plane.constant=entry.y+.13+Math.max(.15,entry.stage.top-entry.y-.13)*reveal;
        if(progress===1){entry.birth=null;finished=true;this.finishConstruction(entry);}
      }
    }
    if(finished){this.batchBuildings();this.renderer.shadowMap.needsUpdate=true;}
    if(!this.reduced)this.terrain.animate(t);
    if(!this.lighting || t-this.lighting>.12){this.atmosphere.update(camera,t,this.reduced);this.lighting=t;}
    else this.atmosphere.sky.position.copy(camera.position);
    this.traffic.frame(movementTime,t,this.reduced);
    this.atmosphere.clouds.visible=!this.territoryPreview;
    this.renderer.render(this.scene,camera);
    const metrics=this.metrics;
    metrics.seconds+=Math.min(2,raw);metrics.frames++;
    if(metrics.seconds>=2){
      metrics.fps=metrics.frames/metrics.seconds;metrics.frames=metrics.seconds=0;
      metrics.calls=this.renderer.info.render.calls;metrics.triangles=this.renderer.info.render.triangles;
      this.canvas.dataset.fps=metrics.fps.toFixed(1);
      this.canvas.dataset.calls=metrics.calls;
      this.canvas.dataset.triangles=metrics.triangles;
      this.adjustResolution(metrics.fps);
    }
    this.onFrame?.(t);
  }
}

