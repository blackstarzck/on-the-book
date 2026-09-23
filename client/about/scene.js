import * as THREE from 'three';

const THEMES = {
  forest: { cover: '#9d5543', spine: '#696847', paper: '#eee5d0', edge: '#d5c9ae', grass: '#7c8749', moss: '#a0a864', leaf: '#4d633d', lightLeaf: '#899757', trunk: '#746348', stone: '#d4c7a8', gold: '#b9994e', accent: '#b85e42' },
  dusk: { cover: '#7f4541', spine: '#705c50', paper: '#eee0cc', edge: '#d5baa0', grass: '#94805c', moss: '#b9a27b', leaf: '#7f7357', lightLeaf: '#b4966c', trunk: '#78604c', stone: '#dfc2a6', gold: '#c68e51', accent: '#bd704e' },
  paper: { cover: '#8c8b71', spine: '#717762', paper: '#f0ebdd', edge: '#d3cdbb', grass: '#a5ac8c', moss: '#c2c5a1', leaf: '#788b73', lightLeaf: '#b2bda1', trunk: '#8b8570', stone: '#e4ddca', gold: '#b4a47a', accent: '#bd9b70' },
};

function canvasTexture(width, height, draw) {
  const surface = typeof OffscreenCanvas === 'function'
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement('canvas'), { width, height });
  draw(surface.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(surface);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function paperTexture(side) {
  return canvasTexture(1024, 1024, (ctx, width, height) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(132,113,77,.045)';
    for (let line = 0; line < 300; line += 1) {
      const x = (line * 73) % width; const y = (line * 139) % height;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 14, y + 1); ctx.stroke();
    }
    ctx.fillStyle = '#8c826e';
    ctx.textAlign = side < 0 ? 'left' : 'right';
    ctx.font = '14px Arial, sans-serif';
    ctx.fillText(side < 0 ? 'ON THE BOOK  /  A READING GARDEN' : 'EVERY PAGE, A PLACE TO GROW.', side < 0 ? 84 : 940, 927);
    ctx.fillStyle = '#c2b7a0';
    for (let line = 0; line < 4; line += 1) {
      const lineWidth = 240 - line * 28;
      ctx.fillRect(side < 0 ? 86 : 938 - lineWidth, 850 + line * 12, lineWidth, 2);
    }
    ctx.strokeStyle = '#d3cbb8';
    ctx.beginPath(); ctx.moveTo(80, 900); ctx.lineTo(944, 900); ctx.stroke();
    ctx.font = '17px Georgia, serif'; ctx.fillStyle = '#92846b'; ctx.textAlign = 'center';
    ctx.fillText(side < 0 ? '24' : '25', 512, 978);
  });
}

function linenTexture() {
  return canvasTexture(256, 256, (ctx, width, height) => {
    ctx.fillStyle = '#bcbcbc'; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#979797'; ctx.lineWidth = 0.6;
    for (let p = 0; p < width; p += 3) {
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(width, p); ctx.stroke();
    }
  });
}

