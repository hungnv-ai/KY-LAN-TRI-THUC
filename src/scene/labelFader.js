import * as THREE from 'three';

/**
 * Làm mờ dần các biển chữ ở xa để màn hình gọn (nhất là trên điện thoại).
 * Biển nào muốn được quản lý chỉ cần đặt `sprite.userData.fade = { near, far, overview }`:
 *   - near / far (m): rõ hoàn toàn khi camera gần hơn `near`, biến mất khi xa hơn `far`;
 *   - overview: 'show' | 'hide' — cách hiển thị khi đang xem Toàn cảnh đảo.
 * Không đụng tới `sprite.visible` (thuộc quyền module tạo biển), chỉ đổi opacity của vật liệu.
 */

const RESCAN_SEC = 1;
const tmp = new THREE.Vector3();

/**
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @returns {{ update: (delta: number, overview: boolean) => void }}
 */
export function createLabelFader(scene, camera) {
  let list = [];
  let scanTimer = 0;

  function rescan() {
    list = [];
    scene.traverse((o) => {
      if (o.isSprite && o.userData.fade) list.push(o);
    });
  }

  function update(delta, overview) {
    scanTimer -= delta;
    if (scanTimer <= 0) {
      scanTimer = RESCAN_SEC;
      rescan();
    }
    for (const sprite of list) {
      const { near, far, overview: mode = 'show' } = sprite.userData.fade;
      let alpha;
      if (overview) {
        alpha = mode === 'show' ? 1 : 0;
      } else {
        const d = sprite.getWorldPosition(tmp).distanceTo(camera.position);
        alpha = THREE.MathUtils.clamp((far - d) / Math.max(far - near, 0.001), 0, 1);
      }
      sprite.material.opacity = alpha;
      sprite.material.visible = alpha > 0.01;
    }
  }

  return { update };
}
