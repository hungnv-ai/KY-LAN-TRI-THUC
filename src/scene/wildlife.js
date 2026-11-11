import * as THREE from 'three';
import { BEACH_RADIUS, GRASS_RADIUS, LANDMARKS, gapAngle, isOnPath, polar } from './islandLayout.js';

/**
 * Động vật trên đảo (chỉ để ngắm, không ảnh hưởng luật chơi): bướm bay lượn, thỏ nhảy và chạy trốn
 * khi Kỳ lân tới gần, vịt bơi trong hồ sen, cua bò ngang trên bãi cát, hươu sao gặm cỏ trong rừng.
 */

const BUTTERFLY_COUNT = 46;
const RABBIT_COUNT = 12;
const DUCK_COUNT = 6;
const CRAB_COUNT = 10;
const DEER_COUNT = 4;
/** Thỏ / hươu bỏ chạy khi Kỳ lân ở gần hơn (m). */
const FLEE_DISTANCE = 6;
const RABBIT_SPEED = 2.2;
const RABBIT_FLEE_SPEED = 6.5;
const DEER_SPEED = 1.1;
const DEER_FLEE_SPEED = 7;
/** Động vật xa Kỳ lân hơn mức này (m) thì chỉ cập nhật vị trí thưa (tiết kiệm máy). */
const ACTIVE_DISTANCE = 60;
const BUTTERFLY_COLORS = ['#FFB74D', '#F06292', '#64B5F6', '#FFF176', '#BA68C8', '#FFFFFF', '#4DD0E1'];

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

const std = (color, roughness = 0.8) => new THREE.MeshStandardMaterial({ color, roughness });

function buildRabbit(color) {
  const g = new THREE.Group();
  const fur = std(color, 0.9);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), fur);
  body.scale.set(0.85, 0.85, 1.2);
  body.position.y = 0.2;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), fur);
  head.position.set(0, 0.36, 0.2);
  g.add(head);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.16, 3, 6), fur);
    ear.position.set(0.06 * s, 0.55, 0.16);
    ear.rotation.z = -0.15 * s;
    g.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), std('#1c1412', 0.3));
    eye.position.set(0.08 * s, 0.39, 0.31);
    g.add(eye);
  }
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), std('#FFFFFF', 0.9));
  tail.position.set(0, 0.22, -0.24);
  g.add(tail);
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}

function buildDuck(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), std(color, 0.7));
  body.scale.set(0.85, 0.7, 1.25);
  body.position.y = 0.12;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), std(color, 0.7));
  head.position.set(0, 0.36, 0.2);
  g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), std('#FF9B2F', 0.5));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.34, 0.36);
  g.add(beak);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 5), std(color, 0.7));
  tail.rotation.x = -Math.PI / 2 - 0.5;
  tail.position.set(0, 0.22, -0.3);
  g.add(tail);
  return g;
}

function buildCrab() {
  const g = new THREE.Group();
  const shell = std('#E4572E', 0.6);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), shell);
  body.scale.set(1.3, 0.55, 1);
  body.position.y = 0.12;
  g.add(body);
  for (const s of [-1, 1]) {
    const claw = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), shell);
    claw.position.set(0.22 * s, 0.16, 0.14);
    g.add(claw);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), std('#1c1412', 0.3));
    eye.position.set(0.06 * s, 0.25, 0.1);
    g.add(eye);
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 4), shell);
      leg.rotation.z = 1.0 * s;
      leg.position.set(0.22 * s, 0.07, -0.08 + i * 0.07);
      g.add(leg);
    }
  }
  return g;
}

