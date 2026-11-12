import { sfx } from '../audio/sfx.js';
import { FEED, QUESTS } from '../config.js';
import { completeQuest, feedAnimal, feedsToday, friendlyError, getQuests, onProgressChange } from '../game/progress.js';
import { loadJSON, saveJSON } from '../game/storage.js';
import { dayKey } from '../game/time.js';
import { BRIDGE, HILLS, LANDMARKS, RING_PATH_RADIUS, terrainHeight } from '../scene/islandLayout.js';
import { isDialogOpen, say, showToast } from '../ui/feedback.js';
import { hideInteract, showInteract } from '../ui/interactPrompt.js';
import { isSheetOpen } from '../ui/sheet.js';

/** Đứng trong bán kính này (m) quanh điểm nhấn thì tính là đã ghé. */
const VISIT_RADIUS = { windmill: 5, camp: 4.5, gazebo: 3.2, rockGarden: 5.5, lighthouse: 4.5, hilltop: 2.8 };
/** Đi được tới quãng giữa cầu (m quanh tâm cầu) & đủ cao → "đi qua cầu". */
const BRIDGE_MID_RADIUS = 1.6;
/** Đi trên đường vòng: lệch khỏi đường quá mức này (m) thì vòng chạy bị tính lại từ đầu. */
const LAP_TOLERANCE = 4;
/** Thấy thỏ trong bán kính này (m) thì tính là "tìm được". */
const RABBIT_SPOT_RADIUS = 3.5;
const CHECK_SEC = 0.25;
const STORE_KEY = 'klt-explore-progress';
const ANIMAL_NAMES = { rabbit: 'thỏ', deer: 'hươu', duck: 'vịt' };
const ANIMAL_FOOD = { rabbit: '🥕', deer: '🌿', duck: '🍞' };

/**
 * Nhiệm vụ khám phá đảo (A) + cho thú ăn (B): phát hiện Kỳ lân tới điểm nhấn, lên đỉnh đồi, chạy một vòng,
 * tìm thỏ; hiện nút "Cho ăn" khi đứng gần thú. Máy chủ kiểm tra & trao thưởng (complete_quest / feed_animal).
 *
 * @param {{ mascot: { object: import('three').Object3D, emote: (n: string) => void },
 *   wildlife: ReturnType<typeof import('../scene/wildlife.js').createWildlife>,
 *   rewards: ReturnType<typeof import('./rewards.js').createRewards>,
 *   fx: ReturnType<typeof import('../scene/fx.js').createFx> }} deps
 * @returns {{ update: (delta: number) => void, progress: (id: string) => { value: number, need: number } | null,
 *   targets: () => { x: number, z: number }[] }}
 */
