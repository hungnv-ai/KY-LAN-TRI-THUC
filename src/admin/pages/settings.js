import { h } from '../../ui/dom.js';
import { showToast } from '../../ui/feedback.js';
import { api, getSetting } from '../api.js';
import { EVENTS } from '../../data/events.js';
import { badge, field, select } from '../widgets.js';

/** Lời nhắn gợi ý khi bật bảo trì. */
const MAINTENANCE_HINT = 'Kỳ Lân đang được nâng cấp để vui hơn. Bạn quay lại sau ít phút nhé!';

/**
 * Bảo trì game: công tắc bật/tắt + lời nhắn. Bật → người chơi thấy màn hình bảo trì (Kỳ lân ló đầu);
 * giáo viên / BGH / quản trị vẫn vào được để kiểm tra.
 *
 * @param {string} role
 */
function maintenanceCard(role) {
  const canEdit = role === 'admin' || role === 'bgh';
  const status = h('p', { class: 'muted' }, 'Đang tải…');
  const toggle = h('input', { type: 'checkbox', class: 'maint-switch-input', disabled: !canEdit });
  const message = h('textarea', { class: 'input', rows: 3, maxlength: 500, placeholder: MAINTENANCE_HINT, disabled: !canEdit });
  const save = h('button', { class: 'btn', type: 'button', disabled: !canEdit }, 'Lưu');

  function showStatus(on) {
    status.replaceChildren(
      on ? badge('ĐANG BẢO TRÌ — người chơi không vào được game', 'danger', '🛠️') : badge('Game đang mở bình thường', 'success', '✓'),
    );
  }

  async function load() {
    try {
      const r = await api.maintenanceStatus();
      toggle.checked = Boolean(r.on);
      message.value = r.message ?? '';
      showStatus(r.on);
    } catch (err) {
      status.textContent = err.message;
    }
  }

  save.addEventListener('click', async () => {
    save.disabled = true;
    try {
      const r = await api.setMaintenance(toggle.checked, message.value);
      showStatus(r.on);
      showToast(r.on ? 'Đã BẬT bảo trì — người chơi sẽ thấy màn hình bảo trì trong ~1 phút' : 'Đã TẮT bảo trì — game mở lại', { type: 'success', icon: '🛠️' });
    } catch (err) {
      showToast(err.message, { type: 'warn' });
    }
    save.disabled = false;
  });
  load();

  return h(
    'section',
    { class: 'card' },
    h('header', { class: 'card-head' }, h('h3', {}, '🛠️ Bảo trì game')),
    h('p', { class: 'muted' }, 'Bật khi cần sửa / nâng cấp game. Người chơi sẽ thấy màn hình bảo trì có Kỳ lân và lời nhắn bên dưới; giáo viên, BGH và quản trị vẫn vào được để kiểm tra.'),
    h('label', { class: 'maint-switch' }, toggle, h('span', { class: 'maint-switch-track', 'aria-hidden': 'true' }), h('span', {}, 'Bật chế độ bảo trì')),
    field('Lời nhắn cho người chơi', message, 'Để trống = dùng lời nhắn mặc định.'),
    h('div', { class: 'page-actions' }, save),
    status,
    canEdit ? '' : h('p', { class: 'muted' }, 'Chỉ Ban Giám hiệu và Quản trị được bật/tắt bảo trì.'),
  );
}

/** Sự kiện theo mùa: tự động theo lịch, bật ngay (để thử / mở sớm) hoặc tắt. */
function eventCard() {
  const status = h('p', { class: 'muted' }, 'Đang tải…');
  const options = [['auto', 'Tự động theo lịch'], ...EVENTS.map((e) => [`on:${e.id}`, `Bật ngay: ${e.icon} ${e.name}`]), ['off', 'Tắt mọi sự kiện']];
  const sel = select(options, 'auto');
  const save = h('button', { class: 'btn', type: 'button' }, 'Áp dụng');

  async function load() {
    try {
      const r = await api.eventStatus();
      const o = r.override ?? {};
      sel.value = o.mode === 'on' ? `on:${o.id}` : o.mode === 'off' ? 'off' : 'auto';
      const active = EVENTS.find((e) => e.id === r.active);
      status.replaceChildren(
        active ? badge(`Đang diễn ra: ${active.icon} ${active.name}`, 'success') : badge('Không có sự kiện nào đang diễn ra', 'neutral'),
        ` · Thiệp đã gửi (60 ngày): ${r.cardsSent}`,
      );
    } catch (err) {
      status.textContent = err.message;
    }
  }

  save.addEventListener('click', async () => {
    const [mode, id] = sel.value.split(':');
    save.disabled = true;
    try {
      await api.setEvent(mode, id ?? null);
      showToast('Đã cập nhật sự kiện — người chơi thấy sau khi tải lại trang', { type: 'success', icon: '🌸' });
      await load();
    } catch (err) {
      showToast(err.message, { type: 'warn' });
    }
    save.disabled = false;
  });
  load();

  return h(
    'section',
    { class: 'card' },
    h('header', { class: 'card-head' }, h('h3', {}, '🌸 Sự kiện theo mùa')),
    h(
      'p',
      { class: 'muted' },
      `Lịch tự động: ${EVENTS.map((e) => `${e.name} (${e.start.split('-').reverse().join('/')} – ${e.end.split('-').reverse().join('/')})`).join('; ')}. `,
      'Chọn "Bật ngay" để mở sớm hoặc xem thử trang trí, trang phục, thiệp tri ân.',
    ),
    field('Chế độ', sel),
    h('div', { class: 'page-actions' }, save),
    status,
  );
}

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
    maintenanceCard(role),
    eventCard(),
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
