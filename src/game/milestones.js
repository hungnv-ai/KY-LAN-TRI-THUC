import { MILESTONES } from '../config.js';

/**
 * Mốc quãng đường: tra cứu thuần (không đụng DOM/Three.js). Luật thưởng nằm ở
 * game/localBackend.js (ngoại tuyến) và add_distance (máy chủ).
 */

/** @returns {typeof MILESTONES.LIST} danh sách mốc, xếp tăng dần theo số mét */
export function listMilestones() {
  return MILESTONES.LIST;
}

/**
 * @param {string} id
 * @returns {(typeof MILESTONES.LIST)[number] | undefined}
 */
export function getMilestone(id) {
  return MILESTONES.LIST.find((m) => m.id === id);
}

/**
 * Mốc kế tiếp chưa đạt.
 *
 * @param {number} distance tổng quãng đường (m)
 * @returns {(typeof MILESTONES.LIST)[number] | null}
 */
export function nextMilestone(distance) {
  return MILESTONES.LIST.find((m) => distance < m.meters) ?? null;
}

/**
 * Huy hiệu trên bảng tên: icon của mốc có `badge` cao nhất đã đạt.
 *
 * @param {number} distance tổng quãng đường (m)
 * @returns {string} emoji hoặc chuỗi rỗng
 */
export function milestoneBadge(distance) {
  let badge = '';
  for (const m of MILESTONES.LIST) if (m.badge && distance >= m.meters) badge = m.icon;
  return badge;
}
