import * as THREE from "three";
import { reactionSize, mainModel } from './experience.js';
export function routePoints(chapter) {
  const half = (chapter.width || 64) / 2;
  const main=mainModel(chapter);
  return [{ x: -half, z: 0 }, ...(main?[{x:main.x,z:main.z}]:[]), { x: half, z: 0 }];
}
export function defaultDecals(chapter) {
  const style = chapter.floorDecor || 'auto';
  if (style === 'none') return [];
  const asset = style === 'auto' ? ({meadow:'leaves',night:'pocket-watch',tea:'tea-cup',rose:'leaves',gold:'open-book'}[chapter.theme] || 'leaves') : style;
  return chapter.placements.map((p,i) => ({id:'decor-'+i,asset,
    x:THREE.MathUtils.clamp(p.x+(i%2?5:-5),-(chapter.width||64)/2+3,(chapter.width||64)/2-3),
    z:THREE.MathUtils.clamp(p.z+6,-(chapter.depth||56)/2+3,(chapter.depth||56)/2-3),
    width:3.5,height:3,rotation:(i%2?-.25:.15)*180/Math.PI}));
}
export function arrowPlacements(chapter, circles=chapter.placements.map(p=>({...p,radius:reactionSize(p,chapter)}))) {
  if(chapter.floorArrows===false)return [];
  const result=[],points=routePoints(chapter),scale=chapter.floorArrowScale??1;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],distance=Math.hypot(b.x-a.x,b.z-a.z),angle=Math.atan2(b.z-a.z,b.x-a.x);
    for(let d=2.2;d<distance-1.7;d+=chapter.floorArrowSpacing??4.5){
      const x=a.x+(b.x-a.x)*d/distance,z=a.z+(b.z-a.z)*d/distance;
      if(circles.some(p=>Math.hypot(x-p.x,z-p.z)<p.radius+Math.hypot(2.8,1.05)*scale/2))continue;
      result.push({x,z,width:2.8*scale,height:1.05*scale,angle});
    }
  }
  return result;
}
export function floorArt(parent, chapter, offset = 0, circles) {
  const group = new THREE.Group(); parent.add(group);
  const loader = new THREE.TextureLoader();
  const load = name => { const texture = loader.load(name.startsWith('/uploads/') ? name : `/floor-assets/${name}.svg`); texture.colorSpace = THREE.SRGBColorSpace; return texture; };
  const decal = (material, x, z, width, height, angle = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    m.rotation.set(-Math.PI / 2, 0, -angle); m.position.set(offset + x, .026, z); group.add(m); return m;
  };
  if (chapter.floorArrows !== false) {
    const material = new THREE.MeshBasicMaterial({ map: load("arrow"), transparent: true, depthWrite: false, toneMapped: false, opacity: .83 });
    for(const p of arrowPlacements(chapter,circles))decal(material,p.x,p.z,p.width,p.height,p.angle);
  }
  for (const item of chapter.floorDecals ?? defaultDecals(chapter)) {
    const material = new THREE.MeshBasicMaterial({map:load(item.asset),transparent:true,depthWrite:false,toneMapped:false,opacity:.65});
    const mesh=decal(material,item.x,item.z,item.width,item.height,THREE.MathUtils.degToRad(item.rotation));
    mesh.position.y+=item.y||0;mesh.userData.floorDecalId=item.id;mesh.userData.chapterId=chapter.id;
  }
  return group;
}
export function layout(chapters) {
  let edge = -(chapters[0]?.width || 64) / 2;
  return chapters.map(chapter => {
    const width = chapter.width || 64, depth = chapter.depth || 56;
    const zone = { chapter, width, depth, start: edge, end: edge + width, x: edge + width / 2 };
    edge += width;
    return zone;
  });
}
export function terrain(parent, chapter, x = 0, circles, groundOnly = false) {
  const width = chapter.width || 64, depth = chapter.depth || 56;
  const colors = { meadow: "#dde3ce", night: "#dedee9", tea: "#e9e0d0", rose: "#e5dddc", gold: "#ebe3cb" };
  const paper = new THREE.TextureLoader().load("/floor-assets/graph-paper.svg");
  paper.wrapS = paper.wrapT = THREE.RepeatWrapping; paper.repeat.set(width / 8, depth / 8); paper.colorSpace = THREE.SRGBColorSpace;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshStandardMaterial({ map: paper, color: "#ffffff", roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(x, 0, 0); ground.receiveShadow = true;ground.userData.worldGround=true; parent.add(ground);
  const art = groundOnly ? null : floorArt(parent, chapter, x, circles);
  const geometry = new THREE.CircleGeometry(.07, 5), material = new THREE.MeshBasicMaterial({ color: "#b5bda3" });
  const dots = new THREE.InstancedMesh(geometry, material, 180), dummy = new THREE.Object3D();
  for (let i = 0; i < 180; i++) {
    dummy.position.set(x + Math.sin(i * 17.31) * (width / 2 - 1), .016, Math.cos(i * 8.27) * (depth / 2 - 1));
    dummy.rotation.x = -Math.PI / 2; dummy.updateMatrix(); dots.setMatrixAt(i, dummy.matrix);
  }
  dots.userData.groundDecoration=true;parent.add(dots);
  return art;
}
