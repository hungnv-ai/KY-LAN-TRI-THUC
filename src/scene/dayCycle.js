import * as THREE from 'three';

/**
 * Ngày – hoàng hôn – đêm theo GIỜ VIỆT NAM thật: màu trời, sương mù, biển, ánh nắng thay đổi êm;
 * buổi tối có sao, đèn lồng sáng quanh quảng trường và đom đóm.
 * Xem thử một giờ bất kỳ: thêm `?time=19.5` (19 giờ 30) vào địa chỉ trang.
 */

/** Mốc màu theo giờ (h = giờ thập phân). Giữa hai mốc được trộn màu. */
const KEYS = [
  { h: 0, sky: ['#0b1d4a', '#1d3570', '#34508a'], sea: '#1d3f6e', sun: ['#9db8ff', 0.55], hemi: ['#6f86c9', '#2b2f4a', 0.55], night: 1 },
  { h: 5, sky: ['#1a2c66', '#4a5a9a', '#c792a8'], sea: '#2c5a8a', sun: ['#c8b6ff', 0.7], hemi: ['#8a96cf', '#4a3d52', 0.6], night: 0.8 },
  { h: 6.2, sky: ['#6aa6e6', '#f2c9a8', '#ffd9a0'], sea: '#4a9ccf', sun: ['#ffd2a1', 1.7], hemi: ['#cfe2ff', '#ffd9b5', 0.85], night: 0 },
  { h: 8, sky: ['#6fb1ee', '#a9d3f7', '#e9f3fb'], sea: '#4fb6e3', sun: ['#ffefd2', 2.4], hemi: ['#cfe8ff', '#ffe6c4', 0.95], night: 0 },
  { h: 16.3, sky: ['#6fb1ee', '#a9d3f7', '#e9f3fb'], sea: '#4fb6e3', sun: ['#ffefd2', 2.4], hemi: ['#cfe8ff', '#ffe6c4', 0.95], night: 0 },
  { h: 17.6, sky: ['#5f8fd6', '#f5a76c', '#ffcf8a'], sea: '#4a8fc0', sun: ['#ffb36b', 2.0], hemi: ['#ffd1b0', '#ffb08a', 0.9], night: 0 },
  { h: 18.5, sky: ['#3b3f8f', '#c56a8a', '#f59a6a'], sea: '#3a6a9a', sun: ['#ff9a6a', 1.3], hemi: ['#b48ac9', '#7a4a5a', 0.75], night: 0.45 },
  { h: 19.5, sky: ['#14245a', '#2e3f7e', '#5a5f9a'], sea: '#22487a', sun: ['#a7b8ff', 0.65], hemi: ['#7488c8', '#30304c', 0.6], night: 1 },
  { h: 24, sky: ['#0b1d4a', '#1d3570', '#34508a'], sea: '#1d3f6e', sun: ['#9db8ff', 0.55], hemi: ['#6f86c9', '#2b2f4a', 0.55], night: 1 },
];
const UPDATE_SEC = 20;
const STAR_COUNT = 420;
const FIREFLY_COUNT = 60;
/** Đèn lồng dọc 5 con đường: khoảng cách từ tâm (m) và lệch sang mép đường (m), so le hai bên. */
const LANTERN_ALONG = [6.5, 11];
const LANTERN_SIDE = 1.35;
const LANTERN_POLE_H = 1.25;

/** Giờ hiện tại ở Việt Nam (UTC+7), dạng thập phân; hoặc giờ xem thử trong địa chỉ. */
function vnHour() {
  try {
    const t = Number(new URLSearchParams(window.location.search).get('time'));
    if (Number.isFinite(t) && new URLSearchParams(window.location.search).has('time')) return ((t % 24) + 24) % 24;
  } catch {
    /* bỏ qua */
  }
  const now = new Date();
  return (now.getUTCHours() + 7 + now.getUTCMinutes() / 60) % 24;
}

const ca = new THREE.Color();
const cb = new THREE.Color();
function mix(a, b, t, out) {
  return out.copy(ca.set(a)).lerp(cb.set(b), t);
}

function sample(h) {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = THREE.MathUtils.smoothstep(h, a.h, b.h);
  return { a, b, t };
}

function glowTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * @param {THREE.Scene} scene
 * @param {{ hemi: THREE.HemisphereLight, ambient: THREE.AmbientLight, sun: THREE.DirectionalLight }} lights
 * @returns {{ update: (delta: number, elapsed: number) => void, isNight: () => boolean, hour: () => number }}
 */
