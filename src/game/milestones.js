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
 * Huy hiệu trên bảng tên: mốc cao nhất đã đạt (vd 👟 1 km) — ai cũng thấy để thi đua.
 *
 * @param {number} distance tổng quãng đường (m)
 * @returns {{ icon: string, label: string, title: string, special: boolean } | null} null = chưa đạt mốc nào
 */
export function milestoneBadge(distance) {
  let top = null;
  for (const m of MILESTONES.LIST) if (distance >= m.meters) top = m;
  return top ? { icon: top.icon, label: `${top.meters / 1000} km`, title: top.title, special: Boolean(top.badge) } : null;
}
