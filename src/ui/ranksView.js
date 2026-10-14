import { RANKS, getRankInfo } from '../data/ranks.js';
import { h, formatNumber } from './dom.js';
import { openSheet } from './sheet.js';

/**
 * Bảng 7 hạng + thống kê cá nhân.
 *
 * @param {{ xp: number, streak: number, stats: { answered: number, correct: number, rounds: number } }} data
 */
export function openRanks({ xp, streak, stats }) {
  const info = getRankInfo(xp);
  const accuracy = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : 0;

  const statsEl = h(
    'div',
    { class: 'stats' },
    stat(formatNumber(xp), 'Tổng XP'),
    stat(`${streak} 🔥`, 'Chuỗi ngày'),
    stat(`${accuracy}%`, 'Trả lời đúng'),
  );

  const list = h(
    'ol',
    { class: 'rank-list' },
    RANKS.map((rank, i) => {
      const state = i < info.index ? 'past' : i === info.index ? 'current' : 'future';
      return h(
        'li',
        { class: `rank-row is-${state}` },
        h('span', { class: 'rank-icon', 'aria-hidden': 'true' }, rank.icon),
        h(
          'span',
          {},
          h('span', { class: 'rank-row-name', style: { color: rank.color } }, rank.name),
          h('br'),
          h('span', { class: 'rank-row-meta' }, `${formatNumber(rank.xp)} XP · 🎁 ${rank.reward}`),
        ),
        h(
          'span',
          { class: 'rank-row-badge' },
          state === 'current' ? `Bạn ở đây${info.tier ? ` · ${info.tier}` : ''}` : state === 'past' ? '✓ Đã đạt' : '',
        ),
      );
    }),
  );

  // CSS custom property cần gán qua setProperty.
  list.querySelectorAll('.rank-row').forEach((row, i) => row.style.setProperty('--row-color', RANKS[i].color));

  openSheet({
    title: '🏆 Hành trình Kỳ lân',
    content: h(
      'div',
      {},
      statsEl,
      list,
      h('p', { class: 'muted', style: { marginTop: '12px' } }, 'Từ hạng Đồng trở lên, mỗi hạng có 3 bậc III → II → I.'),
    ),
  });
}

function stat(value, label) {
  return h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, value), h('span', { class: 'stat-label' }, label));
}