function pageShape(side, width, depth, thickness = 0.018, curvature = 0.14) {
  const segments = 36;
  const positions = []; const uvs = []; const indices = [];
  const curve = (t) => Math.sin(t * Math.PI) * curvature + t * 0.022;
  // Solid curved sheets expose their real top, bottom, and paper edges.
  for (let layer = 0; layer < 2; layer += 1) {
    for (let row = 0; row < 2; row += 1) {
      for (let step = 0; step <= segments; step += 1) {
        const t = step / segments;
        positions.push(side * (0.025 + t * width), curve(t) - layer * thickness, (row - 0.5) * depth);
        uvs.push(side < 0 ? 1 - t : t, 1 - row);
      }
    }
  }
  const stride = segments + 1;
  for (let step = 0; step < segments; step += 1) {
    const a = step; const b = step + 1; const c = stride + step; const d = c + 1;
    indices.push(a, c, b, b, c, d);
    const base = stride * 2;
    indices.push(base + a, base + b, base + c, base + b, base + d, base + c);
    indices.push(a, b, base + a, b, base + b, base + a);
    indices.push(c, base + c, d, d, base + c, base + d);
  }
  for (const step of [0, segments]) {
    const a = step; const b = stride + step; const c = stride * 2 + step; const d = stride * 3 + step;
    indices.push(a, c, b, b, c, d);
  }
  if (side < 0) {
    for (let index = 0; index < indices.length; index += 3) [indices[index + 1], indices[index + 2]] = [indices[index + 2], indices[index + 1]];
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function islandShape(width, depth) {
  const shape = new THREE.Shape();
  const w = width / 2; const d = depth / 2;
  shape.moveTo(-w * 0.93, -d * 0.52);
  shape.bezierCurveTo(-w * 1.12, -d * 0.93, -w * 0.35, -d * 1.05, w * 0.04, -d * 0.97);
  shape.bezierCurveTo(w * 0.61, -d * 1.1, w * 0.97, -d * 0.6, w * 0.97, -d * 0.03);
  shape.bezierCurveTo(w * 1.07, d * 0.54, w * 0.55, d * 1.03, -w * 0.12, d * 0.94);
  shape.bezierCurveTo(-w * 0.68, d * 1.09, -w * 1.01, d * 0.58, -w * 0.93, -d * 0.52);
  return shape;
}

function archShape() {
  const shape = new THREE.Shape();
  const radius = 0.34; const height = 1.06; const border = 0.1;
  shape.moveTo(-radius, 0); shape.lineTo(-radius, height - radius);
  shape.absarc(0, height - radius, radius, Math.PI, 0, true);
  shape.lineTo(radius, 0); shape.lineTo(radius - border, 0);
  shape.lineTo(radius - border, height - radius);
  shape.absarc(0, height - radius, radius - border, 0, Math.PI, false);
  shape.lineTo(-radius + border, 0); shape.closePath();
  return shape;
}

function leafShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(-0.22, 0.14, -0.21, 0.49, 0, 0.68);
  shape.bezierCurveTo(0.22, 0.46, 0.2, 0.16, 0, 0);
  return shape;
}

function mesh(geometry, material, parent, position = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.castShadow = true; object.receiveShadow = true;
  parent.add(object); return object;
}

function branch(parent, points, radius, material) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  return mesh(new THREE.TubeGeometry(curve, 8, radius, 6, false), material, parent);
}

function roundTree(parent, x, z, height, palette, variant = 0) {
  const tree = new THREE.Group(); tree.position.set(x, 0.16, z); parent.add(tree);
  branch(tree, [[0, 0, 0], [-0.035, height * 0.42, 0.025], [0.025, height * 0.75, -0.01]], 0.044, palette.trunk);
  branch(tree, [[-0.015, height * 0.37, 0], [-0.19, height * 0.62, 0.045], [-0.27, height * 0.75, 0]], 0.022, palette.trunk);
  branch(tree, [[0, height * 0.45, 0], [0.15, height * 0.63, 0], [0.24, height * 0.74, 0.02]], 0.02, palette.trunk);
  const crown = new THREE.Group(); tree.add(crown);
  const clusters = [[0, 0.91, 0, 0.38], [-0.25, 0.81, 0.06, 0.29], [0.22, 0.84, 0.02, 0.3], [-0.07, 0.77, -0.19, 0.28], [0.07, 1.06, 0.01, 0.26]];
  clusters.forEach(([cx, cy, cz, size], index) => {
    const leaves = mesh(new THREE.IcosahedronGeometry(size * height, 2), index % 3 === variant ? palette.lightLeaf : palette.leaf, crown, [cx * height, cy * height, cz * height]);
    leaves.scale.set(1, 0.95 + index * 0.025, 0.9);
    leaves.rotation.set(index * 0.39, index * 0.51, index * 0.16);
  });
  return tree;
}

