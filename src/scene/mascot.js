import * as THREE from 'three';
import { EMOTES, PROPS, REST_POSE } from './emotes.js';
import {
  addFlameMane,
  addHorn,
  createBadge,
  createEmojiSprite,
  createEye,
  createHand,
  createMouth,
  createSpiralBrowGeometry,
  mat,
  mesh,
  placeOnEllipsoid,
} from './mascotParts.js';

/**
 * Linh vật Kỳ lân VA Schools dựng bằng Three.js, có bộ cảm xúc theo sticker mascot.
 *
 * Nét nhận diện bắt buộc (Brand Guideline): bờm lửa đỏ, SỪNG VÀNG, LÔNG MÀY VÀNG XOẮN,
 * mắt to, BÀN TAY 4 NGÓN, áo khoác đỏ có logo VA, quần soóc nâu đỏ, giày đỏ.
 * Hướng mặt: +Z. Chiều cao ~2.7 đơn vị, đứng trên y = 0.
 */

const COLORS = {
  head: 0xd8372e,
  limb: 0xec5a26,
  snout: 0xdd4033,
  gold: 0xe6b04c,
  eye: 0x141010,
  eyeRim: 0x4a2a1a,
  mouth: 0x6e1a12,
  mouthInside: 0x5a0f12,
  tongue: 0xff7b86,
  shorts: 0x5c1a17,
  stitch: 0x3a0f0c,
};

// Tỉ lệ theo ảnh mẫu (docs/mascot-reference/01-dung-chuan-chong-hong.png):
// đầu + bờm ~42% chiều cao, áo khoác dáng hộp, quần tới gối, giày to.
const HEAD_PIVOT_Y = 1.42;
const HEAD_CENTER_Y = 0.46; // so với HEAD_PIVOT_Y (trước khi nhân HEAD_SIZE)
const HEAD_RADIUS = 0.56;
const HEAD_SIZE = 0.88;
const HEAD_SCALE = new THREE.Vector3(1.12, 0.92, 0.9);
const ARM_REST_Z = REST_POSE.armL[1];
const TORSO_Y = 1.05;
/** Profile áo khoác [bán kính, y] từ gấu áo lên cổ. */
const JACKET_PROFILE = [
  [0.001, -0.34],
  [0.39, -0.34],
  [0.43, -0.3],
  [0.45, -0.1],
  [0.455, 0.1],
  [0.42, 0.27],
  [0.31, 0.37],
  [0.2, 0.4],
  [0.001, 0.41],
];
/** Áo dẹt theo chiều trước–sau. */
const JACKET_DEPTH = 0.8;

/** Bán kính áo tại độ cao y (nội suy theo JACKET_PROFILE). */
function jacketRadiusAt(y) {
  for (let i = 1; i < JACKET_PROFILE.length; i++) {
    const [r1, y1] = JACKET_PROFILE[i];
    if (y <= y1) {
      const [r0, y0] = JACKET_PROFILE[i - 1];
      return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
    }
  }
  return 0;
}

/** Tốc độ chuyển tư thế (càng lớn càng nhanh). */
const POSE_SPEED = 12;
/** Không có tương tác quá lâu (giây) thì Kỳ lân "chán". */
const IDLE_BORED_SEC = 28;

/**
 * @returns {{
 *   object: THREE.Group,
 *   materials: Record<string, THREE.Material>,
 *   anchors: Record<string, THREE.Object3D>,
 *   update: (delta: number, elapsed: number) => void,
 *   emote: (name: keyof typeof EMOTES) => void,
 *   setMood: (name: keyof typeof EMOTES | null) => void,
 *   headWorldPosition: (target?: THREE.Vector3) => THREE.Vector3,
 * }}
 */
