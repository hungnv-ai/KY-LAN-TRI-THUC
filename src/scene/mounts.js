import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Kỳ lân được nâng lên bao nhiêu (m) khi đứng trên từng loại thú cưỡi. */
const LIFT = { board: 0.2, cloud: 0.5 };
const WHEEL_RADIUS = 0.06;
const BOARD_LENGTH = 0.95;
const CLOUD_BOB = 0.06;
const COLORS = { deck: '#C8102E', stripe: '#F2C230', wheel: '#2B2B2B', truck: '#B8BCC4', cloud: '#FFFFFF', cloudShade: '#DCE9FF' };

/** Geometry & material dùng chung cho mọi Kỳ lân (mình + người khác) — không dispose. */
let shared = null;

function buildShared() {
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
  const deck = new THREE.CapsuleGeometry(0.2, BOARD_LENGTH - 0.4, 4, 12);
  deck.rotateX(Math.PI / 2);
  deck.scale(1, 0.12, 1);
  const stripe = new THREE.BoxGeometry(0.1, 0.012, BOARD_LENGTH * 0.7);
  stripe.translate(0, 0.026, 0);
  const wheel = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.05, 14);
  wheel.rotateZ(Math.PI / 2);
  const truck = new THREE.BoxGeometry(0.34, 0.03, 0.05);
  // Mây: vài quả cầu gộp thành một khối (một draw call).
  const puffs = [
    [0, 0, 0, 0.42],
    [0.36, -0.02, 0.08, 0.3],
    [-0.36, -0.02, -0.05, 0.32],
    [0.12, 0.05, -0.32, 0.28],
    [-0.1, 0.02, 0.34, 0.3],
    [0.3, -0.05, -0.28, 0.22],
  ].map(([x, y, z, r]) => {
    const g = new THREE.SphereGeometry(r, 14, 10);
    g.scale(1, 0.6, 1);
    g.translate(x, y, z);
    return g;
  });
  const cloud = mergeGeometries(puffs);
  puffs.forEach((g) => g.dispose());
  return {
    deck,
    stripe,
    wheel,
    truck,
    cloud,
    deckMat: mat(COLORS.deck, { roughness: 0.45 }),
    stripeMat: mat(COLORS.stripe, { metalness: 0.3, roughness: 0.4 }),
    wheelMat: mat(COLORS.wheel, { roughness: 0.8 }),
    truckMat: mat(COLORS.truck, { metalness: 0.7, roughness: 0.35 }),
    cloudMat: mat(COLORS.cloud, { roughness: 0.95, emissive: COLORS.cloudShade, emissiveIntensity: 0.25 }),
  };
}

function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildBoard(s) {
  const g = new THREE.Group();
  const top = WHEEL_RADIUS * 2 + 0.02;
  const deck = shadowed(new THREE.Mesh(s.deck, s.deckMat));
  deck.position.y = top;
  const stripe = new THREE.Mesh(s.stripe, s.stripeMat);
  stripe.position.y = top;
  g.add(deck, stripe);
  const wheels = [];
  for (const z of [-0.3, 0.3]) {
    const truck = new THREE.Mesh(s.truck, s.truckMat);
    truck.position.set(0, WHEEL_RADIUS + 0.01, z);
    g.add(truck);
    for (const x of [-0.17, 0.17]) {
      const w = shadowed(new THREE.Mesh(s.wheel, s.wheelMat));
      w.position.set(x, WHEEL_RADIUS, z);
      g.add(w);
      wheels.push(w);
    }
  }
  g.userData.wheels = wheels;
  return g;
}

function buildCloud(s) {
  const g = new THREE.Group();
  const c = shadowed(new THREE.Mesh(s.cloud, s.cloudMat));
  c.position.y = 0.32;
  g.add(c);
  return g;
}

/**
 * Thú cưỡi gắn dưới chân một Kỳ lân (của mình hoặc người khác): ván trượt VA / mây thần.
 *
 * @param {{ anchors: { Root: THREE.Object3D }, setLift: (y: number) => void }} mascot
 * @returns {{ set: (id: string | null) => void, current: () => string | null,
 *   update: (delta: number, elapsed: number, speed: number) => void, dispose: () => void }}
 *   `speed` = tốc độ đang đi (m/s) để bánh xe quay / ván nghiêng.
 */
export function createMountRig(mascot) {
  shared ??= buildShared();
  let id = null;
  let obj = null;

  function set(next) {
    const want = LIFT[next] !== undefined ? next : null;
    if (want === id) return;
    if (obj) mascot.anchors.Root.remove(obj);
    id = want;
    obj = id === 'board' ? buildBoard(shared) : id === 'cloud' ? buildCloud(shared) : null;
    if (obj) mascot.anchors.Root.add(obj);
    mascot.setLift(id ? LIFT[id] : 0);
  }

  function update(delta, elapsed, speed) {
    if (!obj) return;
    if (id === 'board') {
      for (const w of obj.userData.wheels) w.rotation.x += (speed / WHEEL_RADIUS) * delta;
      obj.rotation.x = -Math.min(0.08, speed * 0.008);
    } else {
      const bob = Math.sin(elapsed * 2.4) * CLOUD_BOB;
      obj.position.y = bob;
      obj.rotation.y = Math.sin(elapsed * 0.7) * 0.15;
      mascot.setLift(LIFT.cloud + bob);
    }
  }

  return { set, current: () => id, update, dispose: () => set(null) };
}
