import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  BEACH_RADIUS,
  BRIDGE,
  GRASS_RADIUS,
  HILLS,
  LANDMARKS,
  STATION_DISTANCE,
  bridgeHeight,
  gapAngle,
  isOnPath,
  polar,
  terrainHeight,
  zoneAngle,
} from './islandLayout.js';

/**
 * Thiên nhiên & điểm nhấn trên đảo (không ảnh hưởng luật chơi): rừng nhiều loại cây, bụi, đá, nấm,
 * cỏ cao, dừa và vỏ sò trên bãi cát; hồ sen, cối xay gió, khu cắm trại, chòi nghỉ, vườn đá, hải đăng.
 * Mỗi loại cây là MỘT InstancedMesh (hình gộp + màu theo đỉnh) → hàng trăm cây vẫn nhẹ trên điện thoại.
 */

/** Số lượng từng loại. */
const COUNTS = { round: 70, pine: 64, blossom: 26, autumn: 26, palm: 30, bush: 90, rock: 46, mushroom: 36, tuft: 520, shell: 60 };
/** Khoảng cách tối thiểu giữa hai thân cây (m). */
const TREE_SPACING = 2.6;
const TREE_COLLIDER = 0.45;

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tô một màu cho cả hình (thuộc tính color theo đỉnh) để gộp nhiều phần thành một hình. */
function paint(geometry, color) {
  const geo = geometry.index ? geometry.toNonIndexed() : geometry;
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.deleteAttribute('uv');
  return geo;
}

function part(geometry, color, x = 0, y = 0, z = 0) {
  geometry.translate(x, y, z);
  return paint(geometry, color);
}

// ── Hình từng loại cây (gốc ở y = 0, cao ~3–5 m) ─────────────────────────

function roundTreeGeometry(leaf, leaf2) {
  return mergeGeometries([
    part(new THREE.CylinderGeometry(0.16, 0.24, 1.7, 7), '#8A6548', 0, 0.85, 0),
    part(new THREE.IcosahedronGeometry(1.05, 1), leaf, 0, 2.5, 0),
    part(new THREE.IcosahedronGeometry(0.7, 1), leaf2, 0.55, 3.1, 0.2),
    part(new THREE.IcosahedronGeometry(0.62, 1), leaf2, -0.5, 2.95, -0.3),
  ]);
}

function pineGeometry() {
  return mergeGeometries([
    part(new THREE.CylinderGeometry(0.13, 0.2, 1.2, 6), '#6E4F38', 0, 0.6, 0),
    part(new THREE.ConeGeometry(1.25, 1.7, 8), '#3E8E5A', 0, 1.8, 0),
    part(new THREE.ConeGeometry(0.98, 1.5, 8), '#4A9C63', 0, 2.75, 0),
    part(new THREE.ConeGeometry(0.66, 1.3, 8), '#58AB6E', 0, 3.6, 0),
  ]);
}

function palmGeometry() {
  const parts = [];
  // Thân cong nhẹ: 4 đốt nghiêng dần.
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.CylinderGeometry(0.13 - i * 0.012, 0.16 - i * 0.012, 1.05, 6);
    seg.rotateZ(-0.06 - i * 0.05);
    parts.push(part(seg, i % 2 ? '#A98562' : '#9A7653', 0.05 * i * i, 0.5 + i * 0.98, 0));
  }
  // Tán: 7 tàu lá rủ xuống.
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.ConeGeometry(0.34, 2.2, 4);
    leaf.scale(1, 1, 0.22);
    leaf.rotateZ(Math.PI / 2 + 0.45);
    leaf.translate(1.0, -0.2, 0);
    leaf.rotateY((i / 7) * Math.PI * 2);
    parts.push(part(leaf, i % 2 ? '#4FA65B' : '#63B768', 0.45, 4.05, 0));
  }
  for (let i = 0; i < 3; i++) {
    parts.push(part(new THREE.SphereGeometry(0.16, 6, 5), '#7A5A3A', 0.45 + Math.cos(i * 2.1) * 0.2, 3.85, Math.sin(i * 2.1) * 0.2));
  }
  return mergeGeometries(parts);
}

