import { h } from './dom.js';

/**
 * Phản hồi nhanh cho người chơi: toast góc phải, hộp thoại xác nhận, hộp thoại chúc mừng,
 * bong bóng lời thoại của Kỳ lân.
 */

const toastRoot = document.getElementById('toasts');
const dialogRoot = document.getElementById('dialog-root');
const speechEl = document.getElementById('speech');

const TOAST_MS = 2800;
const SPEECH_MS = 5000;

/**
 * @param {string} message
 * @param {{ type?: 'info' | 'success' | 'warn', icon?: string }} [options]
 */
export function showToast(message, { type = 'info', icon = '' } = {}) {
  const toast = h('div', { class: `toast ${type}`, role: 'status' }, icon && h('span', { 'aria-hidden': 'true' }, icon), message);
  toastRoot.append(toast);
  setTimeout(() => {
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 300);
  }, TOAST_MS);
}

/**
 * Hộp thoại xác nhận (dùng trước khi tiêu Xu).
 *
 * @param {{ icon?: string, title: string, message: string, confirmText?: string, cancelText?: string }} options
 * @returns {Promise<boolean>}
 */
export function confirmDialog({ icon = '❓', title, message, confirmText = 'Đồng ý', cancelText = 'Huỷ' }) {
  return new Promise((resolve) => {
    const close = (result) => {
      dialog.remove();
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };
    const onKey = (e) => e.key === 'Escape' && close(false);

    const confirmBtn = h('button', { class: 'btn', type: 'button', onclick: () => close(true) }, confirmText);
    const dialog = h(
      'div',
      { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-title' },
      h('div', { class: 'sheet-backdrop', onclick: () => close(false) }),
      h(
        'div',
        { class: 'dialog-card' },
        h('div', { class: 'big-emoji', 'aria-hidden': 'true' }, icon),
        h('h2', { class: 'dialog-title', id: 'dlg-title' }, title),
        h('p', { class: 'muted' }, message),
        h(
          'div',
          { class: 'dialog-actions' },
          h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => close(false) }, cancelText),
          confirmBtn,
        ),
      ),
    );
    dialogRoot.append(dialog);
    document.addEventListener('keydown', onKey);
    confirmBtn.focus();
  });
}

/**
 * Hộp thoại chúc mừng (lên hạng…).
 *
 * @param {{ icon: string, title: string, message: string, buttonText?: string }} options
 * @returns {Promise<void>}
 */
export function celebrateDialog({ icon, title, message, buttonText = 'Tuyệt vời!' }) {
  return new Promise((resolve) => {
    const close = () => {
      dialog.remove();
      resolve();
    };
    const okBtn = h('button', { class: 'btn btn-block', type: 'button', onclick: close }, buttonText);
    const dialog = h(
      'div',
      { class: 'dialog celebrate', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'cel-title' },
      h('div', { class: 'sheet-backdrop', onclick: close }),
      h(
        'div',
        { class: 'dialog-card' },
        h('div', { class: 'big-emoji', 'aria-hidden': 'true' }, icon),
        h('h2', { class: 'dialog-title', id: 'cel-title' }, title),
        h('p', { class: 'muted' }, message),
        h('div', { class: 'dialog-actions single' }, okBtn),
      ),
    );
    dialogRoot.append(dialog);
    okBtn.focus();
  });
}

let speechTimer = 0;

/**
 * Hiện lời thoại phía trên đầu Kỳ lân.
 *
 * @param {string} text
 */
export function say(text) {
  speechEl.textContent = text;
  speechEl.hidden = false;
  clearTimeout(speechTimer);
  speechTimer = setTimeout(() => (speechEl.hidden = true), SPEECH_MS);
}

/**
 * Cập nhật vị trí bong bóng theo toạ độ màn hình của đầu Kỳ lân (gọi mỗi frame).
 *
 * @param {number} x px
 * @param {number} y px
 */
export function setSpeechAnchor(x, y) {
  if (speechEl.hidden) return;
  speechEl.style.left = `${x}px`;
  speechEl.style.top = `${Math.max(90, y)}px`;
}
