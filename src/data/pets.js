/**
 * Thú cưng nở từ trứng (điểm danh đủ ngày → trứng nở ra một bạn chưa có).
 * `weight`: tỉ lệ xuất hiện tương đối (càng hiếm càng nhỏ). `look`: thông số dựng hình 3D trong
 * scene/pets.js (màu thân, kiểu tai, đuôi…).
 */
export const PETS = [
  { id: 'ga', name: 'Gà Con Tò Mò', emoji: '🐥', rarity: 'common', weight: 30, look: { body: '#FFD54F', belly: '#FFF3C4', ears: 'tuft', tail: 'none', beak: '#FF8F00', scale: 0.85 } },
  { id: 'meo', name: 'Mèo Mướp', emoji: '🐱', rarity: 'common', weight: 25, look: { body: '#F2A65A', belly: '#FFF1E0', ears: 'cat', tail: 'long', stripes: '#C9783A' } },
  { id: 'cun', name: 'Cún Vàng', emoji: '🐶', rarity: 'common', weight: 25, look: { body: '#D9A066', belly: '#FFF4E3', ears: 'floppy', tail: 'short', earColor: '#8D5A34' } },
  { id: 'tho', name: 'Thỏ Bông', emoji: '🐰', rarity: 'rare', weight: 15, look: { body: '#FAFAFA', belly: '#FFE3EC', ears: 'bunny', tail: 'puff', earInner: '#FFB3C8' } },
  { id: 'rua', name: 'Rùa Thông Thái', emoji: '🐢', rarity: 'rare', weight: 15, look: { body: '#8BC34A', belly: '#E6F4C9', ears: 'none', tail: 'short', shell: '#5D8C2B', scale: 0.95 } },
  { id: 'gautruc', name: 'Gấu Trúc Mũm Mĩm', emoji: '🐼', rarity: 'epic', weight: 8, look: { body: '#FAFAFA', belly: '#FFFFFF', ears: 'round', tail: 'short', earColor: '#222222', patches: '#222222', scale: 1.05 } },
  { id: 'cao', name: 'Cáo Lửa', emoji: '🦊', rarity: 'epic', weight: 8, look: { body: '#F26A1B', belly: '#FFF6EE', ears: 'fox', tail: 'bushy', earColor: '#3B2418' } },
  { id: 'rong', name: 'Rồng Con Vàng', emoji: '🐲', rarity: 'legendary', weight: 3, look: { body: '#E53935', belly: '#FFD54F', ears: 'horns', tail: 'dragon', wings: '#FFC107', sparkle: true } },
];

/**
 * @param {string | null | undefined} id
 * @returns {(typeof PETS)[number] | undefined}
 */
export function getPet(id) {
  return PETS.find((p) => p.id === id);
}
