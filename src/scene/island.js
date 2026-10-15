import * as THREE from 'three';
import { VALUES } from '../config.js';

/**
 * Hòn đảo Kỳ Lân: quảng trường ở giữa (bục tròn viền 5 màu), 5 con đường dẫn tới
 * 5 Vùng Đất theo 5 giá trị, mỗi vùng có cột phát sáng + cảnh trang trí riêng.
 * 1 đơn vị 3D = 1 mét.
 */

const ISLAND_RADIUS = 32;
/** Kỳ lân không chạy ra quá bán kính này (còn bãi cát & cây viền đảo). */
const WALK_RADIUS = 29.5;
const STATION_DISTANCE = 16;
/** Đứng trong vòng tròn này quanh cột thì kích hoạt thử thách Vùng Đất. */
const STATION_TRIGGER_RADIUS = 2.4;
const PLATFORM_R = 1.5;
const PLATFORM_H = 0.18;
const PLATFORM_RAMP = 0.3;

/** Chiều cao nhãn tên Vùng Đất (tỉ lệ so với chiều cao màn hình). */
const LABEL_SCREEN_HEIGHT = 0.045;
const BEAM_OPACITY = 0.22;
const BEAM_OPACITY_DONE = 0.05;

/**
 * @param {THREE.Scene} scene
 * @returns {{
 *   stations: { id: string, name: string, color: string, position: THREE.Vector3, radius: number }[],
 *   groundHeight: (x: number, z: number) => number,
 *   resolve: (pos: THREE.Vector3, radius: number) => void,
 *   randomOpenPoint: (minR?: number, maxR?: number) => THREE.Vector3,
 *   setStationDone: (id: string, done: boolean) => void,
 *   update: (delta: number, elapsed: number) => void,
 * }}
 */
export function setupIsland(scene) {
  scene.background = createSkyTexture();
  scene.fog = new THREE.Fog(0xf3e9dc, 32, 85);

  const rng = mulberry32(2026);
  const colliders = []; // { x, z, r }
  const animated = []; // (elapsed) => void

  buildGround(scene);
  buildPlaza(scene);

  // ── 5 Vùng Đất ──────────────────────────────────────────────────────
  const stations = VALUES.map((value, i) => {
    const angle = Math.PI + (i - 2) * ((Math.PI * 2) / VALUES.length);
    const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const position = dir.clone().multiplyScalar(STATION_DISTANCE);

    buildPath(scene, dir);
    const station = buildStation(scene, value, position, animated);
    colliders.push({ x: position.x, z: position.z, r: 0.75 });

    const zone = new ZoneBuilder(scene, position, dir, rng, colliders, animated);
    ZONE_DECOR[value.id](zone, value);

    return { id: value.id, name: value.name, color: value.color, position, radius: STATION_TRIGGER_RADIUS, ...station };
  });

  buildRimTrees(scene, rng, colliders);

  function groundHeight(x, z) {
    const r = Math.hypot(x, z);
    if (r <= PLATFORM_R) return PLATFORM_H;
    if (r >= PLATFORM_R + PLATFORM_RAMP) return 0;
    return PLATFORM_H * (1 - (r - PLATFORM_R) / PLATFORM_RAMP);
  }

  /** Đẩy vị trí ra khỏi vật cản và giữ trong đảo (sửa trực tiếp `pos`). */
  function resolve(pos, radius) {
    for (const c of colliders) {
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const min = c.r + radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x = c.x + (dx / d) * min;
        pos.z = c.z + (dz / d) * min;
      }
    }
    const r = Math.hypot(pos.x, pos.z);
    if (r > WALK_RADIUS) {
      pos.x *= WALK_RADIUS / r;
      pos.z *= WALK_RADIUS / r;
    }
  }

  /** Điểm trống ngẫu nhiên trên đảo (để rải xu, hộp quà). */
  function randomOpenPoint(minR = 4, maxR = WALK_RADIUS - 1.5) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const a = Math.random() * Math.PI * 2;
      const r = minR + Math.random() * (maxR - minR);
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      const blocked =
        colliders.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + 1.2) ||
        stations.some((s) => Math.hypot(x - s.position.x, z - s.position.z) < STATION_TRIGGER_RADIUS + 1.5);
      if (!blocked) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(0, 0, 5);
  }

  function setStationDone(id, done) {
    const station = stations.find((s) => s.id === id);
    if (!station) return;
    station.beam.material.opacity = done ? BEAM_OPACITY_DONE : BEAM_OPACITY;
    station.orb.material.emissiveIntensity = done ? 0.08 : 0.35;
    station.check.visible = done;
  }

  function update(_delta, elapsed) {
    for (const fn of animated) fn(elapsed);
  }

  return { stations, groundHeight, resolve, randomOpenPoint, setStationDone, update };
}