function paperTree(parent, x, z, height, palette) {
  const tree = new THREE.Group(); tree.position.set(x, 0.15, z);
  tree.scale.setScalar(height / 1.4); parent.add(tree);
  branch(tree, [[0, 0, 0], [0.025, 0.65, 0], [-0.015, 1.33, 0]], 0.025, palette.trunk);
  const leafGeometry = new THREE.ExtrudeGeometry(leafShape(), { depth: 0.018, bevelEnabled: false, curveSegments: 10 });
  const leaves = [
    [-0.01, 0.92, -0.12, 0.52, 0.18], [0.01, 0.69, 0, -0.78, -0.12],
    [-0.02, 0.46, 0.07, 0.95, 0.26], [0.02, 0.22, 0, -0.9, -0.35],
    [0, 1.2, 0.01, 0.06, -0.08],
  ];
  leaves.forEach(([lx, ly, lz, turn, twist], index) => {
    const leaf = mesh(leafGeometry, index % 2 ? palette.leaf : palette.lightLeaf, tree, [lx, ly, lz]);
    leaf.rotation.set(0.05, twist, turn); leaf.scale.setScalar(index === 4 ? 0.66 : 0.82);
    const fold = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.47, 4), palette.moss, leaf, [0, 0.27, 0.022]);
    fold.castShadow = false;
  });
  return tree;
}

function mushroom(parent, x, z, size, palette) {
  const group = new THREE.Group(); group.position.set(x, 0.16, z);
  group.scale.setScalar(size); parent.add(group);
  mesh(new THREE.CylinderGeometry(0.035, 0.047, 0.18, 8), palette.paper, group, [0, 0.09, 0]);
  mesh(new THREE.SphereGeometry(0.14, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), palette.accent, group, [0, 0.17, 0]).scale.y = 0.6;
  const underside = mesh(new THREE.CircleGeometry(0.14, 16), palette.paper, group, [0, 0.17, 0]);
  underside.rotation.x = Math.PI / 2;
  [[-0.055, 0.038], [0.052, 0.046], [0.018, -0.065]].forEach(([dx, dz]) => {
    const dot = mesh(new THREE.SphereGeometry(0.018, 6, 4), palette.paper, group, [dx, 0.24, dz]);
    dot.scale.y = 0.22; dot.castShadow = false;
  });
}

function details(parent, side, palette) {
  const bladeGeometry = new THREE.PlaneGeometry(0.035, 0.2, 1, 4);
  const vertices = bladeGeometry.attributes.position;
  for (let index = 0; index < vertices.count; index += 1) {
    const t = (vertices.getY(index) + 0.1) / 0.2;
    vertices.setX(index, vertices.getX(index) * (1 - t * 0.9) + t * t * 0.044);
    vertices.setY(index, vertices.getY(index) + 0.1); vertices.setZ(index, t * t * 0.025);
  }
  bladeGeometry.computeVertexNormals();
  const blades = new THREE.InstancedMesh(bladeGeometry, palette.lightLeaf, 54);
  const dummy = new THREE.Object3D(); let instance = 0;
  for (let tuft = 0; tuft < 18; tuft += 1) {
    const angle = tuft * 2.39996; const radius = 0.48 + (tuft % 4) * 0.12;
    const x = side * 1.2 + Math.cos(angle) * radius; const z = Math.sin(angle) * radius * 1.13;
    for (let blade = 0; blade < 3; blade += 1) {
      dummy.position.set(x + blade * 0.018, 0.17, z);
      dummy.rotation.set(0, angle + blade * 2.1, (blade - 1) * 0.14);
      dummy.scale.setScalar(0.7 + (tuft % 5) * 0.1);
      dummy.updateMatrix(); blades.setMatrixAt(instance++, dummy.matrix);
    }
  }
  blades.castShadow = true; parent.add(blades);
  const pebbles = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.065, 1), palette.stone, 11);
  for (let index = 0; index < 11; index += 1) {
    const angle = index * 2.39996 + 0.8;
    dummy.position.set(side * 1.2 + Math.cos(angle) * (0.58 + (index % 2) * 0.26), 0.18, Math.sin(angle) * 0.91);
    dummy.rotation.set(index, index * 0.34, index * 0.46); dummy.scale.set(1 + (index % 3) * 0.3, 0.48, 0.8);
    dummy.updateMatrix(); pebbles.setMatrixAt(index, dummy.matrix);
  }
  pebbles.castShadow = true; pebbles.receiveShadow = true; parent.add(pebbles);
}

