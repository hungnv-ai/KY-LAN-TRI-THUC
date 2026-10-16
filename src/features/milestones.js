import { sfx } from '../audio/sfx.js';
import { getItem } from '../data/items.js';
import { getMilestone, listMilestones } from '../game/milestones.js';
import { getState } from '../game/progress.js';
import { celebrateDialog } from '../ui/feedback.js';
import { onDistanceClick } from '../ui/hud.js';
import { openMilestones } from '../ui/milestonesView.js';

/** Màu pháo hoa khi đạt mốc (vàng VA). */
const MILESTONE_COLOR = '#C49C57';

/**
 * Mốc quãng đường: bấm ô 🏃 để xem các mốc; khi máy chủ báo vừa qua mốc → ăn mừng + hộp thoại.
 * Không chứa luật thưởng (máy chủ / localBackend đã trao thưởng trong addDistance).
 *
 * @param {{ rewards: ReturnType<typeof import('./rewards.js').createRewards>, onBadgeChanged?: () => void }} deps
 * @returns {{ celebrate: (reached: { id: string, reward: object, item: { name: string } | null }[]) => Promise<void> }}
 */
export function setupMilestones({ rewards, onBadgeChanged }) {
  onDistanceClick(() => {
    const state = getState();
    openMilestones({
      distance: Number(state.stats.distance) || 0,
      claimed: state.milestones ?? [],
      milestones: listMilestones().map((m) => ({ ...m, itemName: m.item ? (getItem(m.item)?.name ?? null) : null })),
    });
  });

  let queue = Promise.resolve();

  /** Ăn mừng lần lượt từng mốc vừa đạt (thường chỉ 1). */
  function celebrate(reached) {
    queue = queue.then(async () => {
      for (const r of reached) {
        const m = getMilestone(r.id);
        if (!m) continue;
        sfx.rankUp();
        rewards.celebrate(MILESTONE_COLOR);
        rewards.flyReward(r.reward ?? {});
        const parts = [`Bạn đã chạy tổng cộng ${m.meters / 1000} km trên đảo!`];
        if (r.reward?.coins) parts.push(`Thưởng +${r.reward.coins} Xu${r.reward.xp ? `, +${r.reward.xp} XP` : ''}.`);
        if (r.item) parts.push(`Quà độc quyền: ${r.item.name} — mở Tủ đồ để mang thử nhé!`);
        parts.push(m.badge ? `Bảng tên của bạn giờ có huy hiệu ${m.icon} ${m.meters / 1000} km viền vàng lấp lánh!` : `Bảng tên của bạn giờ hiện ${m.icon} ${m.meters / 1000} km — mọi người trên đảo đều thấy!`);
        await celebrateDialog({ icon: m.icon, title: `Mốc ${m.meters / 1000} km: ${m.title}!`, message: parts.join(' ') });
        if (r.reward?.rankUp) await rewards.announceRankUp(r.reward.rankUp);
        onBadgeChanged?.();
      }
    });
    return queue;
  }

  return { celebrate };
}
