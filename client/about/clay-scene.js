import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applyJourneyCamera } from './journey-camera.js';
import { createJourneyPresentation, journeyBeat } from './journey-presentation.js';

// Static URLs let Vite fingerprint each file; a template path would bundle the whole folder.
const ASSET_URLS = {
  'clay-journey.json': new URL('./assets/clay-journey.json', import.meta.url).href,
  'clay-journey.glb': new URL('./assets/clay-journey.glb', import.meta.url).href,
  'journey-walk.webp': new URL('./assets/journey-walk.webp', import.meta.url).href,
  'journey-approach.webp': new URL('./assets/journey-approach.webp', import.meta.url).href,
  'journey-read.webp': new URL('./assets/journey-read.webp', import.meta.url).href,
};
const asset = (name) => ASSET_URLS[name];
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const PHOTO_NAMES = ['Walk', 'Approach', 'Read'];

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,235,161,1)');
  gradient.addColorStop(.22, 'rgba(255,201,101,.65)');
  gradient.addColorStop(.55, 'rgba(255,173,63,.17)');
  gradient.addColorStop(1, 'rgba(255,157,49,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function sunlightTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  for (let row = 0; row < canvas.height; row += 1) {
    const fraction = row / (canvas.height - 1);
    const halfWidth = 4 + fraction * 58;
    const strength = Math.sin(fraction * Math.PI) ** .7;
    const gradient = context.createLinearGradient(64 - halfWidth, 0, 64 + halfWidth, 0);
    gradient.addColorStop(0, 'rgba(255,214,141,0)');
    gradient.addColorStop(.2, `rgba(255,214,141,${strength * .16})`);
    gradient.addColorStop(.5, `rgba(255,230,178,${strength * .48})`);
    gradient.addColorStop(.8, `rgba(255,214,141,${strength * .16})`);
    gradient.addColorStop(1, 'rgba(255,214,141,0)');
    context.fillStyle = gradient;
    context.fillRect(0, row, canvas.width, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function samplePath(path, progress) {
  const exact = clamp(progress) * (path.length - 1);
  const index = Math.min(path.length - 2, Math.floor(exact));
  const a = path[index];
  const b = path[index + 1];
  const mix = exact - index;
  return {
    position: a.position.clone().lerp(b.position, mix),
    normal: a.normal.clone().lerp(b.normal, mix).normalize(),
    tangent: b.position.clone().sub(a.position).normalize(),
  };
}

/** The path, rounded road, and photo frames are authored in Blender. */
export async function createClayJourney(canvas, options = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .98;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const lightViewport = { value: new THREE.Vector2(1, 1) };
  function softenLightEdges(material) {
    // Feather only the atmospheric light, never the photos, frames, or road.
    material.onBeforeCompile = shader => {
      shader.uniforms.journeyLightViewport = lightViewport;
      shader.fragmentShader = 'uniform vec2 journeyLightViewport;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        vec2 lightScreen = gl_FragCoord.xy / journeyLightViewport;
        vec2 lightEdge = min(lightScreen, 1.0 - lightScreen);
        vec2 lightFeather = smoothstep(vec2(0.035, 0.05), vec2(0.20, 0.25), lightEdge);
        diffuseColor.a *= lightFeather.x * lightFeather.y;
        #include <opaque_fragment>
      `);
    };
    return material;
  }

  const scene = new THREE.Scene();
  const journeyFog = new THREE.Fog('#041f1c', 5, 12);
  scene.fog = journeyFog;
  const textures = new Set();
  let resizeObserver;
  let frame = 0;
  let disposed = false;
  let enabled = true;
  let dirty = true;
  let reducedMotion = false;
  let progress = 0;
  let onLayout = options.onLayout;

  function dispose() {
    disposed = true;
    cancelAnimationFrame(frame);
    resizeObserver?.disconnect();
    onLayout = undefined;
    const geometries = new Set();
    const materials = new Set();
    scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      const list = Array.isArray(object.material) ? object.material : [object.material];
      list.filter(Boolean).forEach((material) => {
        materials.add(material);
        Object.values(material).forEach((value) => { if (value?.isTexture) textures.add(value); });
      });
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
    renderer.dispose();
    delete canvas.dataset.ready;
  }

  try {
    const response = await fetch(asset('clay-journey.json'));
    if (!response.ok) throw new Error(`Clay journey metadata: HTTP ${response.status}`);
    const metadata = await response.json();
    if (!Array.isArray(metadata.path) || metadata.path.length < 2) throw new Error('Clay journey path is missing.');
    const loader = new THREE.TextureLoader();
    const results = await Promise.allSettled([
      new GLTFLoader().loadAsync(asset('clay-journey.glb')).then((gltf) => { scene.add(gltf.scene); return gltf; }),
      ...['walk', 'approach', 'read'].map(async (name) => {
        const texture = await loader.loadAsync(asset(`journey-${name}.webp`));
        textures.add(texture);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        return texture;
      }),
    ]);
    const failure = results.find((result) => result.status === 'rejected');
    if (failure) throw failure.reason;
    const [gltf, ...photos] = results.map((result) => result.value);
    const model = gltf.scene;
    model.updateMatrixWorld(true);

    const path = metadata.path.map((point) => ({
      position: new THREE.Vector3(...point.position),
      normal: new THREE.Vector3(...(point.normal || [0, 1, 0])).normalize(),
    }));
    const stops = metadata.stops || [{ progress: .17 }, { progress: .5 }, { progress: .83 }];
    const photoCenters = stops.map(stop => new THREE.Box3().setFromObject(model.getObjectByName(stop.photoMesh)).getCenter(new THREE.Vector3()));
    const camera = new THREE.PerspectiveCamera(38, 1200 / 1100, .1, 100);
    const presentation = createJourneyPresentation(model, camera, stops);
    let aspect = Math.max(1, canvas.clientWidth) / Math.max(1, canvas.clientHeight);
    let cameraPose = applyJourneyCamera(camera, progress, aspect, reducedMotion, path, photoCenters);

    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    scene.add(new THREE.HemisphereLight('#d5e5d5', '#172c28', .62));
    const key = new THREE.DirectionalLight('#dfd1b5', 1.1);
    key.position.set(-6, 13, 10);
    key.target.position.copy(center);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = key.shadow.camera.bottom = -9;
    key.shadow.camera.right = key.shadow.camera.top = 9;
    key.shadow.camera.near = .5;
    key.shadow.camera.far = 45;
    key.shadow.normalBias = .055;
    key.shadow.bias = -.00035;
    key.shadow.radius = 3;
    scene.add(key, key.target);
    const fill = new THREE.DirectionalLight('#70a68c', .32);
    fill.position.set(5, 6, -5);
    scene.add(fill);

    const photoMeshes = [];
    const frameMaterials = PHOTO_NAMES.map(() => []);
    model.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = !object.name.startsWith('Paving_Joint_');
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const replacements = materials.map((material) => {
        const photoIndex = PHOTO_NAMES.findIndex((name) => material.name === `Photo_${name}`);
        if (photoIndex >= 0) {
          photoMeshes[photoIndex] = object;
          object.castShadow = false;
          const photoMaterial = new THREE.MeshStandardMaterial({ map: photos[photoIndex], roughness: 1, metalness: 0, emissive: '#ffffff', emissiveMap: photos[photoIndex], emissiveIntensity: .22, toneMapped: false, side: THREE.DoubleSide });
          photoMaterial.name = material.name;
          material.dispose();
          return photoMaterial;
        }
        if (material.isMeshStandardMaterial) {
          material.metalness = 0;
          material.roughness = .92;
          const frameIndex = PHOTO_NAMES.findIndex((name) => material.name === `Frame_${name}`);
          if (frameIndex >= 0) {
            material.emissive.set('#ffbc64');
            material.userData.journeyBaseColor = material.color.clone();
            frameMaterials[frameIndex].push(material);
          }
        }
        return material;
      });
      object.material = Array.isArray(object.material) ? replacements : replacements[0];
    });
    if (photoMeshes.filter(Boolean).length !== 3) throw new Error('Clay journey requires three named photo surfaces.');

    const glow = glowTexture();
    textures.add(glow);
    const cardGlows = photoMeshes.map((mesh) => {
      const box = new THREE.Box3().setFromObject(mesh);
      const photoCenter = box.getCenter(new THREE.Vector3());
      const size = mesh.geometry.boundingBox.getSize(new THREE.Vector3());
      const halo = new THREE.Sprite(softenLightEdges(new THREE.SpriteMaterial({ map: glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })));
      halo.position.copy(photoCenter).add(camera.position.clone().sub(photoCenter).normalize().multiplyScalar(-.11));
      halo.userData.photoSpan = Math.max(size.x, size.y, size.z);
      scene.add(halo);
      return halo;
    });

    const sunlight = sunlightTexture();
    textures.add(sunlight);
    const sunbeams = photoMeshes.map((mesh) => {
      const photoCenter = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
      const target = photoCenter.clone();
      const origin = photoCenter.clone();
      const light = new THREE.SpotLight('#fff1dc', 0, 15, .42, .8, 2);
      light.position.copy(origin);
      light.target.position.copy(target);
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.normalBias = .045;
      light.shadow.bias = -.0003;
      light.shadow.camera.near = .2;
      light.shadow.camera.far = 16;
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), softenLightEdges(new THREE.MeshBasicMaterial({ map: sunlight, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })));
      beam.position.copy(origin).lerp(target, .5);
      beam.renderOrder = 1;
      scene.add(light, light.target, beam);
      return { light, beam, origin, target, photoCenter };
    });

    let pathLength = 0;
    for (let index = 1; index < path.length; index += 1) pathLength += path[index].position.distanceTo(path[index - 1].position);
    const footprintCount = Math.max(30, Math.ceil(pathLength / .36));
    const footprintGeometry = new THREE.CircleGeometry(1, 20);
    const footprints = [];
    for (let index = 0; index < footprintCount; index += 1) {
      const at = index / (footprintCount - 1);
      const point = samplePath(path, at);
      const lateral = point.tangent.clone().cross(point.normal).normalize();
      const material = new THREE.MeshBasicMaterial({ color: '#c8903b', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const footprint = new THREE.Mesh(footprintGeometry, material);
      footprint.position.copy(point.position).addScaledVector(point.normal, .038).addScaledVector(lateral, index % 2 ? .17 : -.17);
      footprint.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(lateral, point.tangent, point.normal));
      footprint.scale.set(.12, .15, 1);
      footprint.renderOrder = 2;
      scene.add(footprint);
      footprints.push({ mesh: footprint, at });
    }

    const travelerGlow = new THREE.Sprite(softenLightEdges(new THREE.SpriteMaterial({ map: glow, transparent: true, opacity: .75, depthWrite: false, blending: THREE.AdditiveBlending })));
    travelerGlow.scale.setScalar(.65);
    scene.add(travelerGlow);
    const travelerLight = new THREE.PointLight('#ffcc79', .7, 2.4, 2);
    scene.add(travelerLight);

    const photoPoints = photoMeshes.map((mesh, index) => {
      const group = model.getObjectByName('Frame_' + PHOTO_NAMES[index]) || mesh;
      const card = model.getObjectByName(stops[index].group);
      const points = [];
      group.traverse((object) => {
        if (!object.geometry) return;
        const vertices = object.geometry.attributes.position;
        for (let index = 0; index < vertices.count; index += 1) {
          points.push(card.worldToLocal(new THREE.Vector3().fromBufferAttribute(vertices, index).applyMatrix4(object.matrixWorld)));
        }
      });
      return points;
    });
    const platforms = PHOTO_NAMES.flatMap(name => {
      const object = model.getObjectByName('Photo_Platform_' + name);
      object.geometry.computeBoundingBox();
      const { min, max } = object.geometry.boundingBox;
      const vertices = [
        [min.x,min.y,min.z],[max.x,min.y,min.z],[max.x,max.y,min.z],[min.x,max.y,min.z],
        [min.x,min.y,max.z],[max.x,min.y,max.z],[max.x,max.y,max.z],[min.x,max.y,max.z],
      ].map(point => new THREE.Vector3(...point));
      return [[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]].map(face => ({ object, points: face.map(index => vertices[index]) }));
    });

    function hull(points) {
      const sorted = points.toSorted((a, b) => a.x - b.x || a.y - b.y);
      const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      const half = values => {
        const result = [];
        for (const point of values) {
          while (result.length >= 2 && cross(result.at(-2), result.at(-1), point) <= 0) result.pop();
          result.push(point);
        }
        return result.slice(0, -1);
      };
      return [...half(sorted), ...half(sorted.toReversed())];
    }

    // Clip the road before perspective division; geometry behind the walker
    // must never turn into giant, inverted screen-space obstacles.
    function visiblePolygon(points) {
      let polygon = points.map(point => point.clone().applyMatrix4(camera.matrixWorldInverse));
      const result = [];
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i + 1) % polygon.length];
        const insideA = a.z <= -camera.near, insideB = b.z <= -camera.near;
        if (insideA) result.push(a);
        if (insideA !== insideB) result.push(a.clone().lerp(b, (-camera.near - a.z) / (b.z - a.z)));
      }
      polygon = result.map(point => {
        point.applyMatrix4(camera.projectionMatrix);
        return { x: (point.x + 1) / 2, y: (1 - point.y) / 2 };
      });
      for (const [axis, edge, sign] of [['x', 0, 1], ['x', 1, -1], ['y', 0, 1], ['y', 1, -1]]) {
        const clipped = [];
        for (let i = 0; i < polygon.length; i++) {
          const a = polygon[i], b = polygon[(i + 1) % polygon.length];
          const insideA = (a[axis] - edge) * sign >= 0, insideB = (b[axis] - edge) * sign >= 0;
          if (insideA) clipped.push(a);
          if (insideA !== insideB) {
            const t = (edge - a[axis]) / (b[axis] - a[axis]);
            clipped.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
          }
        }
        polygon = clipped;
      }
      return polygon;
    }

    function project(point) {
      const projected = point.clone().project(camera);
      return { x: (projected.x + 1) / 2, y: (1 - projected.y) / 2, z: projected.z };
    }

    function getLayout() {
      const road = path.filter((_, index) => {
        const at = index / (path.length - 1);
        return (index % 2 === 0 || index === path.length - 1) && at >= cameraPose.routeProgress - .04 && at <= cameraPose.routeProgress + .28;
      });
      const edges = [[], []];
      road.forEach((point, index) => {
        const tangent = road[Math.min(road.length - 1, index + 1)].position.clone().sub(road[Math.max(0, index - 1)].position).normalize();
        const lateral = tangent.cross(point.normal).normalize();
        edges[0].push(point.position.clone().addScaledVector(lateral, (metadata.pathWidth || 1.48) * .5));
        edges[1].push(point.position.clone().addScaledVector(lateral, -(metadata.pathWidth || 1.48) * .5));
      });
      const photos = photoPoints.map((localPoints, index) => {
        const card = model.getObjectByName(stops[index].group);
        const points = localPoints.map(point => card.localToWorld(point.clone()));
        const inFront = points.every(point => point.clone().applyMatrix4(camera.matrixWorldInverse).z < -camera.near);
        const projected = inFront && card.visible ? hull(points.map(project)) : [];
        if (!projected.length) return { index, visible: false, fullyVisible: false, outline: [], rect: { x: 0, y: 0, width: 0, height: 0 } };
        const left = Math.min(...projected.map((point) => point.x));
        const right = Math.max(...projected.map((point) => point.x));
        const top = Math.min(...projected.map((point) => point.y));
        const bottom = Math.max(...projected.map((point) => point.y));
        return {
          index,
          caption: reducedMotion ? 1 : journeyBeat(progress, index).caption,
          position: card.position.toArray(),
          facing: new THREE.Vector3(0, 1, 0).applyQuaternion(card.quaternion).dot(new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion)),
          rect: { x: left, y: top, width: right - left, height: bottom - top },
          center: { x: (left + right) / 2, y: (top + bottom) / 2 },
          outline: projected,
          visible: right > 0 && left < 1 && bottom > 0 && top < 1,
          fullyVisible: left >= 0 && right <= 1 && top >= 0 && bottom <= 1,
        };
      });
      return {
        progress,
        activeStep: Math.min(2, Math.floor(progress / .84 * 3)),
        camera: { ...cameraPose },
        photos,
        road: {
          quads: [...edges[0].slice(0, -1).map((point, index) => visiblePolygon([point, edges[0][index + 1], edges[1][index + 1], edges[1][index]])), ...platforms.filter(({ object }) => object.visible).map(({ object, points }) => visiblePolygon(points.map(point => object.localToWorld(point.clone()))))].filter(polygon => polygon.length >= 3),
        },
      };
    }

    function updateJourney() {
      scene.fog = reducedMotion ? null : journeyFog;
      cameraPose = applyJourneyCamera(camera, progress, aspect, reducedMotion, path, photoCenters);
      presentation.update(progress, reducedMotion);
      const walkingProgress = cameraPose.routeProgress;
      const current = samplePath(path, walkingProgress + .055);
      travelerGlow.position.copy(current.position).addScaledVector(current.normal, .09);
      travelerLight.position.copy(current.position).addScaledVector(current.normal, .4);
      travelerGlow.visible = travelerLight.visible = !reducedMotion && walkingProgress < .98;
      footprints.forEach(({ mesh, at }) => {
        const distance = (at - walkingProgress) * pathLength;
        mesh.material.opacity = reducedMotion ? .18 : distance > 0 ? .7 * clamp(1 - Math.abs(distance - .65) / 1.3) : 0;
        mesh.visible = mesh.material.opacity > .005;
      });
      stops.forEach((stop, index) => {
        const arrival = reducedMotion ? .55 : journeyBeat(progress, index).approach;
        frameMaterials[index].forEach((material) => {
          material.color.copy(material.userData.journeyBaseColor).lerp(new THREE.Color('#e6b35e'), arrival * .6);
          material.emissiveIntensity = .01 + arrival * .16;
        });
        cardGlows[index].material.opacity = arrival * .32;
        photoMeshes[index].material.color.setScalar(.28 + arrival * .42);
        const { light, beam, origin, target, photoCenter } = sunbeams[index];
        new THREE.Box3().setFromObject(photoMeshes[index]).getCenter(photoCenter);
        const card = model.getObjectByName(stop.group);
        const scale = card.scale.x;
        cardGlows[index].scale.setScalar(cardGlows[index].userData.photoSpan * scale * 1.75);
        const photoFront = new THREE.Vector3(0, 1, 0).applyQuaternion(card.quaternion);
        const viewRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const viewUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
        target.copy(photoCenter);
        // A viewer-side, upper-left source follows the moving photograph itself.
        origin.copy(target).addScaledVector(photoFront, 1.6 * scale)
          .addScaledVector(viewUp, .85 * scale).addScaledVector(viewRight, -.65 * scale);
        light.position.copy(origin);
        light.target.position.copy(target);
        beam.position.copy(origin).lerp(target, .5);
        light.intensity = arrival * origin.distanceToSquared(target) * 1.2;
        light.angle = Math.atan2(1.4 * scale, origin.distanceTo(target));
        light.castShadow = arrival > .03;
        beam.scale.set(2.2 * scale, origin.distanceTo(target), 1);
        beam.material.opacity = arrival * .24;
        const up = origin.clone().sub(target).normalize();
        const facing = camera.position.clone().sub(beam.position).normalize();
        const right = up.clone().cross(facing).normalize();
        const normal = right.clone().cross(up).normalize();
        beam.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));
        cardGlows[index].position.copy(photoCenter).add(camera.position.clone().sub(photoCenter).normalize().multiplyScalar(-.11));
      });
      canvas.dataset.progress = progress.toFixed(4);
      canvas.dataset.step = String(Math.min(2, Math.floor(progress / .84 * 3)));
      canvas.dataset.routeProgress = walkingProgress.toFixed(4);
      canvas.dataset.reducedMotion = String(reducedMotion);
      renderer.shadowMap.needsUpdate = true;
      dirty = true;
    }

    function render() {
      frame = 0;
      if (!enabled || disposed || !dirty) return;
      renderer.render(scene, camera);
      dirty = false;
      canvas.dataset.renderCount = String(Number(canvas.dataset.renderCount || 0) + 1);
      if (typeof onLayout === 'function') onLayout(getLayout());
    }

    function schedule() {
      if (enabled && !disposed && !frame) frame = requestAnimationFrame(render);
    }

    function resize() {
      if (disposed) return;
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      aspect = width / height;
      renderer.setSize(width, height, false);
      renderer.getDrawingBufferSize(lightViewport.value);
      updateJourney();
      dirty = true;
      schedule();
    }

    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    renderer.shadowMap.needsUpdate = true;
    updateJourney();
    resize();
    cancelAnimationFrame(frame);
    render();
    canvas.dataset.ready = 'true';

    return {
      getLayout,
      setLayoutListener(listener) {
        onLayout = typeof listener === 'function' ? listener : undefined;
        if (onLayout && !disposed) onLayout(getLayout());
      },
      render(value = progress) {
        if (disposed) throw new Error('Cannot render a disposed clay journey.');
        if (!Number.isFinite(value)) throw new Error('Journey progress must be finite.');
        progress = clamp(value);
        updateJourney();
        cancelAnimationFrame(frame);
        frame = 0;
        renderer.render(scene, camera);
        dirty = false;
        canvas.dataset.renderCount = String(Number(canvas.dataset.renderCount || 0) + 1);
        const layout = getLayout();
        if (typeof onLayout === 'function') onLayout(layout);
        return layout;
      },
      setProgress(value) {
        if (disposed || !Number.isFinite(value)) return;
        const next = clamp(value);
        if (Math.abs(next - progress) < .00005) return;
        progress = next;
        updateJourney();
        schedule();
      },
      setReducedMotion(value) {
        if (disposed || reducedMotion === Boolean(value)) return;
        reducedMotion = Boolean(value);
        updateJourney();
        schedule();
      },
      setEnabled(value) {
        enabled = Boolean(value);
        if (enabled) schedule();
        else { cancelAnimationFrame(frame); frame = 0; }
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
