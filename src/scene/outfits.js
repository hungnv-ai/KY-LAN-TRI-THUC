import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { VALUES } from '../config.js';
import { SLOTS, getItem } from '../data/items.js';

/**
 * Tủ đồ 3D: dựng và gắn trang phục lên Kỳ lân theo `item.model` trong `src/data/items.js`.
 * Mỗi slot chỉ mặc một món; món cũ được gỡ và giải phóng bộ nhớ.
 *
 * @param {ReturnType<import('./mascot.js').createMascot>} mascot
 * @returns {{ equip: (itemId: string) => void, equipAll: (equipped: Record<string, string>) => void,
 *   update: (delta: number, elapsed: number) => void }}
 */
export function createWardrobe(mascot) {
  /** @type {Map<string, THREE.Object3D[]>} */
  const worn = new Map();
  /** @type {Map<string, (delta: number, elapsed: number) => void>} */
  const animators = new Map();

  function unequipSlot(slot) {
    for (const obj of worn.get(slot) ?? []) {
      obj.removeFromParent();
      disposeTree(obj);
    }
    worn.delete(slot);
    animators.delete(slot);
  }

  function equip(itemId) {
    const item = getItem(itemId);
    if (!item) return;
    unequipSlot(item.slot);
    if (!item.model) return;

    const builder = BUILDERS[item.model];
    const result = builder(mascot, item.params ?? {});
    const objects = result.objects ?? [];
    objects.forEach(enableShadows);
    worn.set(item.slot, objects);
    if (result.update) animators.set(item.slot, result.update);
  }

  function equipAll(equipped) {
    SLOTS.forEach(({ id }) => equipped[id] && equip(equipped[id]));
  }

  function update(delta, elapsed) {
    animators.forEach((fn) => fn(delta, elapsed));
  }

  return { equip, equipAll, update };
}

// ── Builders: mỗi hàm trả về { objects: Object3D[] đã gắn vào nhân vật, update? } ─────────────

