import { EXPLORE, QUIZ, VALUES } from '../config.js';
import { getEvent } from '../data/events.js';
import { dayKey, yesterdayKey } from './time.js';

/**
 * Tiến trình người chơi — lớp trung gian duy nhất mà phần còn lại của game dùng.
 *
 * - Bộ xử lý (backend): ngoại tuyến (localBackend.js) hoặc trực tuyến (remoteBackend.js, Supabase).
 * - Đọc (getState, hasCheckedInToday, …) là đồng bộ, lấy từ bản sao trạng thái gần nhất.
 * - Ghi (checkIn, buyItem, …) là bất đồng bộ (Promise): gửi tới bộ xử lý, nhận trạng thái mới,
 *   cập nhật bản sao và báo cho các nơi đăng ký (HUD…).
 */

/** @typedef {object} PlayerState xem _state_json trong supabase/sql/02_helpers.sql */

let backend = null;
/** @type {PlayerState | null} */
let state = null;
const listeners = new Set();

/** Thông báo lỗi thân thiện theo mã lỗi máy chủ. */
const ERROR_MESSAGES = {
  maintenance: 'Game đang bảo trì — bạn quay lại sau ít phút nhé.',
  not_enough_coins: 'Bạn chưa đủ Xu.',
  already_owned: 'Bạn đã có món này rồi.',
  item_not_buyable: 'Món này chỉ mở khoá khi lên hạng.',
  not_owned: 'Bạn chưa sở hữu món này.',
  email_domain_not_allowed: 'Chỉ tài khoản @vaschools.edu.vn được chơi.',
  not_authenticated: 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại.',
  invalid_display_name: 'Tên hiển thị cần từ 2 đến 24 ký tự.',
  invalid_unit: 'Vui lòng nhập bộ phận / lớp (tối đa 24 ký tự).',
  cannot_kudos_self: 'Không thể gửi cho chính mình.',
  online_only: 'Tính năng này cần đăng nhập (chế độ trực tuyến).',
  ticket_expired: 'Câu hỏi đã hết hạn.',
  not_enough_distance: 'Chạy thêm một chút nữa nhé!',
  no_questions: 'Ngân hàng câu hỏi đang trống.',
  gift_out_of_stock: 'Món quà này vừa hết. Chọn món khác nhé!',
  gift_not_found: 'Món quà này không còn trong cửa hàng.',
  too_many_pending: 'Bạn đang có phiếu chờ duyệt — đợi BGH duyệt rồi đổi tiếp nhé.',
  monthly_limit: 'Tháng này bạn đã đổi đủ số lần. Hẹn tháng sau!',
  pet_not_owned: 'Bạn chưa có thú cưng này.',
  event_item_unavailable: 'Món này chỉ bán trong thời gian sự kiện.',
  bell_join_closed: 'Trận đã bắt đầu — bạn có thể xem và cổ vũ nhé!',
  bell_not_open: 'Phòng chờ chưa mở. Quay lại gần giờ bắt đầu nhé!',
  bell_round_closed: 'Hết giờ trả lời câu này rồi!',
  bell_eliminated: 'Bạn đã dừng chân — tiếp tục cổ vũ mọi người nhé!',
  bell_not_joined: 'Bạn chưa tham gia trận này.',
};

/**
 * @param {unknown} err
 * @returns {string} thông báo tiếng Việt cho người chơi
 */
export function friendlyError(err) {
  const msg = String(err?.message ?? err ?? '');
  const key = Object.keys(ERROR_MESSAGES).find((k) => msg.includes(k));
  if (key) return ERROR_MESSAGES[key];
  if (/fetch|network|Failed to/i.test(msg)) return 'Mất kết nối mạng — thử lại sau giây lát nhé.';
  return 'Có lỗi xảy ra, vui lòng thử lại.';
}

/**
 * Khởi tạo với một bộ xử lý và nạp trạng thái.
 *
 * @param {object} chosenBackend createLocalBackend() | createRemoteBackend()
 * @returns {Promise<PlayerState>}
 */
export async function initProgress(chosenBackend) {
  backend = chosenBackend;
  setState(await backend.getState());
  return state;
}

/** @returns {'local' | 'remote'} */
export function backendMode() {
  return backend?.mode ?? 'local';
}

/** @returns {Readonly<PlayerState>} */
export function getState() {
  return state;
}

/**
 * @param {(state: PlayerState) => void} fn
 * @returns {() => void} huỷ đăng ký
 */
export function onProgressChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setState(next) {
  if (!next) return;
  state = next;
  listeners.forEach((fn) => fn(state));
}

