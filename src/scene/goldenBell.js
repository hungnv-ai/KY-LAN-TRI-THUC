import * as THREE from 'three';

/**
 * Chuông vàng trên quảng trường khi có trận Rung Chuông Vàng: khung gỗ đỏ VA, chuông vàng
 * đung đưa và ngân khi công bố đáp án, vòng sáng dưới đất khi trận đang diễn ra.
 */

/** Đặt chuông giữa hai con đường đầu tiên, cách tâm đảo bấy nhiêu mét. */
const BELL_DISTANCE = 7.5;
const BEAM_Y = 2.9;
const SWING_DECAY = 1.6;
const SIGN_SCREEN_HEIGHT = 0.028;

function signSprite(text) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = 'bold 54px "Be Vietnam Pro", Arial, sans-serif';
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 70;
  canvas.width = w;
  canvas.height = 96;
  ctx.font = font;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#E8B54E');
  g.addColorStop(1, '#C48A1E');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(4, 4, w - 8, 88, 44);
  ctx.fill();
  ctx.fillStyle = '#4a2a00';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, 52);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, sizeAttenuation: false }));
  sprite.scale.set((SIGN_SCREEN_HEIGHT * w) / 96, SIGN_SCREEN_HEIGHT, 1);
  return sprite;
}

/**
 * @param {THREE.Scene} scene
 * @param {{ stations: { position: THREE.Vector3 }[], groundHeight: (x: number, z: number) => number }} island
 * @returns {{ setVisible: (visible: boolean) => void, setLive: (live: boolean) => void, ring: () => void,
 *   update: (delta: number, elapsed: number) => void, position: THREE.Vector3 }}
 */
export function createGoldenBell(scene, island) {
  const root = new THREE.Group();
  root.name = 'golden-bell';
  root.visible = false;

  const [a, b] = island.stations;
  const dir = a.position.clone().add(b.position).setY(0).normalize();
  root.position.copy(dir.multiplyScalar(BELL_DISTANCE));
  root.position.y = island.groundHeight(root.position.x, root.position.z);
  root.rotation.y = Math.atan2(root.position.x, root.position.z);

  const wood = new THREE.MeshStandardMaterial({ color: '#9A0036', roughness: 0.6 });
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, BEAM_Y, 12), wood);
    post.position.set(0.95 * s, BEAM_Y / 2, 0);
    root.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.16, 0.2), wood);
  beam.position.y = BEAM_Y;
  root.add(beam);

  const pivot = new THREE.Group();
  pivot.position.y = BEAM_Y - 0.08;
  root.add(pivot);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6), new THREE.MeshStandardMaterial({ color: '#5a3b2e' }));
  rope.position.y = -0.12;
  pivot.add(rope);

  const profile = [
    [0, 1.0], [0.12, 0.98], [0.22, 0.9], [0.28, 0.76], [0.31, 0.52], [0.36, 0.3], [0.45, 0.12], [0.52, 0.03], [0.5, 0],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const gold = new THREE.MeshStandardMaterial({ color: '#F2C14E', metalness: 0.85, roughness: 0.25, emissive: '#7a5200', emissiveIntensity: 0.25, side: THREE.DoubleSide });
  const bell = new THREE.Mesh(new THREE.LatheGeometry(profile, 40), gold);
  bell.scale.setScalar(1.25);
  bell.position.y = -0.25 - 1.25;
  pivot.add(bell);
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), gold);
  clapper.position.y = -1.42;
  pivot.add(clapper);

  const glow = new THREE.Mesh(
    new THREE.TorusGeometry(1.35, 0.06, 10, 48),
    new THREE.MeshStandardMaterial({ color: '#FFD86B', emissive: '#FFC233', emissiveIntensity: 1.4 }),
  );
  glow.rotation.x = Math.PI / 2;
  glow.position.y = 0.05;
  glow.visible = false;
  root.add(glow);

  const sign = signSprite('🔔 Rung Chuông Vàng');
  sign.position.y = BEAM_Y + 0.55;
  sign.userData.fade = { near: 12, far: 20, overview: 'show' };
  root.add(sign);

  root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  scene.add(root);

  let swing = 0;
  let swingTime = 0;

  return {
    position: root.position,
    setVisible: (visible) => (root.visible = visible),
    setLive: (live) => (glow.visible = live),
    ring() {
      swing = 0.45;
      swingTime = 0;
    },
    update(delta, elapsed) {
      if (!root.visible) return;
      swingTime += delta;
      const amp = swing * Math.exp(-swingTime * SWING_DECAY);
      pivot.rotation.z = amp * Math.sin(swingTime * 7) + Math.sin(elapsed * 1.2) * 0.02;
      if (glow.visible) glow.scale.setScalar(1 + Math.sin(elapsed * 3) * 0.05);
    },
  };
}