// ── Nền đảo, quảng trường, đường đi ───────────────────────────────────────

function buildGround(scene) {
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(140, 48),
    new THREE.MeshStandardMaterial({ color: 0x8ec3ea, roughness: 0.35, metalness: 0.1 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.25;
  scene.add(water);

  const sand = new THREE.Mesh(
    new THREE.CylinderGeometry(ISLAND_RADIUS + 1.6, ISLAND_RADIUS + 2.4, 0.5, 96),
    new THREE.MeshStandardMaterial({ color: 0xf1dfb8, roughness: 1 }),
  );
  sand.position.y = -0.27;
  sand.receiveShadow = true;
  scene.add(sand);

  const grass = new THREE.Mesh(
    new THREE.CircleGeometry(ISLAND_RADIUS, 96),
    new THREE.MeshStandardMaterial({ color: 0xc9e4b8, roughness: 1 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = 0;
  grass.receiveShadow = true;
  scene.add(grass);
}

function buildPlaza(scene) {
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 64),
    new THREE.MeshStandardMaterial({ color: 0xeadcc0, roughness: 1 }),
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.005;
  plaza.receiveShadow = true;
  scene.add(plaza);

  // Bục tròn màu kem (#F6EFE3 trong Design System).
  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(PLATFORM_R, PLATFORM_R + PLATFORM_RAMP, PLATFORM_H, 64),
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
}

function buildPath(scene, dir) {
  const START = 3.2;
  const END = STATION_DISTANCE - 2.2;
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, END - START),
    new THREE.MeshStandardMaterial({ color: 0xeadcc0, roughness: 1 }),
  );
  path.rotation.x = -Math.PI / 2;
  path.rotation.z = Math.atan2(dir.x, dir.z) + Math.PI;
  const mid = (START + END) / 2;
  path.position.set(dir.x * mid, 0.004, dir.z * mid);
  path.receiveShadow = true;
  scene.add(path);
}

/** Cột Vùng Đất: bệ + cột + quả cầu màu giá trị + cột sáng + tên vùng. */
function buildStation(scene, value, position, animated) {
  const group = new THREE.Group();
  group.position.copy(position);
  scene.add(group);

  const cream = new THREE.MeshStandardMaterial({ color: 0xf6efe3, roughness: 0.8 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.1, 0.3, 32), cream);
  base.position.y = 0.15;
  group.add(base);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 2.4, 24), cream);
  pillar.position.y = 1.5;
  group.add(pillar);

  const orb = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.55, 2),
    new THREE.MeshStandardMaterial({ color: value.color, emissive: value.color, emissiveIntensity: 0.35, roughness: 0.35 }),
  );
  orb.position.y = 3.2;
  group.add(orb);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(STATION_TRIGGER_RADIUS, 0.07, 8, 64),
    new THREE.MeshStandardMaterial({ color: value.color, roughness: 0.5 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  group.add(ring);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 16, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: value.color,
      transparent: true,
      opacity: BEAM_OPACITY,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  beam.position.y = 8;
  group.add(beam);

  const label = createLabelSprite(value.name.toUpperCase(), value.color);
  label.position.y = 4.3;
  group.add(label);

  const check = createLabelSprite('✓ Đã ghé hôm nay', '#00796f', 0.5);
  check.position.y = 3.75;
  check.visible = false;
  group.add(check);

  group.traverse((o) => {
    if (o.isMesh && o !== beam) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  const phase = position.x;
  animated.push((t) => {
    orb.position.y = 3.2 + Math.sin(t * 1.5 + phase) * 0.12;
    orb.rotation.y = t * 0.6 + phase;
  });

  return { orb, beam, check };
}

/** Hàng cây quanh mép đảo. */
function buildRimTrees(scene, rng, colliders) {
  const COUNT = 32;
  for (let i = 0; i < COUNT; i++) {
    const a = (i / COUNT) * Math.PI * 2 + rng() * 0.15;
    const r = 29.2 + rng() * 2;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    const tree = createTree(0.9 + rng() * 0.6, rng);
    tree.position.set(x, 0, z);
    scene.add(tree);
    colliders.push({ x, z, r: 0.6 });
  }
}

// ── Trang trí từng Vùng Đất ──────────────────────────────────────────────

/** Tiện ích đặt đồ trang trí theo hệ toạ độ của vùng (dọc hướng ra ngoài / ngang). */
class ZoneBuilder {
  constructor(scene, center, dir, rng, colliders, animated) {
    this.scene = scene;
    this.center = center;
    this.dir = dir;
    this.side = new THREE.Vector3(dir.z, 0, -dir.x);
    this.rng = rng;
    this.colliders = colliders;
    this.animated = animated;
  }

  /** Vị trí: `out` mét ra ngoài (âm = về phía quảng trường), `across` mét sang ngang. */
  at(out, across) {
    return this.center.clone().addScaledVector(this.dir, out).addScaledVector(this.side, across);
  }

  add(object, out, across, colliderR = 0) {
    const p = this.at(out, across);
    object.position.x = p.x;
    object.position.z = p.z;
    object.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.scene.add(object);
    if (colliderR > 0) this.colliders.push({ x: p.x, z: p.z, r: colliderR });
    return object;
  }

  animate(fn) {
    this.animated.push(fn);
  }
}

const std = (color, roughness = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });

const ZONE_DECOR = {
  /** Vườn hoa & trái tim. */
  nhanAi(zone, value) {
    const colors = ['#F48FB1', '#5DCBBF', '#FFFFFF', '#F7D27A', value.color];
    for (let i = 0; i < 14; i++) {
      const flower = new THREE.Group();
      const h = 0.35 + zone.rng() * 0.3;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, h, 6), std('#4F8F4A'));
      stem.position.y = h / 2;
      flower.add(stem);
      const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), std(colors[i % colors.length], 0.5));
      bloom.position.y = h;
      flower.add(bloom);
      const out = (zone.rng() - 0.3) * 6;
      const across = (zone.rng() < 0.5 ? -1 : 1) * (2.8 + zone.rng() * 3);
      zone.add(flower, out, across);
    }
    for (const [out, across] of [
      [2.5, -4.5],
      [3, 4.2],
      [-2.5, 5],
    ]) {
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), std('#6BAF63', 0.9));
      bush.position.y = 0.5;
      zone.add(bush, out, across, 0.7);
    }
    [-1, 1].forEach((s, i) => {
      const heart = createHeart(i ? '#F48FB1' : value.color);
      heart.position.y = 2.6;
      zone.add(heart, 1, s * 3);
      zone.animate((t) => {
        heart.position.y = 2.6 + Math.sin(t * 2 + i) * 0.2;
        heart.rotation.y = t * 0.8;
      });
    });
  },

  /** Núi tuyết & đá tảng. */
  banLinh(zone, value) {
    const mountain = new THREE.Group();
    const rock = new THREE.Mesh(new THREE.ConeGeometry(2.8, 5, 7), std(value.color, 0.95));
    rock.position.y = 2.5;
    mountain.add(rock);
    const snow = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.95, 7), std('#FFFFFF', 0.6));
    snow.position.y = 4.03;
    mountain.add(snow);
    zone.add(mountain, 5, 0, 2.6);

    const small = new THREE.Group();
    const rock2 = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3, 6), std('#8F7562', 0.95));
    rock2.position.y = 1.5;
    small.add(rock2);
    zone.add(small, 4, 4.2, 1.5);

    for (let i = 0; i < 6; i++) {
      const s = 0.35 + zone.rng() * 0.5;
      const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), std(i % 2 ? '#AD9A8C' : '#8F7562', 0.95));
      boulder.position.y = s * 0.6;
      boulder.rotation.set(zone.rng(), zone.rng(), zone.rng());
      const across = (i % 2 ? -1 : 1) * (3.6 + zone.rng() * 2.6);
      zone.add(boulder, (zone.rng() - 0.4) * 5, across, s);
    }
  },

  /** Cây tri thức & chồng sách. */
  triThuc(zone) {
    for (const [out, across, size] of [
      [3, -3.5, 1.5],
      [4, 3.5, 1.3],
      [-1, -4.5, 1.1],
    ]) {
      zone.add(createTree(size, zone.rng, true), out, across, 0.55);
    }
    const bookColors = ['#009082', '#725139', '#9A0036', '#C49C57', '#1750B5'];
    [-1, 1].forEach((s) => {
      const stack = new THREE.Group();
      let y = 0;
      for (let i = 0; i < 5; i++) {
        const h = 0.18 + zone.rng() * 0.08;
        const book = new THREE.Mesh(new THREE.BoxGeometry(1.0, h, 0.7), std(bookColors[i], 0.6));
        book.position.y = y + h / 2;
        book.rotation.y = (zone.rng() - 0.5) * 0.5;
        stack.add(book);
        y += h;
      }
      zone.add(stack, -2, s * 3, 0.65);
    });
  },

  /** Cán cân & đồng hồ. */
  trachNhiem(zone, value) {
    const gold = std(value.color, 0.35, { metalness: 0.5 });
    const scale = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 2.6, 12), gold);
    post.position.y = 1.3;
    scale.add(post);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.2, 24), gold);
    base.position.y = 0.1;
    scale.add(base);
    const beam = new THREE.Group();
    beam.position.y = 2.6;
    scale.add(beam);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.08), gold);
    beam.add(bar);
    for (const s of [-1, 1]) {
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 4), gold);
      chain.position.set(1.1 * s, -0.4, 0);
      beam.add(chain);
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.06, 20), gold);
      plate.position.set(1.1 * s, -0.8, 0);
      beam.add(plate);
    }
    zone.add(scale, 3.5, -3.2, 0.7);
    zone.animate((t) => (beam.rotation.z = Math.sin(t * 0.9) * 0.12));

    const clock = new THREE.Group();
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.6, 12), std('#5B412E'));
    stand.position.y = 0.8;
    clock.add(stand);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.2, 32), std('#FFFFFF', 0.4));
    face.rotation.x = Math.PI / 2;
    face.position.y = 2.4;
    clock.add(face);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.08, 10, 32), gold);
    rim.position.y = 2.4;
    clock.add(rim);
    const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.45, 0.04), std('#2E2017'));
    hourHand.geometry.translate(0, 0.2, 0);
    hourHand.position.set(0, 2.4, 0.13);
    clock.add(hourHand);
    const minuteHand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.04), std('#9A0036'));
    minuteHand.geometry.translate(0, 0.32, 0);
    minuteHand.position.set(0, 2.4, 0.15);
    clock.add(minuteHand);
    const clockObj = zone.add(clock, 3, 3.5, 0.4);
    clockObj.lookAt(0, 0, 0);
    zone.animate((t) => {
      minuteHand.rotation.z = -t * 0.8;
      hourHand.rotation.z = -t * 0.8 / 12;
    });
  },

  /** Hồ nước & thuyền buồm, máy bay giấy. */
  khaiPhong(zone, value) {
    const pond = new THREE.Mesh(new THREE.CircleGeometry(3.2, 48), std('#7FB8E6', 0.25, { metalness: 0.1 }));
    pond.rotation.x = -Math.PI / 2;
    pond.position.y = 0.012;
    zone.add(pond, 4.5, 0);

    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.3, 1.6, 12, 1, false, 0, Math.PI), std('#725139'));
    hull.rotation.set(0, 0, Math.PI / 2);
    hull.rotation.order = 'ZXY';
    hull.rotation.x = Math.PI;
    hull.position.y = 0.2;
    boat.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), std('#5B412E'));
    mast.position.y = 1.1;
    boat.add(mast);
    const sailShape = new THREE.Shape();
    sailShape.moveTo(0, 0);
    sailShape.lineTo(0.9, 0);
    sailShape.lineTo(0, 1.4);
    sailShape.closePath();
    const sail = new THREE.Mesh(
      new THREE.ShapeGeometry(sailShape),
      new THREE.MeshStandardMaterial({ color: '#FFFFFF', side: THREE.DoubleSide, roughness: 0.6 }),
    );
    sail.position.set(0.05, 0.45, 0);
    sail.rotation.y = Math.PI / 2;
    boat.add(sail);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.35), std(value.color, 0.5));
    flag.position.set(0, 2.0, -0.17);
    boat.add(flag);
    zone.add(boat, 4.5, 0);
    zone.animate((t) => {
      boat.position.y = Math.sin(t * 1.6) * 0.05;
      boat.rotation.z = Math.sin(t * 1.2) * 0.06;
      boat.rotation.y = t * 0.15;
    });

    for (let i = 0; i < 3; i++) {
      const plane = new THREE.Mesh(new THREE.TetrahedronGeometry(0.25), std('#FFFFFF', 0.5));
      plane.scale.set(1.6, 0.4, 0.8);
      plane.position.y = 3;
      zone.add(plane, 1, (i - 1) * 3);
      const p0 = plane.position.clone();
      zone.animate((t) => {
        const a = t * 0.7 + i * 2;
        plane.position.set(p0.x + Math.sin(a) * 1.5, 2.6 + Math.sin(a * 2) * 0.4, p0.z + Math.cos(a) * 1.5);
        plane.rotation.y = -a;
      });
    }
    for (const s of [-1, 1]) {
      zone.add(createTree(1.1, zone.rng), 1.5, s * 4.6, 0.55);
    }
  },
};

