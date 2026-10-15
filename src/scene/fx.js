import * as THREE from 'three';
import { VALUES } from '../config.js';

/**
 * Hiệu ứng thị giác trong không gian 3D: pháo hoa hạt, vòng sóng lan toả, cột sáng,
 * tia sáng xoáy quanh nhân vật ("nạp quà") và chữ thưởng bay lên.
 * Dùng pool đối tượng để không tạo/huỷ liên tục.
 */

const PARTICLE_POOL = 220;
const RING_POOL = 4;
const PILLAR_POOL = 2;
const GRAVITY = 7;
const VALUE_COLORS = VALUES.map((v) => v.color);

/**
 * @param {THREE.Scene} scene
 * @returns {{
 *   burst: (pos: THREE.Vector3, opts?: { colors?: string[], count?: number, speed?: number, up?: number, size?: number, life?: number }) => void,
 *   ring: (pos: THREE.Vector3, color?: string) => void,
 *   pillar: (pos: THREE.Vector3, color?: string) => void,
 *   aura: (target: THREE.Object3D, opts?: { duration?: number, colors?: string[] }) => void,
 *   floatText: (pos: THREE.Vector3, text: string, color?: string) => void,
 *   celebrate: (target: THREE.Object3D, opts?: { color?: string, colors?: string[] }) => void,
 *   update: (delta: number) => void,
 * }}
 */
