import { random, terrainHeight, inWater, bounds } from '../world/terrain-data.js';
import { catalogue } from '../core/catalog.js';
import { worldObjects } from '../world/perimeter.js';
import { footprint, gates } from '../core/geometry.js';

import { atlasPoints, inside } from '../world/atlas-geography.js';

function path(ctx,points,w,h){
  ctx.beginPath();
  points.forEach(([x,y],i)=>i?ctx.lineTo(x*w,y*h):ctx.moveTo(x*w,y*h));
  ctx.closePath();
}
function label(ctx,text,x,y,size=12,fill='#586243'){
  ctx.font=`italic ${size}px "Crimson Pro Variable", Georgia, serif`;
  ctx.fillStyle=fill;ctx.textAlign='center';ctx.fillText(text,x,y);
}
function compass(ctx,x,y,r){
  ctx.save();ctx.translate(x,y);
  ctx.strokeStyle='#8e784d';ctx.fillStyle='#8e784d';ctx.lineWidth=.7;
  for(const k of [.81,1.07]){ctx.beginPath();ctx.arc(0,0,r*k,0,Math.PI*2);ctx.stroke();}
  for(let i=0;i<8;i++){
    ctx.save();ctx.rotate(i*Math.PI/4);
    ctx.beginPath();ctx.moveTo(0,i%2?-r*.7:-r*1.14);ctx.lineTo(-r*.12,0);ctx.lineTo(0,r*.12);
    ctx.closePath();ctx.fill();ctx.restore();
  }
  label(ctx,'N',0,-r*1.23,r*.48);label(ctx,'S',0,r*1.54,r*.40);
  label(ctx,'O',-r*1.43,r*.13,r*.40);label(ctx,'L',r*1.43,r*.13,r*.40);
  ctx.restore();
}
function peaks(ctx,x,y,r,rng){
  const h=r*(.55+rng()*.45);
  ctx.beginPath();ctx.moveTo(x-r,y);ctx.lineTo(x-r*.66,y-h*.16);ctx.lineTo(x,y-h);
  ctx.lineTo(x+r*.45,y-h*.41);ctx.lineTo(x+r,y);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x,y-h);ctx.lineTo(x-r*.15,y-h*.42);ctx.lineTo(x+r*.15,y-h*.10);ctx.stroke();
}
function pine(ctx,x,y,r){
  ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x-r*.46,y-r*.36);ctx.lineTo(x-r*.25,y-r*.39);
  ctx.lineTo(x-r*.54,y-r*.06);ctx.lineTo(x+r*.54,y-r*.06);ctx.lineTo(x+r*.21,y-r*.40);
  ctx.lineTo(x+r*.46,y-r*.36);ctx.closePath();ctx.stroke();
  ctx.beginPath();ctx.moveTo(x,y-r*.06);ctx.lineTo(x,y+r*.23);ctx.stroke();
}

