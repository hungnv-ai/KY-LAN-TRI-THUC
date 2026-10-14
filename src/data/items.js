/**
 * Danh mục trang phục/phụ kiện. Hình 3D của từng món được dựng trong `src/scene/outfits.js`
 * theo `model` (+ `params`).
 *
 * - `price`: giá Xu (0 = miễn phí).
 * - `rank`: id hạng cần đạt để mở khoá (phần thưởng lên hạng, miễn phí khi đủ hạng).
 * - `rarity`: common | rare | epic | legendary.
 * - `icon`: emoji hiển thị trong Tủ đồ cho món không có màu đại diện.
 * - `model: null` = "Không mặc" cho slot đó.
 */

export const SLOTS = [
  { id: 'jacket', name: 'Áo khoác', icon: '🧥' },
  { id: 'hat', name: 'Nón', icon: '🧢' },
  { id: 'glasses', name: 'Kính', icon: '👓' },
  { id: 'shoes', name: 'Giày', icon: '👟' },
  { id: 'backpack', name: 'Ba lô', icon: '🎒' },
  { id: 'aura', name: 'Hiệu ứng', icon: '✨' },
];

export const RARITY = {
  common: { name: 'Thường', color: '#737373' },
  rare: { name: 'Hiếm', color: '#1750B5' },
  epic: { name: 'Sử thi', color: '#7A2FB0' },
  legendary: { name: 'Huyền thoại', color: '#C49C57' },
};

export const ITEMS = [
  // Áo khoác: đổi màu áo của Kỳ lân.
  { id: 'jacket-va', slot: 'jacket', name: 'Áo khoác VA', price: 0, rarity: 'common', model: 'jacket', params: { body: '#A8102E', trim: '#D6334F' } },
  { id: 'jacket-nhanai', slot: 'jacket', name: 'Áo Nhân Ái', price: 120, rarity: 'rare', model: 'jacket', params: { body: '#009082', trim: '#5DCBBF' } },
  { id: 'jacket-banlinh', slot: 'jacket', name: 'Áo Bản Lĩnh', price: 120, rarity: 'rare', model: 'jacket', params: { body: '#725139', trim: '#AD9A8C' } },
  { id: 'jacket-trachnhiem', slot: 'jacket', name: 'Áo Trách Nhiệm', price: 120, rarity: 'rare', model: 'jacket', params: { body: '#C49C57', trim: '#F6EFE3' } },
  { id: 'jacket-khaiphong', slot: 'jacket', name: 'Áo Khai Phóng', price: 120, rarity: 'rare', model: 'jacket', params: { body: '#1750B5', trim: '#96B5EA' } },
  { id: 'jacket-kimcuong', slot: 'jacket', name: 'Áo Kim Cương', price: 0, rank: 'kimCuong', rarity: 'legendary', model: 'jacket', params: { body: '#EAF4FF', trim: '#63C5FF', sparkle: true } },

  // Nón
  { id: 'hat-none', slot: 'hat', name: 'Không đội', price: 0, rarity: 'common', model: null },
  { id: 'hat-cap', slot: 'hat', name: 'Nón lưỡi trai VA', price: 80, rarity: 'common', model: 'cap', params: { color: '#9A0036' } },
  { id: 'hat-nonla', slot: 'hat', name: 'Nón lá', price: 150, rarity: 'rare', model: 'nonLa', icon: '👒' },
  { id: 'hat-grad', slot: 'hat', name: 'Mũ tốt nghiệp', price: 250, rarity: 'epic', model: 'gradCap', icon: '🎓' },
  { id: 'hat-crown', slot: 'hat', name: 'Vương miện vàng', price: 0, rank: 'vang', rarity: 'legendary', model: 'crown', icon: '👑' },

  // Kính
  { id: 'glasses-none', slot: 'glasses', name: 'Không đeo', price: 0, rarity: 'common', model: null },
  { id: 'glasses-round', slot: 'glasses', name: 'Kính học giả', price: 60, rarity: 'common', model: 'glasses', params: { frame: '#4A4A4A', lens: '#DDEEFF', tint: 0.25 } },
  { id: 'glasses-sun', slot: 'glasses', name: 'Kính râm', price: 90, rarity: 'rare', model: 'glasses', params: { frame: '#111111', lens: '#111111', tint: 0.85 } },

  // Giày
  { id: 'shoes-red', slot: 'shoes', name: 'Giày đỏ VA', price: 0, rarity: 'common', model: 'shoes', params: { body: '#B3122A', sole: '#F0C48A' } },
  { id: 'shoes-blue', slot: 'shoes', name: 'Giày Khai Phóng', price: 80, rarity: 'common', model: 'shoes', params: { body: '#1750B5', sole: '#FFFFFF' } },
  { id: 'shoes-white', slot: 'shoes', name: 'Sneaker trắng', price: 100, rarity: 'rare', model: 'shoes', params: { body: '#F5F6F7', sole: '#9A0036' } },
  { id: 'shoes-silver', slot: 'shoes', name: 'Giày bạc', price: 0, rank: 'bac', rarity: 'epic', model: 'shoes', params: { body: '#C9D1D8', sole: '#5B6670', metal: true } },

  // Ba lô
  { id: 'backpack-none', slot: 'backpack', name: 'Không đeo', price: 0, rarity: 'common', model: null },
  { id: 'backpack-black', slot: 'backpack', name: 'Ba lô đen', price: 0, rank: 'thanhVien', rarity: 'common', model: 'backpack', params: { color: '#222222' } },
  { id: 'backpack-teal', slot: 'backpack', name: 'Ba lô Nhân Ái', price: 100, rarity: 'rare', model: 'backpack', params: { color: '#009082' } },

  // Hiệu ứng
  { id: 'aura-none', slot: 'aura', name: 'Không', price: 0, rarity: 'common', model: null },
  { id: 'aura-legend', slot: 'aura', name: 'Hào quang Huyền Thoại', price: 0, rank: 'huyenThoai', rarity: 'legendary', model: 'aura', icon: '🌟' },
];

/** Đồ được sở hữu sẵn khi bắt đầu. */
export const STARTER_ITEMS = ['jacket-va', 'hat-none', 'glasses-none', 'shoes-red', 'backpack-none', 'aura-none'];

/** Trang phục mặc định theo slot. */
export const DEFAULT_EQUIPPED = {
  jacket: 'jacket-va',
  hat: 'hat-none',
  glasses: 'glasses-none',
  shoes: 'shoes-red',
  backpack: 'backpack-none',
  aura: 'aura-none',
};

/**
 * @param {string} id
 * @returns {typeof ITEMS[number] | undefined}
 */
export function getItem(id) {
  return ITEMS.find((item) => item.id === id);
}
