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
/** Ô huy hiệu mốc quãng đường. */
const BADGE_ICON_FONT = '50px "Be Vietnam Pro", Arial, sans-serif';
const BADGE_LABEL_FONT = '800 30px "Be Vietnam Pro", Arial, sans-serif';
const BADGE_BG = '#FFF4DC';
const BADGE_GOLD = '#C49C57';
const BADGE_TEXT = '#7A5A1E';

/**
 * Bảng tên nổi trên đầu Kỳ lân: dòng trên "[icon hạng] Họ và tên - Hạng", dòng dưới phòng ban;
 * dải màu Nhà, viền theo màu hạng.
 * Nhìn là biết người đó hạng nào, thuộc Nhà nào → động lực thi đua.
 *
 * Bên phải là ô huy hiệu mốc quãng đường cao nhất (👟 1 km…) nếu đã đạt.
 *
 * @returns {{ sprite: THREE.Sprite, set: (info: { name: string, unit?: string | null, xp: number, house?: string | null,
 *   badge?: { icon: string, label: string, title?: string, special: boolean, next?: string | null } | null, isMe?: boolean }) => void,
 *   update: (elapsed: number) => void, dispose: () => void }}
 */
export function createNameTag() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // depthTest: false → bảng tên luôn nổi trên cây, cột Vùng Đất, nhân vật khác (không bị che mất).
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false });
  const sprite = new THREE.Sprite(material);
  sprite.position.y = NAME_TAG_Y;
  sprite.renderOrder = 15;
  sprite.center.set(0.5, 0);
  let shiny = false;
  let last = '';

  function set({ name, unit, xp, house, badge = null, isMe = false }) {
    const key = `${name}|${unit}|${xp}|${house}|${badge?.label}|${badge?.next}|${isMe}`;
    if (key === last) return;
    last = key;
    const info = getRankInfo(xp ?? 0);
    shiny = info.index >= SHINY_RANK_INDEX || Boolean(badge?.special);

    const titleName = `${info.rank.icon} ${name || 'Kỳ lân'}`;
    const titleRank = ` - ${info.label}`;
    const subtitle = unit || 'VA Schools';
    const fontTitle = '800 50px "Be Vietnam Pro", Arial, sans-serif';
    const fontSub = '600 32px "Be Vietnam Pro", Arial, sans-serif';
    const fontRank = '700 40px "Be Vietnam Pro", Arial, sans-serif';
    ctx.font = fontTitle;
    const wName = ctx.measureText(titleName).width;
    ctx.font = fontRank;
    const wRank = ctx.measureText(titleRank).width;
    const wTitle = wName + wRank;
    ctx.font = fontSub;
    const wSub = ctx.measureText(subtitle).width;
    let badgeW = 0;
    if (badge) {
      ctx.font = BADGE_ICON_FONT;
      badgeW = ctx.measureText(badge.icon).width;
      ctx.font = BADGE_LABEL_FONT;
      badgeW = Math.ceil(Math.max(badgeW, ctx.measureText(badge.label).width) + 28);
    }
    const extra = badge ? badgeW + 12 : 0;
    const width = Math.ceil(Math.max(wTitle, wSub) + 64 + extra);
    canvas.width = width;
    canvas.height = CANVAS_H;

    // Nền + viền màu hạng (mốc đặc biệt: viền vàng).
    ctx.fillStyle = isMe ? 'rgba(255, 250, 240, 0.96)' : 'rgba(255, 255, 255, 0.92)';
    ctx.strokeStyle = badge?.special ? BADGE_GOLD : info.rank.color;
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
    const cx = (width - extra) / 2 + 8;
    // Dòng trên: họ tên (màu mực) + hạng (màu hạng), canh giữa cả cụm.
    const startX = cx - wTitle / 2;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#2E2017';
    ctx.font = fontTitle;
    ctx.fillText(titleName, startX, 46);
    ctx.fillStyle = info.rank.color;
    ctx.font = fontRank;
    ctx.fillText(titleRank, startX + wName, 48);
    // Dòng dưới: phòng ban.
    ctx.textAlign = 'center';
    ctx.fillStyle = '#6B5A4E';
    ctx.font = fontSub;
    ctx.fillText(subtitle, cx, 94);

    // Ô huy hiệu mốc quãng đường bên phải: icon + số km.
    if (badge) {
      const bx = width - badgeW - 14;
      ctx.fillStyle = badge.special ? BADGE_GOLD : BADGE_BG;
      ctx.strokeStyle = BADGE_GOLD;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(bx, 12, badgeW, CANVAS_H - 24, 18);
      ctx.fill();
      ctx.stroke();
      ctx.font = BADGE_ICON_FONT;
      ctx.fillText(badge.icon, bx + badgeW / 2, 46);
      ctx.fillStyle = badge.special ? '#FFFFFF' : BADGE_TEXT;
      ctx.font = BADGE_LABEL_FONT;
      ctx.fillText(badge.label, bx + badgeW / 2, 94);
    }
    // Vùng ô huy hiệu theo toạ độ uv (0..1) — để rê chuột / chạm vào thì hiện tên mốc.
    sprite.userData.badgeTip = badge
      ? { u0: (width - badgeW - 14) / width, u1: (width - 14) / width, text: `${badge.icon} ${badge.title ?? ''} · đã chạy ${badge.label}\n${badge.next ? `Mốc tiếp theo: ${badge.next}` : '🎉 Đã chinh phục mốc cao nhất!'}` }
      : null;

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
