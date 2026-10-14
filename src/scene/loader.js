import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Tải file .glb (đặt trong `public/models/`). Hiện Kỳ lân được dựng bằng code
 * (`src/scene/mascot.js`); module này để sẵn cho GĐ4 khi có model 3D chất lượng cao.
 */

/** LoadingManager dùng chung để theo dõi tiến trình tải toàn bộ tài nguyên. */
export const loadingManager = new THREE.LoadingManager();

const gltfLoader = new GLTFLoader(loadingManager);

/** Cache theo URL: tránh tải lại cùng một file nhiều lần. */
const cache = new Map();

/**
 * Tải một file .glb, trả về bản clone của scene (dùng chung geometry/material với cache).
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
    scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    return { scene, animations: gltf.animations };
  } catch (err) {
    cache.delete(url); // cho phép thử lại lần sau
    throw err;
  }
}
