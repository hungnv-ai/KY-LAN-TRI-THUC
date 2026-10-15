import {
  CHECK_IN,
  EXPLORE,
  GOLDEN_HOURS,
  MISSIONS,
  PETS_CONFIG,
  QUIZ,
  SAVE_KEY,
  VALUES,
} from '../config.js';
import { DEFAULT_EQUIPPED, ITEMS, STARTER_ITEMS, getItem } from '../data/items.js';
import { EVENT_QUESTIONS, activeEventId } from '../data/events.js';
import { PETS } from '../data/pets.js';
import { QUESTIONS } from '../data/questions.js';
import { getRankInfo, rankIndexOf } from '../data/ranks.js';
import { createLocalBell } from './localBell.js';
import { missionStatus } from './missions.js';
import { loadJSON, saveJSON } from './storage.js';
import { dayKey, isGoldenHour, yesterdayKey } from './time.js';

/**
 * Bộ xử lý NGOẠI TUYẾN: luật game chạy ngay trong trình duyệt, lưu localStorage.
 * Dùng khi chưa cấu hình Supabase. Mỗi hàm trả về cùng cấu trúc với hàm RPC trên máy chủ
 * (supabase/sql/03_player_rpc.sql) để progress.js không cần phân biệt.
 * Lưu ý: ở chế độ này người rành kỹ thuật có thể sửa điểm — chỉ dùng để chơi thử.
 */

const RECENT_LIMIT = 20;
/** Xác suất ưu tiên câu hỏi sự kiện khi sự kiện đang diễn ra. */
const EVENT_QUESTION_CHANCE = 0.4;

/**
 * Sự kiện đang diễn ra ở chế độ ngoại tuyến. Xem thử sự kiện trước ngày: thêm `?event=<id>` vào
 * địa chỉ (hoặc `?event=off` để tắt).
 */
function localActiveEvent() {
  let param = null;
  try {
    param = new URLSearchParams(window.location.search).get('event');
  } catch {
    /* không có window (kiểm thử) */
  }
  if (param === 'off') return null;
  return activeEventId(new Date(), param ? { mode: 'on', id: param } : null);
}
const HOUSES = VALUES.map((v) => v.id);

function createDaily() {
  return {
    day: dayKey(),
    checkedIn: false,
    rewardedRounds: 0,
    quizRounds: 0,
    runQuestions: 0,
    stations: [],
    allStationsBonus: false,
    coinPickups: 0,
    gifts: 0,
    distance: 0,
    distanceAtRunQ: 0,
    thanksSent: 0,
    heartsSent: 0,
    chestClaimed: false,
  };
}

function createInitialState() {
  return {
    xp: 0,
    coins: 50,
    owned: [...STARTER_ITEMS],
    equipped: { ...DEFAULT_EQUIPPED },
    streak: { count: 0, lastDay: null },
    pets: { owned: [], active: null, egg: 0, eggNeed: PETS_CONFIG.EGG_DAYS },
    daily: createDaily(),
    stats: { answered: 0, correct: 0, rounds: 0, distance: 0, heartsReceived: 0, thanksReceived: 0 },
    profile: {
      id: 'local',
      displayName: null,
      unit: null,
      role: 'player',
      house: HOUSES[Math.floor(Math.random() * HOUSES.length)],
    },
    rewardLog: [],
  };
}

/**
 * @returns {object} bộ xử lý với các hàm giống RPC máy chủ (trả về Promise)
 */