export function createMascot() {
  const materials = {
    head: mat(COLORS.head, 0.55),
    limb: mat(COLORS.limb, 0.55),
    snout: mat(COLORS.snout, 0.55),
    gold: mat(COLORS.gold, 0.3, 0.5),
    eye: mat(COLORS.eye, 0.15),
    eyeRim: mat(COLORS.eyeRim, 0.4),
    sclera: mat(0xffffff, 0.3),
    highlight: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    mouth: mat(COLORS.mouth, 0.6),
    mouthInside: mat(COLORS.mouthInside, 0.7),
    tongue: mat(COLORS.tongue, 0.6),
    jacket: mat(0xa8102e, 0.75),
    jacketTrim: mat(0xe2733a, 0.7),
    shorts: mat(COLORS.shorts, 0.8),
    stitch: mat(COLORS.stitch, 0.6),
  };

  const root = new THREE.Group();
  root.name = 'Root';
  // Nhóm "bounce" để nhảy/xoay/ngã cả người mà không đổi vị trí gốc.
  const bounce = new THREE.Group();
  bounce.name = 'Bounce';
  root.add(bounce);

  const anchors = { Root: root };
  const { torso, arms } = buildBody(bounce, materials, anchors);
  const { head, skull, face } = buildHead(bounce, materials, anchors);

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  // ── Trạng thái animation ────────────────────────────────────────────
  const pose = {
    armL: [...REST_POSE.armL],
    armR: [...REST_POSE.armR],
    head: [...REST_POSE.head],
  };
  let current = null; // { name, def, time }
  let mood = null;
  let idleTime = 0;
  const props = createPropLayer(head);

  function play(name) {
    const def = EMOTES[name];
    if (!def) return;
    current = { name, def, time: 0 };
    face.set(def.face);
    props.show(def.prop);
    idleTime = 0;
  }

  function activeDef() {
    if (current) return current.def;
    if (mood) return EMOTES[mood];
    return EMOTES.idle;
  }

  function endEmote() {
    current = null;
    const def = activeDef();
    face.set(def.face);
    props.show(def.prop);
  }

  function update(delta, elapsed) {
    // Thời gian cảm xúc hiện tại.
    if (current) {
      current.time += delta;
      if (current.time >= current.def.duration) endEmote();
    } else if (!mood) {
      idleTime += delta;
      if (idleTime > IDLE_BORED_SEC) play('bored');
    }

    // Nội suy tư thế tới đích.
    const def = activeDef();
    const k = 1 - Math.exp(-delta * POSE_SPEED);
    for (const part of ['armL', 'armR', 'head']) {
      const target = def.pose[part] ?? REST_POSE[part];
      pose[part][0] += (target[0] - pose[part][0]) * k;
      pose[part][1] += (target[1] - pose[part][1]) * k;
    }

    // Thở & lắc lư nhẹ.
    const breathe = Math.sin(elapsed * 2.2);
    torso.scale.set(1 + breathe * 0.012, 1 - breathe * 0.012, 1 + breathe * 0.012);
    arms.L.rotation.set(pose.armL[0], 0, pose.armL[1] + breathe * 0.03);
    arms.R.rotation.set(pose.armR[0], 0, pose.armR[1] - breathe * 0.03);
    head.rotation.set(pose.head[0] + Math.sin(elapsed * 0.9) * 0.03, 0, pose.head[1] + Math.sin(elapsed * 1.1) * 0.04);
    bounce.position.set(0, 0, 0);
    bounce.rotation.set(0, 0, 0);

    // Chuyển động riêng của cảm xúc.
    const motion = current?.def.motion ?? (mood ? EMOTES[mood].motion : null);
    if (motion) {
      const t = current ? current.time / current.def.duration : (elapsed % 2) / 2;
      const env = current ? Math.min(1, t / 0.15, (1 - t) / 0.15) : 1;
      MOTIONS[motion]({ t, env, elapsed, bounce, head, arms });
    }

    face.update(delta);
    props.update(delta);
  }

  const tmp = new THREE.Vector3();
  return {
    object: root,
    materials,
    anchors,
    update,
    emote: play,
    setMood(name) {
      mood = name && EMOTES[name] ? name : null;
      idleTime = 0;
      if (!current) endEmote();
    },
    headWorldPosition: (target) => skull.getWorldPosition(target ?? tmp),
  };
}

// ── Chuyển động thêm cho từng cảm xúc ─────────────────────────────────────

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

