import { ALLOWED_EMAIL_DOMAINS } from '../config.js';
import { h } from './dom.js';

/**
 * Màn hình đăng nhập (theo chuẩn trang đăng nhập nội bộ VA: logo trường → tên hệ thống →
 * phương thức đăng nhập) và hộp khai báo hồ sơ (tên hiển thị + bộ phận/lớp cho bảng tên).
 */

const root = document.getElementById('dialog-root');

/** Gợi ý bộ phận / lớp (người chơi vẫn gõ tự do được). */
const UNIT_SUGGESTIONS = [
  'Ban Giám hiệu', 'Văn phòng', 'Phòng Công Nghệ', 'Phòng Tuyển sinh', 'Phòng Kế toán',
  'Tổ Toán', 'Tổ Ngữ văn', 'Tổ Tiếng Anh', 'Tổ KHTN', 'Tổ KHXH', 'Tổ Tin học', 'Tổ Thể chất', 'Tổ Nghệ thuật',
  'Mầm non', 'Tiểu học', 'THCS', 'THPT',
];

/**
 * @param {{ onLogin: () => Promise<void>, onOffline?: () => void, error?: string }} options
 * @returns {() => void} hàm đóng màn hình
 */
export function showLoginScreen({ onLogin, onOffline, error }) {
  const btn = h(
    'button',
    { class: 'btn btn-block btn-google', type: 'button' },
    h('span', { class: 'google-g', 'aria-hidden': 'true' }, 'G'),
    'Đăng nhập bằng Google',
  );
  const errEl = h('p', { class: 'login-error', role: 'alert', hidden: !error }, error ?? '');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.lastChild.textContent = 'Đang chuyển tới Google…';
    try {
      await onLogin();
    } catch (err) {
      errEl.hidden = false;
      errEl.textContent = 'Không đăng nhập được, vui lòng thử lại.';
      btn.disabled = false;
      btn.lastChild.textContent = 'Đăng nhập bằng Google';
      console.error(err);
    }
  });

  const screen = h(
    'div',
    { class: 'login-screen', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'login-title' },
    h(
      'div',
      { class: 'login-card' },
      h('img', { class: 'login-mascot', src: '/mascot-icon.png', alt: 'Linh vật Kỳ lân VA Schools', width: 70, height: 96 }),
      h('div', { class: 'login-school' }, 'VA SCHOOLS · Trường học của sự Lắng Nghe'),
      h('h1', { class: 'login-title', id: 'login-title' }, 'Kỳ Lân Tri Thức'),
      h('p', { class: 'muted' }, 'Học mà chơi, chơi mà học cùng 5 giá trị cốt lõi Nhân Ái · Bản Lĩnh · Tri Thức · Trách Nhiệm · Khai Phóng.'),
      btn,
      h('p', { class: 'login-note' }, `Dùng tài khoản Google của trường (@${ALLOWED_EMAIL_DOMAINS.join(', @')}).`),
      errEl,
      onOffline
        ? h('button', { class: 'link-btn', type: 'button', onclick: () => { close(); onOffline(); } }, 'Chơi thử không cần đăng nhập (không lưu lên máy chủ)')
        : '',
    ),
  );
  root.append(screen);
  btn.focus();
  const close = () => screen.remove();
  return close;
}

/**
 * Hộp khai báo tên hiển thị + bộ phận/lớp. Không đóng được cho tới khi lưu thành công.
 *
 * @param {{ initialName?: string, initialUnit?: string, onSave: (name: string, unit: string) => Promise<void> }} options
 * @returns {Promise<void>} hoàn tất khi đã lưu
 */
export function showProfileSetup({ initialName = '', initialUnit = '', onSave }) {
  return new Promise((resolve) => {
    const nameInput = h('input', {
      class: 'input', id: 'profile-name', type: 'text', maxlength: 24, required: true,
      value: initialName, placeholder: 'Ví dụ: Cô Lan, Thầy Minh, Minh Anh', autocomplete: 'nickname',
    });
    const listId = 'unit-suggestions';
    const unitInput = h('input', {
      class: 'input', id: 'profile-unit', type: 'text', maxlength: 24, required: true,
      value: initialUnit, placeholder: 'Ví dụ: Tổ Toán, Văn phòng, 7A2', list: listId,
    });
    const errEl = h('p', { class: 'login-error', role: 'alert', hidden: true });
    const saveBtn = h('button', { class: 'btn btn-block', type: 'submit' }, 'Lưu & vào đảo 🏝️');

    const form = h(
      'form',
      { class: 'dialog-card profile-form', novalidate: true },
      h('div', { class: 'big-emoji', 'aria-hidden': 'true' }, '🪪'),
      h('h2', { class: 'dialog-title', id: 'profile-title' }, 'Bảng tên Kỳ lân của bạn'),
      h('p', { class: 'muted' }, 'Tên này hiện trên đầu Kỳ lân để mọi người trên đảo nhận ra bạn.'),
      h('label', { class: 'field-label', for: 'profile-name' }, 'Tên hiển thị'),
      nameInput,
      h('label', { class: 'field-label', for: 'profile-unit' }, 'Bộ phận / Lớp'),
      unitInput,
      h('datalist', { id: listId }, UNIT_SUGGESTIONS.map((u) => h('option', { value: u }))),
      errEl,
      saveBtn,
    );
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      saveBtn.disabled = true;
      saveBtn.textContent = 'Đang lưu…';
      errEl.hidden = true;
      try {
        await onSave(nameInput.value, unitInput.value);
        dialog.remove();
        resolve();
      } catch (err) {
        errEl.hidden = false;
        errEl.textContent = err?.friendly ?? 'Không lưu được, vui lòng kiểm tra lại.';
        saveBtn.disabled = false;
        saveBtn.textContent = 'Lưu & vào đảo 🏝️';
      }
    });

    const dialog = h(
      'div',
      { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'profile-title' },
      h('div', { class: 'sheet-backdrop' }),
      form,
    );
    root.append(dialog);
    nameInput.focus();
  });
}
