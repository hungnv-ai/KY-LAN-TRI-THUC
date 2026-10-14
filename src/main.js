import * as THREE from 'three';
import { createWorld } from './scene/world.js';
import { setupLights } from './scene/lights.js';
import { setupIsland } from './scene/island.js';
import { createExplore } from './features/explore.js';
import { createMascot } from './scene/mascot.js';
import { createWardrobe } from './scene/outfits.js';
import { RANKS, getRankInfo } from './data/ranks.js';
import { MASCOT_LINES } from './data/lines.js';
import {
  initProgress,
  getState,
  onProgressChange,
  checkIn,
  hasCheckedInToday,
  getActiveStreak,
  rewardedRoundsLeft,
  completeQuizRound,
  itemStatus,
  buyItem,
  equipItem,
} from './game/progress.js';
import { createQuizRound } from './game/quiz.js';
import { isGoldenHour } from './game/time.js';
import { renderHud, onRankCardClick, hideLoading } from './ui/hud.js';
import { showToast, confirmDialog, celebrateDialog, say, setSpeechAnchor } from './ui/feedback.js';
import { openQuiz } from './ui/quizView.js';
import { openWardrobe } from './ui/wardrobeView.js';
import { openRanks } from './ui/ranksView.js';
import { formatNumber } from './ui/dom.js';

/**
 * Entry: lắp ráp các module và chạy vòng lặp. Logic chi tiết nằm trong từng module.
 */

// ── 3D ──────────────────────────────────────────────────────────────────
const world = createWorld(document.getElementById('canvas-container'));
const { sun } = setupLights(world.scene, world.renderer);
const island = setupIsland(world.scene);

const mascot = createMascot();
world.scene.add(mascot.object);
const wardrobe = createWardrobe(mascot);

// ── Dữ liệu người chơi ──────────────────────────────────────────────────
initProgress();
wardrobe.equipAll(getState().equipped);

function refreshHud() {
  const state = getState();
  renderHud({
    xp: state.xp,
    coins: state.coins,
    streak: getActiveStreak(),
    rankInfo: getRankInfo(state.xp),
    golden: isGoldenHour(),
    canCheckIn: !hasCheckedInToday(),
  });
}
onProgressChange(refreshHud);
refreshHud();
setInterval(refreshHud, 60_000); // cập nhật Giờ Vàng

// ── Tương tác ───────────────────────────────────────────────────────────
/** Cảm xúc ngẫu nhiên khi chạm vào Kỳ lân. */
const TAP_EMOTES = ['wave', 'happy', 'cool', 'think', 'cheer'];

world.onTap(mascot.object, () => {
  mascot.emote(pick(TAP_EMOTES));
  say(pick(MASCOT_LINES));
});

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/** Hiển thị thưởng chung (toast + ăn mừng + lên hạng). */
async function announceReward(reward, label) {
  if (reward.xp || reward.coins) {
    const golden = reward.golden ? ' ⏰x2' : '';
    showToast(`${label}: +${formatNumber(reward.xp)} XP${golden}, +${formatNumber(reward.coins)} Xu`, {
      type: 'success',
      icon: '🎁',
    });
  }
  if (reward.rankUp) {
    const { to, items } = reward.rankUp;
    mascot.emote('cheer');
    const gift = items.length ? ` Bạn nhận được: ${items.map((i) => i.name).join(', ')} — xem trong Tủ đồ!` : '';
    await celebrateDialog({
      icon: to.icon,
      title: `Lên hạng ${to.name}!`,
      message: `Chúc mừng! Kỳ lân của bạn đã đạt hạng ${to.name}.${gift}`,
    });
  }
}

// ── Khám phá Vùng Đất: chạy, câu hỏi theo quãng đường, cột Vùng Đất, xu & hộp quà ──
const explore = createExplore({
  world,
  island,
  mascot,
  sun,
  onRankUp: (reward) => announceReward({ ...reward, xp: 0, coins: 0 }, ''),
});