export function createDayCycle(scene, lights) {
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 2;
  skyCanvas.height = 256;
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyTex;
  const sea = scene.getObjectByName('sea');
  const shallow = scene.getObjectByName('shallow');
  const shallowDay = new THREE.Color('#8FE3DD');
  const shallowNight = new THREE.Color('#2f6d8a');

  // Sao (chỉ hiện ban đêm).
  const starPos = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const a = Math.random() * Math.PI * 2;
    const el = 0.12 + Math.random() * 1.3;
    const r = 200;
    starPos.set([Math.cos(el) * Math.sin(a) * r, Math.sin(el) * r, Math.cos(el) * Math.cos(a) * r], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  stars.frustumCulled = false;
  scene.add(stars);

  // Đèn lồng đỏ VA quanh quảng trường (sáng dần khi chiều tối).
  const lanterns = new THREE.Group();
  const lanternGlow = glowTexture('rgba(255,236,170,1)', 'rgba(255,140,60,0.55)');
  const lanternMat = new THREE.MeshStandardMaterial({ color: '#C62828', emissive: '#ff7a3c', emissiveIntensity: 0, roughness: 0.5 });
  const poleMat = new THREE.MeshStandardMaterial({ color: '#5B412E', roughness: 0.8 });
  const glows = [];
  const gold = new THREE.MeshStandardMaterial({ color: '#E8B54E', metalness: 0.6, roughness: 0.35 });
  for (let k = 0; k < 5; k++) {
    const path = Math.PI + (k - 2) * ((Math.PI * 2) / 5); // cùng công thức góc với island.js
    const dir = new THREE.Vector2(Math.sin(path), Math.cos(path));
    LANTERN_ALONG.forEach((along, j) => {
      const side = (j + k) % 2 ? 1 : -1;
      const g = new THREE.Group();
      g.position.set(dir.x * along + dir.y * LANTERN_SIDE * side, 0, dir.y * along - dir.x * LANTERN_SIDE * side);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, LANTERN_POLE_H, 6), poleMat);
      pole.position.y = LANTERN_POLE_H / 2;
      pole.castShadow = true;
      g.add(pole);
      // Đèn lồng giấy đỏ kiểu Việt: thân bầu + nắp vàng trên dưới + tua.
      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), lanternMat);
      lantern.scale.set(1, 0.85, 1);
      lantern.position.y = LANTERN_POLE_H + 0.12;
      g.add(lantern);
      for (const dy of [0.14, -0.14]) {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 10), gold);
        cap.position.y = lantern.position.y + dy;
        g.add(cap);
      }
      const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 4), gold);
      tassel.position.y = lantern.position.y - 0.24;
      g.add(tassel);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: lanternGlow, transparent: true, depthWrite: false, opacity: 0, blending: THREE.AdditiveBlending }));
      glow.scale.setScalar(1.3);
      glow.position.y = lantern.position.y;
      g.add(glow);
      glows.push(glow);
      lanterns.add(g);
    });
  }
  scene.add(lanterns);
  const lanternLight = new THREE.PointLight('#ffb070', 0, 12, 1.6);
  lanternLight.position.set(0, 2.4, 0);
  scene.add(lanternLight);

  // Đom đóm quanh quảng trường.
  const flyPos = new Float32Array(FIREFLY_COUNT * 3);
  const flies = [];
  for (let i = 0; i < FIREFLY_COUNT; i++) {
    flies.push({ a: Math.random() * Math.PI * 2, r: 3 + Math.random() * 14, y: 0.4 + Math.random() * 1.6, p: Math.random() * 10, s: 0.1 + Math.random() * 0.2 });
  }
  const flyGeo = new THREE.BufferGeometry();
  flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
  const fireflies = new THREE.Points(flyGeo, new THREE.PointsMaterial({ map: glowTexture('rgba(255,255,200,1)', 'rgba(200,255,120,0.6)'), size: 0.35, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  fireflies.frustumCulled = false;
  scene.add(fireflies);

  let night = 0;
  let hour = vnHour();
  let timer = 0;
  const cSky = [new THREE.Color(), new THREE.Color(), new THREE.Color()];

  function apply() {
    hour = vnHour();
    const { a, b, t } = sample(hour);
    night = THREE.MathUtils.lerp(a.night, b.night, t);
    a.sky.forEach((c, i) => mix(c, b.sky[i], t, cSky[i]));
    const ctx = skyCanvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, `#${cSky[0].getHexString()}`);
    g.addColorStop(0.55, `#${cSky[1].getHexString()}`);
    g.addColorStop(1, `#${cSky[2].getHexString()}`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 2, 256);
    skyTex.needsUpdate = true;
    if (scene.fog) scene.fog.color.copy(cSky[2]);
    if (sea) mix(a.sea, b.sea, t, sea.material.color);
    if (shallow) shallow.material.color.copy(shallowDay).lerp(shallowNight, night);
    mix(a.sun[0], b.sun[0], t, lights.sun.color);
    lights.sun.intensity = THREE.MathUtils.lerp(a.sun[1], b.sun[1], t);
    mix(a.hemi[0], b.hemi[0], t, lights.hemi.color);
    mix(a.hemi[1], b.hemi[1], t, lights.hemi.groundColor);
    lights.hemi.intensity = THREE.MathUtils.lerp(a.hemi[2], b.hemi[2], t);
    lights.ambient.intensity = 0.35 + night * 0.1;
    lanternMat.emissiveIntensity = night * 1.6;
    glows.forEach((s) => (s.material.opacity = night * 0.9));
    lanternLight.intensity = night * 4;
  }
  apply();

  function update(delta, elapsed) {
    timer -= delta;
    if (timer <= 0) {
      timer = UPDATE_SEC;
      apply();
    }
    stars.material.opacity = night * (0.75 + Math.sin(elapsed * 0.7) * 0.1);
    stars.visible = night > 0.02;
    fireflies.visible = night > 0.3;
    if (fireflies.visible) {
      fireflies.material.opacity = night * (0.6 + Math.sin(elapsed * 3) * 0.3);
      const pos = flyGeo.attributes.position;
      flies.forEach((f, i) => {
        const a = f.a + elapsed * f.s;
        pos.setXYZ(i, Math.sin(a) * f.r, f.y + Math.sin(elapsed * 1.3 + f.p) * 0.35, Math.cos(a) * f.r);
      });
      pos.needsUpdate = true;
    }
  }

  return { update, isNight: () => night > 0.5, hour: () => hour };
}
