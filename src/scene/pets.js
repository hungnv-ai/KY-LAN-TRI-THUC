import * as THREE from 'three';
import { getPet } from '../data/pets.js';
import { createEmojiSprite } from './mascotParts.js';

/**
 * Thú cưng chibi dựng bằng code (theo `look` trong src/data/pets.js) + hành vi đi theo chủ:
 * bám phía sau-bên phải Kỳ lân, nhảy lon ton khi chạy, ngó nghiêng khi đứng yên.
 */

/** Vị trí đứng so với chủ (hệ toạ độ của chủ, m): bên phải, hơi lùi sau. */
const FOLLOW_OFFSET = new THREE.Vector3(0.95, 0, -0.25);
const FOLLOW_SPEED = 6;
/** Xa hơn khoảng này thì "dịch chuyển" luôn tới cạnh chủ (vd chủ về quảng trường). */
const TELEPORT_DIST = 8;
const HOP_HEIGHT = 0.09;
const HOP_FREQ = 13;

const BLACK = '#1d1d1d';

/** Vật liệu dùng lại theo màu (thú cưng của nhiều người dùng chung → nhẹ máy). */
const materials = new Map();
function mat(color, roughness = 0.55) {
  const key = `${color}|${roughness}`;
  if (!materials.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness });
    m.userData.shared = true;
    materials.set(key, m);
  }
  return materials.get(key);
}

function part(geometry, color, x = 0, y = 0, z = 0, roughness) {
  const m = new THREE.Mesh(geometry, mat(color, roughness));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function addEars(head, look) {
  const c = look.earColor ?? look.body;
  switch (look.ears) {
    case 'cat':
    case 'fox': {
      const big = look.ears === 'fox' ? 1.35 : 1;
      for (const s of [-1, 1]) {
        const ear = part(new THREE.ConeGeometry(0.05 * big, 0.11 * big, 4), look.body, 0.085 * s, 0.13, 0);
        ear.rotation.z = -0.35 * s;
        head.add(ear);
        const tip = part(new THREE.ConeGeometry(0.025 * big, 0.05 * big, 4), c, 0.1 * s, 0.17 * big, 0);
        tip.rotation.z = -0.35 * s;
        head.add(tip);
      }
      break;
    }
    case 'floppy':
      for (const s of [-1, 1]) {
        const ear = part(new THREE.SphereGeometry(0.06, 12, 10), c, 0.13 * s, 0.0, 0);
        ear.scale.set(0.45, 1.2, 0.8);
        ear.rotation.z = 0.25 * s;
        head.add(ear);
      }
      break;
    case 'bunny':
      for (const s of [-1, 1]) {
        const ear = part(new THREE.CapsuleGeometry(0.032, 0.17, 4, 10), look.body, 0.05 * s, 0.24, -0.01);
        ear.rotation.z = -0.12 * s;
        head.add(ear);
        const inner = part(new THREE.CapsuleGeometry(0.018, 0.13, 4, 8), look.earInner ?? '#FFB3C8', 0.052 * s, 0.24, 0.018);
        inner.rotation.z = -0.12 * s;
        head.add(inner);
      }
      break;
    case 'round':
      for (const s of [-1, 1]) head.add(part(new THREE.SphereGeometry(0.05, 12, 10), c, 0.105 * s, 0.11, -0.01));
      break;
    case 'tuft': {
      const tuft = part(new THREE.ConeGeometry(0.03, 0.08, 6), look.body, 0, 0.17, 0);
      tuft.rotation.z = 0.3;
      head.add(tuft);
      break;
    }
    case 'horns':
      for (const s of [-1, 1]) {
        const horn = part(new THREE.ConeGeometry(0.022, 0.09, 8), '#FFD54F', 0.06 * s, 0.15, -0.01, 0.3);
        horn.rotation.z = -0.25 * s;
        head.add(horn);
      }
      break;
    default:
      break;
  }
}

function addFace(head, look) {
  for (const s of [-1, 1]) {
    if (look.patches) {
      const patch = part(new THREE.SphereGeometry(0.04, 12, 10), look.patches, 0.055 * s, 0.01, 0.125);
      patch.scale.set(1, 1.25, 0.5);
      patch.rotation.z = 0.5 * s;
      head.add(patch);
    }
    head.add(part(new THREE.SphereGeometry(0.026, 12, 10), BLACK, 0.055 * s, 0.015, 0.138, 0.2));
    head.add(part(new THREE.SphereGeometry(0.009, 8, 6), '#ffffff', 0.062 * s, 0.026, 0.16, 0.2));
    const cheek = part(new THREE.SphereGeometry(0.02, 10, 8), '#FF9AA8', 0.095 * s, -0.035, 0.115);
    cheek.scale.set(1, 0.6, 0.4);
    head.add(cheek);
  }
  if (look.beak) {
    const beak = part(new THREE.ConeGeometry(0.03, 0.06, 8), look.beak, 0, -0.02, 0.165);
    beak.rotation.x = Math.PI / 2;
    head.add(beak);
  } else {
    head.add(part(new THREE.SphereGeometry(0.016, 8, 6), '#5a3b2e', 0, -0.025, 0.152, 0.3));
  }
  if (look.stripes) {
    for (const x of [-0.035, 0.035]) {
      const stripe = part(new THREE.BoxGeometry(0.015, 0.05, 0.02), look.stripes, x, 0.1, 0.1);
      stripe.rotation.x = -0.5;
      head.add(stripe);
    }
  }
}

function addTail(body, look) {
  switch (look.tail) {
    case 'long': {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.12, -0.15),
        new THREE.Vector3(0, 0.2, -0.26),
        new THREE.Vector3(0.03, 0.34, -0.27),
      ]);
      body.add(part(new THREE.TubeGeometry(curve, 12, 0.022, 8), look.body, 0, 0, 0));
      return null;
    }
    case 'bushy': {
      const tail = part(new THREE.SphereGeometry(0.08, 14, 12), look.body, 0, 0.2, -0.22);
      tail.scale.set(0.75, 0.75, 1.5);
      tail.rotation.x = 0.7;
      tail.add(part(new THREE.SphereGeometry(0.045, 12, 10), look.belly, 0, 0, -0.07));
      body.add(tail);
      return tail;
    }
    case 'puff':
      body.add(part(new THREE.SphereGeometry(0.05, 12, 10), '#ffffff', 0, 0.14, -0.17));
      return null;
    case 'dragon': {
      const tail = part(new THREE.ConeGeometry(0.05, 0.22, 10), look.body, 0, 0.1, -0.24);
      tail.rotation.x = -1.2;
      body.add(tail);
      return tail;
    }
    case 'short': {
      const tail = part(new THREE.SphereGeometry(0.035, 10, 8), look.body, 0, 0.16, -0.17);
      body.add(tail);
      return tail;
    }
    default:
      return null;
  }
}

