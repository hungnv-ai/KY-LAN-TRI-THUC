import * as THREE from 'three';

/**
 * Dựng linh vật Kỳ lân VA Schools bằng hình khối Three.js (chưa cần file .glb).
 *
 * Nét nhận diện bắt buộc (Brand Guideline): bờm đỏ hình ngọn lửa, SỪNG VÀNG, LÔNG MÀY VÀNG XOẮN,
 * mắt to, BÀN TAY 4 NGÓN, áo khoác đỏ có logo VA, quần soóc nâu đỏ, giày đỏ.
 *
 * Hướng mặt: +Z. Chiều cao ~2.6 đơn vị, đứng trên y = 0.
 */

const COLORS = {
  head: 0xe0392b,
  limb: 0xf0612c,
  snout: 0xe5412f,
  gold: 0xe6b04c,
  eye: 0x141010,
  eyeRim: 0x4a2a1a,
  mouth: 0x6e1a12,
  shorts: 0x5c1a17,
  stitch: 0x3a0f0c,
};

/** Toạ độ đầu (dùng cho phụ kiện và camera). */
const HEAD_PIVOT_Y = 1.32;
const HEAD_CENTER_Y = 0.48; // so với HEAD_PIVOT_Y
const HEAD_RADIUS = 0.56;
const HEAD_SCALE = new THREE.Vector3(1, 0.94, 0.9);

