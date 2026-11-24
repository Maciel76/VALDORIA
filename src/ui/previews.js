import * as THREE from 'three';
import { loadLandmarks,makeModel,sealFor } from '../models/library.js';
import { tracks,animateModel } from '../models/animation.js';

const thumbnails=new Map();
const thumbnailQueues=new WeakMap();
let renderer, scene, camera;
function setup() {
  renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
  renderer.setSize(178,115,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  scene=new THREE.Scene();
  const light=new THREE.DirectionalLight(0xffeed1,2.6);
  light.position.set(-4,9,4);
  scene.add(light,new THREE.HemisphereLight(0xffe7cb,0xa28b55,1.7));
  camera=new THREE.OrthographicCamera(-1.55,1.55,1,-1,.01,150);
}
export function thumbnail(id) {
  if(thumbnails.has(id))return thumbnails.get(id);
  try {
    if(!renderer)setup();
    const mesh=makeModel({type:id});
    if(id==='keep')sealFor(mesh);
    mesh.traverse(node=>{if(node.isPointLight||node.name==='fumaça')node.visible=false;});
    const motion=tracks(mesh,1);
    animateModel(motion,1,0,true,true,true);
    const box=new THREE.Box3().setFromObject(mesh), center=box.getCenter(new THREE.Vector3()), scale=box.getSize(new THREE.Vector3());
    const span=Math.max(scale.x,scale.y,scale.z)*.65+.1;
    camera.left=-span*1.55;camera.right=span*1.55;
    camera.top=span;camera.bottom=-span;camera.updateProjectionMatrix();
    camera.position.copy(center).add(new THREE.Vector3(2.6,2.0,3.25).setLength(span*6+4));
    camera.lookAt(center);scene.add(mesh);
    renderer.render(scene,camera);
    scene.remove(mesh);
    motion.forEach(track=>{if(track.kind==='wave')track.node.geometry.dispose();});
    const data=renderer.domElement.toDataURL();
    thumbnails.set(id,data);
    return data;
  } catch { return ''; }
}
export function fillThumbnails(container) {
  const dialog=container.closest('dialog');
  const images=[...container.querySelectorAll('img[data-model]:not([src])')];
  thumbnailQueues.set(container,images);
  const active=()=>dialog.open&&thumbnailQueues.get(container)===images;
  const pulse=async()=>{
    if(!active()||!images.length)return;
    const image=images.shift();
    const type=image.dataset.model;
    if(!thumbnails.has(type)){
      const loading=loadLandmarks([{type}]);
      if(loading)await loading;
    }
    if(!active()||!image.isConnected)return;
    const data=thumbnail(type);
    if(data)image.src=data;
    if(images.length)setTimeout(pulse,36);
  };
  setTimeout(pulse,35);
}

