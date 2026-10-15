import * as THREE from 'three';
/** Thời gian hiện sticker (giây). */
const SHOW_SEC = 2.8;
/** Kích thước trên màn hình (đơn vị sprite không co giãn). */
const SCREEN_SIZE = 0.085;
/** Ngang tầm đầu Kỳ lân (m) — sticker hiện bên cạnh đầu, không bị cắt mép trên màn hình. */
const OFFSET_Y = 2.25;
const CANVAS_SIZE = 160;

const textures = new Map();

/** Bong bóng tròn trắng + emoji (vẽ một lần, dùng chung cho mọi Kỳ lân). */
function stickerTexture(emoji) {
  if (textures.has(emoji)) return textures.get(emoji);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext('2d');
  const c = CANVAS_SIZE / 2;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.strokeStyle = 'rgba(154, 0, 54, 0.85)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(c, c - 8, c - 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Đuôi bong bóng chỉ về phía đầu Kỳ lân (góc dưới bên trái).
  ctx.beginPath();
  ctx.moveTo(c - 40, CANVAS_SIZE - 44);
  ctx.lineTo(10, CANVAS_SIZE - 8);
  ctx.lineTo(c - 12, CANVAS_SIZE - 26);
  ctx.fill();
  ctx.font = '84px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, c, c - 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textures.set(emoji, texture);
  return texture;
}

/**
 * Sticker nổi trên đầu một Kỳ lân (của mình hoặc người khác): bật lên, lắc nhẹ, mờ dần.
 *
 * @param {THREE.Object3D} parent gốc của Kỳ lân (đặt sticker phía trên bảng tên)
 * @returns {{ show: (emoji: string) => void, update: (delta: number) => void, dispose: () => void }}
 */
export function createStickerBubble(parent) {
  const material = new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false });
  const sprite = new THREE.Sprite(material);
  sprite.center.set(-0.15, 0.1); // lệch sang phải đầu
  sprite.position.y = OFFSET_Y;
  sprite.renderOrder = 20;
  sprite.visible = false;
  parent.add(sprite);
  let time = SHOW_SEC;

  function show(emoji) {
    material.map = stickerTexture(emoji);
    material.needsUpdate = true;
    time = 0;
    sprite.visible = true;
  }

  function update(delta) {
    if (!sprite.visible) return;
    time += delta;
    if (time >= SHOW_SEC) {
      sprite.visible = false;
      return;
    }
    const pop = Math.min(1, time * 7);
    const overshoot = pop < 1 ? pop * 1.15 : 1 + 0.04 * Math.sin(time * 9);
    const s = SCREEN_SIZE * overshoot;
    sprite.scale.set(s, s, 1);
    material.rotation = Math.sin(time * 6) * 0.08;
    material.opacity = Math.min(1, (SHOW_SEC - time) / 0.5);
  }

  function dispose() {
    parent.remove(sprite);
    material.dispose(); // texture dùng chung — không dispose
  }

  return { show, update, dispose };
}