function bushGeometry() {
  return mergeGeometries([
    part(new THREE.IcosahedronGeometry(0.55, 0), '#5FA65C', 0, 0.4, 0),
    part(new THREE.IcosahedronGeometry(0.4, 0), '#74B96A', 0.42, 0.32, 0.1),
    part(new THREE.IcosahedronGeometry(0.36, 0), '#6DB466', -0.35, 0.3, -0.2),
  ]);
}

function mushroomGeometry() {
  const cap = new THREE.SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  return mergeGeometries([part(new THREE.CylinderGeometry(0.06, 0.08, 0.22, 6), '#FFF4E0', 0, 0.11, 0), part(cap, '#E0463A', 0, 0.2, 0)]);
}

function tuftGeometry() {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.ConeGeometry(0.05, 0.42 + (i % 3) * 0.1, 3);
    blade.rotateZ((i - 2) * 0.22);
    parts.push(part(blade, i % 2 ? '#79C36A' : '#5FAE58', (i - 2) * 0.07, 0.2, (i % 2) * 0.06));
  }
  return mergeGeometries(parts);
}

/**
 * @param {THREE.Scene} scene
 * @param {{ addCollider: (x: number, z: number, r: number) => void, isFree: (x: number, z: number, margin?: number) => boolean }} island
 * @returns {{ update: (delta: number, elapsed: number) => void, setNight: (k: number) => void, setDetail: (fine: boolean) => void }}
 */
