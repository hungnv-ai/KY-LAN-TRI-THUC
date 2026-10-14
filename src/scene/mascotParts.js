import * as THREE from 'three';

/**
 * Các hàm dựng chi tiết của Kỳ lân VA (bờm lửa, sừng, mắt, miệng, tay, huy hiệu…).
 * Thuần dựng hình — không chứa animation.
 */

/** @returns {THREE.MeshStandardMaterial} */
export function mat(color, roughness = 0.6, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

/** @returns {THREE.Mesh} */
export function mesh(geometry, material) {
  return new THREE.Mesh(geometry, material);
}

/**
 * Đặt object lên bề mặt ellipsoid (tâm 0,0,0, bán trục `radii`) tại toạ độ (x, y) phía trước,
 * và xoay object hướng theo pháp tuyến bề mặt (+Z của object = pháp tuyến).
 *
 * @returns {THREE.Object3D} chính object đó
 */
export function placeOnEllipsoid(object, radii, x, y, offset = 0.005) {
  const k = 1 - (x / radii.x) ** 2 - (y / radii.y) ** 2;
  const z = radii.z * Math.sqrt(Math.max(0, k));
  const normal = new THREE.Vector3(x / radii.x ** 2, y / radii.y ** 2, z / radii.z ** 2).normalize();
  object.position.set(x, y, z).addScaledVector(normal, offset);
  object.lookAt(object.position.clone().add(normal));
  return object;
}

/** Huy hiệu VA trên ngực áo: hình tròn trắng viền đỏ, chữ "VA". */
export function createBadge() {
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
  const badge = mesh(new THREE.CircleGeometry(0.08, 32), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6 }));
  badge.name = 'Badge';
  return badge;
}

/** Bàn tay 4 ngón dạng găng tròn: lòng bàn tay + 3 ngón + 1 ngón cái. */
export function createHand(material, side) {
  const hand = new THREE.Group();
  const palm = mesh(new THREE.SphereGeometry(0.105, 20, 16), material);
  palm.scale.set(1, 1.05, 0.82);
  hand.add(palm);

  const fingerGeo = new THREE.CapsuleGeometry(0.036, 0.06, 4, 10);
  for (let i = 0; i < 3; i++) {
    const finger = mesh(fingerGeo, material);
    finger.position.set((i - 1) * 0.058, -0.1, 0.01);
    finger.rotation.z = (i - 1) * 0.15;
    hand.add(finger);
  }
  const thumb = mesh(fingerGeo, material);
  thumb.position.set(-0.085 * side, -0.02, 0.05);
  thumb.rotation.set(0.5, 0, 0.9 * side);
  hand.add(thumb);
  return hand;
}

/** Lông mày vàng xoắn ốc (mặt phẳng XY, nhô nhẹ theo +Z). */
export function createSpiralBrowGeometry(side) {
  const turns = 1.6;
  const points = [];
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * turns * Math.PI * 2;
    const r = 0.014 + t * 0.055;
    points.push(new THREE.Vector3(Math.cos(angle) * r * side, Math.sin(angle) * r, 0.006 * (1 - t)));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 64, 0.019, 8);
}

/**
 * Bờm lửa bản rộng như cánh hoa, ôm quanh đầu (giống mascot gốc): ngọn cao ở đỉnh,
 * các ngọn hai bên vểnh ra ngoài, ngọn ở má chĩa xuống. Chừa khuôn mặt phía trước.
 */
export function addFlameMane(head, center, radii, material) {
  const UP = new THREE.Vector3(0, 1, 0);
  const BACK = new THREE.Vector3(0, 0, -1);
  // [độ cao°, phương vị° (0 = phía trước), dài, rộng, độ bốc lên (0..1, âm = chĩa xuống)]
  const flames = [
    [84, 180, 0.6, 0.27, 0.4],
    [64, 32, 0.46, 0.22, 0.5],
    [64, -32, 0.46, 0.22, 0.5],
    [52, 95, 0.54, 0.26, 0.45],
    [52, -95, 0.54, 0.26, 0.45],
    [56, 145, 0.54, 0.27, 0.45],
    [56, -145, 0.54, 0.27, 0.45],
    [40, 180, 0.5, 0.27, 0.4],
    [24, 72, 0.46, 0.24, 0.35],
    [24, -72, 0.46, 0.24, 0.35],
    [22, 125, 0.48, 0.26, 0.35],
    [22, -125, 0.48, 0.26, 0.35],
    [4, 160, 0.42, 0.26, 0.25],
    [4, -160, 0.42, 0.26, 0.25],
    [-2, 86, 0.38, 0.22, 0.12],
    [-2, -86, 0.38, 0.22, 0.12],
    [-24, 92, 0.3, 0.17, -0.25],
    [-24, -92, 0.3, 0.17, -0.25],
  ];

  for (const [elevDeg, azDeg, length, width, lift] of flames) {
    const elev = THREE.MathUtils.degToRad(elevDeg);
    const az = THREE.MathUtils.degToRad(azDeg);
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev));

    const flame = mesh(createPetalFlameGeometry(width, length), material);
    const surface = new THREE.Vector3(dir.x * radii.x, dir.y * radii.y, dir.z * radii.z).multiplyScalar(0.8);
    flame.position.copy(center).add(surface);

    // Trục Y = hướng ngọn lửa; trục Z (mặt mỏng) hướng ra sau để ngọn cong về phía sau.
    const aim = dir.clone().addScaledVector(UP, lift).normalize();
    const backward = BACK.clone().addScaledVector(aim, -aim.dot(BACK));
    if (backward.lengthSq() < 1e-4) backward.set(0, 1, 0);
    backward.normalize();
    const side = new THREE.Vector3().crossVectors(aim, backward);
    flame.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, aim, backward));
    head.add(flame);
  }
}

