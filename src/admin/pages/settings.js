import { h } from '../../ui/dom.js';
import { showToast } from '../../ui/feedback.js';
import { api, getSetting } from '../api.js';
import { field } from '../widgets.js';

/**
 * Cài đặt & phân quyền: tên miền email được phép (chỉ Quản trị), hướng dẫn phân quyền.
 *
 * @param {HTMLElement} el
 * @param {{ role: string }} ctx
 */
export async function renderSettings(el, { role }) {
  const domains = (await getSetting('ALLOWED_EMAIL_DOMAINS').catch(() => null)) ?? [];
  const input = h('input', { class: 'input', value: domains.join(', '), disabled: role !== 'admin' });
  const save = h('button', { class: 'btn', type: 'button', disabled: role !== 'admin' }, 'Lưu');
  save.addEventListener('click', async () => {
    const list = input.value.split(/[\s,;]+/).map((d) => d.trim().replace(/^@/, '')).filter(Boolean);
    if (!list.length) {
      showToast('Cần ít nhất 1 tên miền (để trống = ai cũng vào được — không an toàn).', { type: 'warn' });
      return;
    }
    save.disabled = true;
    try {
      await api.setAllowedDomains(list);
      showToast('Đã lưu tên miền được phép', { type: 'success', icon: '✓' });
    } catch (err) {
      showToast(err.message, { type: 'warn' });
    }
    save.disabled = false;
  });

  el.replaceChildren(
    h(
      'section',
      { class: 'card' },
      h('header', { class: 'card-head' }, h('h3', {}, '🔐 Tên miền email được phép đăng nhập')),
      field('Tên miền (cách nhau bằng dấu phẩy)', input, 'Ví dụ: vaschools.edu.vn. Chỉ tài khoản Google thuộc các tên miền này mới chơi được.'),
      h('div', { class: 'page-actions' }, save),
      role !== 'admin' ? h('p', { class: 'muted' }, 'Chỉ vai trò Quản trị được đổi mục này.') : '',
    ),
    h(
      'section',
      { class: 'card' },
      h('header', { class: 'card-head' }, h('h3', {}, '👥 Phân quyền (4 nhóm vai trò)')),
      h(
        'ol',
        { class: 'role-list' },
        h('li', {}, h('strong', {}, 'Quản trị'), ' — toàn quyền: phân quyền BGH, đổi cài đặt.'),
        h('li', {}, h('strong', {}, 'Ban Giám hiệu'), ' — duyệt câu hỏi, phiếu quà, phân quyền giáo viên, xem thống kê.'),
        h('li', {}, h('strong', {}, 'Giáo viên'), ' — soạn câu hỏi (chờ BGH duyệt), xem thống kê và người chơi.'),
        h('li', {}, h('strong', {}, 'Người chơi'), ' — chơi game (mặc định cho mọi tài khoản mới).'),
      ),
      h('p', { class: 'muted' }, 'Đổi vai trò tại trang Người chơi › Sửa.'),
    ),
    h(
      'section',
      { class: 'card' },
      h('header', { class: 'card-head' }, h('h3', {}, '🎮 Liên kết nhanh')),
      h('p', {}, h('a', { href: '/', class: 'link' }, '← Về trang game')),
    ),
  );
}
