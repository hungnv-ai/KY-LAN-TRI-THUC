import { sfx } from '../audio/sfx.js';
import { getSticker, STICKER_COOLDOWN_SEC } from '../data/stickers.js';
import { getProfile } from '../game/progress.js';
import { showToast } from '../ui/feedback.js';
import { composePhoto, flash, photoFailed, runCountdown, showPhotoPreview } from '../ui/photoView.js';
import { addQuickAction, toggleStickerPicker } from '../ui/quickActions.js';

/** Đếm ngược trước khi chụp (giây). */
const PHOTO_COUNTDOWN = 3;

/**
 * Thể hiện bản thân trên đảo: gửi sticker (mọi người cùng đảo thấy) và chụp ảnh nhóm có khung VA.
 *
 * @param {{ world: object, mascot: object, social: { sendSticker: (id: string) => void } }} deps
 */
export function setupExpressions({ world, mascot, social }) {
  let lastSticker = -Infinity;

  addQuickAction({
    icon: '😄',
    label: 'Gửi sticker',
    order: 10,
    onClick: (btn) =>
      toggleStickerPicker(btn, (id) => {
        const now = performance.now() / 1000;
        if (now - lastSticker < STICKER_COOLDOWN_SEC) {
          showToast('Từ từ thôi, đợi một chút rồi gửi tiếp nhé!', { icon: '⏳' });
          return;
        }
        lastSticker = now;
        const sticker = getSticker(id);
        sfx.pop();
        mascot.emote(sticker.emote);
        social.sendSticker(id);
      }),
  });

  let shooting = false;
  addQuickAction({
    icon: '📸',
    label: 'Chụp ảnh',
    order: 20,
    onClick: async () => {
      if (shooting) return;
      shooting = true;
      document.body.classList.add('is-photo');
      try {
        await runCountdown(PHOTO_COUNTDOWN, (n) => {
          sfx.tick();
          if (n === 1) mascot.emote('cheer');
        });
        // Vẽ lại rồi đọc ảnh ngay trong cùng một lượt (canvas WebGL không giữ bộ đệm).
        world.renderer.render(world.scene, world.camera);
        const name = getProfile().displayName;
        const when = new Date().toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
        const photo = composePhoto(world.renderer.domElement, { caption: [name, when].filter(Boolean).join(' · ') });
        sfx.shutter();
        flash();
        showPhotoPreview(photo);
      } catch (err) {
        console.warn('[photo]', err);
        photoFailed();
      } finally {
        document.body.classList.remove('is-photo');
        shooting = false;
      }
    },
  });
}
