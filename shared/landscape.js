import * as THREE from "three";
export function routePoints(chapter) {
  const half = (chapter.width || 64) / 2;
  return [{ x: -half, z: 0 }, ...[...chapter.placements].sort((a, b) => a.x - b.x).map(p => ({ x: p.x, z: p.z })), { x: half, z: 0 }];
}
export function floorArt(parent, chapter, offset = 0) {
  const group = new THREE.Group(); parent.add(group);
  const loader = new THREE.TextureLoader();
  const load = name => { const texture = loader.load(`/floor-assets/${name}.svg`); texture.colorSpace = THREE.SRGBColorSpace; return texture; };
  const decal = (material, x, z, width, height, angle = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    m.rotation.set(-Math.PI / 2, 0, -angle); m.position.set(offset + x, .026, z); group.add(m); return m;
  };
  if (chapter.floorArrows !== false) {
    const material = new THREE.MeshBasicMaterial({ map: load("arrow"), transparent: true, depthWrite: false, toneMapped: false, opacity: .83 });
    const points = routePoints(chapter);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], distance = Math.hypot(b.x - a.x, b.z - a.z);
      const angle = Math.atan2(b.z - a.z, b.x - a.x);
      for (let d = 2.2; d < distance - 1.7; d += 4.5) decal(material, a.x + (b.x - a.x) * d / distance, a.z + (b.z - a.z) * d / distance, 2.8, 1.05, angle);
    }
  }
  const style = chapter.floorDecor || "auto";
  if (style !== "none") {
    const name = style === "auto" ? ({ meadow: "leaves", night: "pocket-watch", tea: "tea-cup", rose: "leaves", gold: "open-book" }[chapter.theme] || "leaves") : style;
    const material = new THREE.MeshBasicMaterial({ map: load(name), transparent: true, depthWrite: false, toneMapped: false, opacity: .65 });
    chapter.placements.forEach((p, i) => {
      const x = THREE.MathUtils.clamp(p.x + (i % 2 ? 5 : -5), -(chapter.width || 64) / 2 + 3, (chapter.width || 64) / 2 - 3);
      const z = THREE.MathUtils.clamp(p.z + 6, -(chapter.depth || 56) / 2 + 3, (chapter.depth || 56) / 2 - 3);
      decal(material, x, z, 3.5, 3, i % 2 ? -.25 : .15);
    });
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
export function terrain(parent, chapter, x = 0) {
  const width = chapter.width || 64, depth = chapter.depth || 56;
  const colors = { meadow: "#dde3ce", night: "#dedee9", tea: "#e9e0d0", rose: "#e5dddc", gold: "#ebe3cb" };
  const paper = new THREE.TextureLoader().load("/floor-assets/graph-paper.svg");
  paper.wrapS = paper.wrapT = THREE.RepeatWrapping; paper.repeat.set(width / 8, depth / 8); paper.colorSpace = THREE.SRGBColorSpace;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshStandardMaterial({ map: paper, color: "#ffffff", roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(x, 0, 0); ground.receiveShadow = true; parent.add(ground);
  const art = floorArt(parent, chapter, x);
  const geometry = new THREE.CircleGeometry(.07, 5), material = new THREE.MeshBasicMaterial({ color: "#b5bda3" });
  const dots = new THREE.InstancedMesh(geometry, material, 180), dummy = new THREE.Object3D();
  for (let i = 0; i < 180; i++) {
    dummy.position.set(x + Math.sin(i * 17.31) * (width / 2 - 1), .016, Math.cos(i * 8.27) * (depth / 2 - 1));
    dummy.rotation.x = -Math.PI / 2; dummy.updateMatrix(); dots.setMatrixAt(i, dummy.matrix);
  }
  parent.add(dots);
  return art;
}
