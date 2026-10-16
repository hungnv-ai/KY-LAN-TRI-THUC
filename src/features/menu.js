import { sfx } from '../audio/sfx.js';
import { getMilestone } from '../game/milestones.js';
import { RANKS } from '../data/ranks.js';
import {
  answerQuestion,
  backendMode,
  buyItem,
  checkIn,
  claimMissionChest,
  equipItem,
  finishQuizRound,
  friendlyError,
  getActiveStreak,
  getHouseStandings,
  getLeaderboard,
  getMissions,
  getMyKudos,
  getMyVouchers,
  getProfile,
  getState,
  hasCheckedInToday,
  isChestClaimed,
  itemStatus,
  onProgressChange,
  rewardedRoundsLeft,
  startQuizRound,
} from '../game/progress.js';
import { formatNumber } from '../ui/dom.js';
import { confirmDialog, say, showToast } from '../ui/feedback.js';
import { onRankCardClick } from '../ui/hud.js';
import { openQuiz } from '../ui/quizView.js';
import { openRanks } from '../ui/ranksView.js';
import { openToday } from '../ui/todayView.js';
import { openWardrobe } from '../ui/wardrobeView.js';

/** Mặc thử đồ chưa đủ Xu trong bấy nhiêu ms rồi trả lại đồ cũ. */
const TRY_ON_MS = 2500;

/**
 * Các nút điều hướng: Hôm nay (điểm danh + nhiệm vụ), Tri Thức (quiz), Tủ đồ, Hạng & Thi đua.
 *
 * @param {{ world: object, mascot: object, wardrobe: object, fx: object,
 *   rewards: ReturnType<typeof import('./rewards.js').createRewards>,
 *   onOutfitChanged: () => void, onCheckedIn?: (result: object) => void | Promise<void> }} deps
 */
