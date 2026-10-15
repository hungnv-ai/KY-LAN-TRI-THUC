import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** Điểm camera nhìn vào (ngực/đầu Kỳ lân trên bục). */
const LOOK_AT = new THREE.Vector3(0, 1.4, 0);
/** Hướng đặt camera (hơi chếch phải, nhìn từ trên xuống — thấy nhiều mặt đảo & bạn bè hơn). */
const VIEW_DIR = new THREE.Vector3(0.22, 0.46, 1).normalize();
/** Khoảng cách camera mặc định (đủ xa để thấy nhiều cảnh vật và người chơi xung quanh). */
const DIST_LANDSCAPE = 15;
const DIST_PORTRAIT = 23;
/** Xa nhất người chơi tự kéo/zoom được khi đi theo Kỳ lân. */
const FOLLOW_MAX_DIST = 32;
/** Chế độ Toàn cảnh: camera bay lên cao nhìn cả hòn đảo. */
const OVERVIEW_TARGET = new THREE.Vector3(0, 0, 0);
const OVERVIEW_DIR = new THREE.Vector3(0.18, 1.05, 0.75).normalize();
/** Bán kính cần lọt khung khi xem toàn cảnh (đảo + bờ cát, m). */
const OVERVIEW_FIT_RADIUS = 34;
const OVERVIEW_FOV = 48;
const DEFAULT_FOV = 35;
const CAMERA_FLY_SPEED = 2.6;
/** Màn chào: camera lượn nửa vòng quanh đảo rồi đáp xuống Kỳ lân. */
const INTRO_SEC = 5;
const INTRO_START_RADIUS = 62;
const INTRO_START_HEIGHT = 38;
/** Sương mù tối thiểu khi ở gần (m). */
const FOG_NEAR = 36;
const FOG_FAR = 110;
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
 *   follow: (position: THREE.Vector3) => void, setOverview: (on: boolean) => void, isOverview: () => boolean,
 *   playIntro: () => Promise<void> }}
 */
