import { CHECK_IN, GOLDEN_HOURS, QUIZ, SAVE_KEY } from '../config.js';
import { DEFAULT_EQUIPPED, ITEMS, STARTER_ITEMS, getItem } from '../data/items.js';
import { getRankInfo, rankIndexOf } from '../data/ranks.js';
import { loadJSON, saveJSON } from './storage.js';
import { dayKey, isGoldenHour, yesterdayKey } from './time.js';

/**
 * Tiến trình người chơi: XP, Xu, hạng, tủ đồ, chuỗi ngày, giới hạn hằng ngày.
 *
 * GĐ1 lưu trên trình duyệt nên người rành kỹ thuật có thể sửa điểm. GĐ2 chuyển việc
 * tính điểm sang server (Supabase) — giữ nguyên API của module này để UI không phải sửa.
 */

/** @typedef {ReturnType<typeof createInitialState>} PlayerState */

function createInitialState() {
  return {
    xp: 0,
    coins: 50,
    owned: [...STARTER_ITEMS],
    equipped: { ...DEFAULT_EQUIPPED },
    streak: { count: 0, lastDay: null },
    daily: { day: dayKey(), checkedIn: false, rewardedRounds: 0 },
    stats: { answered: 0, correct: 0, rounds: 0 },
  };
}

let state = createInitialState();
const listeners = new Set();

/** Nạp dữ liệu đã lưu (gọi một lần lúc khởi động). */
export function initProgress() {
  const saved = loadJSON(SAVE_KEY);
  if (saved) {
    const base = createInitialState();
    state = {
      ...base,
      ...saved,
      equipped: { ...base.equipped, ...saved.equipped },
      streak: { ...base.streak, ...saved.streak },
      daily: { ...base.daily, ...saved.daily },
      stats: { ...base.stats, ...saved.stats },
    };
  }
  rollDailyIfNeeded();
  grantRankRewards();
  persist();
}

/** @returns {Readonly<PlayerState>} */
export function getState() {
  return state;
}

/**
 * Đăng ký nhận thông báo khi dữ liệu thay đổi.
 *
 * @param {(state: PlayerState) => void} fn
 * @returns {() => void} hàm huỷ đăng ký
 */
export function onProgressChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function persist() {
  saveJSON(SAVE_KEY, state);
  listeners.forEach((fn) => fn(state));
}

/** Sang ngày mới thì reset giới hạn hằng ngày. */
function rollDailyIfNeeded() {
  const today = dayKey();
  if (state.daily.day !== today) {
    state.daily = { day: today, checkedIn: false, rewardedRounds: 0 };
  }
}

/** Tự trao các món đồ phần thưởng hạng mà người chơi đã đủ điều kiện. */
function grantRankRewards() {
  const { index } = getRankInfo(state.xp);
  const unlocked = [];
  for (const item of ITEMS) {
    if (item.rank && rankIndexOf(item.rank) <= index && !state.owned.includes(item.id)) {
      state.owned.push(item.id);
      unlocked.push(item);
    }
  }
  return unlocked;
}

/**
 * Cộng thưởng. XP được nhân Giờ Vàng.
 *
 * @param {{ xp?: number, coins?: number }} reward
 * @returns {{ xp: number, coins: number, golden: boolean, rankUp: null | { from: object, to: object, items: object[] } }}
 */
export function grantReward({ xp = 0, coins = 0 }) {
  rollDailyIfNeeded();
  const golden = isGoldenHour();
  const xpGained = golden ? xp * GOLDEN_HOURS.XP_MULTIPLIER : xp;

  const before = getRankInfo(state.xp);
  state.xp += xpGained;
  state.coins += coins;
  const after = getRankInfo(state.xp);

  let rankUp = null;
  if (after.index > before.index) {
    rankUp = { from: before.rank, to: after.rank, items: grantRankRewards() };
  }
  persist();
  return { xp: xpGained, coins, golden, rankUp };
}

