import { setIntroMode } from '../ui/hud.js';

/**
 * Màn chào: camera lượn nửa vòng quanh đảo rồi đáp xuống Kỳ lân (chạm / bấm phím để bỏ qua).
 * Chạy mỗi lần vào game (mở lại trang / đăng nhập lại).
 *
 * @param {{ world: object }} deps
 * @returns {Promise<void>}
 */
export async function playIntro({ world }) {
  setIntroMode(true);
  try {
    await world.playIntro();
  } finally {
    setIntroMode(false);
  }
}
