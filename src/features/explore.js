import { EXPLORE, VALUES } from '../config.js';
import {
  addDistance,
  coinPickupsLeft,
  collectCoin,
  completeRunQuestion,
  completeStation,
  getState,
  giftsLeft,
  isStationDone,
  openGift,
  stationsDoneCount,
} from '../game/progress.js';
import { pickQuestion } from '../game/quiz.js';
import { createMovement } from '../scene/movement.js';
import { createPickups } from '../scene/pickups.js';
import { initControls, readInput, setControlsEnabled } from '../ui/controls.js';
import { celebrateDialog, isDialogOpen, say, showToast } from '../ui/feedback.js';
import { onHomeClick, renderExploreHud } from '../ui/hud.js';
import { openQuickQuestion } from '../ui/quickQuestionView.js';
import { isSheetOpen } from '../ui/sheet.js';

/** Lưu quãng đường vào bộ nhớ sau mỗi chặng này (m), không lưu mỗi frame. */
const SAVE_DISTANCE_EVERY_M = 10;
const SUN_OFFSET = { x: 5, y: 10, z: 6 };

/**
 * Chế độ Khám phá Vùng Đất — điều phối di chuyển (scene), luật thưởng (game) và giao diện (ui):
 * chạy bằng phím / cần điều khiển, câu hỏi mỗi 100 m, thử thách ở 5 cột Vùng Đất,
 * nhặt xu vàng, mở hộp quà bất ngờ.
 *
 * @param {{
 *   world: ReturnType<typeof import('../scene/world.js').createWorld>,
 *   island: ReturnType<typeof import('../scene/island.js').setupIsland>,
 *   mascot: ReturnType<typeof import('../scene/mascot.js').createMascot>,
 *   sun: import('three').DirectionalLight,
 *   onRankUp: (reward: object) => void,
 * }} deps
 * @returns {{ update: (delta: number, elapsed: number) => void }}
 */
