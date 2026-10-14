import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { setupLights } from './lights.js';
import { loadingManager, loadUnicorn } from './loader.js';
import { setCoins, setLoadingProgress, hideLoading } from './hud.js';

// ---------------------------------------------------------------------------
// Scene / Camera / Renderer
// ---------------------------------------------------------------------------
const container = document.getElementById('canvas-container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfe8ff);
scene.fog = new THREE.Fog(0xcfe8ff, 15, 40);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(3.5, 2.5, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
container.appendChild(renderer.domElement);

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 2.5;
controls.maxDistance = 12;
controls.maxPolarAngle = Math.PI / 2 - 0.05; // không cho camera chui xuống dưới mặt đất
controls.update();

// ---------------------------------------------------------------------------
// Môi trường
// ---------------------------------------------------------------------------
setupLights(scene);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(12, 64),
  new THREE.MeshStandardMaterial({ color: 0xa8e6a1, roughness: 0.95 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ---------------------------------------------------------------------------
// Tài nguyên
// ---------------------------------------------------------------------------
loadingManager.onProgress = (_url, loaded, total) => setLoadingProgress(loaded / total);

/** Trạng thái runtime của game. */
const state = {
  unicorn: null,
  mixer: null,
};

async function init() {
  const { model, animations, isPlaceholder } = await loadUnicorn();
  model.name = 'Unicorn';
  scene.add(model);
  state.unicorn = model;

  if (animations.length > 0) {
    state.mixer = new THREE.AnimationMixer(model);
    const idle = THREE.AnimationClip.findByName(animations, 'Idle') ?? animations[0];
    state.mixer.clipAction(idle).play();
  }
  model.userData.isPlaceholder = isPlaceholder;

  setCoins(0);
  hideLoading();
}

// ---------------------------------------------------------------------------
// Animation loop
// ---------------------------------------------------------------------------
const timer = new THREE.Timer();
timer.connect(document); // tạm dừng delta khi tab bị ẩn

function update(delta, elapsed) {
  state.mixer?.update(delta);

  // Placeholder không có animation: cho "thở" nhẹ để scene sống động hơn.
  if (state.unicorn?.userData.isPlaceholder) {
    state.unicorn.position.y = Math.sin(elapsed * 2) * 0.03;
  }

  controls.update();
}

renderer.setAnimationLoop((timestamp) => {
  timer.update(timestamp);
  update(timer.getDelta(), timer.getElapsed());
  renderer.render(scene, camera);
});

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

init().catch((err) => {
  console.error('[main] Khởi tạo thất bại:', err);
  hideLoading();
});
