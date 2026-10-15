import { loadJSON, saveJSON } from '../game/storage.js';
import { setIntroMode } from '../ui/hud.js';

/** Ngày đã chạy màn chào gần nhất — mỗi ngày chỉ chạy một lần (không làm phiền khi tải lại trang). */
const INTRO_KEY = 'klt-intro-day';

/**
 * Màn chào: camera lượn nửa vòng quanh đảo rồi đáp xuống Kỳ lân (chạm / bấm phím để bỏ qua).
 * Chỉ chạy lần đầu mở game trong ngày.
 *
 * @param {{ world: object }} deps
 * @returns {Promise<void>}
 */
export async function playIntroOnce({ world }) {
  const today = new Date().toDateString();
  if (loadJSON(INTRO_KEY) === today) return;
  saveJSON(INTRO_KEY, today);
  setIntroMode(true);
  try {
    await world.playIntro();
  } finally {
    setIntroMode(false);
  }
}
