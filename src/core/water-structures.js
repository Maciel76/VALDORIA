export const bridges=new Set(['bridge','riverBridge']);
export const riverBridgeLength=30;

export function riverBridgeDeck(z){
  const t=Math.max(0,Math.min(1,(riverBridgeLength/2-Math.abs(z))/(riverBridgeLength/2-2.5)));
  return .08+6.22*t*t*(3-2*t);
}

export const sluiceHinge=4.32;
export const sluicePlane=1.77;
export const sluiceBottom=-2.2;
export const sluiceLeafHeight=6;
export const sluiceAngle=95*Math.PI/180;