export function createBookScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80); camera.position.set(0, 0, 13);
  scene.add(new THREE.HemisphereLight('#fffaf0', '#a29478', 2.1));
  const key = new THREE.DirectionalLight('#fff2dc', 3.2); key.position.set(-4, 8, 7); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -6; key.shadow.camera.right = 7; key.shadow.camera.top = 7; key.shadow.camera.bottom = -5;
  key.shadow.camera.near = 0.5; key.shadow.camera.far = 35;
  key.shadow.normalBias = 0.027; key.shadow.bias = -0.0003; key.shadow.radius = 3; scene.add(key);
  const fill = new THREE.DirectionalLight('#f1f1e9', 0.75); fill.position.set(7, 1, 3); scene.add(fill);

  const palette = {}; const targetColors = {}; const linen = linenTexture();
  Object.entries(THEMES.forest).forEach(([name, color]) => {
    palette[name] = new THREE.MeshStandardMaterial({ color, roughness: name === 'gold' ? 0.34 : 0.88, metalness: name === 'gold' ? 0.45 : 0, side: THREE.DoubleSide });
    targetColors[name] = new THREE.Color(color);
  });
  palette.cover.bumpMap = linen; palette.cover.bumpScale = 0.028;
  palette.spine.bumpMap = linen; palette.spine.bumpScale = 0.02;
  const model = new THREE.Group(); scene.add(model);
  const wings = []; const sheets = []; const gardens = []; const plants = []; const paperMaterials = []; const orbs = [];
  const widthOfPage = 2.43; const depthOfPage = 3.13;

  for (const side of [-1, 1]) {
    const wing = new THREE.Group(); model.add(wing); wings.push({ object: wing, side });
    const cover = mesh(pageShape(side, widthOfPage + 0.13, depthOfPage + 0.14, 0.095, 0.09), palette.cover, wing, [0, -0.27, 0]);
    cover.receiveShadow = false;
    mesh(pageShape(side, widthOfPage + 0.09, depthOfPage + 0.1, 0.018, 0.092), palette.spine, wing, [0, -0.254, 0]);
    for (let index = 0; index < 14; index += 1) {
      const y = -0.232 + index * 0.019;
      const sheet = mesh(pageShape(side, widthOfPage - index * 0.003, depthOfPage - index * 0.003, 0.014, 0.12 + index * 0.001), index % 3 ? palette.paper : palette.edge, wing, [0, y, 0]);
      sheets.push({ object: sheet, y, fraction: index / 14 });
    }
    const paper = palette.paper.clone(); paper.map = paperTexture(side); paperMaterials.push(paper);
    const face = mesh(pageShape(side, widthOfPage - 0.048, depthOfPage - 0.044, 0.012, 0.14), paper, wing, [0, 0.042, 0]);
    sheets.push({ object: face, y: 0.042, fraction: 1 });
    const garden = new THREE.Group(); garden.position.y = 0.22; wing.add(garden); gardens.push(garden);
    const soil = mesh(new THREE.ExtrudeGeometry(islandShape(2.05, 2.48), { depth: 0.045, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.065, bevelThickness: 0.035, curveSegments: 18 }), palette.grass, garden, [side * 1.21, 0.075, -0.045]);
    soil.rotation.x = -Math.PI / 2;
    const softPatch = mesh(new THREE.SphereGeometry(1, 24, 12), palette.moss, garden, [side * 1.26, 0.1, -0.44]);
    softPatch.scale.set(0.59, 0.08, 0.65);
    const plantGroup = new THREE.Group(); plantGroup.position.set(side * 1.21, 0, 0);
    garden.add(plantGroup); plants.push(plantGroup);
    // Each miniature stays attached to its own turning page.
    const content = new THREE.Group(); content.position.x = -side * 1.21; plantGroup.add(content);
    details(content, side, palette);
    if (side < 0) {
      roundTree(content, -1.53, -0.65, 1.27, palette);
      paperTree(content, -1.82, 0.6, 0.87, palette);
      mushroom(content, -0.76, 0.82, 0.84, palette);
      mushroom(content, -0.98, 0.91, 0.6, palette);
      mushroom(content, -1.07, 0.69, 0.5, palette);
    } else {
      paperTree(content, 1.67, -0.57, 1.22, palette);
      roundTree(content, 0.64, -0.73, 0.77, palette, 1);
      mushroom(content, 1.88, 0.6, 0.71, palette);
      mushroom(content, 1.69, 0.79, 0.48, palette);
      const arch = mesh(new THREE.ExtrudeGeometry(archShape(), { depth: 0.13, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.018, bevelThickness: 0.016, curveSegments: 20 }), [palette.stone, palette.accent], content, [0.8, 0.15, -0.015]);
      arch.rotation.y = -0.18;
      const threshold = mesh(new THREE.BoxGeometry(0.81, 0.07, 0.34), palette.stone, content, [0.8, 0.16, 0.07]);
      threshold.rotation.y = -0.18;
    }
  }

  const spine = mesh(new THREE.CylinderGeometry(0.145, 0.145, depthOfPage + 0.16, 24), palette.spine, model, [0, -0.245, 0]);
  spine.rotation.x = Math.PI / 2;
  const binding = mesh(new THREE.CylinderGeometry(0.02, 0.02, depthOfPage - 0.08, 10), palette.edge, model, [0, 0.048, 0]);
  binding.rotation.x = Math.PI / 2;
  const ribbonCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.03, 0.065, 0.3), new THREE.Vector3(0.04, 0.06, 1.25),
    new THREE.Vector3(0.13, -0.045, 1.76), new THREE.Vector3(0.23, -0.14, 1.96),
  ]);
  const ribbonGeometry = new THREE.PlaneGeometry(0.09, 1, 1, 20);
  const ribbonPosition = ribbonGeometry.attributes.position;
  for (let index = 0; index < ribbonPosition.count; index += 1) {
    const t = 0.5 - ribbonPosition.getY(index); const point = ribbonCurve.getPoint(t);
    ribbonPosition.setXYZ(index, point.x + ribbonPosition.getX(index), point.y, point.z);
  }
  ribbonGeometry.computeVertexNormals(); mesh(ribbonGeometry, palette.accent, model);

  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.52, 0.177, 1.11), new THREE.Vector3(-0.33, 0.177, 0.7),
    new THREE.Vector3(0.29, 0.177, 0.49), new THREE.Vector3(0.77, 0.177, 0.21),
    new THREE.Vector3(0.91, 0.177, -0.28), new THREE.Vector3(1.27, 0.177, -0.96),
  ]);
  const paverGeometry = new THREE.CylinderGeometry(0.113, 0.125, 0.044, 7);
  for (let index = 0; index < 18; index += 1) {
    const point = path.getPointAt(index / 17);
    const paver = mesh(paverGeometry, index % 4 ? palette.stone : palette.paper, gardens[point.x < 0 ? 0 : 1], [point.x, point.y, point.z]);
    paver.rotation.y = index * 0.73; paver.scale.set(0.93 + index % 3 * 0.13, 1, 0.83);
  }
  [[-0.56, 1.25, -0.49, 0.075], [1.15, 1.52, -0.02, 0.087], [1.97, 0.69, 0.42, 0.052]].forEach(([x, y, z, radius], index) => {
    const orb = mesh(new THREE.SphereGeometry(radius, 20, 14), palette.gold, gardens[x < 0 ? 0 : 1], [x, y, z]);
    orbs.push({ object: orb, y, offset: index * 2.3 });
  });
  const shadowMap = canvasTexture(256, 256, (ctx, w, h) => {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 12, w / 2, h / 2, w / 2);
    gradient.addColorStop(0, 'rgba(66,49,28,.23)'); gradient.addColorStop(0.42, 'rgba(66,49,28,.12)'); gradient.addColorStop(1, 'rgba(66,49,28,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 4.6), new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.48 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.56; shadow.renderOrder = -1; model.add(shadow);

  let width = 0; let height = 0; let mobile = false;
  let frame = 0; let previousTime = 0; let elapsed = 0;
  let disposed = false; let enabled = true;
  let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let progress = 0; let targetProgress = 0;
  let viewRotation = 0; let targetRotation = 0; let zoom = 1; let targetZoom = 1;
  const pointer = new THREE.Vector2(); const targetPointer = new THREE.Vector2();

  function render(delta = 0) {
    if (disposed || !width || !height) return;
    const damping = reduced ? 1 : 1 - Math.exp(-Math.min(delta, 0.06) * 5);
    progress += (targetProgress - progress) * damping;
    viewRotation += (targetRotation - viewRotation) * damping; zoom += (targetZoom - zoom) * damping;
    pointer.lerp(targetPointer, damping);
    Object.keys(palette).forEach((name) => palette[name].color.lerp(targetColors[name], damping));
    paperMaterials.forEach((paper) => paper.color.copy(palette.paper.color));
    const spanY = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const spanX = spanY * camera.aspect; const idle = reduced ? 0 : Math.sin(elapsed * 0.42);
    const baseScale = mobile ? spanX * 0.95 / 5.48 : Math.min(spanX * 0.54 / 5.48, spanY * 0.205);
    model.scale.setScalar(baseScale * (0.75 + progress * 0.35) * zoom);
    model.position.set(mobile ? 0 : spanX * 0.16, -spanY * (mobile ? 0.105 : 0.045) + idle * 0.018, 0);
    model.rotation.set(0.67 + pointer.y * 0.055, -0.4 + progress * 0.65 + viewRotation * 0.65 + pointer.x * 0.09, -0.055 + pointer.x * 0.018 + idle * 0.005);
    wings.forEach(({ object, side }) => { object.rotation.z = side * (0.105 - progress * 0.09); });
    sheets.forEach(({ object, y, fraction }) => { object.position.y = y + fraction * progress * 0.1; });
    gardens.forEach((garden) => { garden.position.y = 0.22 + progress * 0.1; });
    plants.forEach((plant) => { plant.scale.setScalar(0.75 + progress * 0.25); });
    orbs.forEach(({ object, y, offset }) => { object.position.y = y + (reduced ? 0 : Math.sin(elapsed * 0.8 + offset) * 0.045); });
    renderer.render(scene, camera);
  }

  function animate(time) {
    frame = 0;
    if (disposed || !enabled || reduced) return;
    const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.06) : 1 / 60;
    previousTime = time; elapsed += delta; render(delta); frame = requestAnimationFrame(animate);
  }

  function requestRender() {
    if (disposed || !enabled) return;
    if (reduced) render();
    else if (!frame) { previousTime = 0; frame = requestAnimationFrame(animate); }
  }

  function resize() {
    if (disposed) return;
    const bounds = canvas.getBoundingClientRect(); width = Math.round(bounds.width); height = Math.round(bounds.height);
    if (!width || !height) return;
    mobile = width < 700;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.3 : 1.7));
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    render(1 / 60); requestRender();
  }

  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  return {
    setProgress(value) { targetProgress = THREE.MathUtils.clamp(value, 0, 1); requestRender(); },
    setPointer(x, y) {
      if (reduced) return;
      targetPointer.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1)); requestRender();
    },
    setView(rotation = 0, scale = 1) {
      targetRotation = THREE.MathUtils.clamp(rotation, -1, 1); targetZoom = THREE.MathUtils.clamp(scale, 0.8, 1.2); requestRender();
    },
    setTheme(name) {
      const theme = THEMES[name] || THEMES.forest;
      Object.entries(theme).forEach(([keyName, color]) => targetColors[keyName].set(color)); requestRender();
    },
    setReducedMotion(value) {
      reduced = Boolean(value);
      if (reduced) { cancelAnimationFrame(frame); frame = 0; elapsed = 0; pointer.set(0, 0); targetPointer.set(0, 0); }
      requestRender();
    },
    setEnabled(value) {
      enabled = Boolean(value);
      if (!enabled) { cancelAnimationFrame(frame); frame = 0; previousTime = 0; }
      else requestRender();
    },
    dispose() {
      if (disposed) return;
      disposed = true; observer.disconnect(); cancelAnimationFrame(frame);
      const geometries = new Set(); const materials = new Set(); const textures = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) {
          const list = Array.isArray(object.material) ? object.material : [object.material];
          list.forEach((item) => { materials.add(item); if (item.map) textures.add(item.map); if (item.bumpMap) textures.add(item.bumpMap); });
        }
      });
      textures.forEach((texture) => texture.dispose()); materials.forEach((item) => item.dispose()); geometries.forEach((geometry) => geometry.dispose());
      key.shadow.dispose(); renderer.dispose();
    },
  };
}
