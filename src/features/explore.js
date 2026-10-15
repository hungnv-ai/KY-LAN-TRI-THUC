import * as THREE from 'three';
import { sfx } from '../audio/sfx.js';
import { EXPLORE, VALUES } from '../config.js';
import {
  addDistance,
  answerQuestion,
  askQuestion,
  coinPickupsLeft,
  collectCoin,
  friendlyError,
  getState,
  giftsLeft,
  isStationDone,
  onProgressChange,
  openGift,
  stationsDoneCount,
} from '../game/progress.js';
import { createMovement } from '../scene/movement.js';
import { createPickups } from '../scene/pickups.js';
import { initControls, readInput, setControlsEnabled } from '../ui/controls.js';
import { isDialogOpen, say, showToast } from '../ui/feedback.js';
import { flyToHud } from '../ui/flyFx.js';
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
 *   fx: ReturnType<typeof import('../scene/fx.js').createFx>,
 *   onRankUp: (reward: object) => void,
 * }} deps
 * @returns {{ update: (delta: number, elapsed: number) => void, isMoving: () => boolean }}
 */
export function createExplore({ world, island, mascot, sun, fx, onRankUp }) {
  const movement = createMovement(mascot, island, world.camera);
  const player = mascot.object.position;

  let unsavedDistance = 0;
  let sinceQuestion = 0;
  let insideStation = null;
  let coinLimitNotified = false;
  let lastHud = '';
  let requesting = false; // đang chờ máy chủ phát câu hỏi
  let flushing = null;
  let moving = false;

  const syncStations = () => island.stations.forEach((s) => island.setStationDone(s.id, isStationDone(s.id)));
  syncStations();
  onProgressChange(syncStations);

  /** Gửi quãng đường chưa lưu lên bộ xử lý (theo đợt, không mỗi frame). */
  function flushDistance() {
    if (unsavedDistance <= 0) return flushing ?? Promise.resolve();
    const meters = unsavedDistance;
    unsavedDistance = 0;
    flushing = addDistance(meters)
      .catch(() => {})
      .finally(() => (flushing = null));
    return flushing;
  }

  initControls({
    onFirstMove: () => say('Đi thôi! Chạy tới các cột màu để nhận thử thách Vùng Đất nhé! 🗺️'),
  });
  onHomeClick(() => {
    movement.teleport(0, 0);
    mascot.emote('wave');
    say('Về Quảng trường rồi! 🏠');
  });

  const pickups = createPickups(world.scene, island, {
    onCoin: (pos) => {
      if (coinPickupsLeft() <= 0) {
        if (!coinLimitNotified) {
          coinLimitNotified = true;
          showToast('Hôm nay đã nhặt đủ xu rồi. Mai quay lại nhé!', { icon: '🪙' });
        }
        return false;
      }
      // "Nạp tiền" hiện ngay (không chờ máy chủ): tia sáng vàng, chữ +1, xu bay vào ô Xu.
      sfx.coin();
      fx.burst(pos, { colors: ['#FFD86B', '#F5C542', '#FFFFFF'], count: 14, speed: 2, up: 2.5, size: 0.16, life: 0.6 });
      fx.floatText(pos.clone(), '+1', '#C49C57');
      flyToHud('coin', world.toScreen(pos), 1);
      collectCoin().catch(() => {});
      return true;
    },
    canSpawnGift: () => giftsLeft() > 0,
    onGift: (pos) => handleGift(pos),
  });

  // ── Câu hỏi & thử thách (mở bảng bên, Kỳ lân suy nghĩ) ────────────────
  function ask({ title, intro, accent, question, onResult }) {
    openQuickQuestion({
      title,
      intro,
      accent,
      question,
      answer: answerQuestion,
      onResult: (res) => {
        mascot.emote(res.correct ? 'happy' : 'oops');
        if (res.correct) {
          sfx.correct();
          fx.burst(headPosition().clone(), { count: 24, speed: 2.5, up: 3, life: 0.9 });
        } else {
          sfx.wrong();
        }
        const reward = res.reward;
        if (reward?.coins) setTimeout(() => flyToHud('coin', world.toScreen(headPosition()), Math.min(reward.coins, 6)), 200);
        if (reward?.xp) flyToHud('xp', world.toScreen(headPosition()), Math.min(Math.ceil(reward.xp / 3), 5));
        return onResult?.(res);
      },
      onError: (err) => showToast(friendlyError(err), { type: 'warn', icon: '⚠️' }),
      onClose: () => {
        mascot.setMood(null);
        world.setPanelFocus(false);
      },
    });
    world.setPanelFocus(true);
    mascot.setMood('think');
    movement.faceCamera();
    sfx.pop();
  }

  const headTmp = new THREE.Vector3();
  function headPosition() {
    return headTmp.set(player.x, player.y + 2.6, player.z);
  }

  /** Xin câu hỏi từ bộ xử lý; trong lúc chờ không kích hoạt thêm. */
  async function request(fn) {
    if (requesting) return null;
    requesting = true;
    try {
      return await fn();
    } catch (err) {
      if (!String(err?.message).includes('not_enough_distance')) {
        showToast(friendlyError(err), { type: 'warn', icon: '⚠️' });
      }
      return null;
    } finally {
      requesting = false;
    }
  }

  async function askRunQuestion() {
    const question = await request(async () => {
      await flushDistance();
      return askQuestion('run');
    });
    if (!question?.ticketId) return;
    ask({
      title: '❓ Câu hỏi dọc đường',
      intro: `Bạn đã chạy thêm ${EXPLORE.QUESTION_EVERY_M} m! Trả lời nhanh để nhận thưởng nhé.`,
      question,
      onResult: (res) => {
        if (res.reward?.rankUp) onRankUp(res.reward);
      },
    });
  }

  async function askStation(station) {
    const value = VALUES.find((v) => v.id === station.id);
    const question = await request(() => askQuestion('station', station.id));
    if (!question) return;
    if (question.done) {
      island.setStationDone(station.id, true);
      return;
    }
    ask({
      title: `🏛️ Vùng Đất ${station.name}`,
      intro: `“${value.motto}” — trả lời đúng để chinh phục Vùng Đất này!`,
      accent: station.color,
      question,
      onResult: (res) => {
        island.setStationDone(station.id, true);
        const reward = res.reward;
        if (!reward) return '';
        let extra = '';
        if (reward.allStations) {
          extra = `🏅 Nhà thám hiểm! Ghé đủ 5 Vùng Đất hôm nay: +${reward.allStations.xp} XP, +${reward.allStations.coins} Xu`;
          setTimeout(() => {
            mascot.emote('cheer');
            sfx.rankUp();
            fx.celebrate(mascot.object, { color: '#FFD86B' });
          }, 900);
        }
        const rankUp = reward.rankUp ?? reward.allStations?.rankUp;
        if (rankUp) onRankUp({ rankUp });
        return extra;
      },
    });
  }

  /**
   * Mở hộp quà ngay trên đảo — không dùng hộp thoại che Kỳ lân. Hiệu ứng "nạp quà":
   * cột sáng, vòng sóng lan toả, pháo hoa 5 màu, tia sáng xoáy quanh Kỳ lân, chữ thưởng bay lên,
   * xu / sao bay vào ví.
   */
  async function handleGift(giftPos) {
    let result;
    try {
      result = await openGift();
    } catch (err) {
      showToast(friendlyError(err), { type: 'warn', icon: '⚠️' });
      return;
    }
    if (!result) return;
    movement.faceCamera();
    mascot.emote('cheer');
    sfx.gift();
    fx.burst(new THREE.Vector3(giftPos.x, giftPos.y + 0.6, giftPos.z), { count: 30, speed: 3, up: 4, life: 0.9 });
    fx.celebrate(mascot.object, { color: '#FFD86B' });

    const left = giftsLeft();
    const label = {
      coins: `+${result.amount} Xu`,
      xp: `+${result.amount} XP`,
      item: `🎁 ${result.item?.name}`,
      voucher: '🎟️ Phiếu quà!',
    }[result.kind];
    setTimeout(() => fx.floatText(headPosition().clone().setY(player.y + 2.0), label, result.kind === 'xp' ? '#1750B5' : '#9A0036'), 250);

    if (result.kind === 'coins') {
      setTimeout(() => {
        flyToHud('coin', world.toScreen(headPosition()), result.amount);
        sfx.coins(result.amount);
      }, 500);
      showToast(`Hộp quà bất ngờ: +${result.amount} Xu · còn ${left} hộp hôm nay`, { type: 'success', icon: '🎁' });
    } else if (result.kind === 'xp') {
      setTimeout(() => flyToHud('xp', world.toScreen(headPosition()), 6), 500);
      showToast(`Hộp quà bất ngờ: +${result.amount} XP · còn ${left} hộp hôm nay`, { type: 'success', icon: '🎁' });
    } else if (result.kind === 'voucher') {
      say('Trúng PHIẾU QUÀ hiện vật! Chờ Ban Giám hiệu duyệt rồi nhận quà nhé! 🎟️');
      showToast('Bạn trúng Phiếu quà may mắn — xem trong mục Hạng › Phiếu quà', { type: 'success', icon: '🎟️' });
    } else {
      say(`Quà hiếm: ${result.item.name}! Mở Tủ đồ để mặc thử nhé! 👕`);
      showToast(`Quà hiếm: ${result.item.name} đã vào Tủ đồ! · còn ${left} hộp hôm nay`, { type: 'success', icon: '🎁' });
    }
    if (result.reward.rankUp) setTimeout(() => onRankUp(result.reward), 1800);
  }

  // ── Mỗi frame ───────────────────────────────────────────────────────
  function update(delta, elapsed) {
    const busy = isSheetOpen() || isDialogOpen();
    setControlsEnabled(!busy);

    const moved = movement.update(delta, readInput());
    world.follow(player);
    sun.position.set(player.x + SUN_OFFSET.x, player.y + SUN_OFFSET.y, player.z + SUN_OFFSET.z);
    sun.target.position.copy(player);

    moving = moved > 0.001;
    if (moved > 0) {
      unsavedDistance += moved;
      sinceQuestion += moved;
      if (unsavedDistance >= SAVE_DISTANCE_EVERY_M && !flushing) flushDistance();
    }

    if (!busy && !requesting) {
      if (sinceQuestion >= EXPLORE.QUESTION_EVERY_M) {
        sinceQuestion = 0;
        askRunQuestion();
      } else {
        checkStations();
      }
    }

    pickups.update(delta, elapsed, player, !busy);

    const hud = {
      distance: Math.floor(Number(getState().stats.distance) + unsavedDistance),
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
  if (import.meta.env.DEV) window.__klt = { player, island, pickups, world, fx, teleport: movement.teleport };
  window.addEventListener('pagehide', () => flushDistance());
  /** Dịch chuyển Kỳ lân tới cạnh một vị trí (vd tới chỗ bạn bè). */
  function teleportNear(x, z) {
    movement.teleport(x + 1.6, z + 1.2);
    mascot.emote('wave');
  }

  return { update, isMoving: () => moving, teleportNear };
}
