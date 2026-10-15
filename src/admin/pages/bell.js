import { BELL } from '../../config.js';
import { TOPICS } from '../../data/questions.js';
import { h } from '../../ui/dom.js';
import { confirmDialog, showToast } from '../../ui/feedback.js';
import { api } from '../api.js';
import { badge, dataTable, field, formDialog, select } from '../widgets.js';

const PHASE = {
  lobby: { label: 'Sắp diễn ra', tone: 'info', icon: '📅' },
  answer: { label: 'Đang thi', tone: 'warning', icon: '🔔' },
  reveal: { label: 'Đang thi', tone: 'warning', icon: '🔔' },
  ended: { label: 'Đã kết thúc', tone: 'success', icon: '🏆' },
  cancelled: { label: 'Đã huỷ', tone: 'neutral', icon: '✕' },
};

const fmt = (iso) => new Date(iso).toLocaleString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Giá trị cho ô datetime-local (giờ máy, làm tròn 5 phút sau hiện tại + 1 giờ). */
function defaultStart() {
  const d = new Date(Date.now() + 3600_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Rung Chuông Vàng: lên lịch trận, xem danh sách, huỷ, xem kết quả.
 *
 * @param {HTMLElement} el
 */
export function renderBell(el) {
  const list = h('div', {});
  el.replaceChildren(
    h(
      'p',
      { class: 'muted' },
      `Tạo trận đấu theo giờ hẹn: mọi người cùng trả lời một câu hỏi, sai là dừng chân, người trụ lại cuối cùng thắng. Phòng chờ mở trước ${BELL.LOBBY_MIN} phút và Kỳ lân sẽ nhắc người chơi trong game.`,
    ),
    h('div', { class: 'toolbar' }, h('button', { class: 'btn', type: 'button', onclick: () => createDialog(load) }, '+ Tạo trận mới')),
    list,
  );

  async function load() {
    list.replaceChildren(h('p', { class: 'muted' }, 'Đang tải…'));
    try {
      const rows = await api.bellList();
      list.replaceChildren(
        dataTable({
          empty: 'Chưa có trận nào. Bấm "+ Tạo trận mới" để lên lịch.',
          columns: [
            { key: 'title', label: 'Trận', className: 'col-wide', render: (g) => h('div', {}, h('strong', {}, g.title), h('div', { class: 'muted small' }, `${g.questionCount} câu · ${g.answerSec} giây/câu`)) },
            { key: 'startsAt', label: 'Bắt đầu', render: (g) => fmt(g.startsAt) },
            { key: 'phase', label: 'Trạng thái', render: (g) => badge(PHASE[g.phase].label, PHASE[g.phase].tone, PHASE[g.phase].icon) },
            { key: 'players', label: 'Tham gia', render: (g) => String(g.players) },
            { key: 'survivors', label: 'Thắng', render: (g) => (g.phase === 'ended' ? String(g.survivors) : '—') },
            { key: 'prize', label: 'Giải', render: (g) => `${g.prizeXp} XP · ${g.prizeCoins} Xu${g.winnerVoucher ? ` · 🎟️ ${g.winnerVoucher}` : ''}` },
            {
              key: 'actions',
              label: 'Thao tác',
              className: 'col-actions',
              render: (g) =>
                h(
                  'div',
                  { class: 'row-actions' },
                  g.players > 0 ? h('button', { class: 'btn-sm', type: 'button', onclick: () => showResults(g) }, 'Kết quả') : '',
                  g.phase === 'lobby' ? h('button', { class: 'btn-sm', type: 'button', onclick: () => cancel(g, load) }, 'Huỷ trận') : '',
                ),
            },
          ],
          rows,
        }),
      );
    } catch (err) {
      list.replaceChildren(h('p', { class: 'notice notice-danger' }, err.message));
    }
  }
  load();
}

async function createDialog(onSaved) {
  const title = h('input', { class: 'input', maxlength: 80, value: 'Rung Chuông Vàng trưa thứ Sáu', required: true });
  const starts = h('input', { class: 'input', type: 'datetime-local', value: defaultStart(), required: true });
  const count = h('input', { class: 'input', type: 'number', min: 3, max: 30, value: 10 });
  const seconds = h('input', { class: 'input', type: 'number', min: 8, max: 60, value: BELL.DEFAULT_ANSWER_SEC });
  const xp = h('input', { class: 'input', type: 'number', min: 0, step: 10, value: 50 });
  const coins = h('input', { class: 'input', type: 'number', min: 0, step: 10, value: 100 });
  const voucher = h('input', { class: 'input', maxlength: 80, placeholder: 'Ví dụ: Sổ tay VA (để trống nếu không có)' });
  const topic = select([['', 'Mọi chủ đề'], ...Object.entries(TOPICS)], '');
  const saved = await formDialog({
    title: '🔔 Tạo trận Rung Chuông Vàng',
    wide: true,
    body: h(
      'div',
      { class: 'form-grid' },
      field('Tên trận', title),
      field('Giờ bắt đầu', starts, 'Theo giờ máy của bạn (giờ Việt Nam).'),
      field('Số câu hỏi', count, 'Câu lấy ngẫu nhiên từ ngân hàng câu đã duyệt.'),
      field('Thời gian mỗi câu (giây)', seconds),
      field('Chủ đề', topic),
      field('Giải cho người thắng: XP', xp),
      field('Giải cho người thắng: Xu', coins),
      field('Phiếu quà cho người thắng', voucher, `Chỉ trao khi có không quá ${BELL.MAX_VOUCHER_WINNERS} người thắng.`),
    ),
    submitText: 'Lên lịch',
    onSubmit: () =>
      api.bellCreate({
        title: title.value,
        startsAt: new Date(starts.value).toISOString(),
        count: Number(count.value),
        answerSec: Number(seconds.value),
        prizeXp: Number(xp.value),
        prizeCoins: Number(coins.value),
        voucher: voucher.value,
        topic: topic.value,
      }),
  });
  if (saved) {
    showToast('Đã lên lịch trận — người chơi sẽ thấy nút 🔔 trong game', { type: 'success', icon: '🔔' });
    onSaved();
  }
}

async function cancel(g, onDone) {
  const ok = await confirmDialog({ icon: '✕', title: 'Huỷ trận này?', message: `${g.title} — ${fmt(g.startsAt)}`, confirmText: 'Huỷ trận' });
  if (!ok) return;
  try {
    await api.bellCancel(g.id);
    showToast('Đã huỷ trận', { type: 'success' });
    onDone();
  } catch (err) {
    showToast(err.message, { type: 'warn' });
  }
}

async function showResults(g) {
  let rows = [];
  try {
    rows = await api.bellResults(g.id);
  } catch (err) {
    showToast(err.message, { type: 'warn' });
    return;
  }
  await formDialog({
    title: `🏆 Kết quả: ${g.title}`,
    wide: true,
    body: dataTable({
      empty: 'Chưa có người tham gia.',
      columns: [
        { key: 'pos', label: '#', render: (_r, i) => String(i + 1) },
        { key: 'name', label: 'Người chơi', className: 'col-wide', render: (r) => h('div', {}, h('strong', {}, r.name ?? '—'), h('div', { class: 'muted small' }, `${r.unit ?? ''} · ${r.email}`)) },
        { key: 'correct', label: 'Câu đúng', render: (r) => String(r.correct) },
        { key: 'out', label: 'Kết quả', render: (r) => (r.outRound == null ? badge('Trụ lại 🏆', 'success') : `Dừng ở câu ${r.outRound}`) },
      ],
      rows,
    }),
    submitText: 'Đóng',
    onSubmit: async () => {},
  });
}
