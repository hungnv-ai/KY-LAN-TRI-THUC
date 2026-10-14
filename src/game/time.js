import { GOLDEN_HOURS } from '../config.js';

/**
 * Khoá ngày dạng YYYY-MM-DD theo giờ địa phương.
 *
 * @param {Date} [date]
 * @returns {string}
 */
export function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * @param {Date} [date]
 * @returns {string} khoá ngày hôm qua
 */
export function yesterdayKey(date = new Date()) {
  const y = new Date(date);
  y.setDate(y.getDate() - 1);
  return dayKey(y);
}

/**
 * @param {Date} [date]
 * @returns {boolean} đang trong Giờ Vàng hay không
 */
export function isGoldenHour(date = new Date()) {
  const h = date.getHours();
  return GOLDEN_HOURS.RANGES.some(([start, end]) => h >= start && h < end);
}
