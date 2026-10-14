import { VALUES } from '../../config.js';
import { TOPICS } from '../../data/questions.js';
import { h } from '../../ui/dom.js';
import { confirmDialog, showToast } from '../../ui/feedback.js';
import { api } from '../api.js';
import { badge, dataTable, field, formDialog, pagination, select } from '../widgets.js';

const PAGE = 20;
const STATUS = {
  approved: { label: 'Đã duyệt', tone: 'success', icon: '✓' },
  pending: { label: 'Chờ duyệt', tone: 'warning', icon: '⏳' },
  rejected: { label: 'Từ chối', tone: 'danger', icon: '✕' },
};
const VALUE_NAME = Object.fromEntries(VALUES.map((v) => [v.id, v.name]));
const TOPIC_OPTIONS = Object.entries(TOPICS);
const VALUE_OPTIONS = [['', '— Không gắn —'], ...VALUES.map((v) => [v.id, v.name])];
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * Ngân hàng câu hỏi: tìm, lọc, thêm/sửa, duyệt (BGH/admin), xoá (có hỏi lại), nhập từ CSV.
 *
 * @param {HTMLElement} el
 * @param {{ role: string }} ctx
 */
export function renderQuestions(el, { role }) {
  const manager = role === 'bgh' || role === 'admin';
  const filter = { status: manager ? 'pending' : '', topic: '', search: '', offset: 0 };

  const statusTabs = h(
    'div',
    { class: 'segmented', role: 'group', 'aria-label': 'Trạng thái' },
    [['', 'Tất cả'], ['pending', 'Chờ duyệt'], ['approved', 'Đã duyệt'], ['rejected', 'Từ chối']].map(([v, label]) =>
      h('button', { type: 'button', 'data-v': v, onclick: () => { filter.status = v; filter.offset = 0; load(); } }, label),
    ),
  );
  const topicSel = select([['', 'Mọi chủ đề'], ...TOPIC_OPTIONS], '');
  topicSel.addEventListener('change', () => { filter.topic = topicSel.value; filter.offset = 0; load(); });
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Tìm câu hỏi…', 'aria-label': 'Tìm câu hỏi' });
  let t = 0;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { filter.search = search.value.trim(); filter.offset = 0; load(); }, 300);
  });

  const list = h('div', {});
  el.replaceChildren(
    h(
      'div',
      { class: 'page-actions' },
      h('button', { class: 'btn', type: 'button', onclick: () => edit(null) }, '+ Thêm câu hỏi'),
      h('button', { class: 'btn btn-secondary', type: 'button', onclick: importCsv }, '⬆ Nhập từ file CSV/Excel'),
      h('button', { class: 'btn btn-secondary', type: 'button', onclick: downloadTemplate }, '⬇ Tải file mẫu'),
    ),
    !manager ? h('p', { class: 'notice' }, 'Câu hỏi bạn soạn sẽ ở trạng thái "Chờ duyệt" cho tới khi Ban Giám hiệu duyệt.') : '',
    h('div', { class: 'filters' }, statusTabs, topicSel, search),
    list,
  );

  async function load() {
    statusTabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === filter.status)));
    list.replaceChildren(h('p', { class: 'muted' }, 'Đang tải…'));
    try {
      const res = await api.listQuestions({ ...filter, limit: PAGE });
      list.replaceChildren(
        dataTable({
          empty: 'Không có câu hỏi nào khớp bộ lọc.',
          columns: [
            {
              key: 'q',
              label: 'Câu hỏi',
              className: 'col-wide',
              render: (r) =>
                h(
                  'div',
                  {},
                  h('div', { class: 'q-text' }, r.q),
                  h('div', { class: 'q-answer' }, '✓ ', r.options[0], h('span', { class: 'muted' }, `  · ${r.options.length - 1} đáp án sai`)),
                ),
            },
            { key: 'topic', label: 'Chủ đề', render: (r) => TOPICS[r.topic] ?? r.topic },
            { key: 'value', label: 'Giá trị', render: (r) => VALUE_NAME[r.value] ?? '—' },
            { key: 'status', label: 'Trạng thái', render: (r) => badge(STATUS[r.status].label, STATUS[r.status].tone, STATUS[r.status].icon) },
            { key: 'author', label: 'Người soạn', render: (r) => r.author ?? 'Bộ mẫu' },
            { key: 'actions', label: 'Thao tác', className: 'col-actions', render: (r) => actions(r) },
          ],
          rows: res.rows,
        }),
        pagination({ total: res.total, limit: PAGE, offset: filter.offset, onChange: (o) => { filter.offset = o; load(); } }),
      );
    } catch (err) {
      list.replaceChildren(h('p', { class: 'notice notice-danger' }, err.message));
    }
  }

  function actions(r) {
    const canEdit = manager || (r.mine && r.status !== 'approved');
    return h(
      'div',
      { class: 'row-actions' },
      canEdit ? h('button', { class: 'btn-sm', type: 'button', onclick: () => edit(r) }, 'Sửa') : '',
      manager && r.status !== 'approved'
        ? h('button', { class: 'btn-sm btn-sm-success', type: 'button', onclick: () => review(r, 'approved') }, 'Duyệt')
        : '',
      manager && r.status === 'pending'
        ? h('button', { class: 'btn-sm', type: 'button', onclick: () => review(r, 'rejected') }, 'Từ chối')
        : '',
      canEdit ? h('button', { class: 'btn-sm btn-sm-danger', type: 'button', onclick: () => remove(r) }, 'Xoá') : '',
    );
  }

  async function review(r, status) {
    try {
      await api.reviewQuestion(r.id, status);
      showToast(status === 'approved' ? 'Đã duyệt câu hỏi' : 'Đã từ chối câu hỏi', { type: 'success', icon: '✓' });
      load();
    } catch (err) {
      showToast(err.message, { type: 'warn' });
    }
  }

  /** Xoá: luôn hỏi lại → đang xử lý → thông báo (chuẩn UX VA). */
  async function remove(r) {
    const ok = await confirmDialog({
      icon: '🗑️',
      title: 'Xoá câu hỏi này?',
      message: `“${r.q.slice(0, 80)}${r.q.length > 80 ? '…' : ''}” sẽ bị xoá vĩnh viễn.`,
      confirmText: 'Xoá',
    });
    if (!ok) return;
    showToast('Đang xoá…', { icon: '⏳' });
    try {
      await api.deleteQuestion(r.id);
      showToast('Đã xoá câu hỏi', { type: 'success', icon: '✓' });
      load();
    } catch (err) {
      showToast(err.message, { type: 'warn' });
    }
  }

  async function edit(r) {
    const topic = select(TOPIC_OPTIONS, r?.topic ?? 'general');
    const value = select(VALUE_OPTIONS, r?.value ?? '');
    const q = h('textarea', { class: 'input', rows: 3, maxlength: 400, required: true }, r?.q ?? '');
    const optsBox = h('div', { class: 'options-edit' });
    const opts = [...(r?.options ?? ['', '', '', ''])];
    while (opts.length < 2) opts.push('');
    const renderOpts = () => {
      optsBox.replaceChildren(
        ...opts.map((text, i) => {
          const input = h('input', {
            class: 'input',
            value: text,
            maxlength: 200,
            placeholder: i === 0 ? 'Đáp án ĐÚNG' : `Đáp án sai ${i}`,
            'aria-label': i === 0 ? 'Đáp án đúng' : `Đáp án sai ${i}`,
            oninput: (e) => (opts[i] = e.target.value),
          });
          return h(
            'div',
            { class: `option-row ${i === 0 ? 'is-correct' : ''}` },
            h('span', { class: 'option-letter' }, i === 0 ? '✓' : LETTERS[i]),
            input,
            i >= 2 ? h('button', { class: 'btn-sm', type: 'button', 'aria-label': 'Bỏ đáp án', onclick: () => { opts.splice(i, 1); renderOpts(); } }, '✕') : '',
          );
        }),
        opts.length < 6 ? h('button', { class: 'btn-sm', type: 'button', onclick: () => { opts.push(''); renderOpts(); } }, '+ Thêm đáp án sai') : '',
      );
    };
    renderOpts();
    const explain = h('textarea', { class: 'input', rows: 2, maxlength: 300 }, r?.explain ?? '');

    const saved = await formDialog({
      title: r ? 'Sửa câu hỏi' : 'Thêm câu hỏi',
      wide: true,
      body: h(
        'div',
        { class: 'form-grid' },
        h('div', { class: 'grid-2' }, field('Chủ đề', topic), field('Gắn với giá trị (cột Vùng Đất)', value, 'Câu có giá trị sẽ xuất hiện ở cột Vùng Đất tương ứng.')),
        field('Câu hỏi', q),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Đáp án (dòng đầu là đáp án ĐÚNG — game tự xáo thứ tự)'), optsBox),
        field('Giải thích (hiện sau khi trả lời, không bắt buộc)', explain),
      ),
      submitText: manager ? 'Lưu & duyệt' : 'Gửi duyệt',
      onSubmit: () =>
        api.saveQuestion({ id: r?.id, topic: topic.value, value: value.value, q: q.value, options: opts.map((o) => o.trim()).filter(Boolean), explain: explain.value }),
    });
    if (saved) {
      showToast(manager ? 'Đã lưu câu hỏi' : 'Đã gửi câu hỏi chờ duyệt', { type: 'success', icon: '✓' });
      load();
    }
  }

  // ── Nhập hàng loạt từ CSV (mở/lưu bằng Excel: File › Save As › CSV UTF-8) ──
  async function importCsv() {
    const input = h('input', { type: 'file', accept: '.csv,text/csv' });
    input.click();
    const file = await new Promise((resolve) => input.addEventListener('change', () => resolve(input.files[0])));
    if (!file) return;
    const rows = parseCsv(await file.text());
    const items = rows
      .slice(1)
      .map((c) => ({
        topic: normalizeTopic(c[0]),
        value: normalizeValue(c[1]),
        q: (c[2] ?? '').trim(),
        options: [c[3], c[4], c[5], c[6], c[7], c[8]].map((o) => (o ?? '').trim()).filter(Boolean),
        explain: (c[9] ?? '').trim(),
      }))
      .filter((x) => x.q);
    if (!items.length) {
      showToast('File không có câu hỏi hợp lệ. Hãy dùng đúng file mẫu.', { type: 'warn' });
      return;
    }
    const ok = await confirmDialog({
      icon: '📥',
      title: `Nhập ${items.length} câu hỏi?`,
      message: manager ? 'Các câu sẽ được duyệt ngay.' : 'Các câu sẽ ở trạng thái Chờ duyệt.',
      confirmText: 'Nhập',
    });
    if (!ok) return;
    let done = 0;
    const failed = [];
    showToast(`Đang nhập ${items.length} câu…`, { icon: '⏳' });
    for (const [i, item] of items.entries()) {
      try {
        await api.saveQuestion(item);
        done += 1;
      } catch (err) {
        failed.push(`Dòng ${i + 2}: ${err.message}`);
      }
    }
    showToast(`Đã nhập ${done}/${items.length} câu${failed.length ? ` · ${failed.length} lỗi` : ''}`, { type: failed.length ? 'warn' : 'success', icon: '📥' });
    if (failed.length) console.warn('[nhập CSV]', failed);
    load();
  }

  load();
}

