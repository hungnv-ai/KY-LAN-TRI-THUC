import { VALUES } from '../config.js';
import { getRankInfo } from '../data/ranks.js';
import { h } from './dom.js';
import { openSheet } from './sheet.js';

const HOUSE = Object.fromEntries(VALUES.map((v) => [v.id, v]));

/**
 * Bảng "Ai đang ở cùng đảo": tên, hạng, Nhà, khoảng cách; bấm "Tới chỗ bạn" để chạy tới ngay.
 *
 * @param {{ people: { id: string, name: string, unit?: string, xp: number, house?: string, distance: number }[],
 *   room: string, onGo: (id: string) => void, onView: (id: string) => void }} opts
 */
export function openPeople({ people, room, onGo, onView }) {
  const sorted = [...people].sort((a, b) => a.distance - b.distance);
  openSheet({
    title: `👥 Cùng ở ${room}`,
    variant: 'side',
    content: h(
      'div',
      { class: 'people' },
      sorted.length
        ? h(
            'ul',
            { class: 'people-list' },
            sorted.map((p) => {
              const info = getRankInfo(p.xp ?? 0);
              return h(
                'li',
                { class: 'people-row' },
                h('span', { class: 'people-rank', style: { borderColor: info.rank.color }, 'aria-hidden': 'true' }, info.rank.icon),
                h(
                  'button',
                  { class: 'people-name', type: 'button', onclick: () => onView(p.id) },
                  h('strong', {}, p.name ?? 'Kỳ lân'),
                  h(
                    'small',
                    {},
                    p.house ? h('span', { class: 'house-dot', style: { background: HOUSE[p.house]?.color } }) : '',
                    [info.label, p.unit].filter(Boolean).join(' · '),
                    ` · cách ${Math.round(p.distance)} m`,
                  ),
                ),
                h('button', { class: 'btn btn-sm-go', type: 'button', onclick: () => onGo(p.id) }, '📍 Tới chỗ bạn'),
              );
            }),
          )
        : h('p', { class: 'notice' }, 'Chưa thấy ai khác trên đảo. Rủ đồng nghiệp cùng vào chơi nhé! 🦄'),
      h('p', { class: 'muted small' }, 'Mỗi đảo tối đa 20 người. Bấm vào tên để xem hồ sơ, thả tim hoặc gửi lời cảm ơn.'),
    ),
  });
}
