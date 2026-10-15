import { h } from './dom.js';
import { openSheet } from './sheet.js';

/**
 * Bảng giới thiệu sự kiện đang diễn ra: lời mời, hoạt động, số ngày còn lại, lối tắt.
 *
 * @param {{ event: object, daysLeft: number, early?: boolean, onOpenWardrobe: () => void, cardsReceived: number }} opts
 */
export function openEventSheet({ event, daysLeft, early = false, onOpenWardrobe, cardsReceived }) {
  openSheet({
    title: `${event.icon} ${event.name}`,
    content: h(
      'div',
      { class: 'event-sheet' },
      h(
        'div',
        { class: 'event-hero', style: { '--event-color': event.color } },
        h('span', { class: 'event-hero-icon', 'aria-hidden': 'true' }, event.icon),
        h('div', {}, h('strong', {}, event.banner), h(
            'div',
            { class: 'small' },
            early ? `Mở sớm — lịch chính thức từ ${event.start.split('-').reverse().join('/')}` : daysLeft > 0 ? `Còn ${daysLeft} ngày` : 'Ngày cuối cùng!',
          )),
      ),
      h('p', {}, event.intro),
      h('h3', { class: 'section-title' }, 'Hoạt động'),
      h('ul', { class: 'mission-list' }, event.activities.map((a) => h('li', { class: 'mission' }, h('span', { class: 'mission-check', 'aria-hidden': 'true' }, '🌸'), h('div', { class: 'mission-body' }, a)))),
      h('p', { class: 'muted' }, `💌 Bạn đã nhận ${cardsReceived} thiệp trong sự kiện.`),
      h('button', { class: 'btn btn-block', type: 'button', onclick: onOpenWardrobe }, '👕 Xem trang phục sự kiện'),
    ),
  });
}
