import * as THREE from 'three';
import { VALUES } from '../config.js';
import { getRankInfo } from '../data/ranks.js';

/** Chiều cao bảng tên (đơn vị sprite không co giãn) — giữ cố định khi đứng gần/xa. */
const SCREEN_HEIGHT = 0.038;
/** Độ cao bảng tên phía trên chân Kỳ lân (m). */
export const NAME_TAG_Y = 2.95;

/**
 * Chiều cao bảng tên trên màn hình (px). Sprite `sizeAttenuation: false` có kích thước cố định:
 * chiều cao NDC = scale.y × projectionMatrix[5].
 *
 * @param {THREE.PerspectiveCamera} camera
 * @param {number} viewportHeight chiều cao vùng vẽ (px)
 * @returns {number}
 */
export function nameTagPixelHeight(camera, viewportHeight) {
  return SCREEN_HEIGHT * camera.projectionMatrix.elements[5] * 0.5 * viewportHeight;
}
const CANVAS_H = 128;
const HOUSE_COLOR = Object.fromEntries(VALUES.map((v) => [v.id, v.color]));
/** Từ hạng này trở lên (chỉ số trong RANKS) bảng tên có viền lấp lánh. */
const SHINY_RANK_INDEX = 4;

/**
 * Bảng tên nổi trên đầu Kỳ lân: [icon hạng] Tên · bộ phận, dải màu Nhà, viền theo màu hạng.
 * Nhìn là biết người đó hạng nào, thuộc Nhà nào → động lực thi đua.
 *
 * @returns {{ sprite: THREE.Sprite, set: (info: { name: string, unit?: string | null, xp: number, house?: string | null, isMe?: boolean }) => void,
 *   update: (elapsed: number) => void, dispose: () => void }}
 */
export function createNameTag() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, sizeAttenuation: false });
  const sprite = new THREE.Sprite(material);
  sprite.position.y = NAME_TAG_Y;
  sprite.renderOrder = 15;
  sprite.center.set(0.5, 0);
  let shiny = false;
  let last = '';

  function set({ name, unit, xp, house, isMe = false }) {
    const key = `${name}|${unit}|${xp}|${house}|${isMe}`;
    if (key === last) return;
    last = key;
    const info = getRankInfo(xp ?? 0);
    shiny = info.index >= SHINY_RANK_INDEX;

    const title = `${info.rank.icon} ${name || 'Kỳ lân'}`;
    const subtitle = [info.label, unit].filter(Boolean).join(' · ');
    const fontTitle = '800 50px "Be Vietnam Pro", Arial, sans-serif';
    const fontSub = '600 32px "Be Vietnam Pro", Arial, sans-serif';
    ctx.font = fontTitle;
    const wTitle = ctx.measureText(title).width;
    ctx.font = fontSub;
    const wSub = ctx.measureText(subtitle).width;
    const width = Math.ceil(Math.max(wTitle, wSub) + 64);
    canvas.width = width;
    canvas.height = CANVAS_H;

    // Nền + viền màu hạng.
    ctx.fillStyle = isMe ? 'rgba(255, 250, 240, 0.96)' : 'rgba(255, 255, 255, 0.92)';
    ctx.strokeStyle = info.rank.color;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.roundRect(5, 5, width - 10, CANVAS_H - 10, 30);
    ctx.fill();
    ctx.stroke();
    // Dải màu Nhà bên trái.
    ctx.fillStyle = HOUSE_COLOR[house] ?? '#cccccc';
    ctx.beginPath();
    ctx.roundRect(14, 22, 12, CANVAS_H - 44, 6);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#2E2017';
    ctx.font = fontTitle;
    ctx.fillText(title, width / 2 + 8, 46);
    ctx.fillStyle = info.rank.color;
    ctx.font = fontSub;
    ctx.fillText(subtitle, width / 2 + 8, 94);

    texture.needsUpdate = true;
    sprite.scale.set((SCREEN_HEIGHT * width) / CANVAS_H, SCREEN_HEIGHT, 1);
  }

  /** Hạng cao: bảng tên "thở" ánh sáng nhẹ. */
  function update(elapsed) {
    if (!shiny) return;
    const k = 0.85 + Math.sin(elapsed * 3) * 0.15;
    material.color.setRGB(1, k, k * 0.9 + 0.1);
  }

  function dispose() {
    texture.dispose();
    material.dispose();
  }

  return { sprite, set, update, dispose };
}