const BUILDERS = {
  jacket(mascot, { body, trim, sparkle }) {
    const { jacket, jacketTrim } = mascot.materials;
    jacket.color.set(body);
    jacketTrim.color.set(trim);
    const glow = sparkle ? 0.18 : 0;
    jacket.emissive.set(sparkle ? trim : 0x000000).multiplyScalar(glow);
    jacketTrim.emissive.set(sparkle ? trim : 0x000000).multiplyScalar(sparkle ? 0.6 : 0);
    jacket.metalness = sparkle ? 0.25 : 0;
    // Áo đổi màu vật liệu sẵn có, không thêm object → không cần gỡ.
    return { objects: [] };
  },

  shoes(mascot, { body, sole, metal }) {
    const objects = [];
    for (const name of ['FootL', 'FootR']) {
      const shoe = new THREE.Group();
      const upper = new THREE.Mesh(
        new THREE.SphereGeometry(1, 24, 16),
        stdMat(body, metal ? 0.3 : 0.6, metal ? 0.75 : 0),
      );
      upper.scale.set(0.18, 0.12, 0.27);
      upper.position.set(0, 0.12, 0.05);
      shoe.add(upper);

      const soleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.07, 24), stdMat(sole, 0.8));
      soleMesh.scale.set(1.08, 1, 1.6);
      soleMesh.position.set(0, 0.035, 0.05);
      shoe.add(soleMesh);

      mascot.anchors[name].add(shoe);
      objects.push(shoe);
    }
    return { objects };
  },

  cap(mascot, { color }) {
    const cap = new THREE.Group();
    const material = stdMat(color, 0.7);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.44, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), material);
    dome.scale.set(1, 0.62, 1);
    cap.add(dome);

    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 32, 1, false, -Math.PI / 2, Math.PI), material);
    brim.scale.set(1.15, 1, 1.25);
    brim.position.set(0, 0.01, 0.3);
    brim.rotation.x = 0.12;
    cap.add(brim);

    const button = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), stdMat('#ffffff', 0.6));
    button.position.y = 0.27;
    cap.add(button);

    cap.position.y = 0.26;
    cap.scale.setScalar(1.2);
    mascot.anchors.HeadTop.add(cap);
    return { objects: [cap] };
  },

  nonLa(mascot) {
    const hat = new THREE.Group();
    const straw = stdMat('#E8CF8F', 0.9);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.78, 0.42, 40, 1, true), straw);
    cone.material.side = THREE.DoubleSide;
    cone.position.y = 0.21;
    hat.add(cone);

    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.78 * (1 - t), 0.008, 6, 40), stdMat('#C9A962', 0.9));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.42 * t;
      hat.add(ring);
    }
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.012, 6, 40, Math.PI), stdMat('#9A0036', 0.6));
    strap.rotation.z = Math.PI;
    strap.position.set(0, 0, 0.05);
    strap.scale.set(1, 1.3, 1);
    hat.add(strap);

    hat.position.y = 0.46;
    mascot.anchors.HeadTop.add(hat);
    return { objects: [hat] };
  },

  gradCap(mascot) {
    const hat = new THREE.Group();
    const black = stdMat('#1B1B1B', 0.7);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.22, 32), black);
    base.position.y = 0.05;
    hat.add(base);

    const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.9), black);
    board.position.y = 0.18;
    board.rotation.y = Math.PI / 4;
    hat.add(board);

    const gold = stdMat('#C49C57', 0.4, 0.5);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), gold);
    knot.position.y = 0.21;
    hat.add(knot);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 6), gold);
    cord.rotation.z = Math.PI / 2;
    cord.position.set(0.22, 0.21, 0);
    hat.add(cord);
    const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.045, 0.22, 10), gold);
    tassel.position.set(0.45, 0.09, 0);
    hat.add(tassel);

    hat.position.y = 0.4;
    hat.scale.setScalar(1.15);
    mascot.anchors.HeadTop.add(hat);
    return {
      objects: [hat],
      update: (_d, t) => (tassel.rotation.z = Math.sin(t * 2) * 0.12),
    };
  },

  crown(mascot) {
    const crown = new THREE.Group();
    const gold = stdMat('#E8B54E', 0.3, 0.7);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.34, 0.16, 40, 1, true), gold);
    band.material.side = THREE.DoubleSide;
    crown.add(band);

    // 5 đỉnh nhọn, mỗi đỉnh gắn một viên đá màu giá trị.
    VALUES.forEach((value, i) => {
      const a = (i / VALUES.length) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 12), gold);
      spike.position.set(Math.sin(a) * 0.35, 0.17, Math.cos(a) * 0.35);
      crown.add(spike);

      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.045),
        new THREE.MeshStandardMaterial({ color: value.color, emissive: value.color, emissiveIntensity: 0.4, roughness: 0.2 }),
      );
      gem.position.set(Math.sin(a) * 0.37, 0.0, Math.cos(a) * 0.37);
      crown.add(gem);
    });

    crown.position.y = 0.42;
    crown.scale.setScalar(1.15);
    mascot.anchors.HeadTop.add(crown);
    return {
      objects: [crown],
      update: (_d, t) => (crown.rotation.y = Math.sin(t * 0.8) * 0.15),
    };
  },

  /** Vòng hoa (sự kiện 20/11): vòng lá xanh + hoa nhiều màu quanh đầu. */
  flowerCrown(mascot) {
    const crown = new THREE.Group();
    const leaf = stdMat('#5E9E4A', 0.7);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.035, 10, 48), leaf);
    ring.rotation.x = Math.PI / 2;
    crown.add(ring);
    const PETAL_COLORS = ['#F48FB1', '#FFFFFF', '#FFD54F', '#E57373', '#CE93D8'];
    const COUNT = 9;
    for (let i = 0; i < COUNT; i++) {
      const a = (i / COUNT) * Math.PI * 2;
      const flower = new THREE.Group();
      const petalMat = stdMat(PETAL_COLORS[i % PETAL_COLORS.length], 0.5);
      for (let k = 0; k < 5; k++) {
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), petalMat);
        const pa = (k / 5) * Math.PI * 2;
        petal.position.set(Math.cos(pa) * 0.045, 0, Math.sin(pa) * 0.045);
        petal.scale.set(1, 0.45, 1);
        flower.add(petal);
      }
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), stdMat('#FFB300', 0.4));
      center.position.y = 0.015;
      flower.add(center);
      flower.position.set(Math.sin(a) * 0.38, 0.03, Math.cos(a) * 0.38);
      flower.rotation.set(0.5 * Math.cos(a), 0, -0.5 * Math.sin(a));
      crown.add(flower);
    }
    crown.position.y = 0.36;
    crown.scale.setScalar(1.15);
    mascot.anchors.HeadTop.add(crown);
    return { objects: [crown], update: (_d, t) => (crown.rotation.y = Math.sin(t * 0.6) * 0.08) };
  },

  /** Mưa cánh hoa (sự kiện 20/11): cánh hoa hồng rơi chầm chậm quanh Kỳ lân. */
  petals(mascot) {
    const group = new THREE.Group();
    const COUNT = 26;
    const colors = ['#F8BBD0', '#F48FB1', '#FFFFFF', '#FFCDD2'];
    const petals = [];
    for (let i = 0; i < COUNT; i++) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.055, 6), new THREE.MeshStandardMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide, roughness: 0.6 }));
      m.scale.set(1, 0.6, 1);
      group.add(m);
      petals.push({ m, a: Math.random() * Math.PI * 2, r: 0.6 + Math.random() * 0.9, h: Math.random() * 3.2, speed: 0.35 + Math.random() * 0.35, spin: 1 + Math.random() * 2 });
    }
    mascot.anchors.Root.add(group);
    return {
      objects: [group],
      update: (delta, t) => {
        for (const p of petals) {
          p.h -= p.speed * delta;
          if (p.h < 0) p.h += 3.2;
          const a = p.a + t * 0.4;
          p.m.position.set(Math.sin(a) * p.r + Math.sin(t * 1.3 + p.a) * 0.12, p.h, Math.cos(a) * p.r);
          p.m.rotation.set(t * p.spin, t * p.spin * 0.7, 0);
        }
      },
    };
  },

  glasses(mascot, { frame, lens, tint }) {
    const glasses = new THREE.Group();
    const frameMat = stdMat(frame, 0.4, 0.2);
    const lensMat = new THREE.MeshStandardMaterial({
      color: lens,
      transparent: true,
      opacity: tint,
      roughness: 0.1,
      metalness: 0.1,
    });

    for (const side of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.018, 10, 32), frameMat);
      rim.position.set(0.2 * side, 0, 0);
      glasses.add(rim);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(0.125, 32), lensMat);
      glass.position.set(0.2 * side, 0, 0.002);
      glasses.add(glass);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.32), frameMat);
      arm.position.set(0.33 * side, 0.01, -0.16);
      arm.rotation.y = -0.25 * side;
      glasses.add(arm);
    }
    const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 8, 16, Math.PI), frameMat);
    bridge.position.y = 0.02;
    glasses.add(bridge);

    glasses.position.set(0, -0.05, 0.53);
    mascot.anchors.Face.add(glasses);
    return { objects: [glasses] };
  },

  backpack(mascot, { color }) {
    const torso = mascot.anchors.Torso;
    const bag = new THREE.Group();
    const material = stdMat(color, 0.75);

    const body = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.6, 0.24, 4, 0.08), material);
    body.position.set(0, 0.02, -0.4);
    bag.add(body);

    const pocket = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.26, 0.1, 3, 0.04), material);
    pocket.position.set(0, -0.1, -0.54);
    bag.add(pocket);

    const zip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.015, 0.01), stdMat('#C49C57', 0.4, 0.6));
    zip.position.set(0, -0.02, -0.595);
    bag.add(zip);

    // Quai đeo vòng qua vai ra trước ngực.
    for (const side of [-1, 1]) {
      const x = 0.2 * side;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, 0.24, -0.3),
        new THREE.Vector3(x * 1.05, 0.42, -0.02),
        new THREE.Vector3(x * 1.08, 0.27, 0.3),
        new THREE.Vector3(x * 1.15, -0.1, 0.34),
      ]);
      const strap = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.03, 8), stdMat('#222222', 0.7));
      bag.add(strap);
    }

    torso.add(bag);
    return { objects: [bag] };
  },

  aura(mascot) {
    const aura = new THREE.Group();
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.03, 12, 48),
      new THREE.MeshStandardMaterial({ color: '#FFD86B', emissive: '#FFC233', emissiveIntensity: 1.2, roughness: 0.3 }),
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 3.05;
    aura.add(halo);

    const sparkles = [];
    VALUES.forEach((value, i) => {
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.07),
        new THREE.MeshStandardMaterial({ color: value.color, emissive: value.color, emissiveIntensity: 0.9 }),
      );
      aura.add(star);
      sparkles.push({ star, phase: (i / VALUES.length) * Math.PI * 2 });
    });

    mascot.anchors.Root.add(aura);
    return {
      objects: [aura],
      update: (_d, t) => {
        halo.position.y = 3.05 + Math.sin(t * 2) * 0.04;
        for (const { star, phase } of sparkles) {
          const a = t * 0.9 + phase;
          star.position.set(Math.sin(a) * 1.0, 1.2 + Math.sin(t * 1.7 + phase) * 0.5, Math.cos(a) * 1.0);
          star.rotation.y = t * 3;
        }
      },
    };
  },
};

function stdMat(color, roughness = 0.6, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function enableShadows(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
}

/** Giải phóng geometry/material của trang phục đã gỡ (không dùng chung với nơi khác). */
function disposeTree(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      m.map?.dispose();
      m.dispose();
    });
  });
}
