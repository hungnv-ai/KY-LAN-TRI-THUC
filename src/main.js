import * as THREE from 'three';
import { createWorld } from './scene/world.js';
import { setupLights } from './scene/lights.js';
import { setupStage } from './scene/stage.js';
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
setupLights(world.scene, world.renderer);
const stage = setupStage(world.scene);

const mascot = createMascot();
mascot.object.position.y = 0.18; // đứng trên bục
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
world.onTap(mascot.object, () => {
  mascot.wave();
  say(MASCOT_LINES[Math.floor(Math.random() * MASCOT_LINES.length)]);
});

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
    mascot.celebrate();
    const gift = items.length ? ` Bạn nhận được: ${items.map((i) => i.name).join(', ')} — xem trong Tủ đồ!` : '';
    await celebrateDialog({
      icon: to.icon,
      title: `Lên hạng ${to.name}!`,
      message: `Chúc mừng! Kỳ lân của bạn đã đạt hạng ${to.name}.${gift}`,
    });
  }
}

const actions = {
  async checkin() {
    const result = checkIn();
    if (!result) {
      showToast('Hôm nay bạn đã điểm danh rồi. Hẹn gặp lại ngày mai nhé!', { icon: '📅' });
      mascot.wave();
      return;
    }
    mascot.celebrate();
    say(`Điểm danh thành công! Chuỗi ${result.streak} ngày 🔥 — Trách nhiệm là giữ lời hứa với chính mình!`);
    await announceReward(result, 'Điểm danh');
  },

  quiz() {
    openQuiz({
      rewardedLeft: rewardedRoundsLeft,
      createRound: () => createQuizRound(),
      onAnswer: (correct) => (correct ? mascot.celebrate() : mascot.shake()),
      onComplete: (result) => {
        const reward = completeQuizRound(result);
        if (reward.rankUp) announceReward({ ...reward, xp: 0, coins: 0 }, '');
        return reward;
      },
    });
  },

  wardrobe() {
    const view = openWardrobe({
      getStatus: itemStatus,
      onSelect: async (item) => {
        const status = itemStatus(item);
        if (status === 'equipped') return;
        if (status === 'locked') {
          const rank = RANKS.find((r) => r.id === item.rank);
          showToast(`Đạt hạng ${rank.name} để mở khoá "${item.name}"!`, { type: 'warn', icon: '🔒' });
          return;
        }
        if (status === 'tooPoor') {
          showToast(`Cần thêm ${formatNumber(item.price - getState().coins)} Xu. Làm Quiz Tri Thức để kiếm Xu nhé!`, {
            type: 'warn',
            icon: '🪙',
          });
          wardrobe.equip(item.id); // cho mặc thử
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
        }
        equipItem(item.id);
        wardrobe.equip(item.id);
        mascot.celebrate();
        view.refresh();
      },
    });
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

  mascot.update(delta, elapsed);
  wardrobe.update(delta, elapsed);
  stage.update(delta, elapsed);
  world.controls.update();

  mascot.headWorldPosition(headPos);
  headPos.y += 1.0; // phía trên bờm
  const p = world.toScreen(headPos);
  setSpeechAnchor(p.x, p.y);

  world.renderer.render(world.scene, world.camera);
});

hideLoading();
setTimeout(() => {
  mascot.wave();
  say(hasCheckedInToday() ? 'Chào mừng trở lại! Làm một lượt Tri Thức nhé?' : 'Xin chào! Bấm "Điểm danh" để nhận quà hôm nay nhé! 🎁');
}, 700);
