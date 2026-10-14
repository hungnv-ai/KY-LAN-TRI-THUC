/**
 * Bảng trượt từ dưới lên (mobile) / hộp giữa màn hình (desktop) cho Quiz, Tủ đồ, Hạng.
 */
const sheet = document.getElementById('sheet');
const titleEl = document.getElementById('sheet-title');
const bodyEl = document.getElementById('sheet-body');

let onCloseHandler = null;
let lastFocus = null;

sheet.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) closeSheet();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !sheet.hidden && !document.querySelector('.dialog')) closeSheet();
});

/**
 * @param {{ title: string, content: Node, onClose?: () => void }} options
 */
export function openSheet({ title, content, onClose }) {
  if (!sheet.hidden) closeSheet();
  lastFocus = document.activeElement;
  titleEl.textContent = title;
  bodyEl.replaceChildren(content);
  bodyEl.scrollTop = 0;
  onCloseHandler = onClose ?? null;
  sheet.hidden = false;
  sheet.querySelector('.icon-btn').focus();
}

/** @param {string} title */
export function setSheetTitle(title) {
  titleEl.textContent = title;
}

/** @param {Node} content */
export function setSheetContent(content) {
  bodyEl.replaceChildren(content);
  bodyEl.scrollTop = 0;
}

export function closeSheet() {
  if (sheet.hidden) return;
  sheet.hidden = true;
  bodyEl.replaceChildren();
  const handler = onCloseHandler;
  onCloseHandler = null;
  handler?.();
  lastFocus?.focus?.();
}

/** @returns {boolean} */
export function isSheetOpen() {
  return !sheet.hidden;
}