export function drawAtlas(canvas) {
  const w=1200,h=700;canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');
  const rng=random(98814);
  ctx.fillStyle='#d7c4a0';ctx.fillRect(0,0,w,h);
  const paper=ctx.createRadialGradient(w*.4,h*.43,100,w*.45,h*.40,w*.64);
  paper.addColorStop(0,'#e9dfbc');paper.addColorStop(.67,'#e4d6b2');paper.addColorStop(1,'#c3aa7d');
  ctx.fillStyle=paper;ctx.fillRect(0,0,w,h);
  for(let n=0;n<26000;n++){
    ctx.fillStyle=n%3?'rgba(102,71,32,.062)':'rgba(255,254,218,.17)';
    const x=rng()*w,y=rng()*h;
    ctx.fillRect(x,y,rng()*2.8+1,rng()*1.25+.4);
  }
  ctx.strokeStyle='#9f8a5c55';ctx.lineWidth=.65;
  for(let x=40;x<w;x+=52){ctx.beginPath();ctx.moveTo(x,20);ctx.lineTo(x,h-20);ctx.stroke();}
  for(let y=39;y<h;y+=48){ctx.beginPath();ctx.moveTo(20,y);ctx.lineTo(w-20,y);ctx.stroke();}
  ctx.strokeStyle='#9e865aa0';ctx.strokeRect(12,12,w-24,h-24);ctx.strokeRect(17,17,w-34,h-34);
  for(const [i,points] of atlasPoints.entries()){
    const land=ctx.createRadialGradient(w*.47,h*.49,60,w*.47,h*.49,w*.52);
    land.addColorStop(0,'#bcca99');land.addColorStop(.55,'#98a878');land.addColorStop(1,'#899972');
    path(ctx,points,w,h);
    ctx.lineWidth=15;ctx.strokeStyle='#a9956b62';ctx.stroke();
    ctx.lineWidth=7;ctx.strokeStyle='#9c996977';ctx.stroke();
    ctx.lineWidth=2;ctx.strokeStyle='#796c48';ctx.stroke();
    ctx.fillStyle=land;ctx.fill();
    ctx.save();ctx.clip();
    for(let p=0;p<46;p++){
      const x=(.08+rng()*.84)*w,y=(.11+rng()*.76)*h,r=(.04+rng()*.16)*w;
      const wash=ctx.createRadialGradient(x,y,3,x,y,r);
      wash.addColorStop(0,p%4?'#57784730':'#dbc78e65');wash.addColorStop(1,'#74804d00');
      ctx.fillStyle=wash;ctx.fillRect(x-r,y-r,r*2,r*2);
    }
    for(let p=0;p<3800;p++){
      ctx.fillStyle=p%3?'#544f321e':'#ffffda30';const x=rng()*w,y=rng()*h;
      ctx.fillRect(x,y,rng()*3+1,rng()+.35);
    }
    for(let p=0;p<270;p++){
      const nx=.08+rng()*.83,ny=.12+rng()*.79;
      if(!inside(nx,ny,points))continue;
      const band=.45+Math.sin(nx*15+i)*.109;
      const r=4+rng()*12;
      const mountain=Math.abs(ny-band)<.12&&rng()>.35;
      ctx.lineWidth=mountain?.96:.71;
      ctx.strokeStyle=mountain?'#514e3ba6':'#476143af';
      if(mountain)peaks(ctx,nx*w,ny*h,r,rng);
      else pine(ctx,nx*w,ny*h,r*.72);
    }
    ctx.restore();
  }
  for(let i=0;i<94;i++){
    const x=.03+rng()*.94,y=.06+rng()*.86;
    if(atlasPoints.some(poly=>inside(x,y,poly)))continue;
    ctx.strokeStyle='#8e7d5674';ctx.lineWidth=.8;
    const a=x*w,b=y*h,k=5+rng()*14;
    ctx.beginPath();ctx.moveTo(a-k,b);ctx.quadraticCurveTo(a-k*.45,b-3,a,b);
    ctx.quadraticCurveTo(a+k*.45,b+3,a+k,b);ctx.stroke();
  }
  ctx.strokeStyle='#537976a0';ctx.lineWidth=2;ctx.lineCap='round';
  const streams=[[[.40,.37],[.42,.46],[.37,.51],[.36,.6],[.318,.68],[.315,.742]],
    [[.47,.41],[.536,.51],[.56,.55],[.62,.59],[.66,.58]],[[.811,.48],[.78,.55],[.81,.66],[.766,.772]]];
  for(const points of streams){
    ctx.beginPath();
    points.forEach(([x,y],i)=>{if(!i)ctx.moveTo(x*w,y*h);else{
      const [px,py]=points[i-1];ctx.bezierCurveTo((px*.6+x*.4)*w,(py*.7+y*.3)*h,(px*.3+x*.7-.009)*w,(py*.25+y*.75+.021)*h,x*w,y*h);
    }});
    ctx.stroke();
  }
  label(ctx,'Mar de Âmbar',w*.48,h*.092,28,'#827251');
  label(ctx,'Serra da Bruma',w*.44,h*.27,23);
  label(ctx,'Planícies de Avelar',w*.43,h*.666,24);
  label(ctx,'Ilha de Vidral',w*.79,h*.708,19);
  label(ctx,'Ilhas de Lúmen',w*.20,h*.194,17);
  label(ctx,'Estreito dos Ventos',w*.78,h*.934,20,'#827251');
  compass(ctx,w*.905,h*.151,35);
}
export function drawMinimap(canvas,state,position) {
  const ctx=canvas.getContext('2d'), w=192,h=138;
  if(canvas.width!==w){canvas.width=w;canvas.height=h;}
  const edge=bounds(state.territory), sx=w/(edge.maxX-edge.minX), sz=h/(edge.maxZ-edge.minZ),
    rng=random(state.seed);
  for(let i=0;i<h;i+=3)for(let j=0;j<w;j+=3){
    const x=edge.minX+j/sx,z=edge.minZ+i/sz;
    const lev=terrainHeight(x,z,state.seed,state.territory);
    ctx.fillStyle=inWater(x,z,state.seed)?'#668e86':lev>7?['#617847','#657d4b','#6d8555'][Math.floor(rng()*3)]:
      ['#8a9a5a','#819153','#929f61','#849559'][Math.floor(rng()*4)];
    ctx.fillRect(j,i,3,3);
  }
  for(const object of state.objects){
    if(catalogue[object.type].category==='walls')continue;
    const x=(object.x-edge.minX)*sx,z=(object.z-edge.minZ)*sz;
    const castle=object.type==='keep'||object.type==='stockade';
    ctx.fillStyle=castle?'#5e3132':object.type==='cobbles'||object.type==='dirt'?'#beae79':'#e3cf92';
    const size=castle?7:.95;
    ctx.fillRect(x-size/2,z-size/2,size,size);
  }
  for(const object of worldObjects(state)){
    if(catalogue[object.type].category!=='walls')continue;
    const plot=footprint(object), x=(plot.x-edge.minX)*sx,z=(plot.z-edge.minZ)*sz;
    const width=Math.max(1,plot.w*sx),height=Math.max(1,plot.d*sz);
    ctx.fillStyle=gates.has(object.type)?(object.open?'#e4c67c':'#994b43'):'#534635';
    ctx.fillRect(x-width/2,z-height/2,width,height);
  }
  if(position){
    const x=(position.x-edge.minX)*sx,z=(position.z-edge.minZ)*sz;
    ctx.beginPath();ctx.arc(x,z,4,0,Math.PI*2);ctx.strokeStyle='#f7e6a5';ctx.lineWidth=1.4;ctx.stroke();
  }
  ctx.strokeStyle='#eee1afad';ctx.lineWidth=1.3;ctx.strokeRect(2,2,w-4,h-4);
}

