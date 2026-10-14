import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/**
 * Thêm hệ thống ánh sáng vào scene:
 * - HemisphereLight: ánh sáng môi trường dịu (trời xanh / đất ấm), giúp vật thể không bị "phẳng".
 * - AmbientLight: nâng sáng nhẹ các vùng tối.
 * - DirectionalLight: "mặt trời" chính, có đổ bóng.
 *
 * Kèm environment map (RoomEnvironment) để vật liệu kim loại như sừng vàng, giày bạc có phản chiếu.
 *
 * @param {THREE.Scene} scene
 * @param {THREE.WebGLRenderer} renderer
 * @returns {{ hemi: THREE.HemisphereLight, ambient: THREE.AmbientLight, sun: THREE.DirectionalLight }}
 */
export function setupLights(scene, renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
  pmrem.dispose();

  const hemi = new THREE.HemisphereLight(0xdff1ff, 0xffe2c2, 0.8);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
  sun.position.set(5, 10, 6);
  sun.castShadow = true;

  // Shadow map: vùng chiếu bóng bao quanh khu vực nhân vật đứng (~10x10 đơn vị).
  sun.shadow.mapSize.set(2048, 2048);
  const d = 6;
  sun.shadow.camera.left = -d;
  sun.shadow.camera.right = d;
  sun.shadow.camera.top = d;
  sun.shadow.camera.bottom = -d;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 30;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 4; // làm mềm viền bóng (PCFShadowMap)

  scene.add(sun);
  scene.add(sun.target); // target ở gốc toạ độ (0, 0, 0)

  return { hemi, ambient, sun };
}