/** Gọi bộ xử lý; nếu kết quả có `state` thì cập nhật bản sao. */
async function call(method, ...args) {
  const res = await backend[method](...args);
  if (res && typeof res === 'object' && 'state' in res) setState(res.state);
  return res;
}

/** Tải lại trạng thái từ bộ xử lý (sang ngày mới, quay lại tab…). */
export async function refreshState() {
  setState(await backend.getState());
}

// ── Đọc nhanh từ bản sao ─────────────────────────────────────────────────

/**
 * Bộ đếm hôm nay. Trực tuyến: máy chủ luôn trả về đúng "hôm nay" theo giờ Việt Nam →
 * tin máy chủ (máy người chơi có thể để sai múi giờ). Ngoại tuyến: so với ngày của máy.
 */
function today() {
  if (backend?.mode === 'remote') return state.daily;
  return state.daily.day === dayKey() ? state.daily : null;
}

/** Ngày tham chiếu "hôm nay" và "hôm qua" dạng YYYY-MM-DD. */
function referenceDays() {
  if (backend?.mode === 'remote' && state.daily?.day) {
    const d = new Date(`${state.daily.day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return { today: state.daily.day, yesterday: d.toISOString().slice(0, 10) };
  }
  return { today: dayKey(), yesterday: yesterdayKey() };
}

/** @returns {boolean} */
export function hasCheckedInToday() {
  return Boolean(today()?.checkedIn);
}

/** @returns {number} chuỗi ngày còn hiệu lực (đứt nếu bỏ lỡ hơn 1 ngày) */
export function getActiveStreak() {
  const { count, lastDay } = state.streak;
  const ref = referenceDays();
  return lastDay === ref.today || lastDay === ref.yesterday ? count : 0;
}

/** @returns {number} */
export function rewardedRoundsLeft() {
  return Math.max(0, QUIZ.REWARDED_ROUNDS_PER_DAY - (today()?.rewardedRounds ?? 0));
}

/** @returns {number} */
export function runQuestionsLeft() {
  return Math.max(0, EXPLORE.RUN_QUESTIONS_REWARDED_PER_DAY - (today()?.runQuestions ?? 0));
}

/** @param {string} valueId */
export function isStationDone(valueId) {
  return Boolean(today()?.stations.includes(valueId));
}

/** @returns {number} */
export function stationsDoneCount() {
  return today()?.stations.length ?? 0;
}

/** @returns {number} */
export function coinPickupsLeft() {
  return Math.max(0, EXPLORE.COIN_PICKUPS_PER_DAY - (today()?.coinPickups ?? 0));
}

/** @returns {number} */
export function giftsLeft() {
  return Math.max(0, EXPLORE.GIFTS_PER_DAY - (today()?.gifts ?? 0));
}

/** @returns {{ id: string, label: string, target: number, progress: number, done: boolean }[]} */
export function getMissions() {
  return today()?.missions ?? [];
}

/** @returns {boolean} */
export function isChestClaimed() {
  return Boolean(today()?.chestClaimed);
}

/** @returns {{ id: string, displayName: string | null, unit: string | null, role: string, house: string }} */
export function getProfile() {
  return state.profile;
}

/** @returns {{ id: string, name: string, color: string } | null} Nhà của người chơi */
export function getHouse() {
  return VALUES.find((v) => v.id === state.profile.house) ?? null;
}

/** @returns {(typeof import('../data/events.js').EVENTS)[number] | null} sự kiện đang diễn ra (máy chủ quyết định) */
export function getActiveEvent() {
  return getEvent(state?.event) ?? null;
}

/**
 * @param {object} item
 * @returns {'equipped' | 'owned' | 'buyable' | 'tooPoor' | 'locked' | 'milestoneLocked' | 'eventLocked'}
 */
export function itemStatus(item) {
  if (state.equipped[item.slot] === item.id) return 'equipped';
  if (state.owned.includes(item.id)) return 'owned';
  if (item.rank) return 'locked';
  if (item.milestone) return 'milestoneLocked';
  if (item.event && item.event !== state.event) return 'eventLocked';
  return state.coins >= item.price ? 'buyable' : 'tooPoor';
}

// ── Hành động (bất đồng bộ) ──────────────────────────────────────────────

/** @returns {Promise<object>} */
export async function updateProfile(displayName, unit) {
  return call('updateProfile', displayName, unit);
}

/** @returns {Promise<null | { xp: number, coins: number, golden: boolean, rankUp: object | null, streak: number,
 *   egg: { progress: number, need: number, hatched: { id: string, name: string, rarity: string } | null, coins?: number } }>} */
export async function checkIn() {
  return (await call('claimCheckin')).result;
}

/**
 * Bắt đầu lượt quiz: câu hỏi KHÔNG kèm đáp án.
 *
 * @returns {Promise<{ roundId: string, rewarded: boolean, timeLimit: number,
 *   questions: { ticketId: string, topic: string, q: string, options: string[] }[] }>}
 */
export async function startQuizRound() {
  return call('startQuizRound');
}

/**
 * @returns {Promise<{ correct: boolean, correctIndex: number, explain: string | null, reward: object | null }>}
 */
export async function answerQuestion(ticketId, choice) {
  return call('answerTicket', ticketId, choice);
}

/** @returns {Promise<object>} kết quả thưởng của lượt quiz */
export async function finishQuizRound(roundId) {
  return (await call('finishQuizRound', roundId)).result;
}

/**
 * Câu hỏi dọc đường ('run') hoặc thử thách cột Vùng Đất ('station').
 *
 * @returns {Promise<{ ticketId: string, topic: string, q: string, options: string[] } | { done: true }>}
 */
export async function askQuestion(kind, station = null) {
  return call('issueQuestion', kind, station);
}

/**
 * Gửi quãng đường vừa chạy; máy chủ tự trao thưởng khi qua mốc quãng đường.
 *
 * @param {number} meters
 * @returns {Promise<{ added: number, milestones?: { id: string, reward: object, item: { id: string, name: string } | null }[] }>}
 */
export async function addDistance(meters) {
  return call('addDistance', meters);
}

/** @returns {Promise<boolean>} */
export async function collectCoin() {
  return (await call('collectCoin')).ok;
}

/** @returns {Promise<null | { kind: string, amount: number, item: object | null, voucher: object | null, reward: object }>} */
export async function openGift() {
  return (await call('openGift')).result;
}

/** @returns {Promise<void>} */
export async function buyItem(itemId) {
  await call('buyItem', itemId);
}

/** @returns {Promise<void>} */
export async function equipItem(itemId) {
  await call('equipItem', itemId);
}

/** @returns {{ owned: string[], active: string | null, egg: number, eggNeed: number }} */
export function getPets() {
  return state.pets ?? { owned: [], active: null, egg: 0, eggNeed: 3 };
}

/**
 * Dắt thú cưng đi cùng (null = cho nghỉ).
 *
 * @param {string | null} petId
 */
export async function equipPet(petId) {
  await call('equipPet', petId);
}

/** @returns {Promise<null | object>} phần thưởng rương nhiệm vụ */
export async function claimMissionChest() {
  return (await call('claimMissionChest')).result;
}

/**
 * @param {string} toUserId
 * @param {'heart' | 'thanks'} kind
 * @param {string} [message]
 * @param {string | null} [card] mẫu thiệp sự kiện
 * @returns {Promise<{ ok: boolean, reason?: string, reward?: object, card?: string | null }>}
 */
export async function sendKudos(toUserId, kind, message, card = null) {
  return call('sendKudos', toUserId, kind, message, card);
}

/**
 * Đổi Xu lấy phiếu quà hiện vật (chờ BGH duyệt).
 *
 * @param {string} giftId
 * @returns {Promise<{ ok: boolean, voucherId: number }>}
 */
export async function redeemGift(giftId) {
  return call('redeemGift', giftId);
}

/** @returns {Promise<{ gifts: object[], pending: number, thisMonth: number, maxPending: number, monthlyLimit: number }>} */
export const getGiftShop = () => backend.giftShop();
// ── Rung Chuông Vàng (ghi nhận thưởng do máy chủ tự trao khi kết thúc → tải lại trạng thái) ──
export const bellUpcoming = () => backend.bellUpcoming();
export const bellPractice = () => backend.bellPractice();
export const bellJoin = (gameId) => backend.bellJoin(gameId);
export const bellState = (gameId) => backend.bellState(gameId);
export const bellAnswer = (gameId, round, choice) => backend.bellAnswer(gameId, round, choice);

export const getPublicProfiles = (ids) => backend.publicProfiles(ids);
export const getPublicProfile = (id) => backend.publicProfile(id);
export const getMyKudos = () => backend.myKudos();
export const getMyVouchers = () => backend.myVouchers();
export const getLeaderboard = (scope, unit) => backend.leaderboard(scope, unit);
export const getHouseStandings = () => backend.houseStandings();
