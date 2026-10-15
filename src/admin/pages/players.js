import { VALUES } from '../../config.js';
import { h, formatNumber } from '../../ui/dom.js';
import { showToast } from '../../ui/feedback.js';
import { api } from '../api.js';
import { badge, dataTable, field, formDialog, pagination, select, timeAgo } from '../widgets.js';

const PAGE = 20;
export const ROLES = {
  admin: { label: 'Quản trị', tone: 'danger' },
  bgh: { label: 'Ban Giám hiệu', tone: 'info' },
  teacher: { label: 'Giáo viên', tone: 'success' },
  player: { label: 'Người chơi', tone: 'neutral' },
};
const HOUSE = Object.fromEntries(VALUES.map((v) => [v.id, v]));

/**
 * Người chơi: tìm, lọc theo vai trò, sửa tên hiển thị / bộ phận / Nhà / vai trò.
 *
 * @param {HTMLElement} el
 * @param {{ role: string, onGrantVoucher: (player: object) => void }} ctx
 */
export function renderPlayers(el, { role, onGrantVoucher }) {
  const manager = role === 'bgh' || role === 'admin';
  const filter = { search: '', role: '', offset: 0 };
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Tìm theo tên hoặc email…', 'aria-label': 'Tìm người chơi' });
  let t = 0;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { filter.search = search.value.trim(); filter.offset = 0; load(); }, 300);
  });
  const roleSel = select([['', 'Mọi vai trò'], ...Object.entries(ROLES).map(([k, v]) => [k, v.label])]);
  roleSel.addEventListener('change', () => { filter.role = roleSel.value; filter.offset = 0; load(); });
  const list = h('div', {});
  el.replaceChildren(h('div', { class: 'filters' }, search, roleSel), list);

  async function load() {
    list.replaceChildren(h('p', { class: 'muted' }, 'Đang tải…'));
    try {
      const res = await api.listPlayers({ ...filter, limit: PAGE });
      list.replaceChildren(
        dataTable({
          empty: 'Không tìm thấy người chơi.',
          columns: [
            {
              key: 'name',
              label: 'Người chơi',
              className: 'col-wide',
              render: (r) => h('div', {}, h('strong', {}, r.displayName ?? r.fullName ?? '—'), h('div', { class: 'muted small' }, r.email)),
            },
            { key: 'unit', label: 'Bộ phận / Lớp' },
            {
              key: 'house',
              label: 'Nhà',
              render: (r) => (HOUSE[r.house] ? h('span', {}, h('span', { class: 'dot', style: { background: HOUSE[r.house].color } }), ` ${HOUSE[r.house].name}`) : '—'),
            },
            { key: 'rank', label: 'Hạng', render: (r) => `${r.rank} · ${formatNumber(r.xp)} XP` },
            { key: 'streak', label: 'Chuỗi', render: (r) => `${r.streak} 🔥` },
            { key: 'role', label: 'Vai trò', render: (r) => badge(ROLES[r.role].label, ROLES[r.role].tone) },
            { key: 'lastSeen', label: 'Hoạt động', render: (r) => timeAgo(r.lastSeen) },
            {
              key: 'actions',
              label: 'Thao tác',
              className: 'col-actions',
              render: (r) =>
                manager
                  ? h(
                      'div',
                      { class: 'row-actions' },
                      h('button', { class: 'btn-sm', type: 'button', onclick: () => edit(r) }, 'Sửa'),
                      h('button', { class: 'btn-sm', type: 'button', onclick: () => onGrantVoucher(r) }, '🎟️ Trao phiếu'),
                    )
                  : '—',
            },
          ],
          rows: res.rows,
        }),
        pagination({ total: res.total, limit: PAGE, offset: filter.offset, onChange: (o) => { filter.offset = o; load(); } }),
      );
    } catch (err) {
      list.replaceChildren(h('p', { class: 'notice notice-danger' }, err.message));
    }
  }

  async function edit(r) {
    const name = h('input', { class: 'input', value: r.displayName ?? '', maxlength: 24 });
    const unit = h('input', { class: 'input', value: r.unit ?? '', maxlength: 24 });
    const house = select(VALUES.map((v) => [v.id, `Nhà ${v.name}`]), r.house);
    const roleOptions = Object.entries(ROLES)
      .filter(([k]) => role === 'admin' || (k !== 'admin' && k !== 'bgh'))
      .map(([k, v]) => [k, v.label]);
    const roleSel2 = select(roleOptions, r.role);
    if (!roleOptions.some(([k]) => k === r.role)) roleSel2.disabled = true;
    const saved = await formDialog({
      title: `Sửa: ${r.displayName ?? r.email}`,
      body: h(
        'div',
        { class: 'form-grid' },
        field('Tên hiển thị (bảng tên)', name),
        field('Bộ phận / Lớp', unit),
        field('Nhà', house),
        field('Vai trò', roleSel2, 'Giáo viên: soạn câu hỏi · BGH: duyệt câu hỏi, phiếu quà, phân quyền giáo viên · Quản trị: toàn quyền.'),
      ),
      onSubmit: () =>
        api.updatePlayer(r.id, {
          displayName: name.value,
          unit: unit.value,
          house: house.value,
          role: roleSel2.disabled ? null : roleSel2.value,
        }),
    });
    if (saved) {
      showToast('Đã cập nhật người chơi', { type: 'success', icon: '✓' });
      load();
    }
  }

  load();
}
