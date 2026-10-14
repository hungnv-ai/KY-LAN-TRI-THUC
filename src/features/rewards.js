import * as THREE from 'three';
import { sfx } from '../audio/sfx.js';
import { celebrateDialog, showToast } from '../ui/feedback.js';
import { flyToHud } from '../ui/flyFx.js';
import { formatNumber } from '../ui/dom.js';

/** Lên hạng: hiệu ứng trước, hộp thoại chúc mừng hiện sau để không che khoảnh khắc ăn mừng. */
const RANK_UP_DIALOG_DELAY_MS = 1800;

/**
 * Trình bày phần thưởng: toast, xu/sao bay vào ví, hiệu ứng ăn mừng, lên hạng.
 *
 * @param {{ world: object, mascot: object, fx: object, onRankUp?: () => void }} deps
 */
export function createRewards({ world, mascot, fx, onRankUp }) {
  const tmp = new THREE.Vector3();

  /** Toạ độ màn hình phía trên đầu Kỳ lân (điểm xuất phát của xu / sao bay vào ví). */
  function headScreen() {
    mascot.headWorldPosition(tmp);
    tmp.y += 0.6;
    return world.toScreen(tmp);
  }

  /** @returns {THREE.Vector3} vị trí 3D phía trên đầu Kỳ lân */
  function headWorld() {
    mascot.headWorldPosition(tmp);
    return tmp.clone().setY(tmp.y + 1);
  }

  function flyReward(reward) {
    if (reward.coins > 0) {
      flyToHud('coin', headScreen(), Math.min(reward.coins, 10));
      sfx.coins(reward.coins);
    }
    if (reward.xp > 0) flyToHud('xp', headScreen(), Math.min(Math.ceil(reward.xp / 4), 6));
  }

  /** Hiệu ứng ăn mừng lớn quanh Kỳ lân. */
  function celebrate(color) {
    mascot.emote('cheer');
    fx.celebrate(mascot.object, { color });
  }

  /**
   * Toast + xu bay vào ví + (nếu có) lên hạng.
   *
   * @param {{ xp?: number, coins?: number, golden?: boolean, rankUp?: object | null }} reward
   * @param {string} label
   */
  async function announce(reward, label) {
    if (reward.xp || reward.coins) {
      const golden = reward.golden ? ' ⏰x2' : '';
      showToast(`${label}: +${formatNumber(reward.xp ?? 0)} XP${golden}, +${formatNumber(reward.coins ?? 0)} Xu`, {
        type: 'success',
        icon: '🎁',
      });
      flyReward(reward);
    }
    if (reward.rankUp) await announceRankUp(reward.rankUp);
  }

  async function announceRankUp({ to, items = [] }) {
    sfx.rankUp();
    celebrate(to.color);
    onRankUp?.();
    await new Promise((resolve) => setTimeout(resolve, RANK_UP_DIALOG_DELAY_MS));
    const gift = items.length ? ` Bạn nhận được: ${items.map((i) => i.name).join(', ')} — xem trong Tủ đồ!` : '';
    await celebrateDialog({
      icon: to.icon,
      title: `Lên hạng ${to.name}!`,
      message: `Chúc mừng! Kỳ lân của bạn đã đạt hạng ${to.name}.${gift}`,
    });
  }

  return { announce, announceRankUp, flyReward, celebrate, headScreen, headWorld };
}
