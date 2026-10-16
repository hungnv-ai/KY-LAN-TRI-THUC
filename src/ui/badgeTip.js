import { h } from './dom.js';

/** Khoảng cách tooltip so với con trỏ (px). */
const OFFSET_PX = 14;

let tipEl = null;
let hideTimer = 0;

/**
 * Hiện chú thích nhỏ cạnh con trỏ (vd tên mốc quãng đường khi rê chuột vào huy hiệu bảng tên).
 *
 * @param {string} text
 * @param {number} x toạ độ màn hình (px)
 * @param {number} y
 * @param {number} [autoHideMs] tự ẩn sau bấy nhiêu ms (dùng khi chạm trên điện thoại)
 */
export function showBadgeTip(text, x, y, autoHideMs = 0) {
  if (!tipEl) {
    tipEl = h('div', { class: 'badge-tip', role: 'tooltip' });
    document.body.append(tipEl);
  }
  tipEl.textContent = text;
  tipEl.hidden = false;
  // Giữ trong màn hình: lật sang trái nếu sát mép phải.
  const w = tipEl.offsetWidth;
  const left = x + OFFSET_PX + w > window.innerWidth - 8 ? x - OFFSET_PX - w : x + OFFSET_PX;
  tipEl.style.left = `${Math.max(8, left)}px`;
  tipEl.style.top = `${Math.max(8, y - OFFSET_PX - tipEl.offsetHeight)}px`;
  clearTimeout(hideTimer);
  if (autoHideMs) hideTimer = setTimeout(hideBadgeTip, autoHideMs);
}

/** Ẩn chú thích. */
export function hideBadgeTip() {
  clearTimeout(hideTimer);
  if (tipEl) tipEl.hidden = true;
}

/**
 * Đổi con trỏ chuột trên khung 3D (bàn tay khi rê vào huy hiệu).
 *
 * @param {HTMLElement} el
 * @param {boolean} pointer
 */
export function setPointerCursor(el, pointer) {
  el.style.cursor = pointer ? 'help' : '';
}
