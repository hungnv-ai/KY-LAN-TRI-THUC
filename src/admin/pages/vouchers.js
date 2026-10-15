import { h } from '../../ui/dom.js';
import { confirmDialog, showToast } from '../../ui/feedback.js';
import { api } from '../api.js';
import { badge, dataTable, field, formDialog, timeAgo } from '../widgets.js';

const STATUS = {
  pending: { label: 'Chờ duyệt', tone: 'warning', icon: '⏳' },
  approved: { label: 'Đã duyệt — chờ trao', tone: 'info', icon: '✓' },
  redeemed: { label: 'Đã trao quà', tone: 'success', icon: '🎁' },
  rejected: { label: 'Không duyệt', tone: 'danger', icon: '✕' },
};

/**
 * Phiếu quà hiện vật: duyệt phiếu trúng từ hộp quà, trao phiếu cho người chơi xuất sắc,
 * đánh dấu đã trao quà.
 *
 * @param {HTMLElement} el
 */
export function renderVouchers(el) {
  let status = 'pending';
  const tabs = h(
    'div',
    { class: 'segmented', role: 'group', 'aria-label': 'Trạng thái phiếu' },
    [['pending', 'Chờ duyệt'], ['approved', 'Chờ trao'], ['redeemed', 'Đã trao'], ['rejected', 'Không duyệt'], ['', 'Tất cả']].map(([v, label]) =>
      h('button', { type: 'button', 'data-v': v, onclick: () => { status = v; load(); } }, label),
    ),
  );
  const list = h('div', {});
  el.replaceChildren(
    h('p', { class: 'muted' }, 'Phiếu quà đổi được quà hiện vật tại trường (sổ tay, bình nước, áo VA…). Mọi phiếu đều cần BGH duyệt.'),
    h('div', { class: 'filters' }, tabs),
    list,
  );

  async function load() {
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === status)));
    list.replaceChildren(h('p', { class: 'muted' }, 'Đang tải…'));
    try {
      const rows = await api.listVouchers(status);
      list.replaceChildren(
        dataTable({
          empty: 'Không có phiếu quà nào.',
          columns: [
            { key: 'name', label: 'Người nhận', className: 'col-wide', render: (r) => h('div', {}, h('strong', {}, r.name ?? '—'), h('div', { class: 'muted small' }, `${r.unit ?? ''} · ${r.email}`)) },
            { key: 'title', label: 'Phiếu quà', render: (r) => h('div', {}, h('strong', {}, r.title), r.reason ? h('div', { class: 'muted small' }, r.reason) : '') },
            { key: 'status', label: 'Trạng thái', render: (r) => badge(STATUS[r.status].label, STATUS[r.status].tone, STATUS[r.status].icon) },
            { key: 'at', label: 'Ngày', render: (r) => timeAgo(r.at) },
            { key: 'note', label: 'Ghi chú', render: (r) => r.note ?? '—' },
            { key: 'actions', label: 'Thao tác', className: 'col-actions', render: (r) => actions(r) },
          ],
          rows,
        }),
      );
    } catch (err) {
      list.replaceChildren(h('p', { class: 'notice notice-danger' }, err.message));
    }
  }

  function actions(r) {
    return h(
      'div',
      { class: 'row-actions' },
      r.status === 'pending' ? h('button', { class: 'btn-sm btn-sm-success', type: 'button', onclick: () => decide(r, 'approved') }, 'Duyệt') : '',
      r.status === 'pending' ? h('button', { class: 'btn-sm', type: 'button', onclick: () => decide(r, 'rejected') }, 'Không duyệt') : '',
      r.status === 'approved' ? h('button', { class: 'btn-sm btn-sm-success', type: 'button', onclick: () => decide(r, 'redeemed') }, '🎁 Đã trao quà') : '',
    );
  }

  async function decide(r, next) {
    const ok = await confirmDialog({
      icon: next === 'redeemed' ? '🎁' : next === 'approved' ? '✓' : '✕',
      title: { approved: 'Duyệt phiếu quà?', rejected: 'Không duyệt phiếu này?', redeemed: 'Xác nhận đã trao quà?' }[next],
      message: `${r.title} — ${r.name ?? r.email}`,
      confirmText: 'Xác nhận',
    });
    if (!ok) return;
    try {
      await api.decideVoucher(r.id, next);
      showToast('Đã cập nhật phiếu quà', { type: 'success', icon: '✓' });
      load();
    } catch (err) {
      showToast(err.message, { type: 'warn' });
    }
  }

  load();
}

/**
 * Trao phiếu quà cho một người chơi (từ trang Người chơi).
 *
 * @param {{ id: string, displayName?: string, email: string }} player
 */
export async function grantVoucherDialog(player) {
  const title = h('input', { class: 'input', maxlength: 80, placeholder: 'Ví dụ: Sổ tay VA, Bình nước VA', required: true });
  const reason = h('input', { class: 'input', maxlength: 120, placeholder: 'Ví dụ: Top 1 bảng xếp hạng tuần 42' });
  const saved = await formDialog({
    title: `🎟️ Trao phiếu quà cho ${player.displayName ?? player.email}`,
    body: h('div', { class: 'form-grid' }, field('Tên phần quà', title), field('Lý do', reason)),
    submitText: 'Trao phiếu',
    onSubmit: () => api.grantVoucher(player.id, title.value, reason.value),
  });
  if (saved) showToast('Đã trao phiếu quà — người chơi sẽ thấy trong mục "Của tôi"', { type: 'success', icon: '🎟️' });
}
