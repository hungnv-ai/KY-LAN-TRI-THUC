import { ALLOWED_EMAIL_DOMAINS } from '../config.js';

/**
 * Kết nối Supabase (GĐ2). Chỉ bật khi đã cấu hình biến môi trường trên Vercel:
 *   VITE_SUPABASE_URL        — Project URL (vd: https://abcd.supabase.co)
 *   VITE_SUPABASE_ANON_KEY   — khoá "anon / publishable" (công khai, an toàn để ở trình duyệt)
 * Chưa cấu hình → game chạy chế độ ngoại tuyến như cũ.
 */
const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** @type {boolean} đã cấu hình máy chủ hay chưa */
export const isOnlineConfigured = Boolean(URL && KEY);

let clientPromise = null;

/**
 * Tạo (một lần) và trả về Supabase client. Thư viện chỉ được tải khi cần → bản ngoại tuyến nhẹ hơn.
 *
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient | null>}
 */
export function getSupabase() {
  if (!isOnlineConfigured) return Promise.resolve(null);
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL, KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
      realtime: { params: { eventsPerSecond: 20 } },
    }),
  );
  return clientPromise;
}

/** @returns {Promise<import('@supabase/supabase-js').Session | null>} */
export async function getSession() {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Đăng nhập Google; gợi ý tài khoản của trường (`hd`). Trang sẽ chuyển sang Google rồi quay lại. */
export async function signInWithGoogle() {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + window.location.pathname,
      queryParams: { hd: ALLOWED_EMAIL_DOMAINS[0] ?? '', prompt: 'select_account' },
    },
  });
  if (error) throw error;
}

/**
 * Trạng thái bảo trì (đọc được cả khi chưa đăng nhập).
 *
 * @returns {Promise<{ on: boolean, message: string, canBypass: boolean }>} lỗi mạng / máy chủ cũ → coi như không bảo trì
 */
export async function fetchMaintenance() {
  const supabase = await getSupabase();
  if (!supabase) return { on: false, message: '', canBypass: false };
  const { data, error } = await supabase.rpc('maintenance_status');
  if (error || !data) return { on: false, message: '', canBypass: false };
  return { on: Boolean(data.on), message: data.message ?? '', canBypass: Boolean(data.canBypass) };
}

export async function signOut() {
  const supabase = await getSupabase();
  await supabase?.auth.signOut();
}

/**
 * @param {string | undefined} email
 * @returns {boolean} email thuộc tên miền được phép (máy chủ cũng kiểm tra lại)
 */
export function isAllowedEmail(email) {
  if (!ALLOWED_EMAIL_DOMAINS.length) return true;
  const e = String(email ?? '').toLowerCase();
  return ALLOWED_EMAIL_DOMAINS.some((d) => e.endsWith(`@${d.toLowerCase()}`));
}
