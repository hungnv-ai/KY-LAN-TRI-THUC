/**
 * Quản lý HUD (giao diện DOM nằm trên canvas). Chỉ module này được chạm vào DOM của HUD.
 */
const coinsEl = document.getElementById('coins-value');
const loadingEl = document.getElementById('loading-screen');
const progressEl = document.getElementById('loading-progress');

let coins = 0;

export function getCoins() {
  return coins;
}

/** @param {number} value */
export function setCoins(value) {
  coins = Math.max(0, Math.floor(value));
  coinsEl.textContent = String(coins);
  coinsEl.classList.remove('bump');
  void coinsEl.offsetWidth; // restart animation
  coinsEl.classList.add('bump');
}

/** @param {number} amount */
export function addCoins(amount) {
  setCoins(coins + amount);
}

/** @param {number} ratio 0..1 */
export function setLoadingProgress(ratio) {
  progressEl.textContent = `${Math.round(ratio * 100)}%`;
}

export function hideLoading() {
  loadingEl.classList.add('hidden');
}
