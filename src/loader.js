import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Đường dẫn tới các file .glb (đặt trong thư mục `public/models/`).
 * Thêm phụ kiện mới: chỉ cần khai báo thêm một entry trong ACCESSORIES.
 */
export const MODEL_PATHS = {
  unicorn: '/models/unicorn/unicorn.glb',
};

/**
 * Danh mục phụ kiện. `slot` quyết định phụ kiện thuộc nhóm nào (mỗi slot chỉ mặc 1 món),
 * `bone` là tên bone/Object3D trong model Kỳ lân để gắn phụ kiện vào.
 */
export const ACCESSORIES = {
  hat: { path: '/models/accessories/hat.glb', slot: 'head', bone: 'Head' },
  shoes: { path: '/models/accessories/shoes.glb', slot: 'feet', bone: 'Root' },
};

/** LoadingManager dùng chung để theo dõi tiến trình tải toàn bộ tài nguyên. */
export const loadingManager = new THREE.LoadingManager();

const gltfLoader = new GLTFLoader(loadingManager);

/** Cache theo URL: tránh tải lại cùng một file nhiều lần. */
const cache = new Map();

/**
 * Tải một file .glb và trả về `gltf` (scene, animations, ...).
 * Kết quả được cache theo URL; mỗi lần gọi trả về một bản clone của scene
 * để có thể dùng nhiều instance độc lập.
 *
 * @param {string} url
 * @returns {Promise<{ scene: THREE.Group, animations: THREE.AnimationClip[] }>}
 */
export async function loadGLB(url) {
  if (!cache.has(url)) {
    cache.set(url, gltfLoader.loadAsync(url));
  }

  try {
    const gltf = await cache.get(url);
    const scene = gltf.scene.clone(true);
    enableShadows(scene);
    return { scene, animations: gltf.animations };
  } catch (err) {
    cache.delete(url); // cho phép thử lại lần sau
    throw err;
  }
}

/**
 * Tải model Kỳ lân. Nếu chưa có file .glb (giai đoạn phát triển ban đầu),
 * trả về một model placeholder dựng bằng hình khối cơ bản để game vẫn chạy được.
 *
 * @returns {Promise<{ model: THREE.Object3D, animations: THREE.AnimationClip[], isPlaceholder: boolean }>}
 */
export async function loadUnicorn() {
  try {
    const { scene, animations } = await loadGLB(MODEL_PATHS.unicorn);
    return { model: scene, animations, isPlaceholder: false };
  } catch (err) {
    console.warn(`[loader] Không tải được ${MODEL_PATHS.unicorn}, dùng placeholder.`, err);
    return { model: createPlaceholderUnicorn(), animations: [], isPlaceholder: true };
  }
}

/**
 * Tải một phụ kiện theo id trong ACCESSORIES.
 *
 * @param {keyof typeof ACCESSORIES} id
 * @returns {Promise<THREE.Object3D>}
 */
export async function loadAccessory(id) {
  const def = ACCESSORIES[id];
  if (!def) throw new Error(`[loader] Phụ kiện không tồn tại: ${id}`);

  const { scene } = await loadGLB(def.path);
  scene.name = `accessory:${id}`;
  scene.userData.accessoryId = id;
  scene.userData.slot = def.slot;
  return scene;
}

/**
 * Gắn phụ kiện vào nhân vật. Mỗi slot chỉ giữ một phụ kiện: phụ kiện cũ cùng slot sẽ bị gỡ.
 * Nếu không tìm thấy bone tương ứng, phụ kiện được gắn trực tiếp vào gốc nhân vật.
 *
 * @param {THREE.Object3D} character
 * @param {keyof typeof ACCESSORIES} id
 * @returns {Promise<THREE.Object3D>} phụ kiện vừa gắn
 */
export async function equipAccessory(character, id) {
  const def = ACCESSORIES[id];
  const accessory = await loadAccessory(id);

  unequipSlot(character, def.slot);

  const anchor = character.getObjectByName(def.bone) ?? character;
  anchor.add(accessory);
  return accessory;
}

/**
 * Gỡ phụ kiện đang mặc ở một slot (nếu có).
 *
 * @param {THREE.Object3D} character
 * @param {string} slot
 */
export function unequipSlot(character, slot) {
  const equipped = [];
  character.traverse((obj) => {
    if (obj.userData.slot === slot) equipped.push(obj);
  });
  equipped.forEach((obj) => obj.removeFromParent());
}

/** Bật cast/receive shadow cho mọi mesh trong cây object. */
function enableShadows(root) {
  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
}

/**
 * Kỳ lân tạm thời dựng bằng primitive. Các node quan trọng được đặt tên giống bone
 * trong model thật ('Head', 'Root') để equipAccessory hoạt động ngay cả với placeholder.
 */
function createPlaceholderUnicorn() {
  const root = new THREE.Group();
  root.name = 'Root';

  const body = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const mane = new THREE.MeshStandardMaterial({ color: 0xc58cff, roughness: 0.6 });
  const horn = new THREE.MeshStandardMaterial({ color: 0xffd34d, metalness: 0.3, roughness: 0.3 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.9, 8, 16), body);
  torso.rotation.z = Math.PI / 2;
  torso.position.y = 1.1;
  root.add(torso);

  const legGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.75, 12);
  for (const [x, z] of [[0.45, 0.22], [0.45, -0.22], [-0.45, 0.22], [-0.45, -0.22]]) {
    const leg = new THREE.Mesh(legGeo, body);
    leg.position.set(x, 0.375, z);
    root.add(leg);
  }

  const head = new THREE.Group();
  head.name = 'Head';
  head.position.set(0.85, 1.65, 0);
  root.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), body);
  head.add(skull);

  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), body);
  snout.position.set(0.28, -0.08, 0);
  head.add(snout);

  const hornMesh = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.45, 16), horn);
  hornMesh.position.set(0.1, 0.45, 0);
  hornMesh.rotation.z = -0.35;
  head.add(hornMesh);

  const maneMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.5, 6, 12), mane);
  maneMesh.position.set(0.55, 1.5, 0);
  maneMesh.rotation.z = -0.6;
  root.add(maneMesh);

  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 6, 12), mane);
  tail.position.set(-0.95, 1.05, 0);
  tail.rotation.z = 0.8;
  root.add(tail);

  enableShadows(root);
  return root;
}
