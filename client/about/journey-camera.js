const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

// Eye position stays over the authored centerline. Scroll is the only clock:
// reversing or stopping the scroll reverses or stops the walk exactly.
function pointOnRoute(path, progress) {
  if (progress > 1) {
    const end = path.at(-1).position;
    const tangent = end.clone().sub(path.at(-2).position);
    return end.clone().addScaledVector(tangent, (progress - 1) * (path.length - 1));
  }
  const exact = clamp(progress) * (path.length - 1);
  const index = Math.min(path.length - 2, Math.floor(exact));
  return path[index].position.clone().lerp(path[index + 1].position, exact - index);
}

export function getJourneyCameraPose(progress, aspect, reducedMotion, path, photoCenters) {
  if (reducedMotion) {
    const fit = Math.max(1, (1200 / 1100) / aspect);
    return { position: [0, 3.6 + 5.55 * fit, .2 + 13.4 * fit], target: [0, 3.6, .2], fov: 38, aspect, routeProgress: 0 };
  }
  const p = clamp(progress / .84);
  const step = Math.min(2, Math.floor(p * 3));
  const local = p * 3 - step;
  const route = [[.04, .14, .34], [.34, .44, .68], [.68, .78, .94]][step];
  const leaving = local > .72;
  const t = clamp(leaving ? (local - .72) / .28 : local / .36);
  let routeProgress = leaving
    ? route[1] + (route[2] - route[1]) * t * t * (3 - 2 * t)
    : route[0] + (route[1] - route[0]) * t * t * (3 - 2 * t);
  if (progress > .84) {
    const exit = clamp((progress - .84) / .16);
    routeProgress = .94 + .17 * exit * exit * (3 - 2 * exit);
  }
  const ground = pointOnRoute(path, routeProgress);
  const position = ground.clone();
  position.y += 1.38;
  const target = pointOnRoute(path, routeProgress + .085);
  target.y += .96;
  const fov = Math.max(65, Math.min(104, 2 * Math.atan(Math.tan(Math.PI * 34 / 180) / aspect) * 180 / Math.PI));
  return { position: position.toArray(), target: target.toArray(), ground: ground.toArray(), routeProgress, eyeHeight: 1.38, fov, aspect };
}

export function applyJourneyCamera(camera, progress, aspect, reducedMotion, path, photoCenters) {
  const pose = getJourneyCameraPose(progress, aspect, reducedMotion, path, photoCenters);
  camera.position.fromArray(pose.position);
  camera.up.set(0, 1, 0);
  camera.lookAt(...pose.target);
  camera.fov = pose.fov;
  camera.aspect = pose.aspect;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return pose;
}
