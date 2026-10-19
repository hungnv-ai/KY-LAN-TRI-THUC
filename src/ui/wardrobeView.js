import { ITEMS, RARITY, SLOTS } from '../data/items.js';
import { GENDERS } from '../data/characters.js';
import { getMilestone } from '../game/milestones.js';
import { RANKS } from '../data/ranks.js';
import { h, formatNumber } from './dom.js';
import { openSheet } from './sheet.js';

/** Nhắc khi đang dùng nhân vật 3D tải lên. */
const OUTFIT_NOTE = 'Bạn đang dùng nhân vật 3D — trang phục chỉ hiện khi chọn Kỳ lân Nam / Nữ (tab 🦄 Nhân vật).';

/**
 * Giao diện Tủ đồ: tab Nhân vật + tab theo slot, lưới thẻ trang phục.
 *
 * @param {{
 *   getStatus: (item: object) => 'equipped' | 'owned' | 'buyable' | 'tooPoor' | 'locked' | 'milestoneLocked' | 'eventLocked',
 *   onSelect: (item: object) => void | Promise<void>,
 *   onClose?: () => void,
 *   characters?: { list: () => object[], current: () => string, onPick: (id: string) => void | Promise<void> },
 * }} handlers
 * @returns {{ refresh: () => void }}
 */
export function openWardrobe({ getStatus, onSelect, onClose, characters }) {
  const CHARACTER_TAB = { id: 'character', name: 'Nhân vật', icon: '🦄' };
  const tabsList = characters ? [CHARACTER_TAB, ...SLOTS] : SLOTS;
  let activeSlot = SLOTS[0].id;

  const tabs = h(
    'div',
    { class: 'tabs', role: 'tablist', 'aria-label': 'Loại trang phục' },
    tabsList.map((slot) =>
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
  const note = h('p', { class: 'muted wardrobe-note', hidden: true }, '');

  function render() {
    tabs.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.slot === activeSlot)));
    if (activeSlot === CHARACTER_TAB.id) {
      renderCharacters();
      return;
    }
    const slot = SLOTS.find((s) => s.id === activeSlot);
    // Đồ sự kiện chỉ hiện khi sự kiện đang diễn ra (hoặc đã sở hữu).
    const items = ITEMS.filter((item) => item.slot === activeSlot && getStatus(item) !== 'eventLocked');
    grid.replaceChildren(...items.map((item) => renderCard(item, slot)));
    note.textContent = OUTFIT_NOTE;
    note.hidden = !isCustomCharacter();
  }

  /** Nhân vật đang dùng là model 3D tải lên (trang phục không hiện trên model này). */
  function isCustomCharacter() {
    if (!characters) return false;
    return Boolean(characters.list().find((c) => c.id === characters.current())?.modelUrl);
  }

  function renderCharacters() {
    const current = characters.current();
    grid.replaceChildren(
      ...characters.list().map((c) =>
        h(
          'button',
          {
            class: `item-card char-card ${c.id === current ? 'is-equipped' : ''}`,
            type: 'button',
            onclick: () => c.id !== current && characters.onPick(c.id),
          },
          h(
            'span',
            { class: 'char-thumb', 'aria-hidden': 'true' },
            c.modelUrl ? h('span', { class: 'char-3d' }, '🧊') : h('img', { src: '/mascot-icon.png', alt: '', width: 40, height: 54 }),
            c.variant === 'female' ? h('span', { class: 'char-bow' }, '🎀') : '',
          ),
          h('span', { class: 'item-name' }, c.name),
          h('span', { class: 'item-rarity' }, `${GENDERS[c.gender] ?? ''}${c.modelUrl ? ' · 3D' : ''}`),
          h('span', { class: 'item-status' }, c.id === current ? '✓ Đang dùng' : 'Bấm để chọn'),
        ),
      ),
    );
    note.hidden = false;
    note.textContent = 'Nhân vật 3D (🧊) do nhà trường tải lên. Trang phục trong Tủ đồ chỉ hiện trên Kỳ lân Nam / Nữ.';
  }

  function renderCard(item, slot) {
    const status = getStatus(item);
    const rarity = RARITY[item.rarity];
    const color = item.params?.body ?? item.params?.color ?? item.params?.frame;
    const swatch =
      item.icon || !color
        ? h('span', { 'aria-hidden': 'true', style: { fontSize: '22px' } }, item.icon ?? (item.model ? slot.icon : '🚫'))
        : h('span', { class: 'item-swatch', style: { background: color }, 'aria-hidden': 'true' });

    return h(
      'button',
      {
        class: `item-card ${status === 'equipped' ? 'is-equipped' : ''} ${status === 'locked' || status === 'milestoneLocked' ? 'is-locked' : ''}`,
        type: 'button',
        onclick: () => onSelect(item),
      },
      swatch,
      item.event ? h('span', { class: 'item-event-badge' }, '🌸 Sự kiện') : '',
      h('span', { class: 'item-name' }, item.name),
      h('span', { class: 'item-rarity', style: { color: rarity.color } }, rarity.name),
      h('span', { class: 'item-status' }, statusText(item, status)),
    );
  }

  openSheet({ title: '👕 Tủ đồ Kỳ lân', content: h('div', {}, tabs, note, grid), variant: 'side', onClose });
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
    case 'milestoneLocked': {
      const m = getMilestone(item.milestone);
      return `🏃 Mốc ${m ? m.meters / 1000 : '?'} km`;
    }
    default:
      return `🪙 ${formatNumber(item.price)}`;
  }
}
