import { VALUES } from '../../config.js';
import { h, formatNumber } from '../../ui/dom.js';
import { api } from '../api.js';
import { barList, chartCard, columnChart } from '../charts.js';
import { statTile } from '../widgets.js';

const HOUSE = Object.fromEntries(VALUES.map((v) => [v.id, v]));
/** Một màu cho biểu đồ một chuỗi (xanh Khai Phóng — tương phản tốt trên nền sáng). */
const SERIES_COLOR = '#1750B5';

/**
 * Tổng quan: số liệu chính → phân tích (biểu đồ) → chi tiết (bảng), theo nguyên tắc báo cáo VA.
 *
 * @param {HTMLElement} el
 */
export async function renderDashboard(el) {
  el.replaceChildren(h('p', { class: 'muted' }, 'Đang tải số liệu…'));
  const [s, week] = await Promise.all([api.stats(), api.leaderboard('week').catch(() => null)]);
  const q = s.questions ?? {};

  const active = columnChart({
    data: s.daily.map((d) => ({
      label: new Date(d.day).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
      value: d.players,
      tooltip: `${new Date(d.day).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}: ${formatNumber(d.players)} người chơi`,
    })),
    color: SERIES_COLOR,
    unit: 'người',
    valueLabel: 'Người chơi',
  });

  const ranks = barList({
    data: s.ranks.map((r) => ({ label: `${r.icon} ${r.name}`, value: r.players, color: SERIES_COLOR })),
    unit: 'người',
    valueLabel: 'Số người',
  });

  const houses = barList({
    data: s.houses.map((x) => ({ label: `Nhà ${HOUSE[x.house]?.name ?? x.house}`, value: x.points, color: HOUSE[x.house]?.color ?? '#999' })),
    unit: 'điểm',
    valueLabel: 'Điểm tháng này',
  });

  el.replaceChildren(
    h(
      'div',
      { class: 'tiles' },
      statTile('Người chơi', formatNumber(s.players)),
      statTile('Hoạt động hôm nay', formatNumber(s.activeToday), `${formatNumber(s.active7d)} người trong 7 ngày`),
      statTile('Câu trả lời hôm nay', formatNumber(s.answersToday), `Đúng ${s.correctRateToday}%`),
      statTile('XP trao hôm nay', formatNumber(s.xpToday)),
      statTile('Câu hỏi chờ duyệt', formatNumber(q.pending ?? 0), `${formatNumber(q.approved ?? 0)} câu đang dùng`),
      statTile('Phiếu quà chờ duyệt', formatNumber(s.pendingVouchers)),
    ),
    chartCard({ title: 'Người chơi hoạt động mỗi ngày', subtitle: '14 ngày gần nhất', ...active }),
    h(
      'div',
      { class: 'grid-2' },
      chartCard({ title: 'Phân bố 7 hạng', subtitle: 'Số người ở mỗi hạng', ...ranks }),
      chartCard({ title: 'Cúp Kỳ Lân tháng này', subtitle: 'Điểm 5 Nhà = tổng XP thành viên trong tháng', ...houses }),
    ),
    h(
      'div',
      { class: 'grid-2' },
      h(
        'section',
        { class: 'card' },
        h('header', { class: 'card-head' }, h('h3', {}, '🏆 Top tuần này')),
        week?.rows?.length
          ? h(
              'ol',
              { class: 'rank-ol' },
              week.rows.map((r) => h('li', {}, h('strong', {}, r.name ?? '—'), h('span', { class: 'muted' }, ` · ${r.unit ?? ''}`), h('span', { class: 'right' }, `${formatNumber(r.score)} XP`))),
            )
          : h('p', { class: 'muted' }, 'Chưa có điểm trong tuần.'),
      ),
      h(
        'section',
        { class: 'card' },
        h('header', { class: 'card-head' }, h('h3', {}, '🏢 Bộ phận / lớp sôi nổi nhất')),
        s.units.length
          ? h(
              'ol',
              { class: 'rank-ol' },
              s.units.map((u) => h('li', {}, h('strong', {}, u.unit), h('span', { class: 'muted' }, ` · ${formatNumber(u.players)} người`), h('span', { class: 'right' }, `${formatNumber(u.xp)} XP`))),
            )
          : h('p', { class: 'muted' }, 'Chưa có dữ liệu.'),
      ),
    ),
  );
}
