import { formatNumber, h } from './dom.js';
import { openSheet } from './sheet.js';

/**
 * Bảng "Mốc quãng đường": tổng số mét đã chạy, thanh tiến độ tới mốc kế tiếp,
 * danh sách mốc (đã đạt ✓ / chưa đạt) kèm phần thưởng.
 *
 * @param {{
 *   distance: number,
 *   claimed: string[],
 *   milestones: { id: string, meters: number, icon: string, title: string, xp?: number, coins?: number, badge?: boolean, itemName?: string | null }[],
 * }} opts
 */
export function openMilestones({ distance, claimed, milestones }) {
  const next = milestones.find((m) => distance < m.meters) ?? null;
  const prevMeters = next ? (milestones[milestones.indexOf(next) - 1]?.meters ?? 0) : 0;
  const pct = next ? Math.min(100, ((distance - prevMeters) / (next.meters - prevMeters)) * 100) : 100;

  const head = h(
    'div',
    { class: 'ms-head' },
    h('div', { class: 'ms-total' }, h('span', { 'aria-hidden': 'true' }, '🏃 '), `${formatKm(distance)}`),
    h('p', { class: 'muted' }, next ? `Còn ${formatNumber(Math.ceil(next.meters - distance))} m nữa tới mốc ${next.icon} ${next.title}` : 'Bạn đã chinh phục mọi mốc quãng đường! 🎉'),
    h('div', { class: 'ms-bar', role: 'progressbar', 'aria-valuenow': String(Math.round(pct)), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('span', { style: { width: `${pct}%` } })),
  );

  const list = h(
    'ol',
    { class: 'ms-list' },
    ...milestones.map((m) => {
      const done = claimed.includes(m.id) || distance >= m.meters;
      const reward = [m.coins ? `+${formatNumber(m.coins)} Xu` : '', m.xp ? `+${formatNumber(m.xp)} XP` : '', m.itemName ? `👟 ${m.itemName}` : '', m.badge ? 'huy hiệu trên bảng tên' : '']
        .filter(Boolean)
        .join(' · ');
      return h(
        'li',
        { class: `ms-item ${done ? 'is-done' : ''} ${m === next ? 'is-next' : ''}` },
        h('span', { class: 'ms-icon', 'aria-hidden': 'true' }, m.icon),
        h('div', { class: 'ms-info' }, h('strong', {}, m.title), h('span', { class: 'muted' }, `${formatKm(m.meters)} · ${reward}`)),
        h('span', { class: 'ms-state' }, done ? '✓' : '🔒'),
      );
    }),
  );

  openSheet({
    title: '🏃 Mốc quãng đường',
    content: h('div', {}, head, list, h('p', { class: 'muted ms-note' }, 'Quãng đường cộng dồn mọi ngày. Qua mốc là tự nhận thưởng — cứ chạy khám phá đảo nhé!')),
    variant: 'side',
  });
}

function formatKm(meters) {
  if (meters < 1000) return `${formatNumber(Math.floor(meters))} m`;
  const km = Math.floor(meters / 100) / 10;
  return `${km.toLocaleString('vi-VN')} km`;
}
