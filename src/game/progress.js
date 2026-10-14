import { CHECK_IN, EXPLORE, GOLDEN_HOURS, QUIZ, SAVE_KEY, VALUES } from '../config.js';
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
    daily: createDaily(),
    stats: { answered: 0, correct: 0, rounds: 0, distance: 0 },
  };
}

/** Giới hạn & tiến độ trong ngày (reset mỗi ngày). */
function createDaily() {
  return {
    day: dayKey(),
    checkedIn: false,
    rewardedRounds: 0,
    runQuestions: 0,
    stations: [],
    allStationsBonus: false,
    coinPickups: 0,
    gifts: 0,
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
    state.daily = createDaily();
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

// ── Chế độ Khám phá Vùng Đất ──────────────────────────────────────────────

/**
 * Cộng quãng đường đã chạy (gọi theo từng chặng ngắn, không gọi mỗi frame).
 *
 * @param {number} meters
 */
export function addDistance(meters) {
  state.stats.distance += meters;
  persist();
}

/** @returns {number} số câu hỏi nhanh (khi chạy) còn được thưởng hôm nay */
export function runQuestionsLeft() {
  rollDailyIfNeeded();
  return Math.max(0, EXPLORE.RUN_QUESTIONS_REWARDED_PER_DAY - state.daily.runQuestions);
}

/**
 * Trả lời câu hỏi nhanh xuất hiện mỗi chặng đường.
 *
 * @param {boolean} correct
 * @returns {ReturnType<typeof grantReward> & { rewarded: boolean }}
 */
export function completeRunQuestion(correct) {
  recordAnswer(correct);
  if (runQuestionsLeft() <= 0) {
    persist();
    return { xp: 0, coins: 0, golden: false, rankUp: null, rewarded: false };
  }
  state.daily.runQuestions += 1;
  const reward = correct
    ? grantReward({ xp: EXPLORE.RUN_QUESTION_XP, coins: EXPLORE.RUN_QUESTION_COINS })
    : grantReward({ xp: EXPLORE.RUN_QUESTION_TRY_XP });
  return { ...reward, rewarded: true };
}

/**
 * @param {string} valueId
 * @returns {boolean} hôm nay đã làm thử thách ở cột Vùng Đất này chưa
 */
export function isStationDone(valueId) {
  rollDailyIfNeeded();
  return state.daily.stations.includes(valueId);
}

/** @returns {number} số Vùng Đất đã ghé hôm nay */
export function stationsDoneCount() {
  rollDailyIfNeeded();
  return state.daily.stations.length;
}

/**
 * Hoàn thành thử thách ở cột Vùng Đất (mỗi cột 1 lần có thưởng / ngày).
 * Ghé đủ 5 Vùng Đất trong ngày được thưởng thêm "Nhà thám hiểm".
 *
 * @param {string} valueId
 * @param {boolean} correct
 * @returns {null | (ReturnType<typeof grantReward> & { allStations: null | ReturnType<typeof grantReward> })}
 *   null nếu hôm nay đã làm cột này
 */
export function completeStation(valueId, correct) {
  if (isStationDone(valueId)) return null;
  recordAnswer(correct);
  state.daily.stations.push(valueId);
  const reward = correct
    ? grantReward({ xp: EXPLORE.STATION_XP, coins: EXPLORE.STATION_COINS })
    : grantReward({ xp: EXPLORE.STATION_TRY_XP });

  let allStations = null;
  if (state.daily.stations.length >= VALUES.length && !state.daily.allStationsBonus) {
    state.daily.allStationsBonus = true;
    allStations = grantReward({ xp: EXPLORE.ALL_STATIONS_XP, coins: EXPLORE.ALL_STATIONS_COINS });
  }
  return { ...reward, allStations };
}

/** @returns {number} số xu vàng còn nhặt được hôm nay */
export function coinPickupsLeft() {
  rollDailyIfNeeded();
  return Math.max(0, EXPLORE.COIN_PICKUPS_PER_DAY - state.daily.coinPickups);
}

/**
 * Nhặt 1 xu vàng trên đường.
 *
 * @returns {boolean} có được cộng xu không (hết giới hạn ngày thì không)
 */
export function collectCoin() {
  if (coinPickupsLeft() <= 0) return false;
  state.daily.coinPickups += 1;
  state.coins += 1;
  persist();
  return true;
}

/** @returns {number} số hộp quà còn mở được hôm nay */
export function giftsLeft() {
  rollDailyIfNeeded();
  return Math.max(0, EXPLORE.GIFTS_PER_DAY - state.daily.gifts);
}

/**
 * Mở hộp quà bất ngờ: Xu, XP, hoặc (hiếm) một món trang phục chưa có — miễn phí.
 *
 * @returns {null | { kind: 'coins' | 'xp' | 'item', amount: number, item: object | null,
 *   reward: ReturnType<typeof grantReward> }}
 */
export function openGift() {
  if (giftsLeft() <= 0) return null;
  state.daily.gifts += 1;

  const roll = Math.random();
  if (roll >= EXPLORE.GIFT_COIN_CHANCE + EXPLORE.GIFT_XP_CHANCE) {
    const candidates = ITEMS.filter((item) => item.price > 0 && !item.rank && !state.owned.includes(item.id));
    if (candidates.length) {
      const item = candidates[Math.floor(Math.random() * candidates.length)];
      state.owned.push(item.id);
      return { kind: 'item', amount: 0, item, reward: grantReward({}) };
    }
  }
  if (roll < EXPLORE.GIFT_COIN_CHANCE || roll >= EXPLORE.GIFT_COIN_CHANCE + EXPLORE.GIFT_XP_CHANCE) {
    const amount = 5 + Math.floor(Math.random() * 11);
    return { kind: 'coins', amount, item: null, reward: grantReward({ coins: amount }) };
  }
  const amount = 5 + Math.floor(Math.random() * 8);
  const reward = grantReward({ xp: amount });
  return { kind: 'xp', amount: reward.xp, item: null, reward };
}

function recordAnswer(correct) {
  state.stats.answered += 1;
  if (correct) state.stats.correct += 1;
}
