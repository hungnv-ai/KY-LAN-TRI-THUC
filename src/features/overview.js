import { sfx } from '../audio/sfx.js';
import { say } from '../ui/feedback.js';
import { setupOverviewButton } from '../ui/hud.js';
import { isSheetOpen, closeSheet } from '../ui/sheet.js';

/**
 * Toàn cảnh đảo: camera bay lên cao để thấy cả 5 Vùng Đất, chuông vàng, người chơi khác…
 * Bấm lại (hoặc bắt đầu chạy) để bay về chỗ Kỳ lân.
 *
 * @param {{ world: object, isMoving: () => boolean }} deps
 * @returns {{ update: () => void }}
 */
export function setupOverview({ world, isMoving }) {
  let movedFor = 0;
  const button = setupOverviewButton((on) => {
    if (on && isSheetOpen()) closeSheet();
    world.setOverview(on);
    sfx.pop();
    if (on) say('Toàn cảnh đảo đây! Kéo để xoay, chụm 2 ngón để phóng to. Bấm ✕ để quay lại 🔭');
    movedFor = 0;
  });

  return {
    /** Chạy liên tục ~1 giây khi đang xem toàn cảnh → tự bay về để điều khiển dễ hơn. */
    update(delta) {
      if (!world.isOverview()) return;
      movedFor = isMoving() ? movedFor + delta : 0;
      if (movedFor > 1) {
        button.set(false);
        world.setOverview(false);
      }
    },
  };
}