/** @returns {boolean} hôm nay đã điểm danh chưa */
export function hasCheckedInToday() {
  rollDailyIfNeeded();
  return state.daily.checkedIn;
}

/**
 * Chuỗi ngày hiển thị: nếu bỏ lỡ hơn 1 ngày thì chuỗi coi như đã đứt (0).
 *
 * @returns {number}
 */
export function getActiveStreak() {
  const { count, lastDay } = state.streak;
  return lastDay === dayKey() || lastDay === yesterdayKey() ? count : 0;
}

/**
 * Điểm danh hằng ngày (Trách Nhiệm).
 *
 * @returns {null | (ReturnType<typeof grantReward> & { streak: number })} null nếu đã điểm danh hôm nay
 */
export function checkIn() {
  if (hasCheckedInToday()) return null;

  const streak = getActiveStreak() + 1;
  state.streak = { count: streak, lastDay: dayKey() };
  state.daily.checkedIn = true;

  const bonusDays = Math.min(streak, CHECK_IN.STREAK_BONUS_MAX_DAYS);
  const result = grantReward({
    xp: CHECK_IN.XP,
    coins: CHECK_IN.COINS + bonusDays * CHECK_IN.STREAK_BONUS_COINS_PER_DAY,
  });
  return { ...result, streak };
}

/** @returns {number} số lượt quiz có thưởng còn lại hôm nay */
export function rewardedRoundsLeft() {
  rollDailyIfNeeded();
  return Math.max(0, QUIZ.REWARDED_ROUNDS_PER_DAY - state.daily.rewardedRounds);
}

/**
 * Ghi nhận kết thúc một lượt quiz và trao thưởng (nếu còn lượt có thưởng).
 *
 * @param {{ correct: number, total: number }} result
 * @returns {ReturnType<typeof grantReward> & { rewarded: boolean, perfect: boolean }}
 */
export function completeQuizRound({ correct, total }) {
  rollDailyIfNeeded();
  state.stats.answered += total;
  state.stats.correct += correct;
  state.stats.rounds += 1;

  const perfect = correct === total;
  if (rewardedRoundsLeft() <= 0) {
    persist();
    return { xp: 0, coins: 0, golden: false, rankUp: null, rewarded: false, perfect };
  }

  state.daily.rewardedRounds += 1;
  const wrong = total - correct;
  const reward = grantReward({
    xp: correct * QUIZ.XP_PER_CORRECT + wrong * QUIZ.XP_PER_TRY + (perfect ? QUIZ.PERFECT_BONUS_XP : 0),
    coins: correct * QUIZ.COINS_PER_CORRECT + (perfect ? QUIZ.PERFECT_BONUS_COINS : 0),
  });
  return { ...reward, rewarded: true, perfect };
}

/**
 * Trạng thái một món đồ với người chơi hiện tại.
 *
 * @param {object} item
 * @returns {'equipped' | 'owned' | 'buyable' | 'tooPoor' | 'locked'}
 */
export function itemStatus(item) {
  if (state.equipped[item.slot] === item.id) return 'equipped';
  if (state.owned.includes(item.id)) return 'owned';
  if (item.rank) return 'locked';
  return state.coins >= item.price ? 'buyable' : 'tooPoor';
}

/**
 * Mua một món đồ bằng Xu.
 *
 * @param {string} itemId
 * @returns {boolean} thành công hay không
 */
export function buyItem(itemId) {
  const item = getItem(itemId);
  if (!item || itemStatus(item) !== 'buyable') return false;
  state.coins -= item.price;
  state.owned.push(item.id);
  persist();
  return true;
}

/**
 * Mặc một món đồ đã sở hữu.
 *
 * @param {string} itemId
 * @returns {boolean}
 */
export function equipItem(itemId) {
  const item = getItem(itemId);
  if (!item || !state.owned.includes(itemId)) return false;
  state.equipped[item.slot] = itemId;
  persist();
  return true;
}
