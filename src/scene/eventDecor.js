import * as THREE from 'three';
import { getEvent } from '../data/events.js';

/**
 * Trang trí đảo theo sự kiện: cổng hoa ở đầu 5 con đường (kèm biển tên sự kiện) và cánh hoa rơi
 * quanh quảng trường. Bật/tắt theo sự kiện máy chủ báo về.
 */

const ARCH_DISTANCE = 8.5;
/** Biển trên cổng giữ cỡ cố định trên màn hình (không to khổng lồ khi đứng gần). */
const SIGN_SCREEN_HEIGHT = 0.032;
const ARCH_RADIUS = 1.35;
const PETAL_COUNT = 180;
const PETAL_AREA = 15;
const PETAL_TOP = 9;
const FLOWER_COLORS = ['#F48FB1', '#FFFFFF', '#FFD54F', '#E57373', '#CE93D8'];

function petalTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, '#F8BBD0');
  g.addColorStop(1, 'rgba(244, 143, 177, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(32, 32, 30, 18, 0.6, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function bannerSprite(text, color) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = 'bold 54px "Be Vietnam Pro", Arial, sans-serif';
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 70;
  canvas.width = w;
  canvas.height = 96;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(4, 4, w - 8, 88, 44);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, 52);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, sizeAttenuation: false }));
  sprite.scale.set((SIGN_SCREEN_HEIGHT * w) / 96, SIGN_SCREEN_HEIGHT, 1);
  return sprite;
}

function buildArch(color, label) {
  const arch = new THREE.Group();
  const green = new THREE.MeshStandardMaterial({ color: '#5E9E4A', roughness: 0.7 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ARCH_RADIUS, 0.09, 10, 36, Math.PI), green);
  ring.position.y = 1.6;
  arch.add(ring);
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.6, 10), green);
    post.position.set(ARCH_RADIUS * s, 0.8, 0);
    arch.add(post);
  }
  const flowerGeo = new THREE.SphereGeometry(0.11, 10, 8);
  const mats = FLOWER_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
  const COUNT = 15;
  for (let i = 0; i <= COUNT; i++) {
    const a = (i / COUNT) * Math.PI;
    const f = new THREE.Mesh(flowerGeo, mats[i % mats.length]);
    f.position.set(Math.cos(a) * ARCH_RADIUS, 1.6 + Math.sin(a) * ARCH_RADIUS, 0.05 * (i % 2 ? 1 : -1));
    f.scale.setScalar(0.8 + (i % 3) * 0.2);
    arch.add(f);
  }
  const sign = bannerSprite(label, color);
  sign.position.y = 1.6 + ARCH_RADIUS + 0.35;
  arch.add(sign);
  arch.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return arch;
}

/**
 * @param {THREE.Scene} scene
 * @param {{ stations: { position: THREE.Vector3 }[] }} island
 * @returns {{ setEvent: (eventId: string | null) => void, update: (delta: number, elapsed: number) => void }}
 */
export function createEventDecor(scene, island) {
  let group = null;
  let current = null;
  let petals = null;
  let petalData = null;

  function clear() {
    if (!group) return;
    scene.remove(group);
    group.traverse((o) => {
      o.geometry?.dispose();
      const m = o.material;
      if (m) {
        m.map?.dispose();
        m.dispose();
      }
    });
    group = null;
    petals = null;
  }

  function setEvent(eventId) {
    if (eventId === current) return;
    current = eventId;
    clear();
    const event = getEvent(eventId);
    if (!event) return;
    group = new THREE.Group();
    group.name = `event:${event.id}`;
    for (const station of island.stations) {
      const dir = station.position.clone().setY(0).normalize();
      const arch = buildArch(event.color, `${event.icon} ${event.banner}`);
      arch.position.copy(dir.multiplyScalar(ARCH_DISTANCE));
      arch.rotation.y = Math.atan2(station.position.x, station.position.z); // mặt cổng vuông góc con đường
      group.add(arch);
    }

    // Cánh hoa rơi quanh quảng trường.
    const positions = new Float32Array(PETAL_COUNT * 3);
    petalData = [];
    for (let i = 0; i < PETAL_COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * PETAL_AREA;
      petalData.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, y: Math.random() * PETAL_TOP, v: 0.4 + Math.random() * 0.5, p: Math.random() * 6 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    petals = new THREE.Points(geo, new THREE.PointsMaterial({ map: petalTexture(), size: 0.32, transparent: true, depthWrite: false }));
    petals.frustumCulled = false;
    group.add(petals);
    scene.add(group);
  }

  function update(delta, elapsed) {
    if (!petals) return;
    const pos = petals.geometry.attributes.position;
    for (let i = 0; i < petalData.length; i++) {
      const d = petalData[i];
      d.y -= d.v * delta;
      if (d.y < 0) d.y = PETAL_TOP;
      pos.setXYZ(i, d.x + Math.sin(elapsed * 0.9 + d.p) * 0.6, d.y, d.z + Math.cos(elapsed * 0.7 + d.p) * 0.4);
    }
    pos.needsUpdate = true;
  }

  return { setEvent, update };
}
