import { ZONE_GROWTH } from '../config.js';
import { getHouseStandings } from '../game/progress.js';
import { createZoneGrowth } from '../scene/zoneGrowth.js';

/**
 * Cấp của Vùng Đất từ tổng XP tháng của Nhà.
 *
 * @param {number} points
 * @returns {number} 0..4
 */
export function zoneLevel(points) {
  return ZONE_GROWTH.LEVEL_XP.filter((xp) => points >= xp).length;
}

/**
 * Vùng Đất lớn lên theo điểm thi đua của cả trường (5 Nhà = 5 Vùng Đất), tự cập nhật định kỳ.
 *
 * @param {{ world: object, island: object }} deps
 * @returns {{ update: (delta: number, elapsed: number) => void }}
 */
export function setupZoneGrowth({ world, island }) {
  const growth = createZoneGrowth(world.scene, island);

  async function refresh() {
    try {
      const { standings } = await getHouseStandings();
      growth.setLevels(Object.fromEntries(standings.map((s) => [s.house, zoneLevel(s.points)])));
    } catch {
      /* thử lại lần sau */
    }
  }
  refresh();
  setInterval(refresh, ZONE_GROWTH.REFRESH_MIN * 60_000);

  return { update: (delta, elapsed) => growth.update(delta, elapsed) };
}
