/**
 * 7 hạng người chơi (xem docs/GAME_DESIGN.md). `xp` là mốc XP tích luỹ tối thiểu.
 * Hạng có `tiers: true` được chia thành 3 bậc III → II → I.
 */
export const RANKS = [
  { id: 'tapSu', name: 'Tập Sự', icon: '🐣', xp: 0, color: '#8F7562', reward: 'Áo khoác VA cơ bản' },
  { id: 'thanhVien', name: 'Thành Viên', icon: '🎒', xp: 300, color: '#009082', reward: 'Ba lô đen' },
  { id: 'dong', name: 'Đồng', icon: '🥉', xp: 1500, color: '#B87333', reward: 'Khung hạng màu đồng', tiers: true },
  { id: 'bac', name: 'Bạc', icon: '🥈', xp: 5000, color: '#8A9BA8', reward: 'Giày bạc', tiers: true },
  { id: 'vang', name: 'Vàng', icon: '🥇', xp: 12000, color: '#C49C57', reward: 'Vương miện vàng', tiers: true },
  { id: 'kimCuong', name: 'Kim Cương', icon: '💎', xp: 25000, color: '#1750B5', reward: 'Áo khoác Kim Cương', tiers: true },
  { id: 'huyenThoai', name: 'Kỳ Lân Huyền Thoại', icon: '👑', xp: 50000, color: '#9A0036', reward: 'Hào quang Huyền Thoại' },
];

const TIER_LABELS = ['III', 'II', 'I'];

/**
 * Tính hạng hiện tại từ tổng XP.
 *
 * @param {number} xp
 * @returns {{ rank: typeof RANKS[number], index: number, tier: string, label: string,
 *   next: typeof RANKS[number] | null, progress: number, xpToNext: number }}
 *   `progress` (0..1) là tiến độ tới hạng kế tiếp.
 */
export function getRankInfo(xp) {
  let index = 0;
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (xp >= RANKS[i].xp) {
      index = i;
      break;
    }
  }
  const rank = RANKS[index];
  const next = RANKS[index + 1] ?? null;

  let tier = '';
  if (rank.tiers && next) {
    const step = (next.xp - rank.xp) / TIER_LABELS.length;
    const tierIndex = Math.min(TIER_LABELS.length - 1, Math.floor((xp - rank.xp) / step));
    tier = TIER_LABELS[tierIndex];
  }

  const progress = next ? (xp - rank.xp) / (next.xp - rank.xp) : 1;
  return {
    rank,
    index,
    tier,
    label: tier ? `${rank.name} ${tier}` : rank.name,
    next,
    progress,
    xpToNext: next ? next.xp - xp : 0,
  };
}

/**
 * @param {string} rankId
 * @returns {number} vị trí hạng trong RANKS (-1 nếu không có)
 */
export function rankIndexOf(rankId) {
  return RANKS.findIndex((r) => r.id === rankId);
}