export function createWorld(container) {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(DEFAULT_FOV, window.innerWidth / window.innerHeight, 0.1, 260);

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
  controls.maxDistance = FOLLOW_MAX_DIST;
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

  /** Sương mù lùi xa theo khoảng cách camera (toàn cảnh vẫn rõ, cận cảnh vẫn có chiều sâu). */
  function updateFog() {
    if (!scene.fog) return;
    const d = camera.position.distanceTo(controls.target);
    scene.fog.near = Math.max(FOG_NEAR, d + 18);
    scene.fog.far = Math.max(FOG_FAR, d + 95);
  }

  // ── Màn chào khi mở game ──────────────────────────────────────────────
  let intro = null;
  function playIntro() {
    return new Promise((resolve) => {
      const endT = controls.target.clone();
      const endP = camera.position.clone();
      const off = endP.clone().sub(endT);
      const endAngle = Math.atan2(off.x, off.z);
      intro = {
        t: 0,
        endT,
        endP,
        endAngle,
        endRadius: Math.hypot(off.x, off.z),
        endHeight: off.y,
        resolve,
      };
      flying = true;
      controls.enabled = false;
      const skip = () => finishIntro();
      intro.skip = skip;
      window.addEventListener('pointerdown', skip, { once: true });
      window.addEventListener('keydown', skip, { once: true });
    });
  }

  function finishIntro() {
    if (!intro) return;
    controls.target.copy(intro.endT);
    camera.position.copy(intro.endP);
    window.removeEventListener('pointerdown', intro.skip);
    window.removeEventListener('keydown', intro.skip);
    const done = intro.resolve;
    intro = null;
    flying = false;
    controls.enabled = true;
    done();
  }

  function updateIntro(delta) {
    if (!intro) return;
    intro.t = Math.min(1, intro.t + delta / INTRO_SEC);
    const e = 1 - (1 - intro.t) ** 3; // chậm dần khi đáp xuống
    const angle = intro.endAngle + Math.PI * (1 - e);
    const radius = THREE.MathUtils.lerp(INTRO_START_RADIUS, intro.endRadius, e);
    const height = THREE.MathUtils.lerp(INTRO_START_HEIGHT, intro.endHeight, e);
    controls.target.lerpVectors(OVERVIEW_TARGET, intro.endT, e);
    camera.position.set(controls.target.x + Math.sin(angle) * radius, controls.target.y + height, controls.target.z + Math.cos(angle) * radius);
    camera.lookAt(controls.target);
    if (intro.t >= 1) finishIntro();
  }

  function update(delta) {
    updateIntro(delta);
    updateFly(delta);
    updateFog();
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
  let hasFollow = false;
  function follow(position) {
    followTarget.set(position.x, position.y + LOOK_AT.y - FOLLOW_GROUND_Y, position.z);
    hasFollow = true;
    if (overview || flying) return; // đang xem toàn cảnh → không kéo camera theo
    followDelta.subVectors(followTarget, controls.target);
    controls.target.add(followDelta);
    camera.position.add(followDelta);
  }

  // ── Toàn cảnh đảo: bay lên cao rồi bay về đúng chỗ cũ ─────────────────
  let overview = false;
  let flying = false;
  const saved = { target: new THREE.Vector3(), position: new THREE.Vector3() };
  const fly = { fromT: new THREE.Vector3(), fromP: new THREE.Vector3(), toT: new THREE.Vector3(), toP: new THREE.Vector3(), t: 1 };

  function startFly(toTarget, toPosition) {
    fly.fromT.copy(controls.target);
    fly.fromP.copy(camera.position);
    fly.toT.copy(toTarget);
    fly.toP.copy(toPosition);
    fly.t = 0;
    flying = true;
    controls.enabled = false;
  }

  let targetFov = DEFAULT_FOV;
  function updateFly(delta) {
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, delta * CAMERA_FLY_SPEED);
      camera.updateProjectionMatrix();
    }
    if (!flying) return;
    fly.t = Math.min(1, fly.t + delta * CAMERA_FLY_SPEED * 0.5);
    const e = fly.t < 0.5 ? 4 * fly.t ** 3 : 1 - (-2 * fly.t + 2) ** 3 / 2; // easeInOutCubic
    controls.target.lerpVectors(fly.fromT, fly.toT, e);
    camera.position.lerpVectors(fly.fromP, fly.toP, e);
    if (fly.t >= 1) {
      flying = false;
      controls.enabled = true;
    }
  }

  function setOverview(on) {
    if (on === overview) return;
    overview = on;
    if (on) {
      saved.target.copy(controls.target);
      saved.position.copy(camera.position);
      // Khoảng cách vừa đủ để cả đảo lọt khung theo chiều hẹp hơn của màn hình (điện thoại dựng đứng).
      targetFov = OVERVIEW_FOV;
      const halfV = THREE.MathUtils.degToRad(OVERVIEW_FOV / 2);
      const halfH = Math.atan(Math.tan(halfV) * camera.aspect);
      const dist = THREE.MathUtils.clamp(OVERVIEW_FIT_RADIUS / Math.tan(Math.min(halfV, halfH)), 50, 160);
      controls.maxDistance = dist * 1.3;
      controls.minPolarAngle = 0.05;
      startFly(OVERVIEW_TARGET, OVERVIEW_TARGET.clone().addScaledVector(OVERVIEW_DIR, dist));
    } else {
      controls.maxDistance = FOLLOW_MAX_DIST;
      controls.minPolarAngle = 0.5;
      targetFov = DEFAULT_FOV;
      // Bay về chỗ Kỳ lân đang đứng (có thể đã chạy đi trong lúc xem toàn cảnh), giữ góc nhìn cũ.
      const target = hasFollow ? followTarget.clone() : saved.target.clone();
      startFly(target, target.clone().add(saved.position.sub(saved.target)));
    }
  }

  return {
    scene, camera, renderer, controls, onTap, toScreen, setPanelFocus, update, follow, setOverview, playIntro,
    isOverview: () => overview,
  };
}
