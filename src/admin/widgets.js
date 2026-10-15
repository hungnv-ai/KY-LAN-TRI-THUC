import { h, formatNumber } from '../ui/dom.js';

/**
 * Thành phần giao diện dùng chung cho trang quản trị (theo chuẩn List/Grid của Design System VA:
 * hàng 48–64px, padding ngang 16px, header bảng tách biệt, trạng thái bằng Badge + chữ).
 */

/**
 * Bảng dữ liệu; trên điện thoại (< 768px) mỗi hàng hiển thị như một thẻ (CSS dùng data-label).
 *
 * @param {{ columns: { key: string, label: string, render?: (row: object) => Node | string, className?: string }[],
 *   rows: object[], empty?: string }} opts
 */
export function dataTable({ columns, rows, empty = 'Không có dữ liệu.' }) {
  if (!rows.length) return h('div', { class: 'empty' }, empty);
  return h(
    'div',
    { class: 'table-wrap' },
    h(
      'table',
      { class: 'table' },
      h('thead', {}, h('tr', {}, columns.map((c) => h('th', { scope: 'col', class: c.className ?? '' }, c.label)))),
      h(
        'tbody',
        {},
        rows.map((row, i) =>
          h(
            'tr',
            {},
            columns.map((c) =>
              h('td', { 'data-label': c.label, class: c.className ?? '' }, c.render ? c.render(row, i) : row[c.key] ?? '—'),
            ),
          ),
        ),
      ),
    ),
  );
}

/**
 * Phân trang.
 *
 * @param {{ total: number, limit: number, offset: number, onChange: (offset: number) => void }} opts
 */
export function pagination({ total, limit, offset, onChange }) {
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  return h(
    'nav',
    { class: 'pagination', 'aria-label': 'Phân trang' },
    h('span', { class: 'muted' }, `${formatNumber(total)} mục · trang ${page}/${pages}`),
    h(
      'div',
      { class: 'pagination-btns' },
      h('button', { class: 'btn-sm', type: 'button', disabled: page <= 1, onclick: () => onChange(offset - limit) }, '‹ Trước'),
      h('button', { class: 'btn-sm', type: 'button', disabled: page >= pages, onclick: () => onChange(offset + limit) }, 'Sau ›'),
    ),
  );
}

/**
 * Nhãn trạng thái: icon + chữ (không chỉ dựa vào màu).
 *
 * @param {'success' | 'warning' | 'danger' | 'info' | 'neutral'} tone
 */
export function badge(text, tone = 'neutral', icon = '') {
  return h('span', { class: `badge badge-${tone}` }, icon ? h('span', { 'aria-hidden': 'true' }, icon) : '', text);
}

/** Ô thống kê nhanh. */
export function statTile(label, value, hint = '') {
  return h(
    'div',
    { class: 'tile' },
    h('div', { class: 'tile-label' }, label),
    h('div', { class: 'tile-value' }, value),
    hint ? h('div', { class: 'tile-hint' }, hint) : '',
  );
}

/**
 * Hộp thoại biểu mẫu (thêm/sửa). `onSubmit` ném lỗi → hiện thông báo, giữ hộp thoại.
 *
 * @param {{ title: string, body: Node, submitText?: string, onSubmit: () => Promise<void>, wide?: boolean }} opts
 * @returns {Promise<boolean>} true nếu đã lưu
 */
export function formDialog({ title, body, submitText = 'Lưu', onSubmit, wide = false }) {
  return new Promise((resolve) => {
    const root = document.getElementById('dialog-root');
    const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
    const submit = h('button', { class: 'btn', type: 'submit' }, submitText);
    const close = (saved) => {
      dialog.remove();
      document.removeEventListener('keydown', onKey);
      resolve(saved);
    };
    const onKey = (e) => e.key === 'Escape' && close(false);
    const form = h(
      'form',
      { class: `modal ${wide ? 'modal-wide' : ''}`, novalidate: true },
      h(
        'header',
        { class: 'modal-head' },
        h('h2', { id: 'modal-title' }, title),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Đóng', onclick: () => close(false) }, '✕'),
      ),
      h('div', { class: 'modal-body' }, body, err),
      h(
        'footer',
        { class: 'modal-foot' },
        h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => close(false) }, 'Huỷ'),
        submit,
      ),
    );
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      submit.disabled = true;
      const label = submit.textContent;
      submit.textContent = 'Đang lưu…';
      err.hidden = true;
      try {
        await onSubmit();
        close(true);
      } catch (ex) {
        err.hidden = false;
        err.textContent = ex.message || 'Không lưu được.';
        submit.disabled = false;
        submit.textContent = label;
      }
    });
    const dialog = h(
      'div',
      { class: 'modal-layer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'modal-title' },
      h('div', { class: 'modal-backdrop', onclick: () => close(false) }),
      form,
    );
    root.append(dialog);
    document.addEventListener('keydown', onKey);
    form.querySelector('input, select, textarea, button.btn')?.focus();
  });
}

/** Ô nhập có nhãn. */
export function field(label, control, hint = '') {
  const id = control.id || `f-${Math.random().toString(36).slice(2, 8)}`;
  control.id = id;
  return h('div', { class: 'field' }, h('label', { for: id }, label), control, hint ? h('small', { class: 'muted' }, hint) : '');
}

/** Ô chọn. */
export function select(options, value = '') {
  return h(
    'select',
    { class: 'input' },
    options.map(([v, label]) => h('option', { value: v, selected: v === value }, label)),
  );
}

/** Định dạng thời gian tương đối tiếng Việt. */
export function timeAgo(iso) {
  if (!iso) return '—';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}