export function createExplore({ world, island, mascot, sun, onRankUp }) {
  const movement = createMovement(mascot, island, world.camera);
  const player = mascot.object.position;

  let unsavedDistance = 0;
  let sinceQuestion = 0;
  let insideStation = null;
  let coinLimitNotified = false;
  let lastHud = '';

  island.stations.forEach((s) => island.setStationDone(s.id, isStationDone(s.id)));

  initControls({
    onFirstMove: () => say('Đi thôi! Chạy tới các cột màu để nhận thử thách Vùng Đất nhé! 🗺️'),
  });
  onHomeClick(() => {
    movement.teleport(0, 0);
    mascot.emote('wave');
    say('Về Quảng trường rồi! 🏠');
  });

  const pickups = createPickups(world.scene, island, {
    onCoin: () => {
      const ok = collectCoin();
      if (!ok && !coinLimitNotified) {
        coinLimitNotified = true;
        showToast('Hôm nay đã nhặt đủ xu rồi. Mai quay lại nhé!', { icon: '🪙' });
      }
      return ok;
    },
    canSpawnGift: () => giftsLeft() > 0,
    onGift: () => handleGift(),
  });

  // ── Câu hỏi & thử thách (mở bảng bên, Kỳ lân suy nghĩ) ────────────────
  function ask({ title, intro, accent, question, onAnswer }) {
    openQuickQuestion({
      title,
      intro,
      accent,
      question,
      onAnswer: (correct) => {
        mascot.emote(correct ? 'happy' : 'oops');
        return onAnswer(correct);
      },
      onClose: () => {
        mascot.setMood(null);
        world.setPanelFocus(false);
      },
    });
    world.setPanelFocus(true);
    mascot.setMood('think');
    movement.faceCamera();
  }

  function askRunQuestion() {
    ask({
      title: '❓ Câu hỏi dọc đường',
      intro: `Bạn đã chạy thêm ${EXPLORE.QUESTION_EVERY_M} m! Trả lời nhanh để nhận thưởng nhé.`,
      question: pickQuestion(),
      onAnswer: (correct) => {
        const reward = completeRunQuestion(correct);
        if (reward.rankUp) onRankUp(reward);
        return reward;
      },
    });
  }

  function askStation(station) {
    const value = VALUES.find((v) => v.id === station.id);
    ask({
      title: `🏛️ Vùng Đất ${station.name}`,
      intro: `“${value.motto}” — trả lời đúng để chinh phục Vùng Đất này!`,
      accent: station.color,
      question: pickQuestion({ value: station.id }),
      onAnswer: (correct) => {
        const reward = completeStation(station.id, correct);
        island.setStationDone(station.id, true);
        if (!reward) return { xp: 0, coins: 0, rewarded: false };
        let extra = '';
        if (reward.allStations) {
          extra = `🏅 Nhà thám hiểm! Ghé đủ 5 Vùng Đất hôm nay: +${reward.allStations.xp} XP, +${reward.allStations.coins} Xu`;
          setTimeout(() => mascot.emote('cheer'), 900);
        }
        const rankUp = reward.rankUp ?? reward.allStations?.rankUp;
        if (rankUp) onRankUp({ rankUp });
        return { ...reward, extra };
      },
    });
  }

  async function handleGift() {
    const result = openGift();
    if (!result) return;
    movement.faceCamera();
    mascot.emote('cheer');
    const content = {
      coins: { icon: '🪙', title: `+${result.amount} Xu!`, message: 'Hộp quà bất ngờ chứa đầy xu vàng!' },
      xp: { icon: '⭐', title: `+${result.amount} XP!`, message: 'Hộp quà bất ngờ giúp Kỳ lân thêm kinh nghiệm!' },
      item: {
        icon: '🎁',
        title: `Quà hiếm: ${result.item?.name}!`,
        message: 'Bạn nhận được một món trang phục miễn phí — mở Tủ đồ để mặc thử nhé!',
      },
    }[result.kind];
    await celebrateDialog({
      ...content,
      message: `${content.message} (Còn ${giftsLeft()} hộp quà hôm nay)`,
    });
    if (result.reward.rankUp) onRankUp(result.reward);
  }

  // ── Mỗi frame ───────────────────────────────────────────────────────
  function update(delta, elapsed) {
    const busy = isSheetOpen() || isDialogOpen();
    setControlsEnabled(!busy);

    const moved = movement.update(delta, readInput());
    world.follow(player);
    sun.position.set(player.x + SUN_OFFSET.x, player.y + SUN_OFFSET.y, player.z + SUN_OFFSET.z);
    sun.target.position.copy(player);

    if (moved > 0) {
      unsavedDistance += moved;
      sinceQuestion += moved;
      if (unsavedDistance >= SAVE_DISTANCE_EVERY_M) {
        addDistance(unsavedDistance);
        unsavedDistance = 0;
      }
    }

    if (!busy) {
      if (sinceQuestion >= EXPLORE.QUESTION_EVERY_M) {
        sinceQuestion = 0;
        askRunQuestion();
      } else {
        checkStations();
      }
    }

    pickups.update(delta, elapsed, player, !busy);

    const hud = {
      distance: Math.floor(getState().stats.distance + unsavedDistance),
      toNextQuestion: Math.ceil(EXPLORE.QUESTION_EVERY_M - sinceQuestion),
      stationsDone: stationsDoneCount(),
      stationsTotal: VALUES.length,
    };
    const key = `${hud.distance}|${hud.toNextQuestion}|${hud.stationsDone}`;
    if (key !== lastHud) {
      lastHud = key;
      renderExploreHud(hud);
    }
  }

  function checkStations() {
    const station = island.stations.find(
      (s) => Math.hypot(player.x - s.position.x, player.z - s.position.z) < s.radius,
    );
    const id = station?.id ?? null;
    if (id === insideStation) return;
    insideStation = id;
    if (!station) return;
    if (isStationDone(station.id)) {
      mascot.emote('wave');
      say(`Hôm nay bạn đã chinh phục Vùng Đất ${station.name} rồi! Ghé vùng khác nhé.`);
      return;
    }
    askStation(station);
  }

  if (coinPickupsLeft() <= 0) coinLimitNotified = true;
  // Chỉ khi chạy `npm run dev`: hỗ trợ kiểm thử tự động (không có trong bản build).
  if (import.meta.env.DEV) window.__klt = { player, island, pickups, teleport: movement.teleport };
  return { update };
}