/**
 * Dựng mô hình một thú cưng.
 *
 * @param {string} petId
 * @returns {{ object: THREE.Group, update: (delta: number, elapsed: number, moving: boolean) => void } | null}
 */
export function createPetModel(petId) {
  const pet = getPet(petId);
  if (!pet) return null;
  const look = pet.look;
  const root = new THREE.Group();
  root.name = `pet:${petId}`;
  const bodyGroup = new THREE.Group();
  bodyGroup.scale.setScalar(look.scale ?? 1);
  root.add(bodyGroup);

  const body = part(new THREE.SphereGeometry(0.16, 20, 16), look.body, 0, 0.17, 0);
  body.scale.set(1, 0.88, 1.12);
  bodyGroup.add(body);
  const belly = part(new THREE.SphereGeometry(0.11, 16, 12), look.belly, 0, 0.15, 0.08);
  belly.scale.set(1, 1, 0.6);
  bodyGroup.add(belly);
  for (const [x, z] of [[-0.08, 0.08], [0.08, 0.08], [-0.08, -0.08], [0.08, -0.08]]) {
    bodyGroup.add(part(new THREE.SphereGeometry(0.04, 10, 8), look.belly, x, 0.035, z));
  }
  if (look.shell) {
    const shell = part(new THREE.SphereGeometry(0.19, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), look.shell, 0, 0.17, -0.02);
    shell.scale.set(1, 0.85, 1.15);
    bodyGroup.add(shell);
  }

  const head = new THREE.Group();
  head.position.set(0, 0.38, 0.05);
  head.add(part(new THREE.SphereGeometry(0.145, 20, 16), look.body, 0, 0, 0));
  const muzzle = part(new THREE.SphereGeometry(0.07, 14, 10), look.belly, 0, -0.035, 0.1);
  muzzle.scale.set(1.2, 0.8, 0.7);
  head.add(muzzle);
  addEars(head, look);
  addFace(head, look);
  bodyGroup.add(head);

  const tail = addTail(bodyGroup, look);
  const wings = [];
  if (look.wings) {
    const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.16, 0.08), new THREE.Vector2(0.12, -0.06)]);
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: look.wings, side: THREE.DoubleSide, roughness: 0.4 }));
      wing.position.set(0.08 * s, 0.26, -0.06);
      wing.scale.x = s;
      wing.castShadow = true;
      bodyGroup.add(wing);
      wings.push(wing);
    }
  }
  let sparkle = null;
  if (look.sparkle) {
    sparkle = createEmojiSprite('✨');
    sparkle.scale.setScalar(0.18);
    sparkle.position.set(0.15, 0.6, 0);
    bodyGroup.add(sparkle);
  }

  const phase = Math.random() * 10;
  function update(delta, elapsed, moving) {
    const t = elapsed + phase;
    if (moving) {
      bodyGroup.position.y = Math.abs(Math.sin(t * HOP_FREQ)) * HOP_HEIGHT;
      bodyGroup.rotation.z = Math.sin(t * HOP_FREQ) * 0.08;
      head.rotation.y = 0;
    } else {
      bodyGroup.position.y = Math.sin(t * 2.2) * 0.008;
      bodyGroup.rotation.z *= 0.9;
      head.rotation.y = Math.sin(t * 0.7) * 0.5 * (Math.sin(t * 0.23) > 0 ? 1 : 0.2);
    }
    if (tail) tail.rotation.y = Math.sin(t * (moving ? 14 : 5)) * 0.5;
    wings.forEach((w, i) => (w.rotation.y = (i ? -1 : 1) * (0.3 + Math.sin(t * 9) * 0.35)));
    if (sparkle) {
      sparkle.material.rotation = t;
      sparkle.material.opacity = 0.5 + 0.5 * Math.sin(t * 3);
    }
  }

  return { object: root, update };
}