const MOTIONS = {
  wave({ env, elapsed, arms }) {
    arms.R.rotation.z += Math.sin(elapsed * 14) * 0.3 * env;
  },
  hop({ t, bounce }) {
    bounce.position.y = Math.abs(Math.sin(t * Math.PI * 3)) * 0.12;
  },
  jumpSpin({ t, bounce }) {
    bounce.position.y = Math.sin(t * Math.PI) * 0.45;
    bounce.rotation.y = easeInOut(t) * Math.PI * 2;
  },
  shake({ t, head }) {
    head.rotation.y = Math.sin(t * Math.PI * 5) * 0.22 * (1 - t);
  },
  sob({ env, elapsed, bounce, head }) {
    bounce.position.y = Math.abs(Math.sin(elapsed * 16)) * 0.025 * env;
    head.rotation.y = Math.sin(elapsed * 6) * 0.08 * env;
  },
  faint({ t, bounce }) {
    // Ngã nghiêng sang một bên (vẫn thấy mặt), nằm một lúc rồi đứng dậy.
    const fall = smoothstep(0, 0.14, t) * (1 - smoothstep(0.8, 1, t));
    bounce.rotation.z = 1.45 * fall;
    bounce.position.x = 1.0 * fall;
    bounce.position.y = 0.33 * fall;
  },
  lean({ env, bounce }) {
    bounce.rotation.z = -0.08 * env;
  },
};

// ── Dựng thân & đầu ───────────────────────────────────────────────────────

function buildBody(bounce, materials, anchors) {
  // Chân ngắn, chắc & điểm gắn giày.
  const legGeo = new THREE.CylinderGeometry(0.12, 0.13, 0.36, 16);
  for (const side of [-1, 1]) {
    const leg = mesh(legGeo, materials.limb);
    leg.position.set(0.17 * side, 0.3, 0);
    bounce.add(leg);

    const foot = new THREE.Group();
    foot.name = side < 0 ? 'FootR' : 'FootL';
    foot.position.set(0.17 * side, 0, 0.03);
    bounce.add(foot);
    anchors[foot.name] = foot;
  }

  // Quần soóc dài tới gối, ống rộng.
  const shorts = mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.24, 28), materials.shorts);
  shorts.position.y = 0.62;
  bounce.add(shorts);
  for (const side of [-1, 1]) {
    const cuff = mesh(new THREE.CylinderGeometry(0.18, 0.19, 0.2, 20), materials.shorts);
    cuff.position.set(0.18 * side, 0.48, 0);
    bounce.add(cuff);
  }

  // Thân áo khoác dáng hộp bo tròn (tiện tròn theo profile, dẹt trước–sau).
  const torso = new THREE.Group();
  torso.name = 'Torso';
  torso.position.y = TORSO_Y;
  bounce.add(torso);
  anchors.Torso = torso;

  const jacketGeo = new THREE.LatheGeometry(
    JACKET_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)),
    40,
  );
  jacketGeo.scale(1, 1, JACKET_DEPTH);
  torso.add(mesh(jacketGeo, materials.jacket));

  const hem = mesh(new THREE.TorusGeometry(0.415, 0.03, 12, 40), materials.jacketTrim);
  hem.rotation.x = Math.PI / 2;
  hem.scale.set(1, JACKET_DEPTH, 1);
  hem.position.y = -0.31;
  torso.add(hem);

  const collar = mesh(new THREE.TorusGeometry(0.2, 0.06, 12, 32), materials.jacket);
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(1, 0.9, 1);
  collar.position.y = 0.38;
  torso.add(collar);

  // Khoá kéo chạy dọc mặt trước áo.
  const zipPts = [];
  for (let i = 0; i <= 12; i++) {
    const y = THREE.MathUtils.lerp(-0.32, 0.34, i / 12);
    zipPts.push(new THREE.Vector3(0, y, jacketRadiusAt(y) * JACKET_DEPTH + 0.006));
  }
  torso.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(zipPts), 24, 0.011, 6), materials.stitch));

  // Logo VA trên ngực trái (bên phải người xem).
  const badge = createBadge();
  const bx = 0.2;
  const by = 0.1;
  const bz = JACKET_DEPTH * Math.sqrt(jacketRadiusAt(by) ** 2 - bx ** 2);
  const normal = new THREE.Vector3(bx, 0, bz / JACKET_DEPTH ** 2).normalize();
  badge.position.set(bx, by, bz).addScaledVector(normal, 0.006);
  badge.lookAt(badge.position.clone().add(normal));
  torso.add(badge);

  const back = new THREE.Group();
  back.name = 'Back';
  back.position.set(0, 0.02, -jacketRadiusAt(0) * JACKET_DEPTH + 0.02);
  torso.add(back);
  anchors.Back = back;

  // Tay: vai → tay áo → bàn tay 4 ngón.
  const arms = {};
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.name = side < 0 ? 'ArmR' : 'ArmL';
    shoulder.position.set(0.4 * side, 0.22, 0);
    shoulder.rotation.z = ARM_REST_Z * side;
    torso.add(shoulder);

    const sleeve = mesh(new THREE.CapsuleGeometry(0.15, 0.22, 8, 16), materials.jacket);
    sleeve.position.y = -0.2;
    shoulder.add(sleeve);

    const cuff = mesh(new THREE.TorusGeometry(0.115, 0.032, 10, 24), materials.jacketTrim);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.4;
    shoulder.add(cuff);

    const hand = createHand(materials.limb, side);
    hand.position.y = -0.5;
    shoulder.add(hand);

    arms[side < 0 ? 'R' : 'L'] = shoulder;
  }

  return { torso, arms };
}