/**
 * @returns {{
 *   object: THREE.Group,
 *   materials: Record<string, THREE.MeshStandardMaterial>,
 *   anchors: Record<string, THREE.Object3D>,
 *   update: (delta: number, elapsed: number) => void,
 *   wave: () => void,
 *   celebrate: () => void,
 *   shake: () => void,
 *   headWorldPosition: (target: THREE.Vector3) => THREE.Vector3,
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
    highlight: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    mouth: mat(COLORS.mouth, 0.6),
    jacket: mat(0xa8102e, 0.75),
    jacketTrim: mat(0xd6334f, 0.7),
    shorts: mat(COLORS.shorts, 0.8),
    stitch: mat(COLORS.stitch, 0.6),
  };

  const root = new THREE.Group();
  root.name = 'Root';

  // Nhóm "bounce" để nhún nhảy cả người mà không đổi vị trí gốc.
  const bounce = new THREE.Group();
  bounce.name = 'Bounce';
  root.add(bounce);

  const anchors = {};

  // ── Chân & vị trí giày ──────────────────────────────────────────────
  const legGeo = new THREE.CylinderGeometry(0.1, 0.115, 0.4, 16);
  for (const side of [-1, 1]) {
    const leg = mesh(legGeo, materials.limb);
    leg.position.set(0.17 * side, 0.36, 0);
    bounce.add(leg);

    const foot = new THREE.Group();
    foot.name = side < 0 ? 'FootR' : 'FootL';
    foot.position.set(0.17 * side, 0, 0.03);
    bounce.add(foot);
    anchors[foot.name] = foot;
  }

  // ── Quần soóc ───────────────────────────────────────────────────────
  const shorts = mesh(new THREE.CylinderGeometry(0.34, 0.37, 0.26, 28), materials.shorts);
  shorts.position.y = 0.62;
  bounce.add(shorts);
  for (const side of [-1, 1]) {
    const cuff = mesh(new THREE.CylinderGeometry(0.155, 0.165, 0.16, 20), materials.shorts);
    cuff.position.set(0.17 * side, 0.48, 0);
    bounce.add(cuff);
  }

  // ── Thân áo khoác ───────────────────────────────────────────────────
  const torso = new THREE.Group();
  torso.name = 'Torso';
  torso.position.y = 0.98;
  bounce.add(torso);

  const TORSO_R = new THREE.Vector3(0.43, 0.42, 0.36);
  const jacket = mesh(new THREE.SphereGeometry(1, 40, 28), materials.jacket);
  jacket.scale.copy(TORSO_R);
  torso.add(jacket);

  const hem = mesh(new THREE.TorusGeometry(0.385, 0.035, 12, 40), materials.jacketTrim);
  hem.rotation.x = Math.PI / 2;
  hem.scale.set(1, 0.84, 1);
  hem.position.y = -0.27;
  torso.add(hem);

  const collar = mesh(new THREE.TorusGeometry(0.2, 0.065, 12, 32), materials.jacket);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.36;
  torso.add(collar);

  // Khoá kéo chạy theo mặt trước của áo.
  const zipPts = [];
  for (let i = 0; i <= 12; i++) {
    const a = THREE.MathUtils.lerp(-0.75, 0.95, i / 12);
    zipPts.push(new THREE.Vector3(0, Math.sin(a) * TORSO_R.y, Math.cos(a) * TORSO_R.z + 0.006));
  }
  const zipper = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(zipPts), 24, 0.011, 6), materials.stitch);
  torso.add(zipper);

  // Logo VA trên ngực trái (bên phải người xem).
  torso.add(placeOnEllipsoid(createBadge(), TORSO_R, 0.19, 0.08));

  // Điểm gắn ba lô (sau lưng).
  const back = new THREE.Group();
  back.name = 'Back';
  back.position.set(0, 0.02, -TORSO_R.z + 0.02);
  torso.add(back);
  anchors.Back = back;

  // ── Tay (vai → tay áo → bàn tay 4 ngón) ─────────────────────────────
  const arms = {};
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.name = side < 0 ? 'ArmR' : 'ArmL';
    shoulder.position.set(0.36 * side, 0.2, 0);
    shoulder.rotation.z = 0.42 * side;
    torso.add(shoulder);

    const sleeve = mesh(new THREE.CapsuleGeometry(0.12, 0.26, 8, 16), materials.jacket);
    sleeve.position.y = -0.2;
    shoulder.add(sleeve);

    const cuff = mesh(new THREE.TorusGeometry(0.1, 0.035, 10, 24), materials.jacketTrim);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.4;
    shoulder.add(cuff);

    const hand = createHand(materials.limb, side);
    hand.position.y = -0.5;
    shoulder.add(hand);

    arms[side] = shoulder;
  }

  // ── Đầu ─────────────────────────────────────────────────────────────
  const head = new THREE.Group();
  head.name = 'Head';
  head.position.y = HEAD_PIVOT_Y;
  bounce.add(head);

  const skullCenter = new THREE.Vector3(0, HEAD_CENTER_Y, 0);
  const radii = HEAD_SCALE.clone().multiplyScalar(HEAD_RADIUS);

  const skull = mesh(new THREE.SphereGeometry(HEAD_RADIUS, 48, 36), materials.head);
  skull.scale.copy(HEAD_SCALE);
  skull.position.copy(skullCenter);
  head.add(skull);

  addFlameMane(head, skullCenter, radii, materials.head);
  addHorn(head, skullCenter, radii, materials.gold);

  // Mặt: mắt, lông mày xoắn, mõm, miệng cười.
  const face = new THREE.Group();
  face.name = 'Face';
  face.position.copy(skullCenter);
  head.add(face);
  anchors.Face = face;

  const eyes = [];
  for (const side of [-1, 1]) {
    const eye = createEye(materials, side);
    face.add(placeOnEllipsoid(eye, radii, 0.2 * side, 0.02, 0.0));
    eyes.push(eye);

    const brow = mesh(createSpiralBrowGeometry(side), materials.gold);
    face.add(placeOnEllipsoid(brow, radii, 0.22 * side, 0.235, 0.012));
  }

  const snout = mesh(new THREE.SphereGeometry(0.13, 28, 20), materials.snout);
  snout.scale.set(1.15, 0.6, 0.34);
  snout.position.set(0, -0.14, radii.z - 0.05);
  face.add(snout);

  for (const side of [-1, 1]) {
    const nostril = mesh(new THREE.SphereGeometry(0.014, 10, 8), materials.mouth);
    nostril.position.set(0.05 * side, -0.115, radii.z + 0.005);
    face.add(nostril);
  }

  const smile = mesh(new THREE.TorusGeometry(0.085, 0.012, 8, 24, Math.PI), materials.mouth);
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.215, radii.z - 0.035);
  face.add(smile);

  // Điểm gắn nón: đỉnh đầu (trên bờm).
  const headTop = new THREE.Group();
  headTop.name = 'HeadTop';
  headTop.position.set(0, skullCenter.y + radii.y * 0.78, -0.04);
  head.add(headTop);
  anchors.HeadTop = headTop;
  anchors.Head = head;
  anchors.Torso = torso;
  anchors.Root = root;

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  // ── Animation ───────────────────────────────────────────────────────
  const anim = {
    blinkTimer: 2 + Math.random() * 2,
    blink: 0,
    wave: 0, // thời gian còn lại (giây)
    celebrate: 0,
    shake: 0,
  };
  const WAVE_DURATION = 1.6;
  const CELEBRATE_DURATION = 1.2;
  const SHAKE_DURATION = 0.6;

  function update(delta, elapsed) {
    // Thở & lắc lư nhẹ.
    const breathe = Math.sin(elapsed * 2.2);
    torso.scale.set(1 + breathe * 0.012, 1 - breathe * 0.012, 1 + breathe * 0.012);
    head.rotation.z = Math.sin(elapsed * 1.1) * 0.04;
    head.rotation.x = Math.sin(elapsed * 0.9) * 0.03;
    arms[1].rotation.z = 0.42 + Math.sin(elapsed * 2.2) * 0.03;
    arms[-1].rotation.z = -0.42 - Math.sin(elapsed * 2.2) * 0.03;
    arms[-1].rotation.x = 0;
    bounce.position.y = 0;
    bounce.rotation.y = 0;
    head.rotation.y = 0;

    // Chớp mắt.
    anim.blinkTimer -= delta;
    if (anim.blinkTimer <= 0) {
      anim.blink = 0.16;
      anim.blinkTimer = 2.5 + Math.random() * 3;
    }
    anim.blink = Math.max(0, anim.blink - delta);
    const lid = anim.blink > 0 ? 0.12 : 1;
    eyes.forEach((e) => (e.scale.y = lid));

    // Vẫy tay (tay phải của Kỳ lân = bên trái người xem).
    if (anim.wave > 0) {
      anim.wave = Math.max(0, anim.wave - delta);
      const t = 1 - anim.wave / WAVE_DURATION;
      const lift = Math.sin(Math.min(t * 4, 1) * Math.PI * 0.5) * Math.sin(Math.min((1 - t) * 4, 1) * Math.PI * 0.5);
      arms[-1].rotation.z = -0.42 - lift * 2.3 + Math.sin(elapsed * 14) * 0.25 * lift;
      head.rotation.z += lift * 0.12;
    }

    // Ăn mừng: nhảy + xoay một vòng.
    if (anim.celebrate > 0) {
      anim.celebrate = Math.max(0, anim.celebrate - delta);
      const t = 1 - anim.celebrate / CELEBRATE_DURATION;
      bounce.position.y = Math.sin(t * Math.PI) * 0.45;
      bounce.rotation.y = easeInOut(t) * Math.PI * 2;
      arms[1].rotation.z = 0.42 + Math.sin(t * Math.PI) * 2.2;
      arms[-1].rotation.z = -0.42 - Math.sin(t * Math.PI) * 2.2;
    }

    // Lắc đầu (trả lời sai): nhẹ nhàng, không tiêu cực.
    if (anim.shake > 0) {
      anim.shake = Math.max(0, anim.shake - delta);
      const t = 1 - anim.shake / SHAKE_DURATION;
      head.rotation.y = Math.sin(t * Math.PI * 4) * 0.25 * (1 - t);
    }
  }

  const tmp = new THREE.Vector3();
  return {
    object: root,
    materials,
    anchors,
    update,
    wave: () => (anim.wave = WAVE_DURATION),
    celebrate: () => (anim.celebrate = CELEBRATE_DURATION),
    shake: () => (anim.shake = SHAKE_DURATION),
    headWorldPosition: (target) => skull.getWorldPosition(target ?? tmp),
  };
}

// ── Helpers dựng hình ────────────────────────────────────────────────────

function mat(color, roughness = 0.6, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function mesh(geometry, material) {
  return new THREE.Mesh(geometry, material);
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Đặt object lên bề mặt ellipsoid (tâm 0,0,0, bán trục `radii`) tại toạ độ (x, y) phía trước,
 * và xoay object hướng theo pháp tuyến bề mặt.
 */
