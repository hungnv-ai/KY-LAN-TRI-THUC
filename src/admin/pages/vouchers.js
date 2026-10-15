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
    [['pending', 'Chờ duyệt'], ['approved', 'Chờ trao'], ['redeemed', 'Đã trao'], ['rejected', 'Không duyệt'], ['', 'Tất cả'], ['catalog', '🛍️ Danh mục quà']].map(([v, label]) =>
      h('button', { type: 'button', 'data-v': v, onclick: () => { status = v; load(); } }, label),
    ),
  );
  const list = h('div', {});
  el.replaceChildren(
    h('p', { class: 'muted' }, 'Phiếu quà đổi được quà hiện vật tại trường (sổ tay, bình nước, áo VA…). Người chơi tự đổi bằng Xu hoặc được trao. Mọi phiếu đều cần BGH duyệt; phiếu đổi bằng Xu bị "Không duyệt" sẽ tự hoàn Xu.'),
    h('div', { class: 'filters' }, tabs),
    list,
  );

  async function load() {
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === status)));
    list.replaceChildren(h('p', { class: 'muted' }, 'Đang tải…'));
    if (status === 'catalog') {
      renderCatalog(list);
      return;
    }
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
      message: `${r.title} — ${r.name ?? r.email}${next === 'rejected' && r.coinsSpent > 0 ? `. Hoàn lại ${r.coinsSpent} Xu cho người chơi.` : ''}`,
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

/** Danh mục quà đổi bằng Xu: sửa giá, số lượng, ẩn/hiện, thêm món mới. */
async function renderCatalog(el) {
  const reload = () => renderCatalog(el);
  try {
    const gifts = await api.listGifts();
    el.replaceChildren(
      h('div', { class: 'toolbar' }, h('button', { class: 'btn', type: 'button', onclick: () => editGift(null, reload) }, '+ Thêm quà')),
      dataTable({
        empty: 'Chưa có quà nào.',
        columns: [
          { key: 'name', label: 'Quà', className: 'col-wide', render: (g) => h('div', {}, h('strong', {}, `${g.icon} ${g.name}`), g.description ? h('div', { class: 'muted small' }, g.description) : '') },
          { key: 'cost', label: 'Giá (Xu)', render: (g) => g.cost.toLocaleString('vi-VN') },
          { key: 'stock', label: 'Còn lại', render: (g) => (g.stock === null ? 'Không giới hạn' : String(g.stock)) },
          { key: 'redeemed', label: 'Đã đổi', render: (g) => String(g.redeemed) },
          { key: 'active', label: 'Trạng thái', render: (g) => (g.active ? badge('Đang mở', 'success') : badge('Đã ẩn', 'neutral')) },
          { key: 'actions', label: 'Thao tác', className: 'col-actions', render: (g) => h('button', { class: 'btn-sm', type: 'button', onclick: () => editGift(g, reload) }, 'Sửa') },
        ],
        rows: gifts,
      }),
    );
  } catch (err) {
    el.replaceChildren(h('p', { class: 'notice notice-danger' }, err.message));
  }
}

async function editGift(gift, onSaved) {
  const icon = h('input', { class: 'input', maxlength: 4, value: gift?.icon ?? '🎁' });
  const name = h('input', { class: 'input', maxlength: 60, value: gift?.name ?? '', required: true });
  const description = h('input', { class: 'input', maxlength: 160, value: gift?.description ?? '' });
  const cost = h('input', { class: 'input', type: 'number', min: 1, step: 10, value: gift?.cost ?? 500, required: true });
  const stock = h('input', { class: 'input', type: 'number', min: 0, placeholder: 'Để trống = không giới hạn', value: gift?.stock ?? '' });
  const active = h('input', { type: 'checkbox', checked: gift ? gift.active : true });
  const saved = await formDialog({
    title: gift ? `Sửa "${gift.name}"` : 'Thêm quà mới',
    body: h(
      'div',
      { class: 'form-grid' },
      field('Biểu tượng (emoji)', icon),
      field('Tên quà', name),
      field('Mô tả ngắn', description),
      field('Giá (Xu)', cost, 'Gợi ý: người chơi chăm chỉ kiếm khoảng 100–300 Xu/ngày.'),
      field('Số lượng còn lại', stock),
      h('label', { class: 'check' }, active, ' Đang mở cho người chơi đổi'),
    ),
    submitText: 'Lưu',
    onSubmit: () =>
      api.saveGift({
        id: gift?.id,
        icon: icon.value,
        name: name.value,
        description: description.value,
        cost: Number(cost.value),
        stock: stock.value === '' ? null : Number(stock.value),
        active: active.checked,
        sort: gift?.sort ?? 99,
      }),
  });
  if (saved) {
    showToast('Đã lưu danh mục quà', { type: 'success', icon: '🛍️' });
    onSaved();
  }
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
