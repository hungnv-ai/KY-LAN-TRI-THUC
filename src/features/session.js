import { createLocalBackend } from '../game/localBackend.js';
import { createRemoteBackend } from '../game/remoteBackend.js';
import { friendlyError, getProfile, initProgress, updateProfile } from '../game/progress.js';
import { getSession, getSupabase, isAllowedEmail, isOnlineConfigured, signInWithGoogle, signOut } from '../net/supabase.js';
import { showLoginScreen, showProfileSetup } from '../ui/accountView.js';

/** Cho phép "chơi thử không đăng nhập" khi đã có máy chủ? (false = bắt buộc đăng nhập). */
const ALLOW_OFFLINE_WHEN_ONLINE = false;

/**
 * Bắt đầu phiên chơi: chọn bộ xử lý (ngoại tuyến / Supabase), đăng nhập Google nếu cần,
 * nạp tiến trình, khai báo bảng tên lần đầu.
 *
 * @returns {Promise<{ mode: 'local' | 'remote', supabase: object | null, userId: string }>}
 */
export async function startSession() {
  if (!isOnlineConfigured) {
    await initProgress(createLocalBackend());
    await ensureProfile();
    return { mode: 'local', supabase: null, userId: localPlayerId() };
  }

  const supabase = await getSupabase();
  let error = null;

  for (;;) {
    const session = await getSession();
    if (session) {
      if (!isAllowedEmail(session.user.email)) {
        await signOut();
        error = `Tài khoản ${session.user.email} không thuộc trường. Vui lòng chọn tài khoản @vaschools.edu.vn.`;
      } else {
        try {
          await initProgress(createRemoteBackend(supabase));
          await ensureProfile();
          return { mode: 'remote', supabase, userId: session.user.id };
        } catch (err) {
          error = friendlyError(err);
          if (String(err?.message).includes('email_domain_not_allowed')) await signOut();
          else throw err;
        }
      }
    }

    // Chưa đăng nhập: hiện màn hình đăng nhập (trang sẽ chuyển sang Google rồi quay lại).
    const choice = await new Promise((resolve) => {
      showLoginScreen({
        error,
        onLogin: () => signInWithGoogle(),
        onOffline: ALLOW_OFFLINE_WHEN_ONLINE ? () => resolve('offline') : undefined,
      });
    });
    if (choice === 'offline') {
      await initProgress(createLocalBackend());
      await ensureProfile();
      return { mode: 'local', supabase: null, userId: localPlayerId() };
    }
  }
}

/** Lần đầu vào game: khai báo tên hiển thị + bộ phận/lớp cho bảng tên. */
async function ensureProfile() {
  const profile = getProfile();
  if (profile.displayName && profile.unit) return;
  const suggested = profile.fullName ? shortName(profile.fullName) : '';
  await showProfileSetup({
    initialName: profile.displayName ?? suggested,
    initialUnit: profile.unit ?? '',
    onSave: async (name, unit) => {
      try {
        await updateProfile(name, unit);
      } catch (err) {
        err.friendly = friendlyError(err);
        throw err;
      }
    },
  });
}

/** "Nguyễn Thị Lan" → "Lan" (gợi ý tên ngắn, người chơi sửa được). */
function shortName(fullName) {
  const parts = String(fullName).trim().split(/\s+/);
  return parts[parts.length - 1] ?? '';
}

/** Mã người chơi cho chế độ ngoại tuyến (để các tab thấy nhau khi thử nghiệm). */
function localPlayerId() {
  try {
    let id = sessionStorage.getItem('klt-tab-id');
    if (!id) {
      id = `local-${crypto.randomUUID().slice(0, 8)}`;
      sessionStorage.setItem('klt-tab-id', id);
    }
    return id;
  } catch {
    return `local-${Math.random().toString(36).slice(2, 10)}`;
  }
}