function placeOnEllipsoid(object, radii, x, y, offset = 0.005) {
  const k = 1 - (x / radii.x) ** 2 - (y / radii.y) ** 2;
  const z = radii.z * Math.sqrt(Math.max(0, k));
  const normal = new THREE.Vector3(x / radii.x ** 2, y / radii.y ** 2, z / radii.z ** 2).normalize();
  object.position.set(x, y, z).addScaledVector(normal, offset);
  object.lookAt(object.position.clone().add(normal));
  return object;
}

/** Huy hiệu VA: hình tròn trắng viền đỏ, chữ "VA". */
function createBadge() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#9A0036';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#9A0036';
  ctx.font = 'bold 52px "Be Vietnam Pro", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VA', size / 2, size / 2 + 3);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const badge = new THREE.Mesh(
    new THREE.CircleGeometry(0.075, 32),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6 }),
  );
  badge.name = 'Badge';
  return badge;
}

/** Bàn tay 4 ngón: lòng bàn tay + 3 ngón + 1 ngón cái. */
function createHand(material, side) {
  const hand = new THREE.Group();
  const palm = mesh(new THREE.SphereGeometry(0.1, 20, 16), material);
  palm.scale.set(1, 1.05, 0.8);
  hand.add(palm);

  const fingerGeo = new THREE.CapsuleGeometry(0.032, 0.06, 4, 10);
  for (let i = 0; i < 3; i++) {
    const finger = mesh(fingerGeo, material);
    finger.position.set((i - 1) * 0.055, -0.1, 0.01);
    finger.rotation.z = (i - 1) * 0.15;
    hand.add(finger);
  }
  const thumb = mesh(fingerGeo, material);
  thumb.position.set(-0.08 * side, -0.02, 0.05);
  thumb.rotation.set(0.5, 0, 0.9 * side);
  hand.add(thumb);
  return hand;
}