function buildHead(bounce, materials, anchors) {
  const head = new THREE.Group();
  head.name = 'Head';
  head.position.y = HEAD_PIVOT_Y;
  head.scale.setScalar(HEAD_SIZE);
  bounce.add(head);
  anchors.Head = head;

  const center = new THREE.Vector3(0, HEAD_CENTER_Y, 0);
  const radii = HEAD_SCALE.clone().multiplyScalar(HEAD_RADIUS);

  const skull = mesh(new THREE.SphereGeometry(HEAD_RADIUS, 48, 36), materials.head);
  skull.scale.copy(HEAD_SCALE);
  skull.position.copy(center);
  head.add(skull);

  // Má bầu: nửa dưới mặt rộng hơn (giống ảnh mẫu).
  for (const side of [-1, 1]) {
    const cheek = mesh(new THREE.SphereGeometry(0.27, 32, 24), materials.head);
    cheek.scale.set(1, 0.85, 0.9);
    cheek.position.set(0.26 * side, center.y - 0.16, 0.1);
    head.add(cheek);
  }

  addFlameMane(head, center, radii, materials.head);
  addHorn(head, center, radii, materials.gold);

  const faceGroup = new THREE.Group();
  faceGroup.name = 'Face';
  faceGroup.position.copy(center);
  head.add(faceGroup);
  anchors.Face = faceGroup;

  // Mõm nhỏ + lỗ mũi.
  const snout = mesh(new THREE.SphereGeometry(0.13, 28, 20), materials.snout);
  snout.scale.set(0.95, 0.52, 0.3);
  snout.position.set(0, -0.175, radii.z - 0.06);
  faceGroup.add(snout);
  for (const side of [-1, 1]) {
    const nostril = mesh(new THREE.SphereGeometry(0.011, 10, 8), materials.mouth);
    nostril.position.set(0.04 * side, -0.155, radii.z - 0.012);
    faceGroup.add(nostril);
  }

  const face = createFaceController(faceGroup, radii, materials);

  // Điểm gắn nón: đỉnh đầu (trên bờm).
  const headTop = new THREE.Group();
  headTop.name = 'HeadTop';
  headTop.position.set(0, center.y + radii.y * 0.78, -0.04);
  head.add(headTop);
  anchors.HeadTop = headTop;

  return { head, skull, face };
}

// ── Nét mặt ───────────────────────────────────────────────────────────────

const PUPIL_OFFSETS = {
  lookUp: [0.015, 0.03],
  half: [0.028, -0.01],
};

