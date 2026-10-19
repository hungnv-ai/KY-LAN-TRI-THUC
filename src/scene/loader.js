import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/**
 * Tải file .glb: nhân vật 3D do quản trị tải lên (Supabase Storage) hoặc file trong `public/models/`.
 * Kỳ lân mặc định vẫn dựng bằng code (`src/scene/mascot.js`).
 */

/** LoadingManager dùng chung để theo dõi tiến trình tải toàn bộ tài nguyên. */
export const loadingManager = new THREE.LoadingManager();

const gltfLoader = new GLTFLoader(loadingManager);
// File nhân vật được trang quản trị nén bằng meshopt (admin/glbCompress.js) → cần bộ giải nén này.
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

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
    // SkeletonUtils.clone giữ đúng khung xương cho model có animation (SkinnedMesh).
    const scene = cloneSkinned(gltf.scene);
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
