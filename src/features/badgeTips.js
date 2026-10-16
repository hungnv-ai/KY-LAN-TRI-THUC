import * as THREE from 'three';
import { hideBadgeTip, setPointerCursor, showBadgeTip } from '../ui/badgeTip.js';

/** Chạm (không kéo) dưới ngưỡng này (px) thì coi là bấm vào huy hiệu. */
const TAP_THRESHOLD_PX = 6;
/** Điện thoại: chú thích tự ẩn sau bấy nhiêu ms. */
const TOUCH_TIP_MS = 2500;

/**
 * Rê chuột (máy tính) hoặc chạm (điện thoại) vào ô huy hiệu trên bảng tên → hiện tên mốc quãng đường.
 * Ô huy hiệu do scene/nameTag.js khai báo trong `sprite.userData.badgeTip` (vùng uv + chữ).
 *
 * @param {{ world: { camera: THREE.Camera, renderer: THREE.WebGLRenderer }, getSprites: () => THREE.Sprite[] }} deps
 */
export function setupBadgeTips({ world, getSprites }) {
  const canvas = world.renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pending = null;
  let downPos = null;

  /** @returns {string | null} chữ chú thích nếu (x, y) nằm trên ô huy hiệu */
  function tipAt(x, y) {
    pointer.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, world.camera);
    let best = null;
    for (const sprite of getSprites()) {
      const tip = sprite.userData.badgeTip;
      if (!tip || !sprite.visible) continue;
      const hit = raycaster.intersectObject(sprite, false)[0];
      if (!hit?.uv || hit.uv.x < tip.u0 || hit.uv.x > tip.u1) continue;
      if (!best || hit.distance < best.distance) best = { distance: hit.distance, text: tip.text };
    }
    return best?.text ?? null;
  }

  // Máy tính: rê chuột (gộp theo khung hình để không dò tia quá nhiều).
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    const first = !pending;
    pending = { x: e.clientX, y: e.clientY };
    if (!first) return;
    requestAnimationFrame(() => {
      const { x, y } = pending;
      pending = null;
      const text = tipAt(x, y);
      setPointerCursor(canvas, Boolean(text));
      if (text) showBadgeTip(text, x, y);
      else hideBadgeTip();
    });
  });
  canvas.addEventListener('pointerleave', () => {
    setPointerCursor(canvas, false);
    hideBadgeTip();
  });

  // Điện thoại: chạm vào huy hiệu.
  canvas.addEventListener('pointerdown', (e) => {
    downPos = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse' || !downPos) return;
    const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
    downPos = null;
    if (moved > TAP_THRESHOLD_PX) return;
    const text = tipAt(e.clientX, e.clientY);
    if (text) showBadgeTip(text, e.clientX, e.clientY, TOUCH_TIP_MS);
  });
}
