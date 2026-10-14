import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** Điểm camera nhìn vào (ngực/đầu Kỳ lân trên bục). */
const LOOK_AT = new THREE.Vector3(0, 1.45, 0);
/** Hướng đặt camera (hơi chếch phải, nhìn hơi từ trên xuống). */
const VIEW_DIR = new THREE.Vector3(0.28, 0.16, 1).normalize();
const DIST_LANDSCAPE = 6.4;
const DIST_PORTRAIT = 8.6;
/** Di chuyển chuột/ngón tay dưới ngưỡng này (px) thì coi là "chạm", không phải xoay camera. */
const TAP_THRESHOLD_PX = 6;

/**
 * Renderer, Scene, Camera, OrbitControls và xử lý resize.
 *
 * @param {HTMLElement} container
 * @returns {{ scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer,
 *   controls: OrbitControls, onTap: (object: THREE.Object3D, handler: () => void) => void,
 *   toScreen: (world: THREE.Vector3) => { x: number, y: number } }}
 */
export function createWorld(container) {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(LOOK_AT);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 3.5;
  controls.maxDistance = 12;
  controls.minPolarAngle = 0.6;
  controls.maxPolarAngle = Math.PI / 2 - 0.05; // không cho camera chui xuống dưới mặt đất

  function frameCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    const dist = aspect < 0.8 ? DIST_PORTRAIT : DIST_LANDSCAPE;
    camera.aspect = aspect;
    camera.position.copy(LOOK_AT).addScaledVector(VIEW_DIR, dist);
    camera.updateProjectionMatrix();
    controls.update();
  }
  frameCamera();

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    frameCamera();
  });

  // ── Chạm vào object (phân biệt với kéo xoay camera) ──────────────────
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const tapTargets = [];
  let downPos = null;

  renderer.domElement.addEventListener('pointerdown', (e) => {
    downPos = { x: e.clientX, y: e.clientY };
  });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downPos) return;
    const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
    downPos = null;
    if (moved > TAP_THRESHOLD_PX) return;

    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    for (const { object, handler } of tapTargets) {
      if (raycaster.intersectObject(object, true).length > 0) {
        handler();
        break;
      }
    }
  });

  function onTap(object, handler) {
    tapTargets.push({ object, handler });
  }

  const projected = new THREE.Vector3();
  function toScreen(world) {
    projected.copy(world).project(camera);
    return {
      x: (projected.x * 0.5 + 0.5) * window.innerWidth,
      y: (-projected.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  return { scene, camera, renderer, controls, onTap, toScreen };
}