export function createNature(scene, island) {
  const rng = mulberry32(4242);
  const root = new THREE.Group();
  root.name = 'nature';
  scene.add(root);
  const animated = [];
  const std = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const shadow = (o) => {
    o.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return o;
  };

  // Điểm nhấn dựng trước để cây không mọc đè lên.
  const landmarks = buildLandmarks();
  for (const lm of Object.values(LANDMARKS)) island.addCollider(lm.x, lm.z, lm.r);

  // Đỉnh Đồi Ngắm Cảnh & Đồi Cổ Thụ để trống (không mọc cây rải rác).
  const clearings = [...Object.values(LANDMARKS), ...HILLS.filter((hl) => hl.id !== 'cape').map((hl) => ({ x: hl.x, z: hl.z, r: 3 }))];
  const nearLandmark = (x, z, margin) => clearings.some((lm) => Math.hypot(x - lm.x, z - lm.z) < lm.r + margin);

  /** Rải `count` vật theo luật `pick` (trả về {x, z} hoặc null) → InstancedMesh. */
  function scatter(geometry, count, { pick, scale = [0.8, 1.3], collider = 0, tints = ['#ffffff'], cast = true, spacing = 0, y = 0 }) {
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const color = new THREE.Color();
    const placed = [];
    let n = 0;
    for (let attempt = 0; attempt < count * 30 && n < count; attempt++) {
      const p = pick();
      if (!p) continue;
      if (spacing && placed.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < spacing)) continue;
      if (collider && !island.isFree(p.x, p.z, collider + 0.4)) continue;
      const s = scale[0] + rng() * (scale[1] - scale[0]);
      q.setFromAxisAngle(up, rng() * Math.PI * 2);
      m.compose(new THREE.Vector3(p.x, y + terrainHeight(p.x, p.z) - 0.04, p.z), q, new THREE.Vector3(s, s * (0.9 + rng() * 0.25), s));
      mesh.setMatrixAt(n, m);
      mesh.setColorAt(n, color.set(tints[Math.floor(rng() * tints.length)]));
      if (collider) island.addCollider(p.x, p.z, collider * s);
      placed.push(p);
      n++;
    }
    mesh.count = n;
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  }

  /** Điểm ngẫu nhiên trên cỏ, tránh đường đi, quảng trường, điểm nhấn. */
  function onGrass(minR, maxR, pathMargin = 1.2) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(minR * minR + rng() * (maxR * maxR - minR * minR));
    const p = polar(a, r);
    if (isOnPath(p.x, p.z, pathMargin) || nearLandmark(p.x, p.z, 2.5)) return null;
    return p;
  }

  /** Điểm trong một "cánh rừng": quanh tâm (góc, bán kính) với độ toả cho trước. */
  function inGrove(angle, radius, spread) {
    const p = polar(angle + (rng() - 0.5) * spread, radius + (rng() - 0.5) * 16);
    const r = Math.hypot(p.x, p.z);
    if (r < 9 || r > GRASS_RADIUS - 1.5 || isOnPath(p.x, p.z, 1.4) || nearLandmark(p.x, p.z, 3)) return null;
    return p;
  }

  const tree = { collider: TREE_COLLIDER, spacing: TREE_SPACING };
  // Cây tán tròn: rải khắp đảo, dày hơn ở vành ngoài.
  scatter(roundTreeGeometry('#6BAF63', '#7CC06F'), COUNTS.round, { ...tree, pick: () => onGrass(11, GRASS_RADIUS - 2), scale: [0.85, 1.5], tints: ['#ffffff', '#eaffdf', '#d9f2c6', '#f6ffd9'] });
  // Rừng thông: sau núi Bản Lĩnh và quanh khu cắm trại.
  scatter(pineGeometry(), COUNTS.pine, {
    ...tree,
    pick: () => (rng() < 0.55 ? inGrove(gapAngle(2), 36, 0.7) : inGrove(zoneAngle(1), STATION_DISTANCE + 16, 0.6)),
    scale: [0.9, 1.7],
    tints: ['#ffffff', '#e2f5e6', '#d0ecd8'],
  });
  // Cây hoa anh đào quanh Vùng Đất Nhân Ái & chòi nghỉ.
  scatter(roundTreeGeometry('#F6A6C4', '#FFC4D8'), COUNTS.blossom, { ...tree, pick: () => (rng() < 0.5 ? inGrove(zoneAngle(0), STATION_DISTANCE + 6, 0.55) : inGrove(gapAngle(3), 30, 0.5)), scale: [0.8, 1.25], tints: ['#ffffff', '#ffeef4', '#fff6e8'] });
  // Cây lá vàng cam quanh Vùng Đất Trách Nhiệm & cối xay gió.
  scatter(roundTreeGeometry('#F0A848', '#F6C35F'), COUNTS.autumn, { ...tree, pick: () => (rng() < 0.5 ? inGrove(zoneAngle(3), STATION_DISTANCE + 6, 0.55) : inGrove(gapAngle(1), 32, 0.5)), scale: [0.8, 1.3], tints: ['#ffffff', '#ffe9d2', '#fff3c9'] });
  // Dừa trên bãi cát.
  scatter(palmGeometry(), COUNTS.palm, {
    collider: 0.35,
    spacing: 5,
    pick: () => {
      const p = polar(rng() * Math.PI * 2, GRASS_RADIUS + 0.5 + rng() * 3.2);
      return nearLandmark(p.x, p.z, 3) ? null : p;
    },
    scale: [0.85, 1.25],
    tints: ['#ffffff', '#f1ffe4'],
  });
  scatter(bushGeometry(), COUNTS.bush, { pick: () => onGrass(7, GRASS_RADIUS - 1), scale: [0.7, 1.5], collider: 0.4, tints: ['#ffffff', '#e4f7d8', '#f3ffd0', '#ffe9ef'] });
  scatter(part(new THREE.DodecahedronGeometry(0.5, 0), '#A8A29A', 0, 0.25, 0), COUNTS.rock, { pick: () => onGrass(9, GRASS_RADIUS + 4), scale: [0.5, 1.7], collider: 0.4, tints: ['#ffffff', '#e8e0d6', '#d6d2cc', '#f1e6d2'] });
  const fine = [];
  // Chi tiết nhỏ (nấm, cỏ cao, vỏ sò): ẩn khi máy yếu — xem setDetail.
  fine.push(scatter(mushroomGeometry(), COUNTS.mushroom, { pick: () => inGrove(gapAngle(2), 34, 0.9), scale: [0.7, 1.6], cast: false, tints: ['#ffffff', '#ffd9a8', '#f2c4ff'] }));
  fine.push(scatter(tuftGeometry(), COUNTS.tuft, { pick: () => onGrass(5, GRASS_RADIUS - 0.5, 0.3), scale: [0.8, 1.9], cast: false, tints: ['#ffffff', '#e7ffd6', '#fff8c8'] }));
  // Vỏ sò, sao biển trên cát.
  fine.push(scatter(part(new THREE.SphereGeometry(0.16, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#FFE9DA', 0, 0, 0), COUNTS.shell, {
    pick: () => polar(rng() * Math.PI * 2, GRASS_RADIUS + 1 + rng() * (BEACH_RADIUS - GRASS_RADIUS - 2)),
    scale: [0.6, 1.5],
    cast: false,
    tints: ['#ffffff', '#ffc9b8', '#ffd98a', '#f6b6d0', '#cfe9ff'],
  }));

  // ── Điểm nhấn ───────────────────────────────────────────────────────
  function buildLandmarks() {
    const out = {};

    // Hồ sen: mặt nước, bờ đá, lá sen & hoa, cầu tàu gỗ nhỏ.
    {
      const { x, z, r } = LANDMARKS.lake;
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const water = new THREE.Mesh(new THREE.CircleGeometry(r - 0.4, 56), std('#5FB6E0', 0.15, { metalness: 0.2, transparent: true, opacity: 0.92 }));
      water.rotation.x = -Math.PI / 2;
      water.position.y = 0.02;
      water.name = 'lake';
      g.add(water);
      const shore = new THREE.Mesh(new THREE.RingGeometry(r - 0.6, r + 0.3, 56), std('#E9D7A8', 1));
      shore.rotation.x = -Math.PI / 2;
      shore.position.y = 0.012;
      g.add(shore);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + rng() * 0.2;
        const s = 0.3 + rng() * 0.35;
        const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), std(i % 2 ? '#B9B1A6' : '#9D968C', 0.95));
        stone.position.set(Math.sin(a) * (r - 0.1), s * 0.4, Math.cos(a) * (r - 0.1));
        stone.rotation.set(rng(), rng(), rng());
        g.add(stone);
      }
      const padMat = std('#4FA860', 0.7, { side: THREE.DoubleSide });
      for (let i = 0; i < 14; i++) {
        const a = rng() * Math.PI * 2;
        const d = 1 + rng() * (r - 2.6);
        const pad = new THREE.Mesh(new THREE.CircleGeometry(0.42 + rng() * 0.25, 14, 0.3, Math.PI * 2 - 0.6), padMat);
        pad.rotation.x = -Math.PI / 2;
        pad.rotation.z = rng() * 6;
        pad.position.set(Math.sin(a) * d, 0.035, Math.cos(a) * d);
        g.add(pad);
        if (i % 3 === 0) {
          const lotus = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 7), std(i % 2 ? '#FF9EC0' : '#FFFFFF', 0.5));
          lotus.rotation.x = Math.PI;
          lotus.position.set(pad.position.x, 0.2, pad.position.z);
          g.add(lotus);
        }
      }
      root.add(shadow(g));
      animated.push((t) => (water.material.opacity = 0.9 + Math.sin(t * 1.3) * 0.04));
    }

    // Cối xay gió.
    {
      const { x, z } = LANDMARKS.windmill;
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = Math.atan2(-x, -z);
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.7, 5.2, 10), std('#F6EFE3', 0.85));
      tower.position.y = 2.6;
      g.add(tower);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.35, 1.5, 10), std('#9A0036', 0.7));
      roof.position.y = 5.95;
      g.add(roof);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.1), std('#725139', 0.8));
      door.position.set(0, 0.7, 1.62);
      g.add(door);
      const hub = new THREE.Group();
      hub.position.set(0, 4.6, 1.25);
      for (let i = 0; i < 4; i++) {
        const blade = new THREE.Group();
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.0, 0.08), std('#725139'));
        arm.position.y = 1.5;
        blade.add(arm);
        const sail = new THREE.Mesh(new THREE.BoxGeometry(0.75, 2.2, 0.04), std('#FFF8E6', 0.7));
        sail.position.set(0.42, 1.8, 0);
        blade.add(sail);
        blade.rotation.z = (i * Math.PI) / 2;
        hub.add(blade);
      }
      hub.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), std('#C49C57', 0.4, { metalness: 0.5 })));
      g.add(hub);
      root.add(shadow(g));
      animated.push((t) => (hub.rotation.z = t * 0.6));
      // Luống hoa nhiều màu quanh cối xay.
      const colors = ['#FF7FA8', '#FFD54F', '#B39DDB', '#FFFFFF', '#FF8A65'];
      const bloom = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 7, 5), new THREE.MeshStandardMaterial({ roughness: 0.6 }), 150);
      const m = new THREE.Matrix4();
      const c = new THREE.Color();
      for (let i = 0; i < 150; i++) {
        const row = i % 5;
        const a = Math.atan2(x, z) + ((Math.floor(i / 5) - 15) / 15) * 0.42;
        const p = polar(a, 26.5 + row * 1.1);
        m.makeScale(1, 0.8, 1).setPosition(p.x, 0.22, p.z);
        bloom.setMatrixAt(i, m);
        bloom.setColorAt(i, c.set(colors[row]));
      }
      root.add(bloom);
    }

    // Khu cắm trại: lửa trại (sáng ban đêm), lều, khúc gỗ ngồi.
    {
      const { x, z } = LANDMARKS.camp;
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      for (let i = 0; i < 8; i++) {
        const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), std('#8E8980', 0.95));
        stone.position.set(Math.sin((i / 8) * 6.283) * 0.75, 0.12, Math.cos((i / 8) * 6.283) * 0.75);
        g.add(stone);
      }
      for (let i = 0; i < 3; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.0, 6), std('#6E4F38'));
        log.rotation.set(Math.PI / 2 - 0.5, (i * Math.PI * 2) / 3, 0);
        log.position.y = 0.25;
        g.add(log);
      }
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 7), new THREE.MeshBasicMaterial({ color: '#FF9A3C', transparent: true, opacity: 0.9 }));
      flame.position.y = 0.7;
      g.add(flame);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.55, 6), new THREE.MeshBasicMaterial({ color: '#FFE27A' }));
      inner.position.y = 0.6;
      g.add(inner);
      const fireLight = new THREE.PointLight('#ff9a4a', 0, 14, 1.6);
      fireLight.position.y = 1;
      g.add(fireLight);
      out.fireLight = fireLight;
      animated.push((t) => {
        const k = 1 + Math.sin(t * 11) * 0.12 + Math.sin(t * 17.3) * 0.08;
        flame.scale.set(k, 1 + Math.sin(t * 9) * 0.18, k);
        inner.scale.y = 1 + Math.sin(t * 13) * 0.2;
      });
      for (const [a, color] of [[0.6, '#1750B5'], [2.5, '#009082'], [4.5, '#C49C57']]) {
        const tent = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.9, 4), std(color, 0.8));
        tent.position.set(Math.sin(a) * 4.2, 0.95, Math.cos(a) * 4.2);
        tent.rotation.y = a + Math.PI / 4;
        g.add(tent);
        island.addCollider(x + Math.sin(a) * 4.2, z + Math.cos(a) * 4.2, 1.2);
        const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.5, 8), std('#8A6548'));
        seat.rotation.z = Math.PI / 2;
        seat.rotation.y = a + 1.2;
        seat.position.set(Math.sin(a + 1) * 2.1, 0.22, Math.cos(a + 1) * 2.1);
        g.add(seat);
      }
      root.add(shadow(g));
      flame.castShadow = false;
      inner.castShadow = false;
    }

    // Chòi nghỉ mái đỏ giữa vườn hoa anh đào.
    {
      const { x, z } = LANDMARKS.gazebo;
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const floor = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.5, 0.25, 8), std('#EADCC0', 0.9));
      floor.position.y = 0.125;
      g.add(floor);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.5, 8), std('#9A0036', 0.6));
        post.position.set(Math.sin(a) * 1.9, 1.5, Math.cos(a) * 1.9);
        g.add(post);
      }
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.0, 1.5, 6), std('#B3122A', 0.6));
      roof.position.y = 3.5;
      roof.rotation.y = Math.PI / 6;
      g.add(roof);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), std('#E6B04C', 0.3, { metalness: 0.6 }));
      tip.position.y = 4.35;
      g.add(tip);
      root.add(shadow(g));
    }

    // Vườn đá & tre.
    {
      const { x, z } = LANDMARKS.rockGarden;
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      for (const [dx, dz, s] of [[0, 0, 1.5], [1.6, 0.6, 0.9], [-1.4, 0.9, 1.0], [0.4, -1.6, 0.7]]) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), std('#8F8A84', 0.95));
        rock.position.set(dx, s * 0.55, dz);
        rock.rotation.set(dx, dz, s);
        rock.scale.y = 1.25;
        g.add(rock);
      }
      const bamboo = std('#6FAF4E', 0.6);
      for (let i = 0; i < 22; i++) {
        const a = rng() * Math.PI * 2;
        const d = 3.2 + rng() * 2.4;
        const h = 3.5 + rng() * 2.5;
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, h, 5), bamboo);
        stalk.position.set(Math.sin(a) * d, h / 2, Math.cos(a) * d);
        stalk.rotation.z = (rng() - 0.5) * 0.12;
        g.add(stalk);
        const leaves = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 5), std('#8CCB63', 0.8));
        leaves.position.set(stalk.position.x, h - 0.3, stalk.position.z);
        g.add(leaves);
      }
      root.add(shadow(g));
    }

    // Hải đăng sọc đỏ trắng trên mũi cát — đèn quay vào ban đêm.
    {
      const { x, z } = LANDMARKS.lighthouse;
      const g = new THREE.Group();
      g.position.set(x, terrainHeight(x, z) - 0.1, z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.2, 0.6, 16), std('#BDB5A8', 0.95));
      base.position.y = 0.3;
      g.add(base);
      for (let i = 0; i < 5; i++) {
        const r0 = 1.35 - i * 0.13;
        const band = new THREE.Mesh(new THREE.CylinderGeometry(r0 - 0.13, r0, 1.7, 16), std(i % 2 ? '#FFFFFF' : '#C62828', 0.7));
        band.position.y = 0.6 + 0.85 + i * 1.7;
        g.add(band);
      }
      const deck = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.15, 16), std('#3A3A3A', 0.6));
      deck.position.y = 9.2;
      g.add(deck);
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.9, 12), new THREE.MeshStandardMaterial({ color: '#FFF3B0', emissive: '#FFD766', emissiveIntensity: 0.3, roughness: 0.3 }));
      lamp.position.y = 9.75;
      g.add(lamp);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.9, 12), std('#C62828', 0.6));
      cap.position.y = 10.65;
      g.add(cap);
      const beam = new THREE.Mesh(
        new THREE.ConeGeometry(2.6, 26, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: '#FFF1A8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
      );
      beam.geometry.rotateX(Math.PI / 2);
      beam.geometry.translate(0, 0, -13);
      const beamPivot = new THREE.Group();
      beamPivot.position.y = 9.75;
      beamPivot.add(beam);
      g.add(beamPivot);
      root.add(shadow(g));
      beam.castShadow = false;
      out.lamp = lamp;
      out.beam = beam;
      animated.push((t) => (beamPivot.rotation.y = t * 0.5));
    }

    // Bãi biển: dù, khăn tắm, thuyền gỗ úp trên cát.
    for (let i = 0; i < 5; i++) {
      const a = zoneAngle(i) + (i % 2 ? 0.16 : -0.14);
      const p = polar(a, GRASS_RADIUS + 3.4);
      const g = new THREE.Group();
      g.position.set(p.x, 0, p.z);
      g.rotation.y = a;
      const color = ['#E0463A', '#1750B5', '#F2B33D', '#009082', '#C2185B'][i];
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6), std('#F6EFE3'));
      pole.position.y = 1.15;
      pole.rotation.z = 0.12;
      g.add(pole);
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.55, 10), std(color, 0.7));
      canopy.position.set(-0.14, 2.35, 0);
      canopy.rotation.z = 0.12;
      g.add(canopy);
      const towel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 1.9), std(i % 2 ? '#FFFFFF' : '#FFE08A', 0.9));
      towel.position.set(0.9, 0.02, 0.2);
      g.add(towel);
      root.add(shadow(g));
      island.addCollider(p.x, p.z, 0.3);
    }
    buildBridge();
    buildHillDecor();
    return out;
  }

  /** Cầu gỗ cong bắc qua hồ sen (độ cao mặt cầu theo bridgeHeight → đi lên được). */
  function buildBridge() {
    const g = new THREE.Group();
    g.position.set(BRIDGE.x, 0, BRIDGE.z);
    g.rotation.y = Math.atan2(BRIDGE.dirX, BRIDGE.dirZ);
    const plank = std('#B5895C', 0.85);
    const plankDark = std('#9C7349', 0.85);
    const rail = std('#9A0036', 0.6);
    const PLANKS = 26;
    for (let i = 0; i <= PLANKS; i++) {
      const along = -BRIDGE.half + (i / PLANKS) * BRIDGE.half * 2;
      const y = bridgeHeight(BRIDGE.x + BRIDGE.dirX * along, BRIDGE.z + BRIDGE.dirZ * along);
      const slope = -Math.sin((along / BRIDGE.half) * (Math.PI / 2)) * BRIDGE.height * (Math.PI / 2) / BRIDGE.half;
      const p = new THREE.Mesh(new THREE.BoxGeometry(BRIDGE.halfWidth * 2, 0.1, (BRIDGE.half * 2) / PLANKS + 0.02), i % 2 ? plank : plankDark);
      p.position.set(0, y - 0.05, along);
      p.rotation.x = -Math.atan(slope);
      g.add(p);
      if (i % 3 === 0) {
        for (const s of [-1, 1]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 6), rail);
          post.position.set(s * (BRIDGE.halfWidth - 0.05), y + 0.32, along);
          g.add(post);
          if (y < 0.5) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, y + 0.3, 6), plankDark);
            leg.position.set(s * (BRIDGE.halfWidth - 0.1), (y - 0.3) / 2, along);
            g.add(leg);
          }
        }
      }
    }
    // Tay vịn cong hai bên.
    for (const s of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 20; i++) {
        const along = -BRIDGE.half + (i / 20) * BRIDGE.half * 2;
        pts.push(new THREE.Vector3(s * (BRIDGE.halfWidth - 0.05), bridgeHeight(BRIDGE.x + BRIDGE.dirX * along, BRIDGE.z + BRIDGE.dirZ * along) + 0.7, along));
      }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.045, 6), rail));
    }
    root.add(shadow(g));
  }

  /** Đồi Ngắm Cảnh (cờ VA, ghế, kính viễn vọng) & Đồi Cổ Thụ (cây đa lớn). */
  function buildHillDecor() {
    const view = HILLS.find((hl) => hl.id === 'viewpoint');
    const top = terrainHeight(view.x, view.z);
    const g = new THREE.Group();
    g.position.set(view.x, top - 0.05, view.z);
    g.rotation.y = Math.atan2(view.x, view.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 8), std('#E8E1D3', 0.5, { metalness: 0.3 }));
    pole.position.set(-1.3, 2.1, 0);
    g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.95, 8, 1), std('#9A0036', 0.7, { side: THREE.DoubleSide }));
    flag.position.set(-0.52, 3.6, 0);
    g.add(flag);
    const flagPos = flag.geometry.attributes.position;
    const flagBase = Float32Array.from(flagPos.array);
    animated.push((t) => {
      for (let i = 0; i < flagPos.count; i++) {
        const fx = flagBase[i * 3] + 0.75;
        flagPos.setZ(i, Math.sin(fx * 3 - t * 4) * 0.12 * fx);
      }
      flagPos.needsUpdate = true;
    });
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.45), std('#A57C52'));
    seat.position.y = 0.45;
    bench.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.06), std('#A57C52'));
    back.position.set(0, 0.75, -0.2);
    bench.add(back);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.4), std('#6E4F38'));
      leg.position.set(s * 0.7, 0.22, 0);
      bench.add(leg);
    }
    bench.position.set(1.0, 0, -0.4);
    g.add(bench);
    const scope = new THREE.Group();
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.1, 6), std('#3A3A3A', 0.5));
    stand.position.y = 0.55;
    scope.add(stand);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.55, 10), std('#C49C57', 0.35, { metalness: 0.6 }));
    tube.rotation.x = Math.PI / 2 - 0.2;
    tube.position.y = 1.15;
    scope.add(tube);
    scope.position.set(0.1, 0, 1.0);
    g.add(scope);
    root.add(shadow(g));

    const big = HILLS.find((hl) => hl.id === 'bigTree');
    const tree = new THREE.Mesh(roundTreeGeometry('#4F9A52', '#64AE5E'), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    tree.scale.setScalar(2.6);
    tree.position.set(big.x, terrainHeight(big.x, big.z) - 0.1, big.z);
    root.add(shadow(tree));
    island.addCollider(big.x, big.z, 0.9);
    // Xích đu dưới gốc cổ thụ.
    const swing = new THREE.Group();
    swing.position.set(big.x + 1.6, terrainHeight(big.x + 1.6, big.z), big.z);
    const ropeMat = std('#E9D8B4', 0.9);
    for (const s of [-1, 1]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.6, 4), ropeMat);
      rope.position.set(s * 0.35, 2.0, 0);
      swing.add(rope);
    }
    const swingSeat = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.06, 0.32), std('#9A0036', 0.7));
    swingSeat.position.y = 0.7;
    swing.add(swingSeat);
    root.add(shadow(swing));
    animated.push((t) => (swing.rotation.x = Math.sin(t * 1.4) * 0.12));
  }

  /** @param {number} k 0 = ngày, 1 = đêm — bật lửa trại & đèn hải đăng. */
  function setNight(k) {
    landmarks.fireLight.intensity = 6 + k * 26;
    landmarks.lamp.material.emissiveIntensity = 0.3 + k * 2.2;
    landmarks.beam.material.opacity = k * 0.22;
  }
  setNight(0);

  function update(_delta, elapsed) {
    for (const fn of animated) fn(elapsed);
  }

  /** @param {boolean} on hiện chi tiết nhỏ (tắt khi máy yếu để giữ mượt). */
  function setDetail(on) {
    for (const mesh of fine) mesh.visible = on;
  }

  return { update, setNight, setDetail };
}
