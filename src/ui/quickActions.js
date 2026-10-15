import { STICKERS } from '../data/stickers.js';
import { h } from './dom.js';

/**
 * Cột nút tròn bên phải màn hình (trên thanh điều hướng): Sticker, Chụp ảnh và các nút sự kiện.
 */

const root = document.getElementById('quick-actions');

/**
 * Thêm một nút nhanh.
 *
 * @param {{ icon: string, label: string, onClick: (button: HTMLButtonElement) => void, accent?: string, order?: number }} opts
 * @returns {{ el: HTMLButtonElement, setHidden: (hidden: boolean) => void, setBadge: (text: string | null) => void,
 *   setPulse: (on: boolean) => void }}
 */
export function addQuickAction({ icon, label, onClick, accent, order = 0 }) {
  root.hidden = false;
  const badge = h('span', { class: 'qa-badge', hidden: true });
  const el = h(
    'button',
    { class: 'qa-btn', type: 'button', 'aria-label': label, title: label, style: { order: String(order), ...(accent ? { '--accent': accent } : {}) } },
    h('span', { 'aria-hidden': 'true' }, icon),
    badge,
  );
  el.addEventListener('click', () => onClick(el));
  root.append(el);
  return {
    el,
    setHidden: (hidden) => (el.hidden = hidden),
    setBadge: (text) => {
      badge.hidden = !text;
      badge.textContent = text ?? '';
    },
    setPulse: (on) => el.classList.toggle('is-pulse', on),
  };
}

let openPopover = null;

function closePopover() {
  openPopover?.remove();
  openPopover = null;
  document.removeEventListener('pointerdown', onOutside, true);
}

function onOutside(e) {
  if (openPopover && !openPopover.contains(e.target) && !e.target.closest('.qa-btn')) closePopover();
}

/**
 * Mở bảng chọn sticker cạnh nút.
 *
 * @param {HTMLElement} anchor nút vừa bấm
 * @param {(stickerId: string) => void} onPick
 */
export function toggleStickerPicker(anchor, onPick) {
  if (openPopover) {
    closePopover();
    return;
  }
  const grid = h(
    'div',
    { class: 'sticker-picker', role: 'menu', 'aria-label': 'Chọn sticker' },
    STICKERS.map((s) =>
      h(
        'button',
        {
          class: 'sticker-btn',
          type: 'button',
          role: 'menuitem',
          title: s.label,
          'aria-label': s.label,
          onclick: () => {
            closePopover();
            onPick(s.id);
          },
        },
        s.emoji,
      ),
    ),
  );
  root.append(grid);
  const a = anchor.getBoundingClientRect();
  const r = root.getBoundingClientRect();
  grid.style.top = `${a.top - r.top}px`;
  openPopover = grid;
  setTimeout(() => document.addEventListener('pointerdown', onOutside, true));
  grid.querySelector('button')?.focus();
}
