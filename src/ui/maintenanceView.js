import { h } from './dom.js';

/** Lời nhắn mặc định khi quản trị chưa nhập nội dung. */
const DEFAULT_MESSAGE = 'Kỳ Lân đang được nâng cấp để vui hơn. Bạn quay lại sau ít phút nhé!';

const root = document.getElementById('dialog-root');
let current = null;

/**
 * Màn hình "Đang bảo trì": Kỳ lân ló đầu + lời nhắn của quản trị. Che toàn bộ game.
 *
 * @param {{ message?: string, onRetry: () => void, onStaffLogin?: () => void, onSwitchAccount?: () => void }} opts
 * @returns {() => void} hàm đóng màn hình
 */
export function showMaintenance({ message, onRetry, onStaffLogin, onSwitchAccount }) {
  closeMaintenance();
  const screen = h(
    'div',
    { class: 'maint-screen', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'maint-title' },
    h(
      'div',
      { class: 'maint-card' },
      h('img', { class: 'maint-mascot', src: '/maintenance-kylan.webp', alt: 'Kỳ lân VA ló đầu chờ', width: 322, height: 374 }),
      h(
        'div',
        { class: 'maint-body' },
        h('div', { class: 'maint-tag' }, '🛠️ Bảo trì'),
        h('h1', { class: 'maint-title', id: 'maint-title' }, 'Kỳ Lân Tri Thức đang bảo trì'),
        h('p', { class: 'maint-message' }, message?.trim() || DEFAULT_MESSAGE),
        h('button', { class: 'btn btn-block', type: 'button', onclick: onRetry }, '🔄 Thử lại'),
        h('p', { class: 'muted maint-note' }, 'Trang sẽ tự mở lại khi bảo trì xong.'),
        onStaffLogin ? h('button', { class: 'link-btn', type: 'button', onclick: onStaffLogin }, 'Giáo viên / Quản trị đăng nhập') : '',
        onSwitchAccount ? h('button', { class: 'link-btn', type: 'button', onclick: onSwitchAccount }, 'Đổi tài khoản') : '',
      ),
    ),
  );
  root.append(screen);
  current = screen;
  return closeMaintenance;
}

/** Đóng màn hình bảo trì (nếu đang mở). */
export function closeMaintenance() {
  current?.remove();
  current = null;
}

/** @returns {boolean} màn hình bảo trì đang hiện? */
export function isMaintenanceShown() {
  return Boolean(current);
}