export function createLocalBackend() {
  let state = createInitialState();
  const tickets = new Map();
  const rounds = new Map();
  const recentlyAsked = [];

  const saved = loadJSON(SAVE_KEY);
  if (saved) {
    const base = createInitialState();
    state = {
      ...base,
      ...saved,
      equipped: { ...base.equipped, ...saved.equipped },
      streak: { ...base.streak, ...saved.streak },
      pets: { ...base.pets, ...saved.pets, eggNeed: PETS_CONFIG.EGG_DAYS },
      daily: { ...base.daily, ...saved.daily },
      stats: { ...base.stats, ...saved.stats },
      profile: { ...base.profile, ...saved.profile },
      rewardLog: saved.rewardLog ?? [],
    };
  }

  function rollDaily() {
    if (state.daily.day !== dayKey()) state.daily = createDaily();
  }

  /** Bản trạng thái gửi ra ngoài (giống _state_json trên máy chủ). */
  function snapshot() {
    rollDaily();
    saveJSON(SAVE_KEY, state);
    const { rewardLog: _log, ...rest } = state;
    return structuredClone({ ...rest, event: localActiveEvent(), daily: { ...rest.daily, missions: missionStatus(rest.daily) } });
  }

  function grantRankItems() {
    const { index } = getRankInfo(state.xp);
    const unlocked = [];
    for (const item of ITEMS) {
      if (item.rank && rankIndexOf(item.rank) <= index && !state.owned.includes(item.id)) {
        state.owned.push(item.id);
        unlocked.push({ id: item.id, name: item.name });
      }
    }
    return unlocked;
  }

  function applyReward(xp, coins, kind) {
    const golden = isGoldenHour() && xp > 0;
    const xpGained = golden ? xp * GOLDEN_HOURS.XP_MULTIPLIER : xp;
    const before = getRankInfo(state.xp);
    state.xp += xpGained;
    state.coins += coins;
    if (xpGained) {
      state.rewardLog.push({ t: Date.now(), xp: xpGained, kind });
      // Giữ nhật ký 35 ngày gần nhất (cho BXH tuần/tháng ở chế độ ngoại tuyến).
      const cutoff = Date.now() - 35 * 864e5;
      state.rewardLog = state.rewardLog.filter((e) => e.t >= cutoff);
    }
    const after = getRankInfo(state.xp);
    const rankUp = after.index > before.index ? { from: before.rank, to: after.rank, items: grantRankItems() } : null;
    return { xp: xpGained, coins, golden, rankUp };
  }

  const noReward = () => ({ xp: 0, coins: 0, golden: false, rankUp: null });

  /** Ấp trứng thêm 1 ngày; đủ ngày → nở thú cưng chưa có (giống _egg_tick trên máy chủ). */
  function eggTick() {
    const pets = state.pets;
    const need = PETS_CONFIG.EGG_DAYS;
    if (pets.egg + 1 < need) {
      pets.egg += 1;
      return { progress: pets.egg, need, hatched: null };
    }
    pets.egg = 0;
    const pool = PETS.filter((p) => !pets.owned.includes(p.id));
    if (!pool.length) {
      applyReward(0, PETS_CONFIG.DUPLICATE_COINS, 'egg');
      return { progress: 0, need, hatched: null, coins: PETS_CONFIG.DUPLICATE_COINS };
    }
    let roll = Math.random() * pool.reduce((sum, p) => sum + p.weight, 0);
    const pick = pool.find((p) => (roll -= p.weight) < 0) ?? pool[pool.length - 1];
    pets.owned.push(pick.id);
    pets.active ??= pick.id;
    return { progress: 0, need, hatched: { id: pick.id, name: pick.name, rarity: pick.rarity } };
  }

  function pickQuestion(station, exclude = []) {
    const event = localActiveEvent();
    if (!station && event && Math.random() < EVENT_QUESTION_CHANCE) {
      const eventPool = EVENT_QUESTIONS.filter((q) => q.event === event && !exclude.includes(q) && !recentlyAsked.includes(q));
      if (eventPool.length) {
        const q = eventPool[Math.floor(Math.random() * eventPool.length)];
        recentlyAsked.push(q);
        if (recentlyAsked.length > RECENT_LIMIT) recentlyAsked.shift();
        return q;
      }
    }
    let pool = QUESTIONS.filter(
      (q) => !station || q.value === station || (station === 'triThuc' && q.topic === 'general'),
    ).filter((q) => !exclude.includes(q));
    const fresh = pool.filter((q) => !recentlyAsked.includes(q));
    if (fresh.length) pool = fresh;
    const q = pool[Math.floor(Math.random() * pool.length)];
    recentlyAsked.push(q);
    if (recentlyAsked.length > RECENT_LIMIT) recentlyAsked.shift();
    return q;
  }

  function issueTicket(q, kind, station = null, roundId = null) {
    const order = q.a.map((_, i) => i).sort(() => Math.random() - 0.5);
    const ticketId = crypto.randomUUID();
    tickets.set(ticketId, { correctIndex: order.indexOf(0), kind, station, roundId, explain: q.explain, answered: false });
    return { ticketId, topic: q.topic, q: q.q, options: order.map((i) => q.a[i]) };
  }

  const bell = createLocalBell({
    pickQuestions: (n) => {
      const used = [];
      for (let i = 0; i < n; i++) used.push(pickQuestion(null, used));
      return used;
    },
    applyReward: (xp, coins, kind) => {
      const r = applyReward(xp, coins, kind);
      saveJSON(SAVE_KEY, state);
      return r;
    },
    myName: () => state.profile.displayName ?? 'Bạn',
  });

  const api = {
    mode: 'local',

    // ── Rung Chuông Vàng: ngoại tuyến chỉ có trận luyện tập với bạn ảo ──
    bellUpcoming: () => bell.upcoming(),
    bellPractice: () => bell.practice(),
    bellJoin: (gameId) => bell.join(gameId),
    bellState: (gameId) => bell.state(gameId),
    bellAnswer: (gameId, round, choice) => bell.answer(gameId, round, choice),

    async getState() {
      return snapshot();
    },

    async updateProfile(displayName, unit) {
      const name = String(displayName ?? '').replace(/\s+/g, ' ').trim();
      const u = String(unit ?? '').replace(/\s+/g, ' ').trim();
      if (name.length < 2 || name.length > 24) throw new Error('invalid_display_name');
      if (u.length < 1 || u.length > 24) throw new Error('invalid_unit');
      state.profile.displayName = name;
      state.profile.unit = u;
      return { state: snapshot() };
    },

    async claimCheckin() {
      rollDaily();
      if (state.daily.checkedIn) return { result: null, state: snapshot() };
      const { count, lastDay } = state.streak;
      const streak = lastDay === yesterdayKey() ? count + 1 : lastDay === dayKey() ? count : 1;
      state.streak = { count: streak, lastDay: dayKey() };
      state.daily.checkedIn = true;
      const bonus = Math.min(streak, CHECK_IN.STREAK_BONUS_MAX_DAYS) * CHECK_IN.STREAK_BONUS_COINS_PER_DAY;
      const r = applyReward(CHECK_IN.XP, CHECK_IN.COINS + bonus, 'checkin');
      return { result: { ...r, streak, egg: eggTick() }, state: snapshot() };
    },

    async startQuizRound() {
      rollDaily();
      const rewarded = state.daily.rewardedRounds < QUIZ.REWARDED_ROUNDS_PER_DAY;
      if (rewarded) state.daily.rewardedRounds += 1;
      const roundId = crypto.randomUUID();
      rounds.set(roundId, { rewarded, startedAt: Date.now(), tickets: [], finished: false });
      const used = [];
      const questions = [];
      for (let i = 0; i < QUIZ.QUESTIONS_PER_ROUND; i++) {
        const q = pickQuestion(null, used);
        used.push(q);
        const t = issueTicket(q, 'round', null, roundId);
        rounds.get(roundId).tickets.push(t.ticketId);
        questions.push(t);
      }
      return { roundId, rewarded, timeLimit: QUIZ.TIME_LIMIT_SEC, questions, state: snapshot() };
    },

    async issueQuestion(kind, station = null) {
      rollDaily();
      if (kind === 'run') {
        if (state.daily.distance - state.daily.distanceAtRunQ < EXPLORE.QUESTION_EVERY_M * 0.8) {
          throw new Error('not_enough_distance');
        }
        state.daily.distanceAtRunQ = state.daily.distance;
        return issueTicket(pickQuestion(null), 'run');
      }
      if (state.daily.stations.includes(station)) return { done: true };
      return issueTicket(pickQuestion(station), 'station', station);
    },

    async answerTicket(ticketId, choice) {
      const t = tickets.get(ticketId);
      if (!t) throw new Error('ticket_not_found');
      if (t.answered) throw new Error('already_answered');
      t.answered = true;
      t.answeredAt = Date.now();
      const correct = choice === t.correctIndex;
      t.correct = correct;
      state.stats.answered += 1;
      if (correct) state.stats.correct += 1;
      rollDaily();

      let reward = null;
      if (t.kind === 'run') {
        if (state.daily.runQuestions < EXPLORE.RUN_QUESTIONS_REWARDED_PER_DAY) {
          state.daily.runQuestions += 1;
          reward = correct
            ? applyReward(EXPLORE.RUN_QUESTION_XP, EXPLORE.RUN_QUESTION_COINS, 'run_question')
            : applyReward(EXPLORE.RUN_QUESTION_TRY_XP, 0, 'run_question');
          reward.rewarded = true;
        } else {
          reward = { ...noReward(), rewarded: false };
        }
      } else if (t.kind === 'station') {
        if (state.daily.stations.includes(t.station)) {
          reward = { ...noReward(), rewarded: false };
        } else {
          state.daily.stations.push(t.station);
          reward = correct
            ? applyReward(EXPLORE.STATION_XP, EXPLORE.STATION_COINS, 'station')
            : applyReward(EXPLORE.STATION_TRY_XP, 0, 'station');
          reward.rewarded = true;
          reward.allStations = null;
          if (state.daily.stations.length >= VALUES.length && !state.daily.allStationsBonus) {
            state.daily.allStationsBonus = true;
            reward.allStations = applyReward(EXPLORE.ALL_STATIONS_XP, EXPLORE.ALL_STATIONS_COINS, 'all_stations');
          }
        }
      }
      return { correct, correctIndex: t.correctIndex, explain: t.explain ?? null, reward, state: snapshot() };
    },

    async finishQuizRound(roundId) {
      const r = rounds.get(roundId);
      if (!r) throw new Error('round_not_found');
      if (r.finished) throw new Error('already_finished');
      r.finished = true;
      const deadline = r.startedAt + (QUIZ.TIME_LIMIT_SEC + 20) * 1000;
      const list = r.tickets.map((id) => tickets.get(id));
      const correct = list.filter((t) => t.correct && t.answeredAt <= deadline).length;
      const total = list.length;
      const perfect = total > 0 && correct === total;
      state.stats.rounds += 1;
      rollDaily();
      state.daily.quizRounds += 1;
      let res = noReward();
      if (r.rewarded) {
        res = applyReward(
          correct * QUIZ.XP_PER_CORRECT + (total - correct) * QUIZ.XP_PER_TRY + (perfect ? QUIZ.PERFECT_BONUS_XP : 0),
          correct * QUIZ.COINS_PER_CORRECT + (perfect ? QUIZ.PERFECT_BONUS_COINS : 0),
          'quiz',
        );
      }
      return { result: { ...res, rewarded: r.rewarded, perfect, correct, total }, state: snapshot() };
    },

    async addDistance(meters) {
      rollDaily();
      const add = Math.max(0, Math.min(meters, 500));
      state.daily.distance += add;
      state.stats.distance += add;
      return { added: add, state: snapshot() };
    },

    async collectCoin() {
      rollDaily();
      if (state.daily.coinPickups >= EXPLORE.COIN_PICKUPS_PER_DAY) return { ok: false, state: snapshot() };
      state.daily.coinPickups += 1;
      state.coins += 1;
      return { ok: true, state: snapshot() };
    },

    async openGift() {
      rollDaily();
      if (state.daily.gifts >= EXPLORE.GIFTS_PER_DAY) return { result: null, state: snapshot() };
      state.daily.gifts += 1;
      const roll = Math.random();
      let result = null;
      if (roll >= EXPLORE.GIFT_COIN_CHANCE + EXPLORE.GIFT_XP_CHANCE) {
        const event = localActiveEvent();
        const candidates = ITEMS.filter((it) => it.price > 0 && !it.rank && !state.owned.includes(it.id) && (!it.event || it.event === event));
        if (candidates.length) {
          const item = candidates[Math.floor(Math.random() * candidates.length)];
          state.owned.push(item.id);
          result = { kind: 'item', amount: 0, item: { id: item.id, name: item.name }, voucher: null, reward: noReward() };
        }
      }
      if (!result && roll >= EXPLORE.GIFT_COIN_CHANCE && roll < EXPLORE.GIFT_COIN_CHANCE + EXPLORE.GIFT_XP_CHANCE) {
        const reward = applyReward(5 + Math.floor(Math.random() * 8), 0, 'gift');
        result = { kind: 'xp', amount: reward.xp, item: null, voucher: null, reward };
      } else if (!result) {
        const amount = 5 + Math.floor(Math.random() * 11);
        result = { kind: 'coins', amount, item: null, voucher: null, reward: applyReward(0, amount, 'gift') };
      }
      return { result, state: snapshot() };
    },

    async buyItem(itemId) {
      const item = getItem(itemId);
      if (!item || item.rank) throw new Error('item_not_buyable');
      if (item.event && item.event !== localActiveEvent()) throw new Error('event_item_unavailable');
      if (state.owned.includes(itemId)) throw new Error('already_owned');
      if (state.coins < item.price) throw new Error('not_enough_coins');
      state.coins -= item.price;
      state.owned.push(itemId);
      return { ok: true, state: snapshot() };
    },

    async equipItem(itemId) {
      const item = getItem(itemId);
      if (!item) throw new Error('item_not_found');
      if (!state.owned.includes(itemId)) throw new Error('not_owned');
      state.equipped[item.slot] = itemId;
      return { ok: true, state: snapshot() };
    },

    async equipPet(petId) {
      if (petId && !state.pets.owned.includes(petId)) throw new Error('pet_not_owned');
      state.pets.active = petId || null;
      return { ok: true, state: snapshot() };
    },

    async claimMissionChest() {
      rollDaily();
      if (state.daily.chestClaimed || missionStatus(state.daily).some((m) => !m.done)) {
        return { result: null, state: snapshot() };
      }
      state.daily.chestClaimed = true;
      return { result: applyReward(MISSIONS.CHEST_XP, MISSIONS.CHEST_COINS, 'chest'), state: snapshot() };
    },

    // ── Tính năng cần máy chủ: ngoại tuyến chỉ có bản tối giản ──────────
    async sendKudos() {
      throw new Error('online_only');
    },

    async publicProfiles() {
      return [];
    },

    async publicProfile() {
      throw new Error('online_only');
    },

    async myKudos() {
      return [];
    },

    async myVouchers() {
      return [];
    },

    async giftShop() {
      throw new Error('online_only');
    },

    async redeemGift() {
      throw new Error('online_only');
    },

    async leaderboard(scope) {
      const since = scope === 'week' ? startOfWeek() : scope === 'month' ? startOfMonth() : 0;
      const score = scope === 'all' ? state.xp : state.rewardLog.filter((e) => e.t >= since).reduce((s, e) => s + e.xp, 0);
      const me = { pos: 1, id: 'local', name: state.profile.displayName ?? 'Bạn', unit: state.profile.unit, house: state.profile.house, score, xp: state.xp, me: true };
      return { scope, unit: null, rows: [me], me: { pos: 1, score, xp: state.xp }, offline: true };
    },

    async houseStandings() {
      const since = startOfMonth();
      const mine = state.rewardLog.filter((e) => e.t >= since).reduce((s, e) => s + e.xp, 0);
      return {
        myHouse: state.profile.house,
        standings: HOUSES.map((h) => ({ house: h, points: h === state.profile.house ? mine : 0, members: h === state.profile.house ? 1 : 0 })).sort(
          (a, b) => b.points - a.points,
        ),
        cups: [],
        offline: true,
      };
    },
  };
  return api;
}

function startOfWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}
