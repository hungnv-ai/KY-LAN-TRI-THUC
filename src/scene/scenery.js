import * as THREE from 'three';

/**
 * Cảnh trang trí làm đảo đẹp & có chiều sâu (không ảnh hưởng luật chơi):
 * mây trôi, vùng nước nông màu ngọc quanh bờ, đảo nhỏ phía xa, hoa li ti trên cỏ, chim hải âu bay.
 */

const ISLAND_RADIUS = 32;
const CLOUD_COUNT = 14;
const CLOUD_RADIUS = [70, 140];
const CLOUD_HEIGHT = [26, 48];
const CLOUD_SPEED = 0.012; // rad/giây quanh đảo
const FLOWER_COUNT = 420;
const FLOWER_COLORS = ['#FF8FB1', '#FFFFFF', '#FFD54F', '#B39DDB', '#FF7043', '#81D4FA'];
const BIRD_COUNT = 5;

function rand(rng, [a, b]) {
  return a + rng() * (b - a);
}

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

function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  const puffs = [[70, 78, 46], [120, 60, 56], [175, 76, 44], [100, 88, 40], [150, 92, 42]];
  for (const [x, y, r] of puffs) {
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildDistantIsland(rng) {
  const g = new THREE.Group();
  const sand = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.25, 0.6, 24), new THREE.MeshStandardMaterial({ color: '#F5E2B8', roughness: 1 }));
  const s = 3 + rng() * 5;
  sand.scale.set(s, 1, s);
  g.add(sand);
  const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#8CCB74', roughness: 1 }));
  hill.scale.set(s * 0.85, s * (0.35 + rng() * 0.4), s * 0.85);
  hill.position.y = 0.25;
  g.add(hill);
  const trees = 2 + Math.floor(rng() * 4);
  for (let i = 0; i < trees; i++) {
    const a = rng() * Math.PI * 2;
    const r = rng() * s * 0.5;
    const tree = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.8, 7), new THREE.MeshStandardMaterial({ color: '#5F9E5A', roughness: 0.9 }));
    tree.position.set(Math.sin(a) * r, hill.scale.y * 0.8 + 0.6, Math.cos(a) * r);
    g.add(tree);
  }
  return g;
}

/**
 * @param {THREE.Scene} scene
 * @returns {{ update: (delta: number, elapsed: number) => void }}
 */
export function createScenery(scene) {
  const rng = mulberry32(2027);
  const root = new THREE.Group();
  root.name = 'scenery';
  scene.add(root);

  // Nước nông màu ngọc quanh bờ cát.
  const shallow = new THREE.Mesh(
    new THREE.RingGeometry(ISLAND_RADIUS + 1.5, ISLAND_RADIUS + 9, 96),
    new THREE.MeshStandardMaterial({ color: '#8FE3DD', roughness: 0.3, transparent: true, opacity: 0.85 }),
  );
  shallow.rotation.x = -Math.PI / 2;
  shallow.position.y = -0.22;
  shallow.name = 'shallow'; // scene/dayCycle.js đổi màu theo giờ
  root.add(shallow);
  // Vệt sóng trắng mảnh sát bờ (nhấp nhô nhẹ).
  const foam = new THREE.Mesh(
    new THREE.RingGeometry(ISLAND_RADIUS + 2.3, ISLAND_RADIUS + 2.8, 96),
    new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.6 }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.y = -0.2;
  root.add(foam);

  // Đảo nhỏ phía xa.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rng() * 0.5;
    const r = 70 + rng() * 55;
    const isle = buildDistantIsland(rng);
    isle.position.set(Math.sin(a) * r, -0.3, Math.cos(a) * r);
    root.add(isle);
  }

  // Hoa li ti trên cỏ (một InstancedMesh → rất nhẹ).
  const flowerGeo = new THREE.SphereGeometry(0.09, 6, 4);
  const flowerMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
  const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, FLOWER_COUNT);
  const m = new THREE.Matrix4();
  const color = new THREE.Color();
  for (let i = 0; i < FLOWER_COUNT; i++) {
    const a = rng() * Math.PI * 2;
    const r = 5 + Math.sqrt(rng()) * (ISLAND_RADIUS - 6);
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    // Tránh 5 con đường (gần các tia từ tâm ra cột Vùng Đất).
    const onPath = [0, 1, 2, 3, 4].some((k) => {
      const pa = Math.PI + (k - 2) * ((Math.PI * 2) / 5);
      const dx = Math.sin(pa);
      const dz = Math.cos(pa);
      const along = x * dx + z * dz;
      return along > 2 && Math.abs(x * dz - z * dx) < 1.4;
    });
    const s = onPath ? 0 : 0.7 + rng() * 0.8;
    m.makeScale(s, s * 0.6, s).setPosition(x, 0.06, z);
    flowers.setMatrixAt(i, m);
    flowers.setColorAt(i, color.set(FLOWER_COLORS[i % FLOWER_COLORS.length]));
  }
  root.add(flowers);

  // Mây.
  const cloudTex = cloudTexture();
  const clouds = [];
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.85 }));
    const w = 18 + rng() * 22;
    sprite.scale.set(w, w / 2, 1);
    const cloud = { sprite, a: rng() * Math.PI * 2, r: rand(rng, CLOUD_RADIUS), y: rand(rng, CLOUD_HEIGHT) };
    root.add(sprite);
    clouds.push(cloud);
  }

  // Chim hải âu: chữ V trắng bay vòng.
  const birds = [];
  const wingShape = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.6, 0.15, 0), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.6, 0.15, 0),
  ]);
  for (let i = 0; i < BIRD_COUNT; i++) {
    const bird = new THREE.Line(wingShape, new THREE.LineBasicMaterial({ color: '#ffffff' }));
    root.add(bird);
    birds.push({ bird, a: rng() * Math.PI * 2, r: 22 + rng() * 25, y: 12 + rng() * 8, speed: 0.08 + rng() * 0.06 });
  }

  function update(delta, elapsed) {
    for (const c of clouds) {
      c.a += CLOUD_SPEED * delta;
      c.sprite.position.set(Math.sin(c.a) * c.r, c.y, Math.cos(c.a) * c.r);
    }
    for (const b of birds) {
      b.a += b.speed * delta;
      b.bird.position.set(Math.sin(b.a) * b.r, b.y + Math.sin(elapsed * 0.8 + b.r) * 1.2, Math.cos(b.a) * b.r);
      b.bird.rotation.y = b.a + Math.PI / 2;
      b.bird.scale.y = 1 + Math.sin(elapsed * 6 + b.r) * 0.8; // vỗ cánh
    }
    foam.material.opacity = 0.45 + Math.sin(elapsed * 1.4) * 0.15;
  }

  return { update };
}