function buildDeer() {
  const g = new THREE.Group();
  const fur = std('#C68B59', 0.9);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.75, 4, 10), fur);
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.95;
  g.add(body);
  const legs = [];
  for (const [x, z] of [[-0.17, 0.38], [0.17, 0.38], [-0.17, -0.38], [0.17, -0.38]]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.75, z);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.75, 6), fur);
    leg.position.y = -0.375;
    hip.add(leg);
    g.add(hip);
    legs.push(hip);
  }
  const neck = new THREE.Group();
  neck.position.set(0, 1.1, 0.55);
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.6, 8), fur);
  neckMesh.position.y = 0.26;
  neck.add(neckMesh);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), fur);
  head.scale.set(0.85, 0.9, 1.3);
  head.position.set(0, 0.62, 0.1);
  neck.add(head);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), std('#2b1a12', 0.4));
  nose.position.set(0, 0.6, 0.32);
  neck.add(nose);
  for (const s of [-1, 1]) {
    const antler = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.4, 5), std('#E9D8B4', 0.6));
    antler.position.set(0.08 * s, 0.9, 0.04);
    antler.rotation.z = -0.4 * s;
    neck.add(antler);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 5), fur);
    ear.position.set(0.16 * s, 0.72, 0.02);
    ear.rotation.z = -1.1 * s;
    neck.add(ear);
  }
  neck.rotation.x = 0.35;
  g.add(neck);
  // Đốm trắng của hươu sao.
  const spot = std('#FFF3DC', 0.9);
  for (let i = 0; i < 8; i++) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), spot);
    const a = (i % 2 ? 1 : -1) * (0.5 + (i % 3) * 0.3);
    dot.position.set(Math.sin(a) * 0.3, 0.95 + Math.cos(a) * 0.3, -0.35 + (i / 8) * 0.75);
    g.add(dot);
  }
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), spot);
  tail.position.set(0, 1.05, -0.68);
  g.add(tail);
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return { group: g, legs, neck };
}

/**
 * @param {THREE.Scene} scene
 * @param {{ isFree: (x: number, z: number, margin?: number) => boolean }} island
 * @returns {{ update: (delta: number, elapsed: number, player: THREE.Vector3) => void }}
 */