export function setupMenu({ world, mascot, wardrobe, fx, rewards, onOutfitChanged, onCheckedIn }) {
  const warn = (err) => showToast(friendlyError(err), { type: 'warn', icon: '⚠️' });

  async function doCheckIn() {
    let result;
    try {
      result = await checkIn();
    } catch (err) {
      warn(err);
      return;
    }
    if (!result) {
      showToast('Hôm nay bạn đã điểm danh rồi. Hẹn gặp lại ngày mai nhé!', { icon: '📅' });
      mascot.emote('wave');
      return;
    }
    sfx.cheer();
    rewards.celebrate('#C49C57');
    say(`Điểm danh thành công! Chuỗi ${result.streak} ngày 🔥 — Trách nhiệm là giữ lời hứa với chính mình!`);
    await rewards.announce(result, 'Điểm danh');
    await onCheckedIn?.(result);
  }

  const actions = {
    checkin() {
      const view = openToday({
        getData: () => ({
          checkedIn: hasCheckedInToday(),
          streak: getActiveStreak(),
          missions: getMissions(),
          chestClaimed: isChestClaimed(),
        }),
        onCheckIn: doCheckIn,
        onClaimChest: async () => {
          try {
            const r = await claimMissionChest();
            if (!r) return;
            sfx.gift();
            rewards.celebrate('#FFD86B');
            say('Hoàn thành nhiệm vụ hôm nay! Rương thưởng đây! 🎁');
            await rewards.announce(r, 'Rương nhiệm vụ');
          } catch (err) {
            warn(err);
          }
        },
      });
      const off = onProgressChange(() => view.refresh());
      // Huỷ đăng ký khi bảng đóng (bảng tự đóng khi mở bảng khác).
      setTimeout(function check() {
        if (!document.querySelector('.today')) off();
        else setTimeout(check, 1000);
      }, 1000);
    },

    quiz() {
      openQuiz({
        rewardedLeft: rewardedRoundsLeft,
        startRound: startQuizRound,
        answer: async (ticketId, choice) => {
          const res = await answerQuestion(ticketId, choice);
          mascot.emote(res.correct ? 'happy' : 'oops');
          if (res.correct) {
            sfx.correct();
            fx.burst(rewards.headWorld(), { count: 24, speed: 2.5, up: 3, life: 0.9 });
          } else {
            sfx.wrong();
          }
          return res;
        },
        finishRound: async (roundId, { timedOut }) => {
          const reward = await finishQuizRound(roundId);
          const ratio = reward.total ? reward.correct / reward.total : 0;
          if (reward.rewarded) setTimeout(() => rewards.flyReward(reward), 300);
          if (timedOut) {
            sfx.faint();
            mascot.emote('faint');
            say('Hết giờ rồi… xỉu mất! Lần sau mình nhanh tay hơn nhé! 😵');
          } else if (reward.perfect) {
            sfx.cheer();
            rewards.celebrate('#9A0036');
            say('Đúng hết luôn! Bạn đúng là Kỳ lân Tri Thức! 🏆');
          } else if (ratio < 0.4) {
            mascot.emote('cry');
            say('Huhu… không sao đâu, thử sai là cách mình lớn lên mà! 🌱');
          } else {
            mascot.emote('happy');
          }
          if (reward.rankUp) rewards.announceRankUp(reward.rankUp);
          return reward;
        },
        onError: warn,
        onClose: () => {
          mascot.setMood(null);
          world.setPanelFocus(false);
        },
      });
      // Gọi sau openQuiz: mở bảng mới sẽ đóng bảng cũ (và onClose của nó).
      world.setPanelFocus(true);
      mascot.setMood('think');
    },

    wardrobe() {
      const view = openWardrobe({
        getStatus: itemStatus,
        onClose: () => world.setPanelFocus(false),
        onSelect: async (item) => {
          const status = itemStatus(item);
          if (status === 'equipped') return;
          if (status === 'locked') {
            const rank = RANKS.find((r) => r.id === item.rank);
            showToast(`Đạt hạng ${rank.name} để mở khoá "${item.name}"!`, { type: 'warn', icon: '🔒' });
            mascot.emote('think');
            return;
          }
          if (status === 'milestoneLocked') {
            const m = getMilestone(item.milestone);
            showToast(`Chạy đủ ${m ? m.meters / 1000 : '?'} km (mốc ${m?.icon ?? ''} ${m?.title ?? ''}) để nhận "${item.name}"!`, { type: 'warn', icon: '🏃' });
            mascot.emote('think');
            return;
          }
          if (status === 'eventLocked') {
            showToast(`"${item.name}" chỉ bán trong thời gian sự kiện.`, { type: 'warn', icon: '🌸' });
            return;
          }
          if (status === 'tooPoor') {
            showToast(`Cần thêm ${formatNumber(item.price - getState().coins)} Xu. Làm Quiz Tri Thức để kiếm Xu nhé!`, {
              type: 'warn',
              icon: '🪙',
            });
            wardrobe.equip(item.id); // cho mặc thử
            mascot.emote('cry');
            sfx.wrong();
            setTimeout(() => wardrobe.equip(getState().equipped[item.slot]), TRY_ON_MS);
            return;
          }
          try {
            if (status === 'buyable') {
              wardrobe.equip(item.id); // xem trước trên nhân vật
              const ok = await confirmDialog({
                icon: '🛍️',
                title: `Mua "${item.name}"?`,
                message: `Giá ${formatNumber(item.price)} Xu. Bạn đang có ${formatNumber(getState().coins)} Xu.`,
                confirmText: 'Mua & mặc',
              });
              if (!ok) {
                wardrobe.equip(getState().equipped[item.slot]);
                return;
              }
              await buyItem(item.id);
              showToast(`Đã mua "${item.name}"!`, { type: 'success', icon: '🛍️' });
              mascot.emote('cool');
              sfx.gift();
              fx.ring(mascot.object.position, '#FFD86B');
              fx.aura(mascot.object, { duration: 1.2 });
            } else {
              mascot.emote('happy');
              sfx.pop();
              fx.aura(mascot.object, { duration: 0.6 });
            }
            wardrobe.equip(item.id);
            await equipItem(item.id);
            onOutfitChanged();
          } catch (err) {
            warn(err);
            wardrobe.equip(getState().equipped[item.slot]);
          }
          view.refresh();
        },
      });
      // Gọi sau openWardrobe: mở bảng mới sẽ đóng bảng cũ (và onClose của nó).
      world.setPanelFocus(true);
    },

    ranks(initialTab) {
      const state = getState();
      openRanks({
        xp: state.xp,
        streak: getActiveStreak(),
        stats: state.stats,
        profile: getProfile(),
        online: backendMode() === 'remote',
        initialTab: typeof initialTab === 'string' ? initialTab : undefined,
        loadLeaderboard: getLeaderboard,
        loadHouses: getHouseStandings,
        loadMine: async () => {
          const [vouchers, kudos] = await Promise.all([getMyVouchers(), getMyKudos()]);
          return { vouchers, kudos };
        },
      });
    },
  };

  document.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => actions[btn.dataset.action]());
  });
  onRankCardClick(() => actions.ranks());
  return actions;
}
