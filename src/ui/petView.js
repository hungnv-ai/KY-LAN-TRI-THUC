import { PETS } from '../data/pets.js';
import { RARITY } from '../data/items.js';
import { h } from './dom.js';
import { celebrateDialog } from './feedback.js';
import { isSheetOpen, openSheet, setSheetContent } from './sheet.js';

/** Hình trứng theo tiến độ ấp. */
function eggIcon(progress, need) {
  if (progress <= 0) return '🥚';
  return progress / need >= 0.66 ? '🐣' : '🥚';
}

/**
 * Bảng Thú cưng: trứng đang ấp + bộ sưu tập (đã có: dắt đi; chưa có: ẩn danh theo độ hiếm).
 *
 * @param {{
 *   getData: () => { owned: string[], active: string | null, egg: number, eggNeed: number },
 *   onEquip: (petId: string | null) => Promise<void>,
 * }} handlers
 * @returns {{ refresh: () => void }}
 */
export function openPets({ getData, onEquip }) {
  function render() {
    const { owned, active, egg, eggNeed } = getData();
    const pct = Math.round((egg / eggNeed) * 100);
    return h(
      'div',
      { class: 'pets' },
      h(
        'div',
        { class: 'egg-card' },
        h('span', { class: `egg-icon ${egg > 0 ? 'is-wobble' : ''}`, 'aria-hidden': 'true' }, eggIcon(egg, eggNeed)),
        h(
          'div',
          { class: 'egg-body' },
          h('strong', {}, 'Trứng thần kỳ'),
          h('div', { class: 'mission-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': eggNeed, 'aria-valuenow': egg }, h('span', { style: { width: `${pct}%` } })),
          h('span', { class: 'muted small' }, `Điểm danh ${egg}/${eggNeed} ngày — đủ ngày trứng sẽ nở ra một bạn mới!`),
        ),
      ),
      h('h3', { class: 'section-title' }, `Bộ sưu tập (${owned.length}/${PETS.length})`),
      h(
        'div',
        { class: 'item-grid pet-grid' },
        PETS.map((p) => {
          const has = owned.includes(p.id);
          const isActive = active === p.id;
          const rarity = RARITY[p.rarity];
          const card = h(
            'button',
            { class: `item-card pet-card ${isActive ? 'is-equipped' : ''} ${has ? '' : 'is-locked'}`, type: 'button', disabled: !has },
            h('span', { class: `pet-emoji ${has ? '' : 'is-hidden'}`, 'aria-hidden': 'true' }, has ? p.emoji : '❓'),
            h('span', { class: 'item-name' }, has ? p.name : '???'),
            h('span', { class: 'item-rarity', style: { color: rarity.color } }, rarity.name),
            h('span', { class: 'item-status' }, isActive ? '✓ Đang đi cùng' : has ? 'Dắt đi cùng' : 'Chưa nở'),
          );
          if (has && !isActive) card.addEventListener('click', () => onEquip(p.id).then(refresh));
          return card;
        }),
      ),
      active
        ? h('button', { class: 'btn btn-secondary btn-block', type: 'button', onclick: () => onEquip(null).then(refresh) }, '🏠 Cho thú cưng nghỉ ở nhà')
        : '',
    );
  }

  function refresh() {
    if (isSheetOpen() && document.querySelector('.pets')) setSheetContent(render());
  }

  openSheet({ title: '🐾 Thú cưng', content: render(), variant: 'side' });
  return { refresh };
}

/**
 * Chúc mừng trứng nở.
 *
 * @param {{ emoji: string, name: string, rarity: string }} pet
 * @returns {Promise<void>}
 */
export function showHatched(pet) {
  return celebrateDialog({
    icon: pet.emoji,
    title: 'Trứng nở rồi! 🐣',
    message: `Chào mừng ${pet.name} (${RARITY[pet.rarity]?.name ?? ''}) — bạn ấy sẽ lon ton theo Kỳ lân của bạn khắp đảo!`,
    buttonText: 'Dắt đi chơi thôi!',
  });
}
