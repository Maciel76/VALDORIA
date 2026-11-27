export const riverX = (z,seed)=>59+Math.sin(z/62+seed%11*.15)*16+Math.sin(z/22)*3.8;
export const riverWidth = z=>13.1+2*Math.cos(z/33);
export const riverSurfaceWidth = z=>riverWidth(z)*.54;
export const waterLevel=-1.05;

const inlet=[[null,-126],[74,-120],[89,-109],[103,-96],[116,-82]];
const outlet=[[121,-37],[109,-27],[96,-12],[86,-3],[null,7]];
const channelWidth=3.6;
export const lakeCenter={x:125,z:-63};
export const lakeIntake={x:82,z:-114.13};
const resolveX=(x,z,seed)=>x??riverX(z,seed);
export const lakeChannels=seed=>[inlet,outlet].map(path=>path.map(([x,z])=>[resolveX(x,z,seed),z]));

function channelDistance(x,z,points,seed){
  let distance=Infinity;
  for(let i=1;i<points.length;i++){
    const [from,az]=points[i-1],[to,bz]=points[i];
    const ax=resolveX(from,az,seed), bx=resolveX(to,bz,seed);
    const dx=bx-ax,dz=bz-az;
    const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
    distance=Math.min(distance,Math.hypot(x-ax-t*dx,z-az-t*dz));
  }
  return distance-channelWidth;
}

// Negative inside the connected river, channels and lake.
export function waterDistance(x,z,seed){
  const river=Math.abs(x-riverX(z,seed))-riverWidth(z)*.47;
  if(x<28||x>174||z<-141||z>20)return river;
  const dx=x-lakeCenter.x,dz=z-lakeCenter.z;
  const lake=(Math.hypot((dx+.19*dz)/35,(dz-.13*dx)/30)-1)*30
    +1.35*Math.sin(x*.18+z*.11)+.75*Math.sin(z*.29);
  const channel=z<-76 ? channelDistance(x,z,inlet,seed)
    : z>-43 ? channelDistance(x,z,outlet,seed) : Infinity;
  return Math.min(river,lake,channel);
}

export const inWater=(x,z,seed)=>waterDistance(x,z,seed)<0;
export const waterSurface=(x,z,seed)=>waterDistance(x,z,seed)<.85;