/** Một ngọn lửa dạng cánh hoa: bản rộng, dẹt theo trục Z, ngọn nhọn bo tròn cong nhẹ. */
function createPetalFlameGeometry(width, length) {
  const profile = [
    [0.001, 0],
    [0.9, 0.03],
    [1.05, 0.22],
    [0.88, 0.48],
    [0.52, 0.74],
    [0.18, 0.93],
    [0.001, 1],
  ].map(([r, y]) => new THREE.Vector2(r * width, y * length));
  const geo = new THREE.LatheGeometry(profile, 24);

  const THICKNESS = 0.5;
  const BEND = 0.3;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / length;
    pos.setZ(i, pos.getZ(i) * THICKNESS + BEND * length * t * t);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Sừng vàng có các vòng xoắn, mọc ở đỉnh trước của đầu. */
export function addHorn(head, center, radii, material) {
  const LENGTH = 0.46;
  const BASE = 0.115;
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
    const r = BASE * (1 - (0.95 * h) / LENGTH) * 0.95;
    const ring = mesh(new THREE.TorusGeometry(r, 0.012 * (1 - h / LENGTH) + 0.004, 8, 24), material);
    ring.rotation.x = Math.PI / 2 + 0.25;
    ring.position.y = h;
    horn.add(ring);
  }

  const elev = THREE.MathUtils.degToRad(68);
  const dir = new THREE.Vector3(0, Math.sin(elev), Math.cos(elev));
  horn.position.copy(center).add(new THREE.Vector3(0, dir.y * radii.y, dir.z * radii.z).multiplyScalar(0.92));
  horn.rotation.x = 0.2;
  head.add(horn);
}

/**
 * Mắt với 5 kiểu: open (mắt tròn), wide (mắt trắng hoảng hốt), happy (^), squeeze (> <), x (ngất).
 * Gốc toạ độ ở mặt trước mắt, hướng +Z.
 *
 * @returns {{ group: THREE.Group, variants: Record<string, THREE.Object3D>, pupil: THREE.Group, lid: THREE.Mesh }}
 */
export function createEye(materials, side) {
  const group = new THREE.Group();
  const variants = {};

  // Mắt tròn: viền nâu, tròng đen, 2 điểm sáng (nhóm pupil để liếc mắt).
  const open = new THREE.Group();
  const rim = mesh(new THREE.SphereGeometry(0.118, 24, 16), materials.eyeRim);
  rim.scale.set(1, 1.08, 0.45);
  open.add(rim);
  const pupil = new THREE.Group();
  const iris = mesh(new THREE.SphereGeometry(0.1, 24, 16), materials.eye);
  iris.scale.set(1, 1.08, 0.5);
  iris.position.z = 0.012;
  pupil.add(iris);
  const big = mesh(new THREE.SphereGeometry(0.03, 12, 8), materials.highlight);
  big.position.set(-0.034 * side, 0.04, 0.055);
  pupil.add(big);
  const small = mesh(new THREE.SphereGeometry(0.013, 10, 6), materials.highlight);
  small.position.set(0.034 * side, -0.034, 0.055);
  pupil.add(small);
  open.add(pupil);
  // Mí mắt (che nửa trên) cho kiểu lim dim / liếc.
  const lid = mesh(new THREE.SphereGeometry(0.124, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), materials.head);
  lid.scale.set(1, 1.08, 0.55);
  lid.position.z = 0.006;
  lid.rotation.x = 0.35;
  lid.visible = false;
  open.add(lid);
  variants.open = open;

  // Mắt trắng to (hoảng hốt).
  const wide = new THREE.Group();
  const sclera = mesh(new THREE.SphereGeometry(0.125, 24, 16), materials.sclera);
  sclera.scale.set(1, 1.12, 0.45);
  wide.add(sclera);
  const dot = mesh(new THREE.SphereGeometry(0.042, 16, 12), materials.eye);
  dot.scale.set(1, 1, 0.5);
  dot.position.z = 0.05;
  wide.add(dot);
  variants.wide = wide;

  // Mắt cười ^.
  const happy = mesh(new THREE.TorusGeometry(0.075, 0.022, 8, 20, Math.PI), materials.eye);
  happy.position.y = -0.02;
  happy.position.z = 0.01;
  variants.happy = happy;

  // Mắt nhắm chặt > < (khóc).
  const squeeze = new THREE.Group();
  const stroke = new THREE.CapsuleGeometry(0.02, 0.09, 4, 8);
  for (const s of [-1, 1]) {
    const m = mesh(stroke, materials.eye);
    m.rotation.z = Math.PI / 2 + s * 0.5 * side;
    m.position.set(-0.02 * side, s * 0.03, 0.01);
    squeeze.add(m);
  }
  variants.squeeze = squeeze;

  // Mắt X (ngất xỉu).
  const x = new THREE.Group();
  for (const s of [-1, 1]) {
    const m = mesh(stroke, materials.eye);
    m.rotation.z = (s * Math.PI) / 4;
    m.position.z = 0.01;
    x.add(m);
  }
  variants.x = x;

  for (const v of Object.values(variants)) group.add(v);
  return { group, variants, pupil, lid };
}

