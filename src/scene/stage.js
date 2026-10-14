import * as THREE from 'three';
import { VALUES } from '../config.js';

/**
 * Sân khấu: nền trời gradient, bãi cỏ, bục tròn có viền 5 màu giá trị,
 * và 5 cột mốc "Vùng Đất" xung quanh.
 *
 * @param {THREE.Scene} scene
 * @returns {{ update: (delta: number, elapsed: number) => void }}
 */
export function setupStage(scene) {
  scene.background = createSkyTexture();
  scene.fog = new THREE.Fog(0xf3e9dc, 14, 34);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(30, 64),
    new THREE.MeshStandardMaterial({ color: 0xcfe6c1, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Bục tròn màu kem (#F6EFE3 trong Design System).
  const PLATFORM_R = 1.5;
  const PLATFORM_H = 0.18;
  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(PLATFORM_R, PLATFORM_R + 0.08, PLATFORM_H, 64),
    new THREE.MeshStandardMaterial({ color: 0xf6efe3, roughness: 0.85 }),
  );
  platform.position.y = PLATFORM_H / 2;
  platform.receiveShadow = true;
  platform.castShadow = true;
  scene.add(platform);

  // Viền 5 màu giá trị quanh mép bục (dải màu nhận diện VA).
  const arc = (Math.PI * 2) / VALUES.length;
  VALUES.forEach((value, i) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(PLATFORM_R + 0.02, 0.05, 10, 40, arc - 0.02),
      new THREE.MeshStandardMaterial({ color: value.color, roughness: 0.5 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.rotation.z = i * arc + Math.PI / 2 - arc / 2;
    ring.position.y = PLATFORM_H;
    scene.add(ring);
  });

  // 5 cột mốc Vùng Đất.
  const beacons = [];
  const BEACON_RADIUS = 4.2;
  VALUES.forEach((value, i) => {
    const angle = Math.PI + (i - 2) * 0.55; // xếp hình vòng cung phía sau nhân vật
    const group = new THREE.Group();
    group.position.set(Math.sin(angle) * BEACON_RADIUS, 0, Math.cos(angle) * BEACON_RADIUS);

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 1.4, 20),
      new THREE.MeshStandardMaterial({ color: 0xf6efe3, roughness: 0.8 }),
    );
    pillar.position.y = 0.7;
    pillar.castShadow = true;
    group.add(pillar);

    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.3, 2),
      new THREE.MeshStandardMaterial({
        color: value.color,
        emissive: value.color,
        emissiveIntensity: 0.25,
        roughness: 0.35,
      }),
    );
    orb.position.y = 1.75;
    orb.castShadow = true;
    group.add(orb);

    scene.add(group);
    beacons.push({ orb, phase: i * 1.3 });
  });

  function update(_delta, elapsed) {
    for (const { orb, phase } of beacons) {
      orb.position.y = 1.75 + Math.sin(elapsed * 1.5 + phase) * 0.08;
      orb.rotation.y = elapsed * 0.6 + phase;
    }
  }

  return { update };
}

function createSkyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#b9cef1');
  g.addColorStop(0.55, '#e6eefb');
  g.addColorStop(1, '#f6efe3');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