export function createFx(scene) {
  const sparkTexture = createSparkTexture();

  // ── Hạt ─────────────────────────────────────────────────────────────
  const particles = [];
  for (let i = 0; i < PARTICLE_POOL; i++) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sparkTexture,
        transparent: true,
        depthWrite: false,
      }),
    );
    sprite.visible = false;
    sprite.renderOrder = 20;
    scene.add(sprite);
    particles.push({ sprite, vel: new THREE.Vector3(), life: 0, maxLife: 1, size: 0.2, gravity: 1, active: false });
  }
  let nextParticle = 0;

  function spawnParticle(pos, vel, color, size, life, gravity = 1) {
    const p = particles[nextParticle];
    nextParticle = (nextParticle + 1) % PARTICLE_POOL;
    p.sprite.position.copy(pos);
    p.sprite.material.color.set(color);
    p.vel.copy(vel);
    p.size = size;
    p.life = life;
    p.maxLife = life;
    p.gravity = gravity;
    p.active = true;
    p.sprite.visible = true;
  }

  const tmpVel = new THREE.Vector3();
  function burst(pos, { colors = VALUE_COLORS, count = 40, speed = 4, up = 3, size = 0.22, life = 1.1 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      tmpVel.set(Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s);
      spawnParticle(pos, tmpVel, colors[i % colors.length], size * (0.6 + Math.random() * 0.8), life * (0.7 + Math.random() * 0.5));
    }
  }

  // ── Vòng sóng lan toả trên mặt đất ──────────────────────────────────
  const rings = [];
  for (let i = 0; i < RING_POOL; i++) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1, 48),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    scene.add(mesh);
    rings.push({ mesh, t: 0, active: false });
  }
  let nextRing = 0;
  function ring(pos, color = '#FFD86B') {
    const r = rings[nextRing];
    nextRing = (nextRing + 1) % RING_POOL;
    r.mesh.position.set(pos.x, pos.y + 0.05, pos.z);
    r.mesh.material.color.set(color);
    r.t = 0;
    r.active = true;
    r.mesh.visible = true;
  }

  // ── Cột sáng ────────────────────────────────────────────────────────
  const pillars = [];
  for (let i = 0; i < PILLAR_POOL; i++) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 1, 7, 24, 1, true),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, map: createBeamTexture() }),
    );
    mesh.visible = false;
    scene.add(mesh);
    pillars.push({ mesh, t: 0, active: false });
  }
  let nextPillar = 0;
  function pillar(pos, color = '#FFD86B') {
    const p = pillars[nextPillar];
    nextPillar = (nextPillar + 1) % PILLAR_POOL;
    p.mesh.position.set(pos.x, pos.y + 3.5, pos.z);
    p.mesh.material.color.set(color);
    p.t = 0;
    p.active = true;
    p.mesh.visible = true;
  }

  // ── Tia sáng xoáy quanh nhân vật ("nạp quà") ────────────────────────
  const auras = [];
  function aura(target, { duration = 1.6, colors = ['#FFD86B', '#FFFFFF', ...VALUE_COLORS] } = {}) {
    auras.push({ target, t: 0, duration, colors, emitted: 0 });
  }

  // ── Chữ thưởng bay lên ──────────────────────────────────────────────
  const texts = [];
  function floatText(pos, text, color = '#C49C57') {
    const sprite = createTextSprite(text, color);
    sprite.position.copy(pos);
    sprite.renderOrder = 30;
    scene.add(sprite);
    texts.push({ sprite, t: 0, base: pos.clone() });
  }

  /** Gói hiệu ứng ăn mừng lớn: cột sáng + vòng sóng + pháo hoa + tia xoáy. */
  function celebrate(target, { color = '#FFD86B', colors = VALUE_COLORS } = {}) {
    const pos = target.position;
    pillar(pos, color);
    ring(pos, color);
    setTimeout(() => ring(pos, colors[0]), 180);
    burst(new THREE.Vector3(pos.x, pos.y + 2.2, pos.z), { colors: [color, ...colors], count: 70, speed: 4.5, up: 4 });
    aura(target, { colors: [color, '#FFFFFF', ...colors] });
  }

  const tmpPos = new THREE.Vector3();
  function update(delta) {
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= delta;
      if (p.life <= 0) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }
      p.vel.y -= GRAVITY * p.gravity * delta;
      p.sprite.position.addScaledVector(p.vel, delta);
      const k = p.life / p.maxLife;
      p.sprite.material.opacity = Math.min(1, k * 2);
      p.sprite.scale.setScalar(p.size * (0.6 + k) * 1.6);
    }

    for (const r of rings) {
      if (!r.active) continue;
      r.t += delta;
      const k = r.t / 0.8;
      if (k >= 1) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      r.mesh.scale.setScalar(0.3 + k * 4);
      r.mesh.material.opacity = 1 - k;
    }

    for (const p of pillars) {
      if (!p.active) continue;
      p.t += delta;
      const k = p.t / 1.4;
      if (k >= 1) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      const grow = Math.min(1, k * 5);
      p.mesh.scale.set(grow * (1 - k * 0.5), 0.3 + grow * 0.7, grow * (1 - k * 0.5));
      p.mesh.material.opacity = 0.75 * (1 - k);
    }

    for (let i = auras.length - 1; i >= 0; i--) {
      const a = auras[i];
      a.t += delta;
      if (a.t >= a.duration) {
        auras.splice(i, 1);
        continue;
      }
      // Phát hạt theo hình xoắn ốc đi lên quanh nhân vật.
      const want = Math.floor(a.t * 45);
      while (a.emitted < want) {
        a.emitted += 1;
        const angle = a.emitted * 0.7;
        const radius = 0.9;
        tmpPos.set(
          a.target.position.x + Math.cos(angle) * radius,
          a.target.position.y + 0.2 + (a.emitted % 10) * 0.15,
          a.target.position.z + Math.sin(angle) * radius,
        );
        tmpVel.set(-Math.sin(angle) * 1.2, 2.4, Math.cos(angle) * 1.2);
        spawnParticle(tmpPos, tmpVel, a.colors[a.emitted % a.colors.length], 0.2, 0.9, 0.05);
      }
    }

    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      t.t += delta;
      const k = t.t / 1.6;
      if (k >= 1) {
        scene.remove(t.sprite);
        t.sprite.material.map.dispose();
        t.sprite.material.dispose();
        texts.splice(i, 1);
        continue;
      }
      const pop = Math.min(1, t.t * 6);
      t.sprite.position.set(t.base.x, t.base.y + k * 1.4, t.base.z);
      t.sprite.scale.set(t.sprite.userData.w * pop, t.sprite.userData.h * pop, 1);
      t.sprite.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    }
  }

  return { burst, ring, pillar, aura, floatText, celebrate, update };
}

function createSparkTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.95)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  // Ngôi sao 4 cánh: màu đặc (thấy rõ cả trên nền sáng), tô theo màu của từng hạt.
  ctx.fillStyle = g;
  ctx.beginPath();
  const c = size / 2;
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? c - 2 : c * 0.32;
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

/** Cột sáng: đậm ở chân, mờ dần lên trên. */
function createBeamTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 128);
  return new THREE.CanvasTexture(canvas);
}

function createTextSprite(text, color) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = '800 72px "Be Vietnam Pro", Arial, sans-serif';
  ctx.font = font;
  const width = Math.ceil(ctx.measureText(text).width) + 40;
  canvas.width = width;
  canvas.height = 104;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#ffffff';
  ctx.lineJoin = 'round';
  ctx.strokeText(text, width / 2, 56);
  ctx.fillStyle = color;
  ctx.fillText(text, width / 2, 56);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false }));
  const h = 0.55;
  sprite.userData.w = (h * width) / 104;
  sprite.userData.h = h;
  return sprite;
}