/**
 * Miệng với các kiểu: smile, open (cười lớn có lưỡi), o (há hốc), frown, flat, smirk, tongue (lè lưỡi).
 * Gốc toạ độ ở giữa miệng, hướng +Z.
 *
 * @returns {{ group: THREE.Group, variants: Record<string, THREE.Object3D> }}
 */
export function createMouth(materials) {
  const group = new THREE.Group();
  const variants = {};

  const smile = mesh(new THREE.TorusGeometry(0.085, 0.013, 8, 24, Math.PI), materials.mouth);
  smile.rotation.z = Math.PI;
  smile.position.y = 0.03;
  variants.smile = smile;

  const open = new THREE.Group();
  const cavity = mesh(new THREE.CircleGeometry(0.1, 28, Math.PI, Math.PI), materials.mouthInside);
  cavity.scale.set(1, 0.85, 1);
  cavity.position.y = 0.035;
  open.add(cavity);
  const tongue = mesh(new THREE.CircleGeometry(0.052, 20, Math.PI, Math.PI), materials.tongue);
  tongue.position.set(0, -0.025, 0.002);
  open.add(tongue);
  variants.open = open;

  const o = mesh(new THREE.CircleGeometry(0.05, 24), materials.mouthInside);
  o.scale.set(0.9, 1.25, 1);
  variants.o = o;

  const frown = mesh(new THREE.TorusGeometry(0.06, 0.013, 8, 24, Math.PI), materials.mouth);
  frown.position.y = -0.03;
  variants.frown = frown;

  const flat = mesh(new THREE.CapsuleGeometry(0.012, 0.08, 4, 8), materials.mouth);
  flat.rotation.z = Math.PI / 2;
  variants.flat = flat;

  const smirk = mesh(new THREE.TorusGeometry(0.06, 0.013, 8, 20, Math.PI * 0.8), materials.mouth);
  smirk.rotation.z = Math.PI + 0.25;
  smirk.position.set(0.025, 0.02, 0);
  variants.smirk = smirk;

  const tongueOut = new THREE.Group();
  const line = mesh(new THREE.TorusGeometry(0.07, 0.012, 8, 20, Math.PI), materials.mouth);
  line.rotation.z = Math.PI;
  line.position.y = 0.03;
  tongueOut.add(line);
  const lick = mesh(new THREE.CapsuleGeometry(0.032, 0.05, 4, 10), materials.tongue);
  lick.position.set(0.03, -0.055, 0.01);
  lick.rotation.z = 0.3;
  tongueOut.add(lick);
  variants.tongue = tongueOut;

  for (const v of Object.values(variants)) group.add(v);
  return { group, variants };
}

const spriteTextures = new Map();

/**
 * Sprite emoji (❓ ❗ ✨ 💦 👻 💤…) dùng làm hiệu ứng cảm xúc quanh đầu Kỳ lân.
 *
 * @param {string} char
 * @returns {THREE.Sprite}
 */
export function createEmojiSprite(char) {
  if (!spriteTextures.has(char)) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.font = '100px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, size / 2, size / 2 + 6);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    spriteTextures.set(char, texture);
  }
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTextures.get(char), transparent: true, depthWrite: false }));
}
