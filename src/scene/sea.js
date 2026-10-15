import * as THREE from 'three';

/**
 * Biển sống động: mặt nước lấp lánh, cá nhảy lên tạo vòng sóng, thuyền buồm VA chạy quanh đảo.
 */

const SPARKLE_COUNT = 260;
const SPARKLE_RING = [36, 95];
const SEA_Y = -0.2;
const FISH_COUNT = 4;
const FISH_RING = [36, 52];
const FISH_JUMP_SEC = 1.1;
const FISH_HEIGHT = 1.4;
const BOAT_RADIUS = 47;
const BOAT_SPEED = 0.035; // rad/giây

function sparkleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function sailTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 160;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 160);
  ctx.fillStyle = '#9A0036';
  ctx.beginPath();
  ctx.arc(64, 82, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 38px "Be Vietnam Pro", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VA', 64, 84);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildBoat() {
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.55, 3.2, 14, 1, false, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: '#9A0036', roughness: 0.6 }),
  );
  hull.rotation.z = Math.PI / 2;
  hull.rotation.y = Math.PI / 2;
  hull.position.y = 0.45;
  boat.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 3.0), new THREE.MeshStandardMaterial({ color: '#C49C57', roughness: 0.8 }));
  deck.position.y = 0.46;
  boat.add(deck);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 8), new THREE.MeshStandardMaterial({ color: '#5B412E' }));
  mast.position.y = 2.1;
  boat.add(mast);
  const sail = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 2.5),
    new THREE.MeshStandardMaterial({ map: sailTexture(), side: THREE.DoubleSide, roughness: 0.7 }),
  );
  sail.position.set(0, 2.2, 0.1);
  sail.rotation.y = Math.PI / 2;
  boat.add(sail);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), new THREE.MeshStandardMaterial({ color: '#F7D27A', side: THREE.DoubleSide }));
  flag.position.set(0, 3.85, 0.25);
  flag.rotation.y = Math.PI / 2;
  boat.add(flag);
  boat.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { boat, sail, flag };
}

function buildFish(color) {
  const fish = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), mat);
  body.scale.set(0.6, 0.7, 1.4);
  fish.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 4), mat);
  tail.rotation.x = -Math.PI / 2;
  tail.position.z = -0.42;
  fish.add(tail);
  fish.visible = false;
  return fish;
}

/**
 * @param {THREE.Scene} scene
 * @returns {{ update: (delta: number, elapsed: number) => void }}
 */
export function createSea(scene) {
  const root = new THREE.Group();
  root.name = 'sea-life';
  scene.add(root);

  // Lấp lánh: các điểm sáng nhấp nháy theo pha riêng.
  const pos = new Float32Array(SPARKLE_COUNT * 3);
  for (let i = 0; i < SPARKLE_COUNT; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = SPARKLE_RING[0] + Math.random() * (SPARKLE_RING[1] - SPARKLE_RING[0]);
    pos.set([Math.sin(a) * r, SEA_Y + 0.02, Math.cos(a) * r], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sparkleMat = new THREE.PointsMaterial({ map: sparkleTexture(), size: 0.7, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
  const sparkles = new THREE.Points(geo, sparkleMat);
  sparkles.frustumCulled = false;
  root.add(sparkles);
  // Điểm sáng di chuyển nhẹ = "gợn sóng" (đổi vị trí từng nhóm theo thời gian).
  let shuffleTimer = 0;

  // Cá nhảy.
  const fishColors = ['#FF8A3D', '#FFD54F', '#FF6F91', '#7FD7FF'];
  const fishes = fishColors.slice(0, FISH_COUNT).map((c) => ({ mesh: buildFish(c), t: -Math.random() * 6, start: new THREE.Vector3(), dir: new THREE.Vector3() }));
  fishes.forEach((f) => root.add(f.mesh));
  const splashes = [];
  const splashGeo = new THREE.RingGeometry(0.3, 0.42, 24);
  function splash(at) {
    const m = new THREE.Mesh(splashGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(at.x, SEA_Y + 0.03, at.z);
    root.add(m);
    splashes.push({ m, t: 0 });
  }

  const { boat, flag } = buildBoat();
  root.add(boat);
  let boatAngle = Math.random() * Math.PI * 2;

  function update(delta, elapsed) {
    // Lấp lánh: kích thước nhấp nháy qua opacity tổng + xáo vị trí vài điểm.
    sparkleMat.size = 0.6 + Math.sin(elapsed * 2.2) * 0.12;
    shuffleTimer -= delta;
    if (shuffleTimer <= 0) {
      shuffleTimer = 0.15;
      for (let k = 0; k < 12; k++) {
        const i = Math.floor(Math.random() * SPARKLE_COUNT);
        const a = Math.random() * Math.PI * 2;
        const r = SPARKLE_RING[0] + Math.random() * (SPARKLE_RING[1] - SPARKLE_RING[0]);
        geo.attributes.position.setXYZ(i, Math.sin(a) * r, SEA_Y + 0.02, Math.cos(a) * r);
      }
      geo.attributes.position.needsUpdate = true;
    }

    for (const f of fishes) {
      f.t += delta;
      if (f.t < 0) continue;
      if (!f.mesh.visible) {
        const a = Math.random() * Math.PI * 2;
        const r = FISH_RING[0] + Math.random() * (FISH_RING[1] - FISH_RING[0]);
        f.start.set(Math.sin(a) * r, SEA_Y, Math.cos(a) * r);
        f.dir.set(Math.cos(a), 0, -Math.sin(a)).multiplyScalar(Math.random() < 0.5 ? 1 : -1);
        f.mesh.visible = true;
        splash(f.start);
      }
      const p = f.t / FISH_JUMP_SEC;
      f.mesh.position.copy(f.start).addScaledVector(f.dir, p * 2.2);
      f.mesh.position.y = SEA_Y + Math.sin(p * Math.PI) * FISH_HEIGHT;
      f.mesh.rotation.y = Math.atan2(f.dir.x, f.dir.z);
      f.mesh.rotation.x = -Math.cos(p * Math.PI) * 0.9;
      if (p >= 1) {
        splash(f.mesh.position);
        f.mesh.visible = false;
        f.t = -(2 + Math.random() * 6);
      }
    }
    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i];
      s.t += delta;
      s.m.scale.setScalar(1 + s.t * 3);
      s.m.material.opacity = Math.max(0, 0.8 - s.t);
      if (s.t > 0.8) {
        root.remove(s.m);
        s.m.material.dispose();
        splashes.splice(i, 1);
      }
    }

    boatAngle += BOAT_SPEED * delta;
    boat.position.set(Math.sin(boatAngle) * BOAT_RADIUS, SEA_Y - 0.25 + Math.sin(elapsed * 1.6) * 0.08, Math.cos(boatAngle) * BOAT_RADIUS);
    boat.rotation.y = Math.atan2(Math.cos(boatAngle), -Math.sin(boatAngle)); // mũi thuyền theo hướng chạy
    boat.rotation.z = Math.sin(elapsed * 1.2) * 0.05;
    flag.rotation.x = Math.sin(elapsed * 6) * 0.2;
  }

  return { update };
}
