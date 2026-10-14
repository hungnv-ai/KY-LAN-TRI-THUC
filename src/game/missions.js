import { MISSIONS } from '../config.js';

/**
 * Nhiệm vụ hằng ngày (dùng cho chế độ ngoại tuyến; máy chủ có bản SQL tương đương).
 */

/** Băm chuỗi đơn giản (ổn định giữa các lần tải trang). */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * @param {string} day YYYY-MM-DD
 * @returns {typeof MISSIONS.CATALOG} PER_DAY nhiệm vụ của ngày
 */
export function missionsForDay(day) {
  return [...MISSIONS.CATALOG].sort((a, b) => hash(day + a.id) - hash(day + b.id)).slice(0, MISSIONS.PER_DAY);
}

/**
 * Giá trị bộ đếm theo tên `counter` trong danh mục nhiệm vụ.
 *
 * @param {object} daily
 * @param {string} counter
 * @returns {number}
 */
export function counterValue(daily, counter) {
  switch (counter) {
    case 'checkedIn':
      return daily.checkedIn ? 1 : 0;
    case 'stationCount':
      return daily.stations.length;
    case 'distance':
      return Math.floor(daily.distance);
    default:
      return daily[counter] ?? 0;
  }
}

/**
 * @param {object} daily
 * @returns {{ id: string, label: string, target: number, progress: number, done: boolean }[]}
 */
export function missionStatus(daily) {
  return missionsForDay(daily.day).map((m) => {
    const value = counterValue(daily, m.counter);
    return { id: m.id, label: m.label, target: m.target, progress: Math.min(value, m.target), done: value >= m.target };
  });
}
