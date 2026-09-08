export const travellerRadius = .32;
export function obstacles(objects) {
  return objects.filter(o => o.p.collision !== false).map(o => ({x:o.p.x,z:o.p.z,r:(o.p.collisionRadius ?? .8) * o.p.scale + travellerRadius}));
}
export function clearAt(point, walls) { return walls.every(o => Math.hypot(point.x-o.x, point.z-o.z) >= o.r - .0001); }
export function slideMove(start, delta, walls) {
  let point = {...start};
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x,delta.z)/.12));
  for(let step=0;step<steps;step++) {
    const next = {x:point.x+delta.x/steps,z:point.z+delta.z/steps};
    for(let pass=0;pass<8;pass++) for(const wall of walls) {
      const dx=next.x-wall.x,dz=next.z-wall.z,d=Math.hypot(dx,dz);
      if(d<wall.r) {
        const fallback=Math.hypot(point.x-wall.x,point.z-wall.z);
        const nx=d>1e-8?dx/d:fallback>1e-8?(point.x-wall.x)/fallback:1;
        const nz=d>1e-8?dz/d:fallback>1e-8?(point.z-wall.z)/fallback:0;
        next.x=wall.x+nx*(wall.r+.001);next.z=wall.z+nz*(wall.r+.001);
      }
    }
    if(clearAt(next,walls)) point=next;
  }
  return point;
}
