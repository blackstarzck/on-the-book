import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { terrain, floorArt } from "./landscape.js";
import { textPages, sideReadingPose, revealReading } from "./floor-reading.js";
import { reactionSize, collisionSize } from "./experience.js";
const mat = (color) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.02 });
function mesh(parent, geo, color, pos = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(...pos);
  m.scale.set(...scale);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const ball = (g, c, p, s = [1, 1, 1]) =>
  mesh(g, new THREE.SphereGeometry(1, 24, 16), c, p, s);
const cylinder = (g, c, p, r = 1, h = 1, rt = r) =>
  mesh(g, new THREE.CylinderGeometry(rt, r, h, 32), c, p);
const box = (g, c, p, s) => mesh(g, new THREE.BoxGeometry(...s), c, p);
function ring(g, c, p, r = 0.6, t = 0.1) {
  return mesh(g, new THREE.TorusGeometry(r, t, 12, 40), c, p);
}
export function makeModel(kind, color = "#eee4d4") {
  const g = new THREE.Group();
  if (kind === "traveller") {
    const dress = cylinder(g, "#638f95", [0, 0.56, 0], 0.39, 0.68, 0.19);
    ball(g, "#684f3d", [0, 1.18, 0], [0.36, 0.39, 0.32]);
    ball(g, "#efd3b1", [0, 1.15, 0.13], [0.31, 0.3, 0.26]);
    ball(g, "#684f3d", [0, 1.43, 0.015], [0.35, 0.17, 0.3]);
    for (const s of [-1, 1]) {
      ball(g, "#684f3d", [s * 0.29, 1.03, 0], [0.13, 0.26, 0.19]);
      ball(g, "#443e36", [s * 0.11, 1.19, 0.369], [0.029, 0.042, 0.015]);
      cylinder(g, "#efd3b1", [s * 0.17, 0.17, 0], 0.07, 0.3);
      ball(g, "#675b45", [s * 0.17, 0.055, 0.08], [0.12, 0.08, 0.2]);
      ball(g, "#efd3b1", [s * 0.29, 0.72, 0.02], [0.1, 0.24, 0.1]);
    }
    box(g, "#f1e9d1", [0, 0.64, 0.25], [0.32, 0.35, 0.04]);
    ball(g, "#c2a668", [-0.24, 1.43, 0.24], [0.12, 0.09, 0.07]);
  } else if (kind === "rabbit") {
    ball(g, "#f8f0df", [0, 0.67, 0], [0.43, 0.61, 0.36]);
    ball(g, color, [0, 1.34, 0.05], [0.49, 0.46, 0.43]);
    for (const s of [-1, 1]) {
      const ear = ball(g, color, [s * 0.23, 1.96, 0.01], [0.15, 0.55, 0.14]);
      ear.rotation.z = s * -0.16;
      const inner = ball(
        g,
        "#e9b5a7",
        [s * 0.23, 1.98, 0.135],
        [0.075, 0.39, 0.035],
      );
      inner.rotation.z = s * -0.16;
      ball(g, "#443c37", [s * 0.18, 1.38, 0.43], [0.042, 0.061, 0.027]);
      ball(g, "#eab6a8", [s * 0.29, 1.22, 0.41], [0.1, 0.05, 0.024]);
      ball(g, color, [s * 0.27, 0.18, 0.19], [0.23, 0.18, 0.32]);
      ball(g, color, [s * 0.42, 0.7, 0.13], [0.13, 0.3, 0.14]);
    }
    ball(g, "#bd887f", [0, 1.26, 0.477], [0.056, 0.035, 0.035]);
    ball(g, "#fff9ed", [0, 0.54, -0.37], [0.22, 0.23, 0.2]);
    const collar = ring(g, "#789c8c", [0, 0.99, 0], 0.32, 0.095);
    collar.rotation.x = Math.PI / 2;
    ball(g, "#d7b564", [0.02, 0.93, 0.38], [0.065, 0.08, 0.04]);
  } else if (kind === "mushroom") {
    cylinder(g, "#ecddbf", [0, 0.52, 0], 0.22, 1, 0.16);
    ball(g, color, [0, 1.12, 0], [0.8, 0.5, 0.8]);
    cylinder(g, "#e7cab2", [0, 1.01, 0], 0.74, 0.08);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4,
        r = i ? 0.48 : 0;
      ball(
        g,
        "#fff2d3",
        [Math.cos(a) * r, 1.48 - r * 0.18, Math.sin(a) * r],
        [0.1, 0.035, 0.1],
      );
    }
  } else if (kind === "tree") {
    cylinder(g, "#997752", [0, 1.1, 0], 0.19, 2.2, 0.13);
    ball(g, color, [0, 2.35, 0], [1.05, 1.35, 0.95]);
    ball(g, color, [-0.7, 1.99, 0.15], [0.7, 0.85, 0.72]);
    ball(g, color, [0.62, 2.17, 0.07], [0.72, 0.95, 0.72]);
  } else if (kind === "teapot") {
    ball(g, color, [0, 0.62, 0], [0.66, 0.57, 0.55]);
    cylinder(g, color, [0, 1.04, 0], 0.45, 0.13, 0.37);
    ball(g, "#d8b473", [0, 1.2, 0], [0.11, 0.13, 0.11]);
    const handle = ring(g, color, [-0.68, 0.72, 0], 0.37, 0.09);
    const spout = cylinder(g, color, [0.68, 0.72, 0], 0.19, 0.75, 0.1);
    spout.rotation.z = -0.95;
    cylinder(g, "#e3cb9b", [0, 0.18, 0], 0.48, 0.08);
    for (const x of [-0.85, 0.85]) {
      cylinder(g, "#f7edda", [x, 0.13, 0.95], 0.25, 0.15, 0.28);
      cylinder(g, "#855c3b", [x, 0.21, 0.95], 0.22, 0.02);
    }
  } else if (kind === "rose") {
    cylinder(g, "#7d9366", [0, 0.67, 0], 0.045, 1.3);
    ball(g, "#779362", [0.23, 0.65, 0], [0.3, 0.1, 0.13]).rotation.z = 0.5;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ball(
        g,
        color,
        [Math.cos(a) * 0.24, 1.36 + (i % 2) * 0.1, Math.sin(a) * 0.24],
        [0.26, 0.27, 0.23],
      );
    }
    ball(g, "#db8990", [0, 1.52, 0], [0.2, 0.2, 0.2]);
  } else if (kind === "clock") {
    const face = cylinder(g, "#d0aa61", [0, 0.94, 0], 0.61, 0.18);
    face.rotation.x = Math.PI / 2;
    const dial = cylinder(g, "#fff4d8", [0, 0.94, 0.11], 0.52, 0.02);
    dial.rotation.x = Math.PI / 2;
    box(g, "#536b60", [0.14, 0.97, 0.15], [0.3, 0.035, 0.025]);
    box(g, "#536b60", [0, 1.09, 0.15], [0.035, 0.33, 0.025]);
    ring(g, "#d0aa61", [0, 1.68, 0], 0.12, 0.04);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      ball(
        g,
        "#8d805f",
        [Math.sin(a) * 0.44, 0.94 + Math.cos(a) * 0.44, 0.15],
        [0.026, 0.026, 0.018],
      );
    }
  } else if (kind === "key") {
    ring(g, color, [0, 1.15, 0], 0.3, 0.09);
    cylinder(g, color, [0, 0.59, 0], 0.07, 0.7);
    box(g, color, [0.13, 0.26, 0], [0.32, 0.1, 0.13]);
    box(g, color, [0.15, 0.4, 0], [0.28, 0.1, 0.13]);
  } else if (kind === "cards") {
    box(g, "#f9eddb", [0, 0.94, 0], [0.9, 1.4, 0.13]);
    for (const s of [-1, 1])
      ball(g, "#c36969", [s * 0.115, 1.01, 0.095], [0.16, 0.17, 0.045]);
    const heart = mesh(
      g,
      new THREE.ConeGeometry(0.235, 0.32, 3),
      "#c36969",
      [0, 0.79, 0.095],
    );
    heart.rotation.z = Math.PI;
    heart.scale.z = 0.25;
    for (const s of [-1, 1]) {
      cylinder(g, "#6e846c", [s * 0.24, 0.17, 0], 0.05, 0.26);
      ball(g, "#546e5d", [s * 0.25, 0.075, 0.08], [0.15, 0.075, 0.18]);
    }
  } else if (kind === "house") {
    box(g, "#e8d4b1", [0, 0.8, 0], [1.65, 1.6, 1.3]);
    const roof = mesh(g, new THREE.ConeGeometry(1.5, 1, 4), color, [0, 2, 0]);
    roof.rotation.y = Math.PI / 4;
    box(g, "#79948a", [0, 0.56, 0.666], [0.48, 1.1, 0.04]);
    ball(g, "#d6b16b", [0.15, 0.57, 0.71], [0.04, 0.04, 0.04]);
    for (const s of [-1, 1])
      box(g, "#d1e2d8", [s * 0.54, 1.06, 0.666], [0.3, 0.35, 0.03]);
  }
  return g;
}
const themes = {
  meadow: {
    ground: "#cad7aa",
    leaf: "#8ca875",
    back: "#f1f0e5",
    water: "#91bcb0",
  },
  night: {
    ground: "#929aaf",
    leaf: "#6c7f97",
    back: "#e6e5ef",
    water: "#7e9dae",
  },
  tea: {
    ground: "#d7c9b6",
    leaf: "#a7ae88",
    back: "#f2eae1",
    water: "#aabfae",
  },
  rose: {
    ground: "#d8c6b7",
    leaf: "#8ca58c",
    back: "#f4e9e5",
    water: "#abc3b6",
  },
  gold: {
    ground: "#dcca98",
    leaf: "#94a27a",
    back: "#f5eee0",
    water: "#a5beb0",
  },
};
export class World {
  constructor(
    container,
    {
      chapter,
      models,
      onDiscover = () => {},
      onPortal = () => {},
      onMove = () => {},
      onSelect = () => {},
      onError = () => {},
      editor = false,
      hero = false,
    } = {},
  ) {
    this.container = container;
    this.chapter = chapter;
    this.models = models;
    this.onDiscover = onDiscover;
    this.onPortal = onPortal;
    this.onMove = onMove;
    this.onSelect = onSelect;
    this.onError = onError;
    this.editor = editor;
    this.hero = hero;
    this.active = false;
    this.dead = false;
    this.objects = [];
    this.keys = new Set();
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.abort = new AbortController();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 150);
    this.camera.position.set(19, 21, 26);
    this.camera.lookAt(0, 0, 0);
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      throw Error(
        "이 브라우저에서 3D 화면을 시작하지 못했습니다. 하드웨어 가속을 켜거나 다른 브라우저로 열어 주세요.",
      );
    }
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "책 속 3D 공간. 땅을 누르거나 방향키로 이동하세요.",
    );
    this.renderer.domElement.tabIndex = 0;
    container.append(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight("#fff9e9", "#9cae98", 2.7));
    const sun = new THREE.DirectionalLight("#fff3d9", 4);
    sun.position.set(-8, 18, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -18,
      right: 18,
      top: 18,
      bottom: -18,
    });
    sun.shadow.normalBias = 0.04;
    sun.shadow.bias = -0.0001;
    this.scene.add(sun);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.build(chapter);
    this.player = makeModel("traveller");
    this.player.scale.setScalar(0.85);
    this.player.position.set(0, 0, 4.5);
    this.scene.add(this.player);
    this.target = this.player.position.clone();
    this.player.visible = !hero && !editor;
    this.cameraBase = this.camera.position.clone();
    this.cameraFocus = new THREE.Vector3();
    this.marker = mesh(
      this.scene,
      new THREE.RingGeometry(0.2, 0.3, 36),
      "#d4ac68",
      [0, 0.06, 0],
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    this.ray = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    if (editor) {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.maxPolarAngle = Math.PI * 0.46;
      this.controls.minDistance = 12;
      this.controls.maxDistance = 350;
      this.controls.target.set(0, 0, 0);
    }
    const signal = this.abort.signal;
    this.renderer.domElement.addEventListener(
      "pointerdown",
      (e) => {
        this.down = { x: e.clientX, y: e.clientY };
      },
      { signal },
    );
    this.renderer.domElement.addEventListener(
      "pointerup",
      (e) => {
        if (
          !this.down ||
          Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 8
        )
          return;
        const r = this.renderer.domElement.getBoundingClientRect();
        this.pointer.set(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          (-(e.clientY - r.top) / r.height) * 2 + 1,
        );
        this.ray.setFromCamera(this.pointer, this.camera);
        const hit = this.ray.intersectObjects(
          this.pickObjects?.() || this.objects.map((o) => o.group),
          true,
        )[0];
        if (editor && hit) {
          let obj = hit.object;
          while (obj && !obj.userData.placementId) obj = obj.parent;
          this.onSelect(obj?.userData.placementId);
          return;
        }
        if(editor && this.onSelectFloor && this.floorArt){
          const floorHit=this.ray.intersectObjects(this.pickFloorObjects?.() || this.floorArt.children,true).find(h=>h.object.userData.floorDecalId);
          if(floorHit){this.onSelectFloor(floorHit.object.userData.floorDecalId,floorHit.object.userData.chapterId);return;}
        }
        const point = new THREE.Vector3();
        if (this.ray.ray.intersectPlane(this.plane, point)) {
          if (editor) {
            this.onMove({
              x: +THREE.MathUtils.clamp(point.x, -(chapter.width || 21) / 2 + 1, (chapter.width || 21) / 2 - 1).toFixed(1),
              z: +THREE.MathUtils.clamp(point.z, -(chapter.depth || 14) / 2 + 1, (chapter.depth || 14) / 2 - 1).toFixed(1),
            });
          } else if (this.active) {
            this.moveTo(point.x, point.z);
            this.renderer.domElement.focus();
          }
        }
      },
      { signal },
    );
    window.addEventListener(
      "keydown",
      (e) => {
        if (
          !this.active ||
          editor ||
          document.querySelector("dialog[open]") ||
          /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.closest(".floor-reading-controls")
        )
          return;
        if (
          [
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
            "w",
            "a",
            "s",
            "d",
          ].includes(e.key)
        ) {
          e.preventDefault();
          this.keys.add(e.key);
        }
      },
      { signal },
    );
    window.addEventListener("keyup", (e) => this.keys.delete(e.key), {
      signal,
    });
    window.addEventListener("blur", () => this.keys.clear(), { signal });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    this.last = performance.now();
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }
  build(chapter) {
    if (chapter?.width) {
      this.floorArt = terrain(this.root, chapter);
      for (const p of chapter.placements) this.addPlacement(p);
      return;
    }
    const colors = themes[chapter?.theme || "meadow"];
    this.container.style.setProperty("--scene-bg", colors.back);
    // An open volume is the landscape itself: cloth cover, layered page edges, a crease.
    box(this.root, "#617b65", [0, -0.78, 0], [21.6, 0.32, 15.4]);
    box(this.root, "#dacdb1", [0, -0.56, 0], [21.1, 0.22, 15]);
    box(this.root, "#f0e5c9", [0, -0.38, 0], [20.95, 0.15, 14.9]);
    box(this.root, "#faf0d5", [0, -0.24, 0], [20.8, 0.13, 14.8]);
    for (const x of [-5.15, 5.15]) {
      const page = box(
        this.root,
        "#f2e7cc",
        [x, -0.1, 0],
        [10.24, 0.22, 14.65],
      );
      page.rotation.z = x < 0 ? 0.017 : -0.017;
    }
    box(this.root, "#d2c3a1", [0, 0.023, 0], [0.045, 0.04, 14.2]);
    const ground = ball(
      this.root,
      colors.ground,
      [0, 0.01, 0],
      [9.55, 0.18, 6.65],
    );
    const lake = ball(
      this.root,
      colors.water,
      [-5.3, 0.18, 2.1],
      [2.4, 0.06, 1.85],
    );
    for (let i = 0; i < 3; i++) {
      const r = ring(
        this.root,
        "#c1d7c5",
        [-5.6 + i * 0.4, 0.255, 2.1],
        0.6 + i * 0.25,
        0.016,
      );
      r.rotation.x = Math.PI / 2;
    }
    for (let i = 0; i < 27; i++) {
      const t = i / 26;
      const x = -8.4 + t * 16.8,
        z = Math.sin(t * Math.PI * 2) * 1.15 + 1;
      const stone = ball(
        this.root,
        "#e8d9b5",
        [x, 0.3, z],
        [0.43, 0.055, 0.35],
      );
      stone.rotation.y = i;
    }
    const trees = [
      [-7, -3, 1.4],
      [-5, -4.8, 1.65],
      [-2.1, -5.5, 1.3],
      [1, -5.3, 1.55],
      [5.5, -4.3, 1.5],
      [7, -2.8, 1.2],
      [7.8, 3.3, 1.2],
      [-8, 0.1, 0.85],
    ];
    trees.forEach(([x, z, s], i) => {
      const t = makeModel("tree", i % 2 ? colors.leaf : "#a6b389");
      t.position.set(x, 0.1, z);
      t.scale.setScalar(s);
      this.root.add(t);
    });
    for (let i = 0; i < 34; i++) {
      const x = Math.sin(i * 54.23) * 8.3,
        z = Math.cos(i * 28.11) * 5.4;
      if (Math.abs(z - 1) < 1.1) continue;
      const g = new THREE.Group();
      g.position.set(x, 0.25, z);
      for (let j = 0; j < 3; j++) {
        const stem = cylinder(g, "#819563", [j * 0.11, 0.13, 0], 0.025, 0.25);
        stem.rotation.z = (j - 1) * 0.3;
      }
      ball(
        g,
        i % 3 ? "#e8b871" : "#e9d7c0",
        [0.08, 0.29, 0],
        [0.075, 0.075, 0.075],
      );
      this.root.add(g);
    }
    [
      [-6, 0, 0.65],
      [-6.8, 0, 0.42],
      [4.8, 3.5, 0.6],
      [5.5, 3.6, 0.4],
      [-1, -3, 0.5],
    ].forEach(([x, z, s]) => {
      const m = makeModel("mushroom", "#c68365");
      m.position.set(x, 0.2, z);
      m.scale.setScalar(s);
      this.root.add(m);
    });
    if (chapter?.theme === "tea") {
      box(this.root, "#a77e5e", [0, 0.75, 0], [4, 0.2, 1.9]);
      for (const x of [-1.5, 1.5])
        for (const z of [-0.65, 0.65])
          cylinder(this.root, "#9a775b", [x, 0.4, z], 0.08, 0.7);
    }
    this.portal = new THREE.Group();
    this.portal.position.set(9, 0.1, 0);
    const arch = ring(this.portal, "#d7b777", [0, 1.2, 0], 0.85, 0.09);
    arch.scale.y = 1.35;
    ball(this.portal, "#c7d5bc", [0, 1.2, 0], [0.7, 1, 0.03]);
    this.root.add(this.portal);
    if (chapter) for (const p of chapter.placements) this.addPlacement(p);
  }
  addPlacement(p) {
    const model = this.models.find((m) => m.id === p.modelId);
    if (!model) return;
    const group = new THREE.Group();
    group.position.set(p.x, 0.32 + (p.y || 0), p.z);
    group.rotation.y = THREE.MathUtils.degToRad(p.rotation);
    group.scale.setScalar(p.scale);
    group.userData.placementId = p.id;
    this.root.add(group);
    const entry = {
      p,
      group,
      baseY: 0.32 + (p.y || 0),
      baseRot: group.rotation.y,
      near: false,
      phase: 0,
      mixer: null,
      action: null,
    };
    this.objects.push(entry);
    if (model.kind === "glb") {
      new GLTFLoader().load(
        model.url,
        (gltf) => {
          if (this.dead) {
            this.disposeTree(gltf.scene);
            return;
          }
          const bounds = new THREE.Box3().setFromObject(gltf.scene);
          const size = bounds.getSize(new THREE.Vector3());
          const center = bounds.getCenter(new THREE.Vector3());
          const scale = 2 / Math.max(size.x, size.y, size.z, 0.01);
          gltf.scene.position.set(
            -center.x * scale,
            -bounds.min.y * scale,
            -center.z * scale,
          );
          gltf.scene.scale.setScalar(scale);
          gltf.scene.traverse((o) => {
            if (o.isMesh) {
              o.castShadow = true;
              o.receiveShadow = true;
            }
          });
          group.add(gltf.scene);
          if (gltf.animations.length) {
            entry.clips = gltf.animations;
            entry.selectedClip = p.clip;
            entry.mixer = new THREE.AnimationMixer(gltf.scene);
            const clip =
              gltf.animations.find((c) => c.name === p.clip) ||
              gltf.animations[0];
            entry.action = entry.mixer.clipAction(clip);
            entry.action.play();
            entry.action.paused = true;
          }
        },
        undefined,
        () => {
          this.onError(`“${model.name}” 모델을 불러오지 못했습니다.`);
          const fallback = makeModel("cards", "#c66c65");
          group.add(fallback);
        },
      );
    } else group.add(makeModel(model.kind, model.color));
    const halo = mesh(
      this.root,
      new THREE.RingGeometry(0.94, 1, 48),
      "#c09f5c",
      [p.x, 0.29, p.z],
    );
    halo.rotation.x = -Math.PI / 2;
    halo.scale.setScalar(this.editor ? reactionSize(p, this.chapter) : 0.62);
    halo.material.transparent = true;
    halo.material.opacity = 0.65;
    entry.halo = halo;
    if (this.editor) {
      const boundary = mesh(this.root, new THREE.RingGeometry(.97, 1, 64), '#be756a', [p.x, .30, p.z]);
      boundary.rotation.x = -Math.PI / 2;
      boundary.material.transparent = true;
      boundary.material.opacity = .65;
      boundary.scale.setScalar(collisionSize(p) + .32);
      boundary.visible = p.collision !== false;
      entry.collisionHalo = boundary;
    }
  }
  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.editor && this.chapter?.width && !this.fitted) {
      const size = Math.max(this.chapter.width, this.chapter.depth) * .75;
      this.camera.position.set(size * .6, size, size);
      this.camera.lookAt(0, 0, 0); this.fitted = true;
    }
    if (!this.editor) {
      const factor = Math.max(1, 1.4 / this.camera.aspect);
      this.camera.position.set(19 * factor, 21 * factor, 26 * factor);
      this.cameraBase = this.camera.position.clone();
      this.camera.lookAt(0, 0, 0);
    }
  }
  moveTo(x, z) {
    this.target.set(
      THREE.MathUtils.clamp(x, -9.6, 9.6),
      0,
      THREE.MathUtils.clamp(z, -6, 6),
    );
    this.marker.position.set(this.target.x, 0.4, this.target.z);
    this.marker.visible = true;
  }
  focusPlacement(id) {
    const item = this.objects.find((o) => o.p.id === id);
    if (item)
      this.moveTo(item.p.x, item.p.z + Math.min(item.p.radius * 0.6, 1));
  }
  setActive(active) {
    this.active = active;
    this.hero = false;
    this.player.visible = active;
    this.keys.clear();
  }
  preview(id) {
    this.previewId = id;
  }
  previewFloor(id) {
    const o = this.objects.find(o => o.p.id === id); if (!o) return;
    if (!this.floorReading) {
      this.floorReading = document.createElement('aside');
      this.floorReading.className = 'floor-reading-controls';
      this.container.append(this.floorReading);
    }
    this.floorReading.replaceChildren();
    const title = document.createElement('h2'), text = document.createElement('p');
    title.textContent = this.chapter.title; text.id = 'floor-accessible';
    text.textContent = textPages(this.chapter.floorText?.trim() || this.chapter.body)[0];
    const divider = document.createElement('img'); divider.className = 'story-divider';
    divider.src = '/ornaments/story-divider.png'; divider.alt = ''; divider.setAttribute('aria-hidden', 'true');
    this.floorReading.append(title, divider, text); revealReading(this.floorReading);
    this.player.visible = true; this.player.position.copy(o.group.position).add(new THREE.Vector3(-2, 0, 2));
    const pose = sideReadingPose(o.group, this.player, this.camera, this.chapter.floorZoom || 1.1);
    this.camera.far = 350; this.camera.updateProjectionMatrix();
    this.camera.position.copy(pose.focus).add(pose.offset); this.controls?.target.copy(pose.focus); this.camera.lookAt(pose.focus);
  }
  updatePlacement(p) {
    const o = this.objects.find((o) => o.p.id === p.id);
    if (!o) return;
    const moved = o.group.position.x !== p.x || o.group.position.z !== p.z;
    o.p = p;
    o.baseY = .32 + (p.y || 0);
    o.group.position.set(p.x, o.baseY, p.z);
    o.group.scale.setScalar(p.scale);
    o.baseRot = THREE.MathUtils.degToRad(p.rotation);
    o.halo.position.set(p.x, 0.29, p.z);
    o.halo.scale.setScalar(this.editor ? reactionSize(p, this.chapter) : 0.62);
    if (o.collisionHalo) {
      o.collisionHalo.position.set(p.x, .30, p.z);
      o.collisionHalo.scale.setScalar(collisionSize(p) + .32);
      o.collisionHalo.visible = p.collision !== false;
    }
    if (moved && this.floorArt) {
      this.disposeTree(this.floorArt); this.root.remove(this.floorArt);
      this.floorArt = floorArt(this.root, this.chapter);
      if (this.floorReading) this.previewFloor(p.id);
    }
    if (o.mixer && o.clips && o.selectedClip !== p.clip) {
      o.action?.stop();
      o.action = o.mixer.clipAction(
        o.clips.find((c) => c.name === p.clip) || o.clips[0],
      );
      o.action.play();
      o.selectedClip = p.clip;
    }
  }
  frame(t) {
    if (this.dead) return;
    const dt = Math.min((t - this.last) / 1000, 0.05);
    this.last = t;
    const seconds = t / 1000;
    if (
      this.active &&
      !this.editor &&
      !document.querySelector("dialog[open]")
    ) {
      let dx = 0,
        dz = 0;
      for (const k of this.keys) {
        if (k === "ArrowUp" || k === "w") dz--;
        if (k === "ArrowDown" || k === "s") dz++;
        if (k === "ArrowLeft" || k === "a") dx--;
        if (k === "ArrowRight" || k === "d") dx++;
      }
      if (dx || dz)
        this.moveTo(
          this.player.position.x + dx * 1.5,
          this.player.position.z + dz * 1.5,
        );
      const delta = this.target.clone().sub(this.player.position);
      delta.y = 0;
      const distance = delta.length();
      if (distance > 0.07) {
        delta.normalize();
        this.player.position.addScaledVector(delta, Math.min(distance, dt * 4));
        this.player.rotation.y = Math.atan2(delta.x, delta.z);
        this.player.position.y = this.reduced
          ? 0.33
          : 0.33 + Math.abs(Math.sin(seconds * 13)) * 0.13;
      } else {
        this.player.position.y = 0.33;
        this.marker.visible = false;
      }
      for (const o of this.objects) {
        const distance = Math.hypot(
          this.player.position.x - o.p.x,
          this.player.position.z - o.p.z,
        );
        const near = distance < o.p.radius;
        if (near && !o.near) {
          this.onDiscover(o.p);
          o.phase = 0;
        }
        o.near = near;
      }
      if (!this.reduced) {
        this.cameraFocus.lerp(
          new THREE.Vector3(
            this.player.position.x * 0.18,
            0,
            this.player.position.z * 0.12,
          ),
          1 - Math.exp(-dt * 2),
        );
        this.camera.position.copy(this.cameraBase).add(this.cameraFocus);
        this.camera.lookAt(this.cameraFocus);
      }
      if (
        this.player.position.distanceTo(new THREE.Vector3(9, 0.33, 0)) < 1.25 &&
        !this.portalEntered
      ) {
        this.portalEntered = true;
        this.onPortal();
        return;
      }
    }
    for (const o of this.objects) {
      const playing =
        (this.active && o.near) || (this.editor && this.previewId === o.p.id);
      o.phase += dt;
      const a = playing && !this.reduced ? o.phase : 0;
      o.group.position.y = o.baseY;
      o.group.rotation.set(0, o.baseRot, 0);
      if (a) {
        if (o.p.animation === "hop")
          o.group.position.y += Math.abs(Math.sin(a * 4)) * 0.55;
        if (o.p.animation === "float")
          o.group.position.y += 0.3 + Math.sin(a * 2) * 0.22;
        if (o.p.animation === "spin") o.group.rotation.y += a * 1.8;
        if (o.p.animation === "sway")
          o.group.rotation.z = Math.sin(a * 3) * 0.16;
      }
      if (o.action) {
        o.action.paused = !(
          playing &&
          o.p.animation === "clip" &&
          !this.reduced
        );
        o.mixer.update(dt);
      }
      o.halo.material.opacity = playing ? 0.9 : 0.38;
    }
    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  disposeTree(tree) {
    tree.traverse((o) => {
      o.geometry?.dispose();
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of materials)
        if (m) {
          for (const value of Object.values(m))
            if (value?.isTexture) value.dispose();
          m.dispose();
        }
    });
  }
  dispose() {
    this.dead = true;
    this.floorReading?.remove();
    this.abort.abort();
    this.observer.disconnect();
    this.controls?.dispose();
    this.renderer.setAnimationLoop(null);
    for (const o of this.objects) o.mixer?.stopAllAction();
    this.disposeTree(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