export function createWildlife(scene, island) {
  const rng = mulberry32(777);
  const root = new THREE.Group();
  root.name = 'wildlife';
  scene.add(root);

  /** Chỗ trống trên cỏ trong khoảng bán kính cho trước. */
  function grassSpot(minR, maxR) {
    for (let i = 0; i < 40; i++) {
      const p = polar(rng() * Math.PI * 2, minR + rng() * (maxR - minR));
      if (!isOnPath(p.x, p.z, 1) && island.isFree(p.x, p.z, 1)) return p;
    }
    return polar(rng() * 6.28, minR);
  }

  // ── Bướm: mỗi con 2 cánh tam giác, vỗ bằng cách co giãn theo trục ngang ──
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0.16, 0, 0.1, 0.14, 0, -0.1, 0, 0, 0, -0.16, 0, 0.1, -0.14, 0, -0.1]), 3),
  );
  wingGeo.computeVertexNormals();
  const butterflies = new THREE.InstancedMesh(wingGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), BUTTERFLY_COUNT);
  butterflies.frustumCulled = false;
  const flies = [];
  const tint = new THREE.Color();
  for (let i = 0; i < BUTTERFLY_COUNT; i++) {
    const home = grassSpot(6, GRASS_RADIUS - 3);
    flies.push({ x: home.x, z: home.z, phase: rng() * 10, radius: 1.2 + rng() * 2.6, speed: 0.5 + rng() * 0.6, height: 0.7 + rng() * 1.3 });
    butterflies.setColorAt(i, tint.set(BUTTERFLY_COLORS[i % BUTTERFLY_COLORS.length]));
  }
  root.add(butterflies);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();

  // ── Thỏ ──────────────────────────────────────────────────────────────
  const rabbits = [];
  for (let i = 0; i < RABBIT_COUNT; i++) {
    const home = grassSpot(8, GRASS_RADIUS - 6);
    const group = buildRabbit(['#FFFFFF', '#E8D9C5', '#B9A48C', '#8D7B6A'][i % 4]);
    group.position.set(home.x, 0, home.z);
    root.add(group);
    rabbits.push({ group, home, target: { ...home }, wait: rng() * 4, hop: rng() * 6, heading: rng() * 6.28 });
  }

  // ── Hươu sao trong rừng thông ───────────────────────────────────────
  const deer = [];
  for (let i = 0; i < DEER_COUNT; i++) {
    const center = polar(gapAngle(2) + (i - 1.5) * 0.16, 34 + (i % 2) * 6);
    const home = island.isFree(center.x, center.z, 1.2) ? center : grassSpot(28, 44);
    const d = buildDeer();
    d.group.position.set(home.x, 0, home.z);
    d.group.scale.setScalar(0.9 + rng() * 0.25);
    root.add(d.group);
    deer.push({ ...d, home, target: { ...home }, wait: 2 + rng() * 6, heading: rng() * 6.28, step: 0 });
  }

  // ── Vịt trong hồ sen ────────────────────────────────────────────────
  const ducks = [];
  for (let i = 0; i < DUCK_COUNT; i++) {
    const group = buildDuck(i % 3 === 0 ? '#FFFFFF' : '#FFE27A');
    group.scale.setScalar(i === 0 ? 1.2 : 0.75 + rng() * 0.25);
    root.add(group);
    ducks.push({ group, a: rng() * 6.28, r: 1.2 + rng() * (LANDMARKS.lake.r - 3.4), speed: (0.18 + rng() * 0.2) * (i % 2 ? 1 : -1), bob: rng() * 6 });
  }

  // ── Cua trên bãi cát ────────────────────────────────────────────────
  const crabs = [];
  for (let i = 0; i < CRAB_COUNT; i++) {
    const group = buildCrab();
    root.add(group);
    crabs.push({ group, a: rng() * 6.28, r: GRASS_RADIUS + 1.5 + rng() * (BEACH_RADIUS - GRASS_RADIUS - 3), dir: rng() < 0.5 ? 1 : -1, timer: rng() * 5, moving: true });
  }

  /** Đi về phía `target`, quay mặt theo hướng đi; trả về true khi tới nơi. */
  function stepToward(a, speed, delta) {
    const dx = a.target.x - a.group.position.x;
    const dz = a.target.z - a.group.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.15) return true;
    const k = Math.min(1, (speed * delta) / d);
    a.group.position.x += dx * k;
    a.group.position.z += dz * k;
    const want = Math.atan2(dx, dz);
    const diff = Math.atan2(Math.sin(want - a.heading), Math.cos(want - a.heading));
    a.heading += diff * Math.min(1, delta * 8);
    a.group.rotation.y = a.heading;
    return false;
  }

  /** Chọn điểm chạy trốn ra xa người chơi (vẫn ở chỗ trống trên cỏ). */
  function fleeTarget(a, player, distance) {
    const dx = a.group.position.x - player.x;
    const dz = a.group.position.z - player.z;
    const base = Math.atan2(dx, dz);
    for (let i = 0; i < 6; i++) {
      const ang = base + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.5;
      const x = a.group.position.x + Math.sin(ang) * distance;
      const z = a.group.position.z + Math.cos(ang) * distance;
      if (Math.hypot(x, z) < GRASS_RADIUS - 2 && island.isFree(x, z, 0.6)) return { x, z };
    }
    return a.home;
  }

  function update(delta, elapsed, player) {
    // Bướm.
    for (let i = 0; i < BUTTERFLY_COUNT; i++) {
      const f = flies[i];
      const t = elapsed * f.speed + f.phase;
      v.set(f.x + Math.sin(t) * f.radius, f.height + Math.sin(t * 2.3) * 0.35, f.z + Math.cos(t * 0.8) * f.radius);
      e.set(0, -t + Math.PI / 2, 0);
      q.setFromEuler(e);
      s.set(0.35 + Math.abs(Math.sin(elapsed * 14 + f.phase)) * 0.75, 1, 1);
      m.compose(v, q, s);
      butterflies.setMatrixAt(i, m);
    }
    butterflies.instanceMatrix.needsUpdate = true;

    // Thỏ: nhảy lò cò tới điểm gần nhà, nghỉ, rồi đi tiếp; thấy Kỳ lân tới gần thì chạy.
    for (const r of rabbits) {
      const dp = Math.hypot(r.group.position.x - player.x, r.group.position.z - player.z);
      if (dp > ACTIVE_DISTANCE) continue;
      const scared = dp < FLEE_DISTANCE;
      if (scared && !r.fleeing) {
        r.fleeing = true;
        r.target = fleeTarget(r, player, 7);
        r.wait = 0;
      }
      if (r.wait > 0) {
        r.wait -= delta;
        r.group.position.y = 0;
        continue;
      }
      const speed = r.fleeing ? RABBIT_FLEE_SPEED : RABBIT_SPEED;
      r.hop += delta * (r.fleeing ? 16 : 9);
      r.group.position.y = Math.abs(Math.sin(r.hop)) * (r.fleeing ? 0.28 : 0.16);
      if (stepToward(r, speed, delta)) {
        r.fleeing = false;
        r.wait = 1 + Math.random() * 4;
        const a = Math.random() * 6.28;
        const d = 1.5 + Math.random() * 4;
        const x = r.home.x + Math.sin(a) * d;
        const z = r.home.z + Math.cos(a) * d;
        r.target = island.isFree(x, z, 0.5) && !isOnPath(x, z, 0.4) ? { x, z } : { ...r.home };
      }
    }

    // Hươu: thong thả gặm cỏ (cúi đầu khi đứng), chạy khi bị tới gần.
    for (const d of deer) {
      const dp = Math.hypot(d.group.position.x - player.x, d.group.position.z - player.z);
      if (dp > ACTIVE_DISTANCE) continue;
      if (dp < FLEE_DISTANCE + 1.5 && !d.fleeing) {
        d.fleeing = true;
        d.target = fleeTarget(d, player, 12);
        d.wait = 0;
      }
      if (d.wait > 0) {
        d.wait -= delta;
        d.neck.rotation.x += (1.25 + Math.sin(elapsed * 3) * 0.06 - d.neck.rotation.x) * Math.min(1, delta * 2);
        for (const leg of d.legs) leg.rotation.x *= 0.85;
        continue;
      }
      d.neck.rotation.x += (0.35 - d.neck.rotation.x) * Math.min(1, delta * 4);
      const speed = d.fleeing ? DEER_FLEE_SPEED : DEER_SPEED;
      d.step += delta * (d.fleeing ? 14 : 5);
      const swing = Math.sin(d.step) * (d.fleeing ? 0.7 : 0.35);
      d.legs[0].rotation.x = swing;
      d.legs[3].rotation.x = swing;
      d.legs[1].rotation.x = -swing;
      d.legs[2].rotation.x = -swing;
      if (stepToward(d, speed, delta)) {
        d.fleeing = false;
        d.wait = 3 + Math.random() * 7;
        const a = Math.random() * 6.28;
        const dist = 3 + Math.random() * 6;
        const x = d.home.x + Math.sin(a) * dist;
        const z = d.home.z + Math.cos(a) * dist;
        d.target = island.isFree(x, z, 1) && !isOnPath(x, z, 0.8) ? { x, z } : { ...d.home };
      }
    }

    // Vịt bơi vòng trong hồ.
    for (const d of ducks) {
      d.a += d.speed * delta;
      const x = LANDMARKS.lake.x + Math.sin(d.a) * d.r;
      const z = LANDMARKS.lake.z + Math.cos(d.a) * d.r;
      d.group.position.set(x, 0.03 + Math.sin(elapsed * 2 + d.bob) * 0.02, z);
      d.group.rotation.y = d.a + (d.speed > 0 ? Math.PI / 2 : -Math.PI / 2);
      d.group.rotation.z = Math.sin(elapsed * 1.7 + d.bob) * 0.06;
    }

    // Cua bò ngang dọc mép nước, thỉnh thoảng dừng.
    for (const c of crabs) {
      c.timer -= delta;
      if (c.timer <= 0) {
        c.moving = !c.moving;
        c.timer = c.moving ? 2 + Math.random() * 4 : 1 + Math.random() * 2;
        if (c.moving && Math.random() < 0.5) c.dir *= -1;
      }
      if (c.moving) c.a += (c.dir * 0.9 * delta) / c.r;
      c.group.position.set(Math.sin(c.a) * c.r, c.moving ? Math.abs(Math.sin(elapsed * 18)) * 0.02 : 0, Math.cos(c.a) * c.r);
      c.group.rotation.y = c.a; // quay mặt ra biển, bò ngang
    }
  }

  return { update };
}
