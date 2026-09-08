import * as THREE from "three";
export function textPages(text, limit = 112) {
  const chars = Array.from(text.trim()); const pages = [];
  let start = 0;
  while (start < chars.length) {
    let end = Math.min(start + limit, chars.length);
    if (end < chars.length) {
      for (let i = end - 1; i > start + limit * .55; i--) {
        if (/[.!?。\n]/.test(chars[i])) { end = i + 1; break; }
      }
      if (end === start + limit) for (let i = end - 1; i > start + limit * .65; i--) {
        if (/\s/.test(chars[i])) { end = i + 1; break; }
      }
    }
    pages.push(chars.slice(start, end).join("")); start = end;
  }
  return pages.length ? pages : [""];
}
// Reserve the right half of the viewport for text, fitting both figures on the left.
export function sideReadingPose(model, player, camera, zoom = 1.1) {
  const bounds = (model.isBox3 ? model.clone() : new THREE.Box3().setFromObject(model))
    .union(player.isBox3 ? player : new THREE.Box3().setFromObject(player));
  const size = bounds.getSize(new THREE.Vector3()), focus = bounds.getCenter(new THREE.Vector3());
  const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const distance = Math.max(27, (size.x + 3) / (tangent * camera.aspect * .68), (size.y + size.z + 3) / (tangent * 1.05)) * zoom;
  focus.x += distance * tangent * camera.aspect * .49;
  return { focus, offset: new THREE.Vector3(0, distance * .68, distance * .7332) };
}

export function revealReading(panel) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  panel.querySelectorAll('h2, #floor-accessible').forEach((element, index) => {
    element.getAnimations().forEach(animation => animation.cancel());
    if (!reduced) element.animate([
      { opacity: 0, transform: 'translateY(8px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 440, delay: index * 100, easing: 'ease-out', fill: 'backwards' });
  });
}
