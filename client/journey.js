import { reactionSize } from "../shared/experience.js";
import { obstacles, slideMove, clearAt } from "../shared/collision.js";
import * as THREE from "three";
import { World } from "../shared/world.js";
import { layout, terrain } from "../shared/landscape.js";
import { textPages, sideReadingPose } from "../shared/floor-reading.js";

export class Journey extends World {
  constructor(container, options) {
    super(container, { ...options, chapter: { ...options.chapter, journeyChapters: options.chapters } });
    this.onChapter = options.onChapter;
    const canvas = this.renderer.domElement, signal = this.abort.signal;
    const release = (event) => {
      if (!this.heldMouse || (event.pointerId != null && event.pointerId !== this.heldMouse.id)) return;
      const held = this.heldMouse; this.heldMouse = null; this.down = null;
      if (event.type !== 'pointerup' || performance.now() - held.started > 180 || held.dragged) {
        this.target.copy(this.player.position); this.marker.visible = false;
      }
      if (canvas.hasPointerCapture(held.id)) canvas.releasePointerCapture(held.id);
      if (event.type === 'pointerup') event.stopImmediatePropagation();
    };
    canvas.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || !this.active || document.querySelector('dialog[open]')) return;
      this.heldMouse = {id:event.pointerId, x:event.clientX, y:event.clientY, startX:event.clientX, startY:event.clientY, started:performance.now(), dragged:false};
      canvas.setPointerCapture(event.pointerId); canvas.focus({preventScroll:true});
      this.followMouse();
    }, {signal});
    canvas.addEventListener('pointermove', event => {
      const held = this.heldMouse; if (!held || held.id !== event.pointerId) return;
      if (!(event.buttons & 1)) { release(event); return; }
      held.x = event.clientX; held.y = event.clientY;
      held.dragged ||= Math.hypot(held.x - held.startX, held.y - held.startY) > 8;
    }, {signal});
    canvas.addEventListener('pointerup', release, {signal, capture:true});
    canvas.addEventListener('pointercancel', release, {signal});
    canvas.addEventListener('lostpointercapture', release, {signal});
    window.addEventListener('blur', release, {signal});
    document.addEventListener('visibilitychange', () => { if (document.hidden) release({type:'visibilitychange'}); }, {signal});
    this.onReading = options.onReading;
    this.readingBlend = 0; this.readingPage = 0;
    this.index = Math.max(0, options.chapters.findIndex(c => c.id === options.chapter.id));
    this.player.scale.setScalar(.95);
    this.jump(this.index, false);
    this.sun = this.scene.children.find(o => o.isDirectionalLight);
    this.sun.intensity = 2.4;
    this.scene.children.find(o => o.isHemisphereLight).intensity = 1.65;
    this.scene.add(this.sun.target);
    this.scene.fog = new THREE.Fog("#eeeada", 38, 82);
    this.camera.far = 350; this.camera.updateProjectionMatrix();
    this.legs = this.player.children.filter(o => o.position.y < .3);
    this.arms = this.player.children.filter(o => Math.abs(o.position.x) === .29 && o.position.y === .72);
    [...this.legs, ...this.arms].forEach(o => o.userData.rest = o.position.clone());
  }
  build(chapter) {
    this.chapters = chapter.journeyChapters;
    this.zones = layout(this.chapters);
    this.container.style.setProperty("--scene-bg", "#eeeada");
    this.zones.forEach((zone, i) => {
      terrain(this.root, zone.chapter, zone.x);
      for (const p of zone.chapter.placements) {
        this.addPlacement({ ...p, x: zone.x + p.x });
        const o = this.objects.at(-1);
        if (o?.p.id === p.id) { o.chapterIndex = i; o.halo.visible = false; }
      }
    });
  }
  followMouse() {
    if (!this.heldMouse) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(THREE.MathUtils.clamp((this.heldMouse.x - rect.left) / rect.width, 0, 1) * 2 - 1, 1 - THREE.MathUtils.clamp((this.heldMouse.y - rect.top) / rect.height, 0, 1) * 2);
    this.ray.setFromCamera(this.pointer, this.camera);
    const point = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(this.plane, point)) this.moveTo(point.x, point.z);
  }
  resize() {
    if (!this.renderer) return;
    const { width, height } = this.container.getBoundingClientRect(); if (!width || !height) return;
    this.renderer.setSize(width, height); this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
  }
  zoneAt(x) { return this.zones.findIndex(z => x >= z.start && x < z.end); }
  moveTo(x, z) {
    x = THREE.MathUtils.clamp(x, this.zones[0].start + .5, this.zones.at(-1).end - .5);
    const zone = this.zones[Math.max(0, this.zoneAt(x))];
    this.target.set(x, 0, THREE.MathUtils.clamp(z, -zone.depth / 2 + .5, zone.depth / 2 - .5));
    this.marker.position.set(this.target.x, .03, this.target.z); this.marker.visible = true;
  }
  jump(index, notify = true) {
    if (!this.zones[index]) return;
    this.index = index; this.keys.clear(); this.heldMouse = null;
    const zone = this.zones[index];
    this.player.position.set(zone.x - Math.min(12, zone.width / 4), .08, 4);
    const walls = obstacles(this.objects), origin = this.player.position.clone();
    if (!clearAt(origin, walls)) {
      let found = false;
      for (let radius = .5; radius < Math.max(zone.width, zone.depth) && !found; radius += .5) for (let i = 0; i < 32; i++) {
        const point = { x:origin.x + Math.cos(i * Math.PI / 16) * radius, z:origin.z + Math.sin(i * Math.PI / 16) * radius };
        if (point.x > zone.start + .5 && point.x < zone.end - .5 && Math.abs(point.z) < zone.depth / 2 - .5 && clearAt(point, walls)) { this.player.position.x=point.x;this.player.position.z=point.z;found=true;break; }
      }
    }
    this.target.copy(this.player.position); this.cameraFocus.copy(this.player.position);
    this.readingActive = null; this.readingBlend = 0;
    this.arrivalTime = notify && !this.reduced ? 0 : null;
    if (this.arrivalTime !== null) this.player.position.y = 2.83;
    this.player.scale.setScalar(.95);
    this.player.rotation.y = Math.atan2(2.5, 16);
    this.marker.visible = false;

    this.onReading?.(null);
    if (notify) this.onChapter?.(index);
  }
  turnReadingPage(delta) {
    if (!this.readingActive) return;
    const c = this.zones[this.readingActive.chapterIndex].chapter;
    const state = this.readingState(c, this.readingPage + delta);
    this.readingPage = state.page; this.onReading?.(state);
  }
  readingState(chapter, page = 0) {
    const pages = textPages(chapter.floorText?.trim() || chapter.body, chapter.floorPageSize ?? 112);
    page = THREE.MathUtils.clamp(page, 0, pages.length - 1);
    return { page, count: pages.length, text: pages[page], title: chapter.title, settings: chapter };
  }
  updateReading(dt, paused) {
    if (!paused) {
      const candidates = this.objects.filter(o => o.near && this.zones[o.chapterIndex].chapter.floorEnabled !== false && (this.zones[o.chapterIndex].chapter.floorText?.trim() || this.zones[o.chapterIndex].chapter.body?.trim()));
      const nearest = candidates.includes(this.readingActive) ? this.readingActive : candidates.sort((a, b) => this.player.position.distanceToSquared(a.group.position) - this.player.position.distanceToSquared(b.group.position))[0];
      if ((nearest || null) !== this.readingActive) {
        this.readingActive = nearest || null;
        if (nearest) {
          const zone = this.zones[nearest.chapterIndex];
          this.readingPage = 0; this.readingChapter = zone.chapter;
          // Freeze framing geometry on entry so model and limb animation cannot move the camera.
          this.readingModelBounds = new THREE.Box3().setFromObject(nearest.group);
          this.readingPlayerBounds = new THREE.Box3().setFromObject(this.player);
          this.readingPose = sideReadingPose(this.readingModelBounds, this.readingPlayerBounds, this.camera, zone.chapter.floorZoom || 1.1);
          this.readingAspect = this.camera.aspect;
          this.onReading?.(this.readingState(zone.chapter, 0));
        } else this.onReading?.(null);
      }
    }
    this.readingBlend = THREE.MathUtils.lerp(this.readingBlend, this.readingActive ? 1 : 0, this.reduced ? 1 : 1 - Math.exp(-dt * 3));
    if (Math.abs(this.readingBlend - (this.readingActive ? 1 : 0)) < .002) this.readingBlend = this.readingActive ? 1 : 0;
  }
  frame(t) {
    if (this.dead || !this.player || !this.sun) return;
    const dt = Math.min((t - this.last) / 1000, .05); this.last = t;
    const paused = !this.active || !!document.querySelector("dialog[open]") || document.hidden;
    if (paused && this.heldMouse) { this.heldMouse = null; this.target.copy(this.player.position); this.marker.visible = false; }
    let walking = false;
    if (!paused) {
      this.followMouse();
      let dx = 0, dz = 0;
      for (const key of this.keys) {
        if (["a", "ArrowLeft"].includes(key)) dx--;
        if (["d", "ArrowRight"].includes(key)) dx++;
        if (["w", "ArrowUp"].includes(key)) dz--;
        if (["s", "ArrowDown"].includes(key)) dz++;
      }
      if (dx || dz) this.moveTo(this.player.position.x + dx * 1.5, this.player.position.z + dz * 1.5);
      const delta = this.target.clone().sub(this.player.position); delta.y = 0;
      const distance = delta.length();
      if (distance > .07 && this.arrivalTime === null) {
        delta.normalize().multiplyScalar(Math.min(distance, dt * 6));
        const next = slideMove(this.player.position, delta, obstacles(this.objects));
        walking = Math.hypot(next.x-this.player.position.x,next.z-this.player.position.z) > .001;
        this.player.position.x=next.x;this.player.position.z=next.z;
        if(walking) this.player.rotation.y = Math.atan2(delta.x, delta.z);
        const current = this.zones[Math.max(0, this.zoneAt(this.player.position.x))];
        this.player.position.z = THREE.MathUtils.clamp(this.player.position.z, -current.depth / 2 + .5, current.depth / 2 - .5);
      } else this.marker.visible = false;
      this.player.position.y = .08 + (walking && !this.reduced ? Math.abs(Math.sin(t / 90)) * .05 : 0);
      if (this.arrivalTime !== null) {
        this.arrivalTime += dt;
        const a = this.arrivalTime;
        const height = 2.75, gravity = 36, impact = Math.sqrt(2 * height / gravity);
        this.player.rotation.y = Math.atan2(this.camera.position.x - this.player.position.x, this.camera.position.z - this.player.position.z);
        if (a < impact) {
          this.player.position.y = .08 + height - .5 * gravity * a * a;
          const stretch = .1 * (a / impact);
          this.player.scale.set(.95 * (1 - stretch * .4), .95 * (1 + stretch), .95 * (1 - stretch * .4));
        } else if (a < impact + .28) {
          const landing = (a - impact) / .28;
          const squash = .25 * Math.sin(Math.PI * Math.sqrt(landing));
          this.player.position.y = .08;
          this.player.scale.set(.95 * (1 + squash * .5), .95 * (1 - squash), .95 * (1 + squash * .5));
        } else {
          this.arrivalTime = null; this.player.position.y = .08; this.player.scale.setScalar(.95);
        }
      }
      this.legs.forEach((o, j) => o.position.z = o.userData.rest.z + (walking && !this.reduced ? Math.sin(t / 105) * (o.position.x < 0 ? .12 : -.12) : 0));
      this.arms.forEach((o, j) => o.rotation.x = walking && !this.reduced ? Math.sin(t / 105) * (j ? .4 : -.4) : 0);
      const index = Math.max(0, this.zoneAt(this.player.position.x));
      if (index !== this.index) { this.index = index; this.onChapter?.(index); }
    }
    for (const o of this.objects) {
      const near = Math.hypot(this.player.position.x - o.p.x, this.player.position.z - o.p.z) < reactionSize(o.p, this.zones[o.chapterIndex].chapter);
      if (!paused) {
        if (near && !o.near) { o.phase = 0; o.action?.reset().play(); }
        o.near = near;
        if (near) o.phase += dt;
      }
      const animate = o.near && !this.reduced;
      const a = animate ? o.phase : 0;
      o.group.position.y = o.baseY; o.group.rotation.set(0, o.baseRot, 0);
      if (a) {
        if (o.p.animation === "hop") o.group.position.y += Math.abs(Math.sin(a * 4)) * .55;
        if (o.p.animation === "float") o.group.position.y += .3 + Math.sin(a * 2) * .22;
        if (o.p.animation === "spin") o.group.rotation.y += a * 1.8;
        if (o.p.animation === "sway") o.group.rotation.z = Math.sin(a * 3) * .16;
      }
      if (o.action) {
        if (!o.near || this.reduced) { o.action.reset(); o.action.paused = true; o.mixer.update(0); }
        else { o.action.paused = paused || o.p.animation !== "clip"; o.mixer.update(paused ? 0 : dt); }
      }
      o.halo.visible = false;
    }
    this.updateReading(dt, paused);
    const focus = this.player.position.clone(); focus.y = .6;
    const offset = new THREE.Vector3(2.5, 12, 16);
    if (this.readingBlend > .001) {
      if (this.readingAspect !== this.camera.aspect) {
        this.readingPose = sideReadingPose(this.readingModelBounds, this.readingPlayerBounds, this.camera, this.readingChapter?.floorZoom || 1.1);
        this.readingAspect = this.camera.aspect;
      }
      focus.lerp(this.readingPose.focus, this.readingBlend); offset.lerp(this.readingPose.offset, this.readingBlend);
    }
    this.cameraFocus.lerp(focus, this.reduced ? 1 : 1 - Math.exp(-dt * 5));
    this.camera.position.copy(this.cameraFocus).add(offset);
    this.camera.lookAt(this.cameraFocus.x + (1 - this.readingBlend), THREE.MathUtils.lerp(.3, this.cameraFocus.y, this.readingBlend), this.cameraFocus.z - .6 * (1 - this.readingBlend));
    this.scene.fog.near = Math.max(38, offset.length() * 1.1); this.scene.fog.far = this.scene.fog.near + 65;
    this.sun.position.copy(this.player.position).add(new THREE.Vector3(-8, 18, 9)); this.sun.target.position.copy(this.player.position);
    this.renderer.render(this.scene, this.camera);
  }
}
