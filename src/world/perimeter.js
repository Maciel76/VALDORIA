import { checkPlacement, footprint } from '../core/geometry.js';

const west=-38, east=44, north=-41, south=41;
export const isPerimeterPiece = object => object.id.startsWith('per-') && !object.id.startsWith('per-road-');

function buildLayout() {
  const walls=[];
  const add=(type,x,z,rotation=0)=>walls.push({id:`per-${walls.length}`,type,x,z,rotation,
    ...(type==='cityGate'?{open:true}:{})});
  const row=(from,to,z)=>{
    for(let x=from+2;x<to;x+=4)add('wall',x,z);
  };
  const column=(from,to,x)=>{
    for(let z=from+2;z<to;z+=4)add('wall',x,z,1);
  };

  add('squareTower',west,north,2);
  add('squareTower',east,north,1);
  add('squareTower',west,south,3);
  // Offset this bastion away from the oak grove at the southeast corner.
  add('squareTower',east+3,south);
  add('cityGate',1,south);
  add('cityGate',east,6,1);
  add('cityGate',west,26,3);

  row(west+3,east-3,north);
  row(west+3,-3,south);
  row(5,east-3,south);
  add('wallShort',east-1.5,south);
  column(north+3,2,east);
  column(10,south-3,east);
  column(north+3,22,west);
  column(30,south-3,west);
  return walls;
}

const plan=buildLayout();
const roads=[
  [0,32],[1,34],[1,36],[1,38],[1,40],[1,42],[1,44],[1,46],
  ...[40,42,44,46,48,50].map(x=>[x,6]),
  ...[24,22,20,18,16,14,12,10].map(z=>[34,z]),[36,10],[36,8],
  ...[-44,-42,-40,-38,-36,-34,-32,-30,-28,-26,-24,-22,-20,-18,-16].map(x=>[x,26]),
  [-16,28],...[-14,-12,-10,-8,-6,-4,-2].map(x=>[x,28])
];

export function installStarterPerimeter(state,castle,maxObjects) {
  const plot=footprint(castle);
  if(plot.x-plot.w/2<west+1 || plot.x+plot.w/2>east-1 ||
    plot.z-plot.d/2<north+1 || plot.z+plot.d/2>south-1 ||
    state.objects.length+plan.length+roads.length>maxObjects) return;
  const staged=[];
  for(const wall of plan) {
    if(checkPlacement(state,wall,{staged}))return;
    staged.push({...wall});
  }
  for(const [index,[x,z]] of roads.entries()) {
    const road={type:'cobbles',rotation:0,x,z,id:`per-road-${index}`};
    if(!checkPlacement(state,road,{staged}))staged.push(road);
  }
  state.objects.push(...staged);
  state.starterPerimeter=true;
}
