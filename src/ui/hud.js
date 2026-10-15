import { bump, formatNumber } from './dom.js';

/**
 * HUD trên cùng (hạng, XP, Xu, chuỗi ngày, Giờ Vàng) và màn hình loading.
 */
const els = {
  rankCard: document.getElementById('rank-card'),
  rankIcon: document.getElementById('rank-icon'),
  rankLabel: document.getElementById('rank-label'),
  xpFill: document.getElementById('xp-fill'),
  xpText: document.getElementById('xp-text'),
  xpBar: document.querySelector('.xp-bar'),
  coins: document.getElementById('coins-value'),
  streak: document.getElementById('streak-value'),
  golden: document.getElementById('golden-pill'),
  checkinDot: document.getElementById('checkin-dot'),
  loading: document.getElementById('loading-screen'),
  distance: document.getElementById('distance-value'),
  nextQuestion: document.getElementById('next-question'),
  stations: document.getElementById('stations-value'),
  homeBtn: document.getElementById('home-btn'),
  overviewBtn: document.getElementById('overview-btn'),
  soundBtn: document.getElementById('sound-btn'),
  onlinePill: document.getElementById('online-pill'),
  onlineValue: document.getElementById('online-value'),
  adminLink: document.getElementById('admin-link'),
  progress: document.getElementById('loading-progress'),
};

let lastCoins = null;
let lastXp = null;

/**
 * @param {{ xp: number, coins: number, streak: number, rankInfo: ReturnType<typeof import('../data/ranks.js').getRankInfo>,
 *   golden: boolean, canCheckIn: boolean }} data
 */
export function renderHud({ xp, coins, streak, rankInfo, golden, canCheckIn }) {
  const { rank, label, next, progress, xpToNext } = rankInfo;
  els.rankCard.style.setProperty('--rank-color', rank.color);
  els.rankIcon.textContent = rank.icon;
  els.rankLabel.textContent = label;
  els.xpFill.style.width = `${Math.round(progress * 100)}%`;
  els.xpBar.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
  els.xpText.textContent = next
    ? `${formatNumber(xp)} XP · còn ${formatNumber(xpToNext)} lên ${next.name}`
    : `${formatNumber(xp)} XP · Hạng cao nhất!`;

  els.coins.textContent = formatNumber(coins);
  els.streak.textContent = String(streak);
  els.golden.hidden = !golden;
  els.checkinDot.hidden = !canCheckIn;

  if (lastCoins !== null && coins !== lastCoins) bump(els.coins.parentElement);
  if (lastXp !== null && xp !== lastXp) bump(els.rankCard);
  lastCoins = coins;
  lastXp = xp;
}

/** @param {() => void} handler */
export function onRankCardClick(handler) {
  els.rankCard.addEventListener('click', handler);
}

/** @param {number} ratio 0..1 */
export function setLoadingProgress(ratio) {
  els.progress.textContent = `${Math.round(ratio * 100)}%`;
}

export function hideLoading() {
  els.loading.classList.add('hidden');
  setTimeout(() => (els.loading.hidden = true), 500);
}

/**
 * Thanh Khám phá: quãng đường, câu hỏi kế tiếp, số Vùng Đất đã ghé.
 *
 * @param {{ distance: number, toNextQuestion: number, stationsDone: number, stationsTotal: number }} data
 */
export function renderExploreHud({ distance, toNextQuestion, stationsDone, stationsTotal }) {
  els.distance.textContent = `${formatNumber(distance)} m`;
  els.nextQuestion.textContent = `❓ ${formatNumber(Math.max(0, toNextQuestion))} m`;
  els.stations.textContent = `${stationsDone}/${stationsTotal}`;
}

/** @param {() => void} handler */
/**
 * Nút 🔭 Toàn cảnh: bấm để bật/tắt, nút đổi thành ✕ khi đang xem toàn cảnh.
 *
 * @param {(on: boolean) => void} onToggle
 * @returns {{ set: (on: boolean) => void }}
 */
export function setupOverviewButton(onToggle) {
  let on = false;
  const set = (value) => {
    on = value;
    els.overviewBtn.textContent = on ? '✕' : '🔭';
    els.overviewBtn.setAttribute('aria-pressed', String(on));
    els.overviewBtn.title = on ? 'Quay lại Kỳ lân' : 'Xem toàn cảnh đảo';
    els.overviewBtn.classList.toggle('is-active', on);
    document.body.classList.toggle('is-overview', on);
  };
  els.overviewBtn.addEventListener('click', () => {
    set(!on);
    onToggle(on);
  });
  return { set };
}

/**
 * Ẩn giao diện trong lúc chạy màn chào (camera lượn quanh đảo).
 *
 * @param {boolean} on
 */
export function setIntroMode(on) {
  document.body.classList.toggle('is-intro', on);
}

export function onHomeClick(handler) {
  els.homeBtn.addEventListener('click', handler);
}

/**
 * Nút bật/tắt âm thanh.
 *
 * @param {boolean} muted trạng thái ban đầu
 * @param {(muted: boolean) => void} onChange
 */
export function setupSoundButton(muted, onChange) {
  let current = muted;
  const render = () => {
    els.soundBtn.textContent = current ? '🔇' : '🔊';
    els.soundBtn.setAttribute('aria-label', current ? 'Bật âm thanh' : 'Tắt âm thanh');
    els.soundBtn.title = current ? 'Bật âm thanh' : 'Tắt âm thanh';
  };
  render();
  els.soundBtn.addEventListener('click', () => {
    current = !current;
    render();
    onChange(current);
  });
}

/**
 * Số người đang ở cùng đảo.
 *
 * @param {number} count tính cả mình
 * @param {string} [room]
 */
/**
 * Bấm vào ô 👥 (số người online).
 *
 * @param {() => void} handler
 */
export function onOnlineClick(handler) {
  els.onlinePill.addEventListener('click', handler);
}

export function renderOnline(count, room) {
  els.onlinePill.hidden = false;
  els.onlineValue.textContent = String(count);
  els.onlinePill.title = `${count} người đang ở ${room ? room.replace('island-', 'Đảo ') : 'đảo'}`;
}

/** Hiện nút vào trang quản trị (giáo viên / BGH / quản trị). */
export function showAdminLink() {
  els.adminLink.hidden = false;
}
