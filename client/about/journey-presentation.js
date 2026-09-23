import * as THREE from 'three';

const smooth = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

export function journeyBeat(progress, index) {
  const t = progress / .84 * 3 - index;
  return {
    approach: smooth((t - .04) / .32) * (1 - smooth((t - .72) / .27)),
    caption: smooth((t - .29) / .10) * (1 - smooth((t - .64) / .08)),
  };
}

// Only the photograph moves. Its projected size stays bounded throughout the walk.
export function createJourneyPresentation(model, camera, stops) {
  const records = stops.map(stop => {
    const card = model.getObjectByName(stop.group);
    const name = stop.photo.replace('Photo_', '');
    const foot = model.getObjectByName(`Card_Foot_${name}`);
    const platform = model.getObjectByName(`Photo_Platform_${name}`);
    foot.visible = platform.visible = false;
    model.getObjectByName(`Stage_Number_${name}`).visible = false;
    const originalUp = new THREE.Vector3(0, 0, -1).applyQuaternion(card.quaternion);
    const frame = model.getObjectByName(stop.frame);
    const photo = model.getObjectByName(stop.photoMesh);
    photo.geometry.computeBoundingBox();
    const photoBox = photo.geometry.boundingBox;
    const border = .04;
    const radius = .065 + border;
    const width = photoBox.max.x - photoBox.min.x + border * 2;
    const height = photoBox.max.z - photoBox.min.z + border * 2;
    const outline = new THREE.Shape();
    // Match the photograph's corner segments, with one equal inset on every edge.
    for (const [cx, cy, start] of [[width / 2 - radius, height / 2 - radius, 0], [-width / 2 + radius, height / 2 - radius, 90], [-width / 2 + radius, -height / 2 + radius, 180], [width / 2 - radius, -height / 2 + radius, 270]]) {
      for (let segment = 0; segment <= 6; segment++) {
        const angle = THREE.MathUtils.degToRad(start + segment * 15);
        const x = cx + radius * Math.cos(angle), y = cy + radius * Math.sin(angle);
        if (segment === 0 && start === 0) outline.moveTo(x, y);
        else outline.lineTo(x, y);
      }
    }
    outline.closePath();
    const geometry = new THREE.ExtrudeGeometry(outline, { depth: .055, bevelEnabled: false, steps: 1 });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, photoBox.min.y - .056, 0);
    frame.geometry.dispose();
    frame.geometry = geometry;
    frame.geometry.computeBoundingBox();
    const box = frame.geometry.boundingBox;
    const corners = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      corners.push(card.worldToLocal(frame.localToWorld(new THREE.Vector3(x, y, z))));
    }
    return {
      card, corners,
      position: card.position.clone(), rotation: card.quaternion.clone(),
      ground: card.position.clone().addScaledVector(originalUp, -1.04),
    };
  });
  const localUpright = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);

  return {
    update(progress, reducedMotion) {
      const compact = window.innerWidth <= 760;
      const photoWidth = compact ? .42 : .28;
      const photoHeight = compact ? .60 : .52;
      const photoCenterX = compact ? .27 : .34;
      const halfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const size = .78;
      const distance = Math.max(1.61 * size / (photoWidth * 2 * halfFov * camera.aspect), 2 * size / (photoHeight * 2 * halfFov));
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      const destination = camera.position.clone().addScaledVector(forward, distance)
        .addScaledVector(right, (photoCenterX * 2 - 1) * distance * halfFov * camera.aspect)
        .addScaledVector(up, .24 * distance * halfFov);
      const landing = destination.clone().addScaledVector(up, -1.04 * size);
      const frontRotation = camera.quaternion.clone().multiply(localUpright);
      records.forEach((record, index) => {
        const amount = reducedMotion ? 0 : journeyBeat(progress, index).approach;
        record.card.quaternion.copy(record.rotation).slerp(frontRotation, amount);
        const base = record.ground.clone().lerp(landing, amount);
        const cardUp = new THREE.Vector3(0, 0, -1).applyQuaternion(record.card.quaternion);
        const fits = scale => {
          const center = base.clone().addScaledVector(cardUp, 1.04 * scale);
          const points = record.corners.map(point => point.clone().multiplyScalar(scale).applyQuaternion(record.card.quaternion).add(center).applyMatrix4(camera.matrixWorldInverse));
          if (points.some(point => point.z >= -camera.near)) return false;
          points.forEach(point => point.applyMatrix4(camera.projectionMatrix));
          const width = (Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x))) / 2;
          const height = (Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y))) / 2;
          return width <= photoWidth && height <= photoHeight;
        };
        let scale = size;
        record.card.visible = reducedMotion || fits(0);
        if (!reducedMotion && record.card.visible && !fits(scale)) {
          let low = 0, high = size;
          for (let iteration = 0; iteration < 9; iteration++) {
            const mid = (low + high) / 2;
            if (fits(mid)) low = mid;
            else high = mid;
          }
          scale = low;
        }
        record.card.scale.setScalar(scale);
        record.card.position.copy(base).addScaledVector(cardUp, 1.04 * scale);
      });
      model.updateMatrixWorld(true);
    },
  };
}
