import { fetchMaintenance } from '../net/supabase.js';
import { showToast } from '../ui/feedback.js';
import { isMaintenanceShown, showMaintenance } from '../ui/maintenanceView.js';

/** Đang chơi: kiểm tra trạng thái bảo trì sau mỗi chừng này (ms). */
const POLL_MS = 60000;

/**
 * Theo dõi bảo trì khi đang chơi (chỉ chế độ trực tuyến): quản trị bật bảo trì → người chơi thấy
 * màn hình bảo trì; tắt bảo trì → trang tự tải lại. Nhân viên vẫn chơi tiếp, có lời nhắc.
 *
 * @param {{ online: boolean }} opts
 */
export function setupMaintenance({ online }) {
  if (!online) return;
  let warnedStaff = false;

  async function check() {
    const m = await fetchMaintenance();
    if (m.on && m.canBypass) {
      if (!warnedStaff) showToast('Game đang BẢO TRÌ — bạn vẫn vào được vì là giáo viên / quản trị.', { type: 'warn', icon: '🛠️' });
      warnedStaff = true;
      return;
    }
    warnedStaff = false;
    if (m.on && !isMaintenanceShown()) showMaintenance({ message: m.message, onRetry: check });
    else if (!m.on && isMaintenanceShown()) window.location.reload();
  }

  check();
  setInterval(check, POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
}
