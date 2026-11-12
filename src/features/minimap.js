import { isStationDone } from '../game/progress.js';
import { BEACH_RADIUS, GRASS_RADIUS, HILLS, LANDMARKS, RING_PATH_RADIUS } from '../scene/islandLayout.js';
import { createMinimap } from '../ui/minimap.js';

/** Vẽ lại bản đồ sau mỗi khoảng này (giây) — không cần mỗi khung hình. */
const REDRAW_SEC = 0.2;
const LANDMARK_ICONS = [
  [LANDMARKS.windmill, '🌾'],
  [LANDMARKS.camp, '⛺'],
  [LANDMARKS.gazebo, '🏮'],
  [LANDMARKS.rockGarden, '🎋'],
  [LANDMARKS.lighthouse, '🗼'],
  [HILLS.find((hl) => hl.id === 'viewpoint'), '⛰️'],
];

/**
 * Bản đồ nhỏ: nối vị trí Kỳ lân, bạn bè, Vùng Đất với ui/minimap.js.
 *
 * @param {{ island: { stations: { id: string, color: string, position: { x: number, z: number } }[] },
 *   mascot: { object: import('three').Object3D }, getPeers: () => { x: number, z: number }[],
 *   getTargets?: () => { x: number, z: number }[] }} deps
 * @returns {{ update: (delta: number) => void }}
 */
export function setupMinimap({ island, mascot, getPeers, getTargets }) {
  const map = createMinimap();
  const landmarks = LANDMARK_ICONS.map(([lm, icon]) => ({ x: lm.x, z: lm.z, icon }));
  let timer = 0;

  function update(delta) {
    timer -= delta;
    if (timer > 0) return;
    timer = REDRAW_SEC;
    const p = mascot.object.position;
    map.draw({
      beachRadius: BEACH_RADIUS,
      grassRadius: GRASS_RADIUS,
      ringRadius: RING_PATH_RADIUS,
      pathEnd: RING_PATH_RADIUS,
      lake: LANDMARKS.lake,
      stations: island.stations.map((s) => ({ x: s.position.x, z: s.position.z, color: s.color, done: isStationDone(s.id) })),
      landmarks,
      targets: getTargets?.() ?? [],
      peers: getPeers(),
      me: { x: p.x, z: p.z, heading: mascot.object.rotation.y },
    });
  }

  return { update };
}