/** Mắt: viền nâu, tròng đen, 2 điểm sáng. Gốc toạ độ ở mặt trước mắt, hướng +Z. */
function createEye(materials, side) {
  const eye = new THREE.Group();
  const rim = mesh(new THREE.SphereGeometry(0.105, 24, 16), materials.eyeRim);
  rim.scale.set(1, 1.08, 0.45);
  eye.add(rim);

  const pupil = mesh(new THREE.SphereGeometry(0.088, 24, 16), materials.eye);
  pupil.scale.set(1, 1.08, 0.5);
  pupil.position.z = 0.012;
  eye.add(pupil);

  const big = mesh(new THREE.SphereGeometry(0.026, 12, 8), materials.highlight);
  big.position.set(-0.03 * side, 0.035, 0.05);
  eye.add(big);
  const small = mesh(new THREE.SphereGeometry(0.012, 10, 6), materials.highlight);
  small.position.set(0.03 * side, -0.03, 0.05);
  eye.add(small);
  return eye;
}

/** Lông mày vàng xoắn ốc (mặt phẳng XY, nhô nhẹ theo +Z). */
function createSpiralBrowGeometry(side) {
  const turns = 1.6;
  const points = [];
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * turns * Math.PI * 2;
    const r = 0.014 + t * 0.058;
    points.push(new THREE.Vector3(Math.cos(angle) * r * side, Math.sin(angle) * r, 0.006 * (1 - t)));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 64, 0.018, 8);
}

/**
 * Bờm lửa: các chóp nhọn mọc từ đỉnh, hai bên và sau đầu (chừa khuôn mặt).
 * Mỗi chóp hơi hướng lên trên để giống ngọn lửa.
 */
