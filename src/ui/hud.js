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
