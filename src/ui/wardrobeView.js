import { ITEMS, RARITY, SLOTS } from '../data/items.js';
import { RANKS } from '../data/ranks.js';
import { h, formatNumber } from './dom.js';
import { openSheet } from './sheet.js';

/**
 * Giao diện Tủ đồ: tab theo slot, lưới thẻ trang phục.
 *
 * @param {{
 *   getStatus: (item: object) => 'equipped' | 'owned' | 'buyable' | 'tooPoor' | 'locked',
 *   onSelect: (item: object) => void | Promise<void>,
 * }} handlers
 * @returns {{ refresh: () => void }}
 */
export function openWardrobe({ getStatus, onSelect }) {
  let activeSlot = SLOTS[0].id;

  const tabs = h(
    'div',
    { class: 'tabs', role: 'tablist', 'aria-label': 'Loại trang phục' },
    SLOTS.map((slot) =>
      h(
        'button',
        {
          class: 'tab',
          type: 'button',
          role: 'tab',
          'data-slot': slot.id,
          onclick: () => {
            activeSlot = slot.id;
            render();
          },
        },
        h('span', { 'aria-hidden': 'true' }, slot.icon),
        slot.name,
      ),
    ),
  );
  const grid = h('div', { class: 'item-grid', role: 'tabpanel' });

  function render() {
    tabs.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.slot === activeSlot)));
    const slot = SLOTS.find((s) => s.id === activeSlot);
    grid.replaceChildren(...ITEMS.filter((item) => item.slot === activeSlot).map((item) => renderCard(item, slot)));
  }

  function renderCard(item, slot) {
    const status = getStatus(item);
    const rarity = RARITY[item.rarity];
    const color = item.params?.body ?? item.params?.color ?? item.params?.frame;
    const swatch = color
      ? h('span', { class: 'item-swatch', style: { background: color }, 'aria-hidden': 'true' })
      : h('span', { 'aria-hidden': 'true', style: { fontSize: '22px' } }, item.model ? slot.icon : '🚫');

    return h(
      'button',
      {
        class: `item-card ${status === 'equipped' ? 'is-equipped' : ''} ${status === 'locked' ? 'is-locked' : ''}`,
        type: 'button',
        onclick: () => onSelect(item),
      },
      swatch,
      h('span', { class: 'item-name' }, item.name),
      h('span', { class: 'item-rarity', style: { color: rarity.color } }, rarity.name),
      h('span', { class: 'item-status' }, statusText(item, status)),
    );
  }

  openSheet({ title: '👕 Tủ đồ Kỳ lân', content: h('div', {}, tabs, grid) });
  render();
  return { refresh: render };
}

function statusText(item, status) {
  switch (status) {
    case 'equipped':
      return '✓ Đang mặc';
    case 'owned':
      return 'Bấm để mặc';
    case 'locked': {
      const rank = RANKS.find((r) => r.id === item.rank);
      return `🔒 Hạng ${rank?.name ?? ''}`;
    }
    default:
      return `🪙 ${formatNumber(item.price)}`;
  }
}