function addFlameMane(head, center, radii, material) {
  const UP = new THREE.Vector3(0, 1, 0);
  const BACK = new THREE.Vector3(0, 0, -1);
  // [độ cao (độ), góc phương vị (độ, 0 = phía trước), chiều dài, bán kính đáy]
  const spikes = [
    [88, 180, 0.5, 0.2],
    [62, 140, 0.48, 0.19],
    [62, -140, 0.48, 0.19],
    [62, 180, 0.46, 0.19],
    [58, 95, 0.44, 0.18],
    [58, -95, 0.44, 0.18],
    [50, 50, 0.36, 0.16],
    [50, -50, 0.36, 0.16],
    [30, 120, 0.42, 0.18],
    [30, -120, 0.42, 0.18],
    [32, 165, 0.4, 0.18],
    [32, -165, 0.4, 0.18],
    [12, 82, 0.38, 0.15],
    [12, -82, 0.38, 0.15],
    [8, 140, 0.34, 0.15],
    [8, -140, 0.34, 0.15],
    [-12, 95, 0.3, 0.12],
    [-12, -95, 0.3, 0.12],
  ];

  for (const [elevDeg, azDeg, length, radius] of spikes) {
    const elev = THREE.MathUtils.degToRad(elevDeg);
    const az = THREE.MathUtils.degToRad(azDeg);
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev));

    const spike = mesh(createFlameGeometry(radius, length), material);

    const surface = new THREE.Vector3(dir.x * radii.x, dir.y * radii.y, dir.z * radii.z).multiplyScalar(0.8);
    spike.position.copy(center).add(surface);

    // Trục Y của chóp = pháp tuyến pha thêm hướng lên (lửa bốc lên);
    // trục Z hướng ra sau để phần ngọn cong về phía sau.
    const aim = dir.clone().lerp(UP, 0.45).normalize();
    const backward = BACK.clone().addScaledVector(aim, -aim.dot(BACK));
    if (backward.lengthSq() < 1e-4) backward.set(0, 1, 0);
    backward.normalize();
    const side = new THREE.Vector3().crossVectors(aim, backward);
    spike.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, aim, backward));
    head.add(spike);
  }
}

/**
 * Một ngọn lửa: thân phình ở gốc, thon dần về ngọn bo tròn, ngọn cong nhẹ theo +Z.
 */
function createFlameGeometry(radius, length) {
  const profile = [
    [0.001, 0],
    [1, 0.02],
    [1.04, 0.18],
    [0.82, 0.45],
    [0.45, 0.74],
    [0.16, 0.93],
    [0.001, 1],
  ].map(([r, y]) => new THREE.Vector2(r * radius, y * length));
  const geo = new THREE.LatheGeometry(profile, 20);

  const BEND = 0.28;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / length;
    pos.setZ(i, pos.getZ(i) + BEND * length * t * t);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Sừng vàng có các vòng xoắn, mọc ở đỉnh trước của đầu. */
function addHorn(head, center, radii, material) {
  const LENGTH = 0.46;
  const BASE = 0.11;
  const horn = new THREE.Group();
  horn.name = 'Horn';

  const profile = [
    [0.001, 0],
    [1, 0.02],
    [0.78, 0.35],
    [0.45, 0.7],
    [0.14, 0.95],
    [0.001, 1],
  ].map(([r, y]) => new THREE.Vector2(r * BASE, y * LENGTH));
  horn.add(mesh(new THREE.LatheGeometry(profile, 28), material));

  const RINGS = 4;
  for (let i = 0; i < RINGS; i++) {
    const h = (i + 0.5) * (LENGTH / (RINGS + 1));
    const r = BASE * (1 - 0.95 * h / LENGTH) * 0.95;
    const ring = mesh(new THREE.TorusGeometry(r, 0.011 * (1 - h / LENGTH) + 0.004, 8, 24), material);
    ring.rotation.x = Math.PI / 2 + 0.25;
    ring.position.y = h;
    horn.add(ring);
  }

  const elev = THREE.MathUtils.degToRad(66);
  const dir = new THREE.Vector3(0, Math.sin(elev), Math.cos(elev));
  horn.position.copy(center).add(new THREE.Vector3(0, dir.y * radii.y, dir.z * radii.z).multiplyScalar(0.92));
  horn.rotation.x = 0.22;
  head.add(horn);
}
