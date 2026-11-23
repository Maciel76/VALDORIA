import * as THREE from 'three';
import { materials } from '../models/kit.js';
import { random } from './terrain-data.js';

const looks={
  morning:{sky:'#b1c9ad',horizon:'#dbe1b1',fog:'#c3d6b4',sun:0xffdea2,ambient:0xfff2d7,ground:0x64794f,power:2.28,hemi:1.62,angle:[-47,72,28],lamp:.08},
  noon:{sky:'#81b1cb',horizon:'#cbdcbf',fog:'#b6d3c2',sun:0xffefd8,ambient:0xe5ecfd,ground:0x687f53,power:2.57,hemi:1.92,angle:[-19,112,17],lamp:.0},
  sunset:{sky:'#a78284',horizon:'#f6c59b',fog:'#dbac8d',sun:0xffa464,ambient:0xffdbc2,ground:0x595455,power:2.47,hemi:1.16,angle:[-71,37,-32],lamp:.56},
  night:{sky:'#122336',horizon:'#405768',fog:'#2b4356',sun:0xa6bbff,ambient:0x8195c5,ground:0x293a37,power:.4,hemi:.66,angle:[21,77,-46],lamp:1}
};
export class Atmosphere {
  constructor(scene) {
    this.scene=scene;
    this.scene.fog=new THREE.FogExp2(0xc3d6b4,.004);
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(750,32,18), new THREE.ShaderMaterial({
      depthWrite:false,side:THREE.BackSide,
      uniforms:{top:{value:new THREE.Color()},bottom:{value:new THREE.Color()}},
      vertexShader:'varying vec3 v; void main(){v=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'uniform vec3 top; uniform vec3 bottom; varying vec3 v; void main(){gl_FragColor=vec4(mix(bottom,top,smoothstep(-.12,.62,v.y)),1.); #include <colorspace_fragment>\n}'.replace('; #',';\n#')
    }));
    this.sky.renderOrder=-5;scene.add(this.sky);
    this.hemi=new THREE.HemisphereLight(0xfff2d7,0x64794f,1.64);scene.add(this.hemi);
    this.sun=new THREE.DirectionalLight(0xffd899,2.35);
    this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);
    Object.assign(this.sun.shadow.camera,{left:-74,right:74,top:74,bottom:-74,near:1,far:240});
    this.sun.shadow.normalBias=.19;this.sun.shadow.bias=-.00026;this.sun.shadow.radius=2.5;
    scene.add(this.sun,this.sun.target);
    this.fires=[];
    this.pool=Array.from({length:7},()=>{
      const light=new THREE.PointLight(0xff9c41,0,8,1.9);
      scene.add(light);
      return light;
    });
    this.set('morning');
    const rng=random(594);
    const cloudMaterial=new THREE.MeshBasicMaterial({color:'#eff0d4',transparent:true,opacity:.18,depthWrite:false,fog:true});
    const cloudGeometry=new THREE.IcosahedronGeometry(1,1);
    this.clouds=new THREE.Group();
    for(let i=0;i<29;i++){
      const cloud=new THREE.Mesh(cloudGeometry,cloudMaterial);
      cloud.position.set((rng()-.5)*620,74+rng()*30,(rng()-.5)*620);
      cloud.scale.set(14+rng()*43,1+rng()*2,7+rng()*16);
      this.clouds.add(cloud);
    }
    scene.add(this.clouds);
  }
  set(name) {
    this.look=looks[name];
    this.sky.material.uniforms.top.value.set(this.look.sky);
    this.sky.material.uniforms.bottom.value.set(this.look.horizon);
    this.scene.fog.color.set(this.look.fog);
    this.hemi.color.setHex(this.look.ambient);
    this.hemi.groundColor.setHex(this.look.ground);
    this.hemi.intensity=this.look.hemi;
    for(const light of this.pool)light.visible=this.look.lamp>.15;
    this.sun.color.setHex(this.look.sun);
    this.sun.intensity=this.look.power;
    materials.glass.emissiveIntensity=.06+this.look.lamp*.82;
    materials.pane.emissiveIntensity=.02+this.look.lamp*.58;
  }
  mark(model) {
    model.traverse(light=>{
      if (light.isPointLight) {
        light.userData.originalPower ??= light.intensity;
        this.fires.push({light, power:light.userData.originalPower});
        light.intensity=0;
        light.visible=false;
      }
    });
  }
  setFocus(target) {
    const x=Math.round(target.x/16)*16,z=Math.round(target.z/16)*16;
    this.sun.target.position.set(x,0,z);
    this.sun.position.set(x+this.look.angle[0],this.look.angle[1],z+this.look.angle[2]);
  }
  update(camera,time,reduced) {
    this.sky.position.copy(camera.position);
    if(this.clouds)this.clouds.position.x=reduced?0:Math.sin(time*.035)*18;
    const point=new THREE.Vector3();
    const nearest=this.fires.map(f=>({f,dist:f.light.getWorldPosition(point).distanceToSquared(camera.position)}))
      .filter(v=>v.dist<8100).sort((a,b)=>a.dist-b.dist);
    for(const [i,light] of this.pool.entries()){
      const source=nearest[i];
      if(source){
        source.f.light.getWorldPosition(light.position);
        light.intensity=source.f.power*this.look.lamp*(reduced?1:1+Math.sin(time*7.4+i)*.18);
      }else light.intensity=0;
    }
  }
}

