import { h } from './dom.js';

let el = null;
let current = null;

/**
 * Nút hành động nổi giữa màn hình (vd "🥕 Cho thỏ ăn") khi Kỳ lân đứng gần thứ tương tác được.
 * Bấm nút hoặc phím E / Enter để làm. Gọi lại với cùng `key` thì không vẽ lại.
 *
 * @param {{ key: string, icon: string, label: string, onClick: () => void }} opts
 */
export function showInteract({ key, icon, label, onClick }) {
  if (!el) {
    el = h('button', { class: 'interact-btn', type: 'button' });
    el.addEventListener('click', () => current?.onClick());
    document.body.append(el);
    window.addEventListener('keydown', (e) => {
      if (!current || el.hidden || e.repeat) return;
      if (e.code === 'KeyE' || (e.code === 'Enter' && document.activeElement === document.body)) current.onClick();
    });
  }
  current = { key, onClick };
  if (el.dataset.key !== key) {
    el.dataset.key = key;
    el.replaceChildren(h('span', { class: 'interact-icon', 'aria-hidden': 'true' }, icon), label, h('kbd', { class: 'interact-key' }, 'E'));
  }
  el.hidden = false;
}

/** Ẩn nút hành động nổi. */
export function hideInteract() {
  current = null;
  if (el) {
    el.hidden = true;
    el.dataset.key = '';
  }
}
