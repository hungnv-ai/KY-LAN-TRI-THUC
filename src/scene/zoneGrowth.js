import * as THREE from 'three';
import { VALUES } from '../config.js';

/**
 * Trang trí "lớn lên" quanh mỗi cột Vùng Đất theo cấp (0–4) — cả trường cùng nhìn thấy công sức chung:
 *   cấp 1: bụi hoa · cấp 2: + pha lê phát sáng · cấp 3: + ngôi sao bay quanh · cấp 4: + cầu vồng 5 màu.
 */

const RING_R = 3.4;
const BUSH_COUNT = 6;
const CRYSTAL_COUNT = 4;
const STAR_COUNT = 3;
const LABEL_SCREEN_HEIGHT = 0.022;
const LEVEL_NAMES = ['', 'Cấp 1 · Nảy mầm', 'Cấp 2 · Toả sáng', 'Cấp 3 · Rực rỡ', 'Cấp 4 · Huyền thoại'];

function levelLabel(text, color) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = 'bold 44px "Be Vietnam Pro", Arial, sans-serif';
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 56;
  canvas.width = w;
  canvas.height = 76;
  ctx.font = font;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(3, 3, w - 6, 70, 35);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, 40);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, sizeAttenuation: false }));
  sprite.scale.set((LABEL_SCREEN_HEIGHT * w) / 76, LABEL_SCREEN_HEIGHT, 1);
  sprite.userData.fade = { near: 16, far: 26, overview: 'show' };
  return sprite;
}

function buildLevel(level, color, outward) {
  const g = new THREE.Group();
  const angles = (n, offset = 0) => Array.from({ length: n }, (_, i) => outward + Math.PI * 0.35 + ((i + offset) / (n - 1 || 1)) * Math.PI * 1.3);
  if (level >= 1) {
    const leaf = new THREE.MeshStandardMaterial({ color: '#5FA557', roughness: 0.9 });
    const petals = [new THREE.MeshStandardMaterial({ color, roughness: 0.5 }), new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.5 })];
    angles(BUSH_COUNT).forEach((a, i) => {
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), leaf);
      bush.position.set(Math.sin(a) * RING_R, 0.32, Math.cos(a) * RING_R);
      bush.scale.set(1, 0.75, 1);
      g.add(bush);
      for (let k = 0; k < 4; k++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), petals[(i + k) % 2]);
        const fa = (k / 4) * Math.PI * 2;
        f.position.set(bush.position.x + Math.sin(fa) * 0.28, 0.55, bush.position.z + Math.cos(fa) * 0.28);
        g.add(f);
      }
    });
  }
  if (level >= 2) {
    const crystal = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.9 });
    angles(CRYSTAL_COUNT, 0.5).forEach((a) => {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), crystal);
      c.position.set(Math.sin(a) * (RING_R + 0.9), 0.55, Math.cos(a) * (RING_R + 0.9));
      c.scale.set(0.7, 1.6, 0.7);
      c.userData.spin = true;
      g.add(c);
    });
  }
  if (level >= 3) {
    const starMat = new THREE.MeshStandardMaterial({ color: '#FFD86B', emissive: '#FFC233', emissiveIntensity: 1.1, roughness: 0.3 });
    for (let i = 0; i < STAR_COUNT; i++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), starMat);
      s.userData.orbit = { phase: (i / STAR_COUNT) * Math.PI * 2 };
      g.add(s);
    }
  }
  if (level >= 4) {
    VALUES.forEach((v, i) => {
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(2.6 - i * 0.16, 0.08, 8, 40, Math.PI),
        new THREE.MeshStandardMaterial({ color: v.color, emissive: v.color, emissiveIntensity: 0.35, roughness: 0.4 }),
      );
      arc.position.set(-Math.sin(outward) * 1.2, 0, -Math.cos(outward) * 1.2);
      arc.rotation.y = outward + Math.PI / 2;
      g.add(arc);
    });
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}

function disposeGroup(g) {
  g.traverse((o) => {
    o.geometry?.dispose();
    if (o.material) {
      o.material.map?.dispose();
      o.material.dispose();
    }
  });
}

/**
 * @param {THREE.Scene} scene
 * @param {{ stations: { id: string, color: string, position: THREE.Vector3 }[] }} island
 * @returns {{ setLevels: (levels: Record<string, number>) => void, update: (delta: number, elapsed: number) => void }}
 */
export function createZoneGrowth(scene, island) {
  const zones = island.stations.map((s) => ({ station: s, level: 0, group: null, label: null }));

  function setLevels(levels) {
    for (const z of zones) {
      const level = Math.max(0, Math.min(4, levels[z.station.id] ?? 0));
      if (level === z.level && z.group) continue;
      if (z.group) {
        scene.remove(z.group);
        disposeGroup(z.group);
        z.group = null;
      }
      z.level = level;
      if (level === 0) continue;
      // Hướng từ cột ra phía ngoài đảo (đặt trang trí phía sau cột, không chắn đường).
      const outward = Math.atan2(z.station.position.x, z.station.position.z);
      z.group = buildLevel(level, z.station.color, outward);
      z.group.position.copy(z.station.position);
      const label = levelLabel(`✦ ${LEVEL_NAMES[level]}`, z.station.color);
      label.position.y = 5.0;
      z.group.add(label);
      scene.add(z.group);
    }
  }

  function update(delta, elapsed) {
    for (const z of zones) {
      if (!z.group) continue;
      z.group.children.forEach((o) => {
        if (o.userData.spin) o.rotation.y = elapsed * 0.8;
        if (o.userData.orbit) {
          const a = elapsed * 1.2 + o.userData.orbit.phase;
          o.position.set(Math.sin(a) * 1.1, 4.0 + Math.sin(elapsed * 2 + a) * 0.25, Math.cos(a) * 1.1);
          o.rotation.y = elapsed * 3;
        }
      });
    }
  }

  return { setLevels, update };
}
