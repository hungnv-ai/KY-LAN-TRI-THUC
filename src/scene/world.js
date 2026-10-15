import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** Điểm camera nhìn vào (ngực/đầu Kỳ lân trên bục). */
const LOOK_AT = new THREE.Vector3(0, 1.75, 0);
/** Hướng đặt camera (hơi chếch phải, nhìn hơi từ trên xuống). */
const VIEW_DIR = new THREE.Vector3(0.22, 0.34, 1).normalize();
const DIST_LANDSCAPE = 7.6;
const DIST_PORTRAIT = 9.8;
/** Khi mở bảng bên (Tủ đồ, Quiz): desktop dịch nhân vật sang trái nửa bề rộng bảng; mobile dịch lên trên. */
const SIDE_PANEL_PX = 416;
const MOBILE_PANEL_SHIFT_Y = 0.22;
/** Mobile: thu nhỏ khung hình để cả Kỳ lân vừa phần màn hình phía trên bảng. */
const MOBILE_PANEL_ZOOM = 0.55;
const DESKTOP_MIN_WIDTH = 768;
const VIEW_SHIFT_SPEED = 6;
/** Di chuyển chuột/ngón tay dưới ngưỡng này (px) thì coi là "chạm", không phải xoay camera. */
const TAP_THRESHOLD_PX = 6;
/** Độ cao mặt bục lúc khởi động — LOOK_AT tính theo vị trí này. */
const FOLLOW_GROUND_Y = 0.18;

/**
 * Renderer, Scene, Camera, OrbitControls và xử lý resize.
 *
 * @param {HTMLElement} container
 * @returns {{ scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer,
 *   controls: OrbitControls, onTap: (object: THREE.Object3D, handler: () => void) => () => void,
 *   toScreen: (world: THREE.Vector3) => { x: number, y: number },
 *   setPanelFocus: (open: boolean) => void, update: (delta: number) => void,
 *   follow: (position: THREE.Vector3) => void }}
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
  controls.maxDistance = 16;
  controls.minPolarAngle = 0.5;
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
    // Chọn vật gần camera nhất (khi nhiều Kỳ lân đứng chồng nhau).
    let best = null;
    for (const entry of tapTargets) {
      if (!entry.object.parent?.visible && entry.object.parent) continue;
      const hit = raycaster.intersectObject(entry.object, true)[0];
      if (hit && (!best || hit.distance < best.distance)) best = { distance: hit.distance, entry };
    }
    best?.entry.handler();
  });

  /** @returns {() => void} huỷ đăng ký */
  function onTap(object, handler) {
    const entry = { object, handler };
    tapTargets.push(entry);
    return () => {
      const i = tapTargets.indexOf(entry);
      if (i >= 0) tapTargets.splice(i, 1);
    };
  }

  const projected = new THREE.Vector3();
  function toScreen(world) {
    projected.copy(world).project(camera);
    return {
      x: (projected.x * 0.5 + 0.5) * window.innerWidth,
      y: (-projected.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  // ── Dịch khung hình khi mở bảng bên (camera.setViewOffset) ───────────
  let panelOpen = false;
  const shift = { x: 0, y: 0, zoom: 1 };

  function setPanelFocus(open) {
    panelOpen = open;
  }

  function update(delta) {
    const w = window.innerWidth;
    const hgt = window.innerHeight;
    const desktop = w >= DESKTOP_MIN_WIDTH;
    const targetX = panelOpen && desktop ? SIDE_PANEL_PX / 2 / w : 0;
    const targetY = panelOpen && !desktop ? MOBILE_PANEL_SHIFT_Y : 0;
    const targetZoom = panelOpen && !desktop ? MOBILE_PANEL_ZOOM : 1;
    const k = Math.min(1, delta * VIEW_SHIFT_SPEED);
    shift.x += (targetX - shift.x) * k;
    shift.y += (targetY - shift.y) * k;
    shift.zoom += (targetZoom - shift.zoom) * k;

    const settled = Math.abs(shift.x) < 1e-4 && Math.abs(shift.y) < 1e-4 && Math.abs(shift.zoom - 1) < 1e-4;
    if (settled) {
      if (camera.view?.enabled || camera.zoom !== 1) {
        camera.zoom = 1;
        camera.clearViewOffset(); // gọi luôn updateProjectionMatrix
      }
      return;
    }
    camera.zoom = shift.zoom;
    camera.setViewOffset(w, hgt, shift.x * w, shift.y * hgt, w, hgt);
  }

  // ── Camera bám theo Kỳ lân (giữ nguyên góc xoay người chơi đã chọn) ──
  const followTarget = new THREE.Vector3();
  const followDelta = new THREE.Vector3();
  function follow(position) {
    followTarget.set(position.x, position.y + LOOK_AT.y - FOLLOW_GROUND_Y, position.z);
    followDelta.subVectors(followTarget, controls.target);
    controls.target.add(followDelta);
    camera.position.add(followDelta);
  }

  return { scene, camera, renderer, controls, onTap, toScreen, setPanelFocus, update, follow };
}