function createFaceController(faceGroup, radii, materials) {
  const eyes = [];
  const brows = [];
  for (const side of [-1, 1]) {
    const eye = createEye(materials, side);
    faceGroup.add(placeOnEllipsoid(eye.group, radii, 0.22 * side, -0.05, 0));
    eyes.push({ side, ...eye });

    const brow = mesh(createSpiralBrowGeometry(side), materials.gold);
    placeOnEllipsoid(brow, radii, 0.23 * side, 0.165, 0.012);
    faceGroup.add(brow);
    brows.push({ mesh: brow, baseY: brow.position.y });
  }

  const mouth = createMouth(materials);
  faceGroup.add(placeOnEllipsoid(mouth.group, radii, 0, -0.27, 0.004));

  const shades = createShades();
  shades.position.set(0, -0.045, radii.z + 0.06);
  shades.visible = false;
  faceGroup.add(shades);

  let eyesMode = 'open';
  let blinkTimer = 2 + Math.random() * 2;
  let blink = 0;

  function set({ eyes: mode = 'open', mouth: mouthMode = 'smile', browLift = 0, shades: withShades = false } = {}) {
    eyesMode = mode;
    shades.visible = withShades;
    for (const eye of eyes) {
      let variant = mode;
      if (mode === 'lookUp' || mode === 'half') variant = 'open';
      if (mode === 'wink') variant = eye.side > 0 ? 'happy' : 'open';
      for (const [name, obj] of Object.entries(eye.variants)) obj.visible = name === variant;

      eye.lid.visible = mode === 'half';
      const [ox, oy] = PUPIL_OFFSETS[mode] ?? [0, 0];
      eye.pupil.position.set(ox, oy, 0);
    }
    for (const [name, obj] of Object.entries(mouth.variants)) obj.visible = name === mouthMode;
    for (const brow of brows) brow.mesh.position.y = brow.baseY + browLift;
  }

  function update(delta) {
    blinkTimer -= delta;
    if (blinkTimer <= 0) {
      blink = 0.16;
      blinkTimer = 2.5 + Math.random() * 3;
    }
    blink = Math.max(0, blink - delta);
    const canBlink = ['open', 'lookUp', 'wide', 'wink'].includes(eyesMode);
    const scaleY = canBlink && blink > 0 ? 0.12 : 1;
    for (const eye of eyes) {
      const isOpen = eye.variants.open.visible || eye.variants.wide.visible;
      eye.group.scale.y = isOpen ? scaleY : 1;
    }
  }

  set();
  return { set, update };
}

/** Kính râm đen (sticker "ngầu"). */
function createShades() {
  const group = new THREE.Group();
  const black = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.15, metalness: 0.4 });
  for (const side of [-1, 1]) {
    const lens = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 32), black);
    lens.rotation.x = Math.PI / 2;
    lens.scale.set(1.15, 1, 0.85);
    lens.position.x = 0.215 * side;
    group.add(lens);
  }
  const bridge = mesh(new THREE.BoxGeometry(0.14, 0.035, 0.03), black);
  bridge.position.y = 0.05;
  group.add(bridge);
  return group;
}

// ── Hiệu ứng emoji quanh đầu ──────────────────────────────────────────────

function createPropLayer(head) {
  const layers = new Map(); // tên prop → [{ sprite, spec }]
  let active = null;
  let time = 0;

  function show(name) {
    if (active) layers.get(active).forEach(({ sprite }) => (sprite.visible = false));
    active = name && PROPS[name] ? name : null;
    time = 0;
    if (!active) return;
    if (!layers.has(active)) {
      layers.set(
        active,
        PROPS[active].map((spec) => {
          const sprite = createEmojiSprite(spec.char);
          sprite.renderOrder = 10;
          head.add(sprite);
          return { sprite, spec };
        }),
      );
    }
    layers.get(active).forEach(({ sprite }) => (sprite.visible = true));
  }

  function update(delta) {
    if (!active) return;
    time += delta;
    for (const { sprite, spec } of layers.get(active)) {
      const [x, y, z] = spec.pos;
      let s = spec.scale;
      let py = y;
      let opacity = 1;
      switch (spec.anim) {
        case 'twinkle':
          s *= 0.75 + 0.25 * Math.sin(time * 8 + x);
          sprite.material.rotation = time * 0.8;
          break;
        case 'pop':
          s *= Math.min(1, time * 6) * (1 + 0.08 * Math.sin(time * 10));
          break;
        case 'bob':
          py += Math.sin(time * 4) * 0.05;
          break;
        case 'drip': {
          const cycle = (time * 0.9) % 1;
          py -= cycle * 0.35;
          opacity = 1 - cycle;
          break;
        }
        case 'rise':
          py += time * 0.22;
          opacity = Math.max(0, 1 - time / 2.6);
          break;
      }
      sprite.position.set(x, py, z);
      sprite.scale.setScalar(s);
      sprite.material.opacity = opacity;
    }
  }

  return { show, update };
}