// ── Hình khối dùng chung ──────────────────────────────────────────────────

function createTree(size, rng, withFruit = false) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * size, 0.2 * size, 1.4 * size, 8), std('#8F6B4E', 0.9));
  trunk.position.y = 0.7 * size;
  tree.add(trunk);
  const greens = ['#6BAF63', '#5F9E5A', '#7BBF6E'];
  const canopy = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.85 * size, 1),
    std(greens[Math.floor(rng() * greens.length)], 0.9),
  );
  canopy.position.y = 1.9 * size;
  tree.add(canopy);
  if (withFruit) {
    for (let i = 0; i < 6; i++) {
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.1 * size, 8, 6), std('#D8372E', 0.5));
      const a = (i / 6) * Math.PI * 2;
      fruit.position.set(Math.sin(a) * 0.75 * size, 1.75 * size + (i % 2) * 0.3 * size, Math.cos(a) * 0.75 * size);
      tree.add(fruit);
    }
  }
  tree.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return tree;
}

function createHeart(color) {
  const heart = new THREE.Group();
  const material = std(color, 0.4, { emissive: color, emissiveIntensity: 0.2 });
  for (const s of [-1, 1]) {
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), material);
    lobe.position.set(0.2 * s, 0.15, 0);
    heart.add(lobe);
  }
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.44, 0.6, 16), material);
  tip.rotation.z = Math.PI;
  tip.position.y = -0.2;
  heart.add(tip);
  return heart;
}

/** Nhãn chữ nổi (tên Vùng Đất) dạng sprite luôn quay về camera. */
function createLabelSprite(text, color, height = 0.7) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = 'bold 64px "Be Vietnam Pro", Arial, sans-serif';
  ctx.font = font;
  const width = Math.ceil(ctx.measureText(text).width) + 80;
  canvas.width = width;
  canvas.height = 112;
  ctx.font = font;
  ctx.fillStyle = color;
  const r = 50;
  ctx.beginPath();
  ctx.roundRect(4, 4, width - 8, 104, r);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, 60);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Giữ cỡ chữ cố định trên màn hình (không phóng to khổng lồ khi đứng gần).
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, sizeAttenuation: false }),
  );
  const screenH = LABEL_SCREEN_HEIGHT * (height / 0.7);
  sprite.scale.set((screenH * width) / 112, screenH, 1);
  return sprite;
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

/** Bộ sinh số ngẫu nhiên có seed — bản đồ giống nhau mỗi lần tải. */
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