const actions = {
  async checkin() {
    const result = checkIn();
    if (!result) {
      showToast('Hôm nay bạn đã điểm danh rồi. Hẹn gặp lại ngày mai nhé!', { icon: '📅' });
      mascot.emote('wave');
      return;
    }
    mascot.emote('cheer');
    say(`Điểm danh thành công! Chuỗi ${result.streak} ngày 🔥 — Trách nhiệm là giữ lời hứa với chính mình!`);
    await announceReward(result, 'Điểm danh');
  },

  quiz() {
    openQuiz({
      rewardedLeft: rewardedRoundsLeft,
      createRound: () => createQuizRound(),
      onAnswer: (correct) => mascot.emote(correct ? 'happy' : 'oops'),
      onComplete: (result) => {
        const reward = completeQuizRound(result);
        const ratio = result.correct / result.total;
        if (result.timedOut) {
          mascot.emote('faint');
          say('Hết giờ rồi… xỉu mất! Lần sau mình nhanh tay hơn nhé! 😵');
        } else if (reward.perfect) {
          mascot.emote('cheer');
          say('Đúng hết luôn! Bạn đúng là Kỳ lân Tri Thức! 🏆');
        } else if (ratio < 0.4) {
          mascot.emote('cry');
          say('Huhu… không sao đâu, thử sai là cách mình lớn lên mà! 🌱');
        } else {
          mascot.emote('happy');
        }
        if (reward.rankUp) announceReward({ ...reward, xp: 0, coins: 0 }, '');
        return reward;
      },
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
        if (status === 'tooPoor') {
          showToast(`Cần thêm ${formatNumber(item.price - getState().coins)} Xu. Làm Quiz Tri Thức để kiếm Xu nhé!`, {
            type: 'warn',
            icon: '🪙',
          });
          wardrobe.equip(item.id); // cho mặc thử
          mascot.emote('cry');
          setTimeout(() => wardrobe.equip(getState().equipped[item.slot]), 2500);
          return;
        }
        if (status === 'buyable') {
          wardrobe.equip(item.id); // xem trước trên nhân vật
          const ok = await confirmDialog({
            icon: '🛍️',
            title: `Mua "${item.name}"?`,
            message: `Giá ${formatNumber(item.price)} Xu. Bạn đang có ${formatNumber(getState().coins)} Xu.`,
            confirmText: 'Mua & mặc',
          });
          if (!ok || !buyItem(item.id)) {
            wardrobe.equip(getState().equipped[item.slot]);
            return;
          }
          showToast(`Đã mua "${item.name}"!`, { type: 'success', icon: '🛍️' });
          mascot.emote('cool');
        } else {
          mascot.emote('happy');
        }
        equipItem(item.id);
        wardrobe.equip(item.id);
        view.refresh();
      },
    });
    // Gọi sau openWardrobe: mở bảng mới sẽ đóng bảng cũ (và onClose của nó).
    world.setPanelFocus(true);
  },

  ranks() {
    const state = getState();
    openRanks({ xp: state.xp, streak: getActiveStreak(), stats: state.stats });
  },
};

document.querySelectorAll('[data-action]').forEach((btn) => {
  btn.addEventListener('click', () => actions[btn.dataset.action]());
});
onRankCardClick(actions.ranks);

// ── Animation loop ──────────────────────────────────────────────────────
const timer = new THREE.Timer();
timer.connect(document); // tạm dừng delta khi tab bị ẩn
const headPos = new THREE.Vector3();

world.renderer.setAnimationLoop((timestamp) => {
  timer.update(timestamp);
  const delta = timer.getDelta();
  const elapsed = timer.getElapsed();

  explore.update(delta, elapsed);
  mascot.update(delta, elapsed);
  wardrobe.update(delta, elapsed);
  island.update(delta, elapsed);
  world.controls.update();
  world.update(delta);

  mascot.headWorldPosition(headPos);
  headPos.y += 1.0; // phía trên bờm
  const p = world.toScreen(headPos);
  setSpeechAnchor(p.x, p.y);

  world.renderer.render(world.scene, world.camera);
});

hideLoading();
setTimeout(() => {
  mascot.emote('wave');
  say(hasCheckedInToday() ? 'Chào mừng trở lại! Làm một lượt Tri Thức nhé?' : 'Xin chào! Bấm "Điểm danh" để nhận quà hôm nay nhé! 🎁');
}, 700);