const TEMPLATE_HEADER = ['chu_de', 'gia_tri', 'cau_hoi', 'dap_an_dung', 'dap_an_sai_1', 'dap_an_sai_2', 'dap_an_sai_3', 'dap_an_sai_4', 'dap_an_sai_5', 'giai_thich'];

function downloadTemplate() {
  const rows = [
    TEMPLATE_HEADER,
    ['5 giá trị cốt lõi', 'Nhân Ái', 'Nhân ái theo VA Schools là gì?', 'Biết nghĩ cho người khác', 'Luôn được khen', 'Học thật giỏi', 'Ít nói', '', '', 'Định nghĩa trong tài liệu 5 giá trị cốt lõi.'],
    ['Kiến thức chung', '', '7 × 8 bằng bao nhiêu?', '56', '54', '64', '48', '', '', ''],
  ];
  const csv = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: 'mau-cau-hoi-ky-lan.csv' });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Đọc CSV (hỗ trợ dấu ngoặc kép, dấu phẩy hoặc chấm phẩy như Excel tiếng Việt). */
export function parseCsv(text) {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

function fold(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
}

function normalizeTopic(s) {
  const f = fold(s);
  if (f.includes('gia tri') || f === 'values') return 'values';
  if (f.includes('van hoa') || f.includes('va') || f === 'va') return 'va';
  return 'general';
}

function normalizeValue(s) {
  const f = fold(s);
  const hit = VALUES.find((v) => fold(v.name) === f || v.id.toLowerCase() === f.replace(/\s/g, ''));
  return hit?.id ?? '';
}
