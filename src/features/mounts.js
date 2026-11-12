import { sfx } from '../audio/sfx.js';
import { MOUNTS } from '../config.js';
import { getState } from '../game/progress.js';
import { loadJSON, saveJSON } from '../game/storage.js';
import { createMountRig } from '../scene/mounts.js';
import { say, showToast } from '../ui/feedback.js';
import { addQuickAction } from '../ui/quickActions.js';

const STORE_KEY = 'klt-mount';
const QUICK_ACTION_ORDER = 15;
const WALK_ICON = '🚶';

/**
 * Thú cưỡi (F): nút 🛹 đổi vòng Đi bộ → Ván trượt → Mây thần (mở khoá theo tổng quãng đường).
 * Đang cưỡi thì đi nhanh hơn (MOUNTS.SPEED), người khác cũng thấy (gửi kèm vị trí).
 *
 * @param {{ mascot: Parameters<typeof createMountRig>[0], fx: { ring: Function },
 *   explore: { setRideSpeed: (s: number) => void, speed: () => number } }} deps
 * @returns {{ update: (delta: number, elapsed: number) => void, current: () => string | null }}
 */
export function setupMounts({ mascot, fx, explore }) {
  const rig = createMountRig(mascot);
  const distance = () => Number(getState().stats?.distance) || 0;
  const unlocked = () => MOUNTS.LIST.filter((m) => distance() >= m.unlockMeters);

  const button = addQuickAction({ icon: MOUNTS.LIST[0].icon, label: 'Thú cưỡi', order: QUICK_ACTION_ORDER, onClick: cycle });

  function apply(id, announce) {
    const mount = MOUNTS.LIST.find((m) => m.id === id && distance() >= m.unlockMeters) ?? null;
    rig.set(mount?.id ?? null);
    explore.setRideSpeed(mount ? MOUNTS.SPEED : 0);
    saveJSON(STORE_KEY, mount?.id ?? null);
    // Nút hiện thú cưỡi KẾ TIẾP sẽ đổi sang.
    const list = unlocked();
    const next = mount ? list[list.indexOf(mount) + 1] : list[0];
    button.el.firstChild.textContent = next ? next.icon : WALK_ICON;
    button.el.title = next ? `Cưỡi ${next.name}` : 'Xuống đi bộ';
    button.el.setAttribute('aria-label', button.el.title);
    button.el.classList.toggle('is-active', Boolean(mount));
    if (!announce) return;
    sfx.pop();
    fx.ring(mascot.anchors.Root.position, '#FFD86B');
    if (mount) {
      say(`Lên ${mount.name} nào — vèo vèo quanh đảo! ${mount.icon}`);
      return;
    }
    // Xuống đi bộ: gộp lời nhắc thú cưỡi chưa mở khoá vào cùng một thông báo.
    const locked = MOUNTS.LIST.find((m) => distance() < m.unlockMeters);
    const hint = locked ? ` · ${locked.icon} ${locked.name} mở khoá khi chạy đủ ${locked.unlockMeters / 1000} km` : '';
    showToast(`Xuống đi bộ thong thả${hint}`, { icon: '🚶' });
  }

  function cycle() {
    const list = unlocked();
    const cur = list.findIndex((m) => m.id === rig.current());
    apply(list[cur + 1]?.id ?? null, true);
  }

  apply(loadJSON(STORE_KEY), false);

  return {
    update: (delta, elapsed) => rig.update(delta, elapsed, explore.speed()),
    current: rig.current,
  };
}