/**
 * Thú cưng đi theo một Kỳ lân.
 *
 * @param {THREE.Scene} scene
 * @param {{ groundHeight: (x: number, z: number) => number }} island
 * @returns {{ setPet: (petId: string | null) => void, update: (delta: number, elapsed: number, owner: THREE.Object3D) => void,
 *   current: () => string | null, position: () => THREE.Vector3 | null, dispose: () => void }}
 */
export function createPetFollower(scene, island) {
  let model = null;
  let petId = null;
  let placed = false;
  const target = new THREE.Vector3();
  const prev = new THREE.Vector3();

  function setPet(id) {
    if (id === petId) return;
    dispose();
    petId = id ?? null;
    if (!petId) return;
    model = createPetModel(petId);
    if (model) scene.add(model.object);
    placed = false;
  }

  function update(delta, elapsed, owner) {
    if (!model) return;
    const obj = model.object;
    target.copy(FOLLOW_OFFSET).applyAxisAngle(THREE.Object3D.DEFAULT_UP, owner.rotation.y).add(owner.position);
    prev.copy(obj.position);
    if (!placed || obj.position.distanceTo(target) > TELEPORT_DIST) {
      obj.position.copy(target);
      placed = true;
    } else {
      const k = 1 - Math.exp(-delta * FOLLOW_SPEED);
      obj.position.x += (target.x - obj.position.x) * k;
      obj.position.z += (target.z - obj.position.z) * k;
    }
    obj.position.y = island.groundHeight(obj.position.x, obj.position.z);
    const dx = obj.position.x - prev.x;
    const dz = obj.position.z - prev.z;
    const speed = Math.hypot(dx, dz) / Math.max(delta, 1e-4);
    const moving = speed > 0.4;
    if (moving) {
      const want = Math.atan2(dx, dz);
      const diff = Math.atan2(Math.sin(want - obj.rotation.y), Math.cos(want - obj.rotation.y));
      obj.rotation.y += diff * Math.min(1, delta * 10);
    } else {
      // Đứng yên: quay dần về hướng chủ đang nhìn.
      const diff = Math.atan2(Math.sin(owner.rotation.y - obj.rotation.y), Math.cos(owner.rotation.y - obj.rotation.y));
      obj.rotation.y += diff * Math.min(1, delta * 2);
    }
    model.update(delta, elapsed, moving);
  }

  function dispose() {
    if (!model) return;
    scene.remove(model.object);
    model.object.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && !o.material.userData?.shared) o.material.dispose();
    });
    model = null;
  }

  return { setPet, update, current: () => petId, position: () => model?.object.position ?? null, dispose };
}
