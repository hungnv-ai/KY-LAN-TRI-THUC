/**
 * Kích thước & bố cục hòn đảo — một nguồn sự thật cho island.js, nature.js, wildlife.js,
 * scenery.js, sea.js, dayCycle.js, world.js, minimap. 1 đơn vị = 1 mét, tâm đảo ở (0, 0).
 */

/** Mép thảm cỏ (bên ngoài là bãi cát). */
export const GRASS_RADIUS = 56;
/** Mép bãi cát (bên ngoài là biển). */
export const BEACH_RADIUS = 63;
/** Kỳ lân không chạy ra quá bán kính này (đi được trên bãi cát, không lội xuống biển). */
export const WALK_RADIUS = 61;
/** Khoảng cách từ quảng trường tới cột Vùng Đất. */
export const STATION_DISTANCE = 30;
/** Đường vòng quanh đảo (nối 5 con đường chính). */
export const RING_PATH_RADIUS = 43;
export const RING_PATH_WIDTH = 2.2;
export const PATH_WIDTH = 1.9;
export const ZONE_COUNT = 5;

/**
 * Góc (rad, 0 = +Z) của con đường / Vùng Đất thứ i.
 *
 * @param {number} i 0..4
 * @returns {number}
 */
export function zoneAngle(i) {
  return Math.PI + (i - 2) * ((Math.PI * 2) / ZONE_COUNT);
}

/**
 * Góc ở giữa hai Vùng Đất i và i+1 (chỗ đặt hồ, cối xay, rừng…).
 *
 * @param {number} i 0..4
 * @returns {number}
 */
export function gapAngle(i) {
  return zoneAngle(i) + Math.PI / ZONE_COUNT;
}

/**
 * Toạ độ (x, z) theo góc & bán kính.
 *
 * @param {number} angle
 * @param {number} radius
 * @returns {{ x: number, z: number }}
 */
export function polar(angle, radius) {
  return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius };
}

/** Các điểm nhấn giữa những Vùng Đất (toạ độ tính sẵn). */
export const LANDMARKS = {
  /** Hồ sen có vịt bơi. */
  lake: { ...polar(gapAngle(0), 21), r: 7.5 },
  /** Cối xay gió & ruộng hoa. */
  windmill: { ...polar(gapAngle(1), 22), r: 2.2 },
  /** Khu cắm trại: lửa trại, lều, ghế gỗ. */
  camp: { ...polar(gapAngle(2), 21), r: 1.2 },
  /** Chòi nghỉ giữa vườn hoa. */
  gazebo: { ...polar(gapAngle(3), 22), r: 2.4 },
  /** Vườn đá & tre. */
  rockGarden: { ...polar(gapAngle(4), 21), r: 3 },
  /** Hải đăng trên mũi cát. */
  lighthouse: { ...polar(gapAngle(0), 59), r: 1.6 },
};

/**
 * Điểm (x, z) có nằm trên đường đi (5 đường chính hoặc đường vòng) không.
 *
 * @param {number} x
 * @param {number} z
 * @param {number} [margin] nới rộng thêm (m)
 * @returns {boolean}
 */
export function isOnPath(x, z, margin = 0) {
  const r = Math.hypot(x, z);
  if (Math.abs(r - RING_PATH_RADIUS) < RING_PATH_WIDTH / 2 + margin) return true;
  if (r > RING_PATH_RADIUS) return false;
  for (let i = 0; i < ZONE_COUNT; i++) {
    const a = zoneAngle(i);
    const dx = Math.sin(a);
    const dz = Math.cos(a);
    if (x * dx + z * dz > 0 && Math.abs(x * dz - z * dx) < PATH_WIDTH / 2 + margin) return true;
  }
  return false;
}