export function setupQuests({ mascot, wildlife, rewards, fx }) {
  const player = mascot.object.position;
  const hill = HILLS.find((hl) => hl.id === 'viewpoint');
  const places = {
    windmill: LANDMARKS.windmill,
    camp: LANDMARKS.camp,
    gazebo: LANDMARKS.gazebo,
    rockGarden: LANDMARKS.rockGarden,
    lighthouse: LANDMARKS.lighthouse,
    hilltop: hill,
    lake: { x: BRIDGE.x, z: BRIDGE.z },
  };

  // Tiến độ trong ngày (thỏ đã thấy, góc đã chạy quanh đảo) — lưu trên máy để tải lại trang không mất.
  let saved = loadJSON(STORE_KEY);
  if (!saved || saved.day !== dayKey()) saved = { day: dayKey(), rabbits: [], lap: 0 };
  const persist = () => saveJSON(STORE_KEY, saved);
  let lastAngle = null;
  const pending = new Set();
  let timer = 0;
  let feeding = false;
  let hinted = false;

  const activeQuest = (id) => getQuests().find((q) => q.id === id && !q.done);

  async function finish(id) {
    if (pending.has(id) || !activeQuest(id)) return;
    pending.add(id);
    try {
      const quest = activeQuest(id);
      const result = await completeQuest(id);
      if (result) {
        sfx.cheer();
        rewards.celebrate('#FFD86B');
        mascot.emote('cheer');
        say(`Hoàn thành nhiệm vụ khám phá: ${quest.icon} ${quest.label}!`);
        await rewards.announce(result, `${quest.icon} ${quest.label}`);
      }
    } catch (err) {
      if (!String(err?.message).includes('quest_not_ready')) console.warn('[quests]', err);
    } finally {
      pending.delete(id);
    }
  }

  function checkPlaces() {
    for (const [id, p] of Object.entries(places)) {
      if (!activeQuest(id)) continue;
      const d = Math.hypot(player.x - p.x, player.z - p.z);
      if (id === 'lake') {
        if (d < BRIDGE_MID_RADIUS && player.y > 0.9) finish(id);
      } else if (id === 'hilltop') {
        if (d < VISIT_RADIUS.hilltop && player.y > terrainHeight(hill.x, hill.z) - 0.6) finish(id);
      } else if (d < VISIT_RADIUS[id]) {
        finish(id);
      }
    }
  }

  function checkLap() {
    if (!activeQuest('lap')) return;
    const r = Math.hypot(player.x, player.z);
    if (Math.abs(r - RING_PATH_RADIUS) > LAP_TOLERANCE) {
      if (saved.lap !== 0) {
        saved.lap = 0;
        persist();
      }
      lastAngle = null;
      return;
    }
    const a = Math.atan2(player.x, player.z);
    if (lastAngle !== null) {
      const diff = Math.atan2(Math.sin(a - lastAngle), Math.cos(a - lastAngle));
      saved.lap += diff;
    }
    lastAngle = a;
    if (Math.abs(saved.lap) >= Math.PI * 2) finish('lap');
    persist();
  }

  function checkRabbits() {
    if (!activeQuest('rabbits')) return;
    let changed = false;
    for (const i of wildlife.rabbitsNear(player, RABBIT_SPOT_RADIUS)) {
      if (!saved.rabbits.includes(i)) {
        saved.rabbits.push(i);
        changed = true;
        showToast(`Tìm được chú thỏ thứ ${saved.rabbits.length}! 🐇`, { icon: '🐇' });
      }
    }
    if (changed) persist();
    const need = activeQuest('rabbits')?.need ?? QUESTS.CATALOG.find((q) => q.id === 'rabbits').need;
    if (saved.rabbits.length >= need) finish('rabbits');
  }

  async function doFeed(animal) {
    if (feeding) return;
    if (feedsToday() >= FEED.PER_DAY) {
      showToast('Các bạn thú đã no rồi — mai cho ăn tiếp nhé!', { icon: '😊' });
      return;
    }
    feeding = true;
    try {
      const result = await feedAnimal();
      if (!result) return;
      wildlife.feed(animal);
      sfx.pop();
      mascot.emote('happy');
      fx.burst(animal.position.clone().setY(animal.position.y + 0.6), { colors: ['#FF7FA8', '#FFFFFF', '#FFD54F'], count: 16, speed: 1.6, up: 2.2, size: 0.15, life: 0.8 });
      fx.floatText(animal.position.clone().setY(animal.position.y + 1.2), '❤️', '#E0463A');
      rewards.flyReward(result);
      showToast(`Cho ${ANIMAL_NAMES[animal.kind]} ăn: +${result.coins} Xu · còn ${FEED.PER_DAY - feedsToday()} lần hôm nay`, { type: 'success', icon: ANIMAL_FOOD[animal.kind] });
      const quest = activeQuest('feed');
      if (quest && feedsToday() >= quest.need) finish('feed');
    } catch (err) {
      showToast(friendlyError(err), { type: 'warn' });
    } finally {
      setTimeout(() => (feeding = false), FEED.COOLDOWN_SEC * 1000);
    }
  }

  function checkFeed() {
    const animal = isSheetOpen() || isDialogOpen() ? null : wildlife.nearestFeedable(player);
    if (!animal) {
      hideInteract();
      return;
    }
    if (!hinted) {
      hinted = true;
      say('Đi chậm lại gần thì thú không sợ — bấm nút để cho ăn nhé! 🥕');
    }
    showInteract({
      key: `${animal.kind}-${animal.index}-${feeding}`,
      icon: ANIMAL_FOOD[animal.kind],
      label: feeding ? 'Đang cho ăn…' : `Cho ${ANIMAL_NAMES[animal.kind]} ăn`,
      onClick: () => doFeed(animal),
    });
  }

  onProgressChange(() => {
    if (saved.day !== dayKey()) {
      saved = { day: dayKey(), rabbits: [], lap: 0 };
      persist();
    }
  });

  function update(delta) {
    timer -= delta;
    if (timer > 0) return;
    timer = CHECK_SEC;
    checkPlaces();
    checkLap();
    checkRabbits();
    checkFeed();
  }

  /** Tiến độ nhiệm vụ đếm được (thỏ, cho ăn, vòng chạy %). */
  function progress(id) {
    const need = QUESTS.CATALOG.find((q) => q.id === id)?.need ?? 1;
    if (id === 'rabbits') return { value: Math.min(need, saved.rabbits.length), need };
    if (id === 'feed') return { value: Math.min(need, feedsToday()), need };
    if (id === 'lap') return { value: Math.min(100, Math.round((Math.abs(saved.lap) / (Math.PI * 2)) * 100)), need: 100 };
    return null;
  }

  /** Vị trí các nhiệm vụ "ghé thăm" chưa xong hôm nay (để bản đồ nhỏ đánh dấu). */
  function targets() {
    return getQuests()
      .filter((q) => !q.done && places[q.id])
      .map((q) => ({ x: places[q.id].x, z: places[q.id].z }));
  }

  return { update, progress, targets };
}
