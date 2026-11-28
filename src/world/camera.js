import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { supportHeightWrapper } from './walk.js';
import { bounds,visibleTerrainHeight } from './terrain-data.js';
import { footprint } from '../core/geometry.js';
import { isPerimeterPiece,isVillageWall } from '../core/fortifications.js';
import { villagePerimeterBounds } from './perimeter.js';
import { usesLots } from './lots.js';

const groundClearance=1.4;
const panoramaDistance=1250;

export class KingdomCamera {
  constructor(canvas,camera) {
    this.canvas=canvas;this.camera=camera;
    // Keep the requested orbit pose separate from the terrain-adjusted view.
    this.orbitCamera=camera.clone();
    this.orbit=new OrbitControls(this.orbitCamera,canvas);
    this.orbit.enableDamping=true;
    this.orbit.dampingFactor=.13;
    this.orbit.minDistance=16;
    this.orbit.maxDistance=panoramaDistance;
    this.orbit.maxPolarAngle=Math.PI*.486;
    this.orbit.panSpeed=.82;
    this.orbit.screenSpacePanning=false;
    this.orbit.zoomSpeed=.69;
    this.orbit.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN};
    this.mode='orbit';this.keys=new Set();
    this.viewAngle=new THREE.Spherical();
    this.position=new THREE.Vector3(-.6,0,9);
    this.yaw=0;this.pitch=-.04;
    this.manual=null;
    this.overview();
    canvas.addEventListener('pointerdown',event=>{
      if(this.mode!=='walk'||event.button!==0)return;
      this.manual={x:event.clientX,y:event.clientY};
    });
    document.addEventListener('pointerup',()=>this.manual=null);
    document.addEventListener('pointercancel',()=>this.manual=null);
    document.addEventListener('mousemove',event=>{
      if(this.mode!=='walk')return;
      if(document.pointerLockElement===canvas)this.rotate(event.movementX,event.movementY);
    });
    canvas.addEventListener('pointermove',event=>{
      if(this.mode==='walk' && this.manual && document.pointerLockElement!==canvas){
        this.rotate(event.clientX-this.manual.x,event.clientY-this.manual.y);
        this.manual={x:event.clientX,y:event.clientY};
      }
    });
    window.addEventListener('blur',()=>this.keys.clear());
  }
  rotate(x,y) {
    this.yaw-=x*.0032;
    this.pitch=THREE.MathUtils.clamp(this.pitch-y*.0032,-1.40,1.40);
  }
  overview(state) {
    if(this.mode==='walk')this.setMode('orbit');
    if(state)this.state=state;
    if(usesLots(state?.territory)){
      const {minX,maxX,minZ,maxZ}=bounds(state.territory);
      const x=(minX+maxX)/2,z=(minZ+maxZ)/2;
      const distance=Math.max(maxX-minX,maxZ-minZ)*.92*Math.max(1,1.45/this.camera.aspect);
      this.snap([x,1,z],[x+distance*.66,distance*.93,z+distance*.96]);
      return;
    }
    if(state?.objects.some(isVillageWall)){
      this.snap([3,-2,3],[71,92,101]);
      return;
    }
    const walls=state?.objects.filter(isPerimeterPiece).map(footprint) || [];
    if(walls.length){
      const minX=Math.min(...walls.map(wall=>wall.x-wall.w/2)),maxX=Math.max(...walls.map(wall=>wall.x+wall.w/2));
      const minZ=Math.min(...walls.map(wall=>wall.z-wall.d/2)),maxZ=Math.max(...walls.map(wall=>wall.z+wall.d/2));
      const x=(minX+maxX)/2,z=(minZ+maxZ)/2;
      const span=Math.min(165,Math.max(64,maxX-minX,maxZ-minZ));
      const distance=span*1.15*Math.max(1,Math.min(1.8,.95/this.camera.aspect));
      this.snap([x,-2,z+3],[x+distance*.66,distance*.92,z+distance*.96]);
      return;
    }
    this.snap([-5,2,-9],[55,49,72]);
  }
  focusVillageWall(territory) {
    const {west,east,north,south}=villagePerimeterBounds(territory);
    const x=(west+east)/2,z=(north+south)/2;
    const extent=Math.max(south-north,(east-west)/this.camera.aspect);
    const distance=extent*.57/Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2));
    this.orbit.maxDistance=Math.max(this.orbit.maxDistance,distance*1.1);
    this.snap([x,0,z],[x,distance,z+distance*.12]);
  }
  focusVillageGate(gate) {
    const y=this.floorAt(gate.x,gate.z)??0;
    const angle=gate.rotation*Math.PI/2;
    const dx=12*Math.cos(angle)+21*Math.sin(angle);
    const dz=21*Math.cos(angle)-12*Math.sin(angle);
    this.snap([gate.x,y+2.2,gate.z],[gate.x+dx,y+14,gate.z+dz]);
  }
  focusCastle(x,z) {
    this.snap([x,2.75,z],[x+22,35,z+45]);
  }
  focusExpansion({minX,maxX,minZ,maxZ},state) {
    this.state=state;
    const x=(minX+maxX)/2,z=(minZ+maxZ)/2;
    const extent=Math.max(maxZ-minZ,(maxX-minX)/this.camera.aspect);
    const height=Math.max(90,extent*.61/Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2)));
    this.orbit.maxDistance=Math.max(this.orbit.maxDistance,height*1.1);
    this.snap([x,0,z],[x,height,z+height*.19]);
  }
  snap(target,position) {
    const damping=this.orbit.enableDamping;
    this.orbit.enableDamping=false;
    this.orbit.update();
    this.orbit.target.set(...target);
    this.orbitCamera.position.set(...position);
    this.orbit.update();
    this.orbit.enableDamping=damping;
    this.targetGround=this.floorAt(this.orbit.target.x,this.orbit.target.z);
    this.updateOrbitView();
  }
  setMode(mode,state) {
    if(state)this.state=state;
    if(mode===this.mode)return;
    if(this.mode==='walk')document.exitPointerLock?.();
    if(mode==='walk'){
      this.position.y=supportHeightWrapper(this.position.x,this.position.z,this.state,undefined,this.surfaces);
    }
    this.mode=mode;
    this.orbit.enabled=mode!=='walk';
    this.orbit.maxPolarAngle=mode==='free'?Math.PI*.495:Math.PI*.465;
    this.keys.clear();
    if(mode!=='walk')this.updateOrbitView();
  }
  floorAt(x,z) {
    const state=this.state;
    return state?visibleTerrainHeight(x,z,state.seed,state.territory):undefined;
  }
  updateOrbitView() {
    const target=this.orbit.target;
    const desired=this.orbitCamera.position;
    if(this.state){
      const edge=bounds(this.state.territory);
      const x=THREE.MathUtils.clamp(target.x,edge.minX-5,edge.maxX+5);
      const z=THREE.MathUtils.clamp(target.z,edge.minZ-5,edge.maxZ+5);
      desired.x+=x-target.x;
      desired.z+=z-target.z;
      target.x=x;
      target.z=z;
      const ground=this.floorAt(x,z);
      const rise=this.targetGround===undefined?0:ground-this.targetGround;
      desired.y+=rise;
      target.y+=rise;
      this.targetGround=ground;
    }
    const position=this.camera.position.copy(desired);
    const angle=this.viewAngle.setFromVector3(position.sub(target));
    const panorama=THREE.MathUtils.smoothstep(angle.radius,230,620);
    // Tilt the view down at long range while keeping the player's orbit angle for zooming back in.
    angle.phi=THREE.MathUtils.lerp(angle.phi,Math.min(angle.phi,Math.PI/5),panorama);
    position.setFromSpherical(angle).add(target);
    const ground=this.floorAt(position.x,position.z);
    if(ground!==undefined)position.y=Math.max(position.y,ground+groundClearance);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();
  }
  resize() {
    this.orbitCamera.aspect=this.camera.aspect;
    this.orbitCamera.updateProjectionMatrix();
  }
  lookMode() {
    const operation=this.canvas.requestPointerLock?.();
    operation?.catch(()=>{});
  }
  zoom(scale) {
    if(this.mode==='walk')return;
    const offset=this.orbitCamera.position.clone().sub(this.orbit.target);
    const distance=THREE.MathUtils.clamp(offset.length()*scale,this.orbit.minDistance,this.orbit.maxDistance);
    this.orbitCamera.position.copy(this.orbit.target).add(offset.setLength(distance));
    this.orbit.update();
    this.updateOrbitView();
  }
  frame(dt,state,blocked) {
    this.state=state;
    const pressed=(...keys)=>keys.some(key=>this.keys.has(key));
    if(this.mode==='walk'){
      const z=Number(pressed('w','arrowup'))-Number(pressed('s','arrowdown'));
      const x=Number(pressed('d','arrowright'))-Number(pressed('a','arrowleft'));
      const speed=(pressed('shift')?7:4.2)*dt/(x&&z?Math.SQRT2:1);
      const dx=(x*Math.cos(this.yaw)-z*Math.sin(this.yaw))*speed;
      const dz=(-z*Math.cos(this.yaw)-x*Math.sin(this.yaw))*speed;
      if(dx && !blocked(this.position.x+dx,this.position.z,.24,this.position.y))this.position.x+=dx;
      if(dz && !blocked(this.position.x,this.position.z+dz,.24,this.position.y))this.position.z+=dz;
      const y=supportHeightWrapper(this.position.x,this.position.z,state,this.position.y+.79,this.surfaces);
      this.position.y+=(y-this.position.y)*Math.min(1,dt*15);
      this.camera.position.copy(this.position);
      this.camera.position.y=Math.max(this.position.y+1.66,this.floorAt(this.position.x,this.position.z)+groundClearance);
      this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ');
    }else{
      const right=Number(pressed('d','arrowright'))-Number(pressed('a','arrowleft'));
      const back=Number(pressed('s','arrowdown'))-Number(pressed('w','arrowup'));
      if(right||back){
        const offset=this.orbitCamera.position.clone().sub(this.orbit.target).setY(0).normalize();
        const speed=dt*37/Math.hypot(right,back);
        const move=new THREE.Vector3(offset.x*back+offset.z*right,0,offset.z*back-offset.x*right).multiplyScalar(speed);
        this.orbitCamera.position.add(move);this.orbit.target.add(move);
      }
      this.orbit.update();
      this.updateOrbitView();
    }
  }
}

