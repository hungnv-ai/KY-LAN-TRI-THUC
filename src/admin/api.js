import { getSupabase } from '../net/supabase.js';

/**
 * Gọi hàm RPC quản trị trên Supabase (supabase/sql/05_staff_rpc.sql).
 * Máy chủ tự kiểm tra quyền (giáo viên / BGH / admin) — trang này chỉ hiển thị.
 */

/** Thông báo lỗi tiếng Việt. */
const MESSAGES = {
  forbidden: 'Bạn không có quyền thực hiện thao tác này.',
  cannot_change_own_role: 'Không thể tự đổi quyền của chính mình.',
  question_too_short: 'Câu hỏi quá ngắn (tối thiểu 5 ký tự).',
  need_two_options: 'Cần ít nhất 2 đáp án (đáp án đúng + 1 đáp án sai).',
  question_not_found: 'Không tìm thấy câu hỏi (có thể đã bị xoá).',
  profile_not_found: 'Không tìm thấy người chơi.',
  invalid_title: 'Tên phiếu quà quá ngắn.',
  not_authenticated: 'Phiên đăng nhập đã hết — vui lòng đăng nhập lại.',
  email_domain_not_allowed: 'Tài khoản không thuộc tên miền của trường.',
  questions_q_unique: 'Câu hỏi này đã có trong ngân hàng.',
};

/**
 * @param {string} fn tên hàm RPC
 * @param {object} [args]
 * @returns {Promise<any>}
 */
export async function rpc(fn, args = {}) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    const key = Object.keys(MESSAGES).find((k) => error.message?.includes(k));
    const err = new Error(key ? MESSAGES[key] : error.message);
    err.raw = error;
    throw err;
  }
  return data;
}

export const api = {
  myRole: () => rpc('my_role'),
  myState: () => rpc('get_my_state'),
  claimFirstAdmin: () => rpc('claim_first_admin'),
  stats: () => rpc('admin_stats'),
  leaderboard: (scope, unit = null) => rpc('leaderboard', { p_scope: scope, p_unit: unit, p_limit: 10 }),
  listQuestions: (o) =>
    rpc('staff_list_questions', {
      p_status: o.status || null,
      p_search: o.search || null,
      p_topic: o.topic || null,
      p_limit: o.limit ?? 20,
      p_offset: o.offset ?? 0,
    }),
  saveQuestion: (q) =>
    rpc('staff_save_question', {
      p_id: q.id ?? null,
      p_topic: q.topic,
      p_value: q.value || null,
      p_q: q.q,
      p_options: q.options,
      p_explain: q.explain || null,
    }),
  reviewQuestion: (id, status) => rpc('staff_review_question', { p_id: id, p_status: status }),
  deleteQuestion: (id) => rpc('staff_delete_question', { p_id: id }),
  listPlayers: (o) =>
    rpc('admin_list_players', {
      p_search: o.search || null,
      p_unit: o.unit || null,
      p_role: o.role || null,
      p_limit: o.limit ?? 20,
      p_offset: o.offset ?? 0,
    }),
  updatePlayer: (id, f) =>
    rpc('admin_update_player', {
      p_id: id,
      p_display_name: f.displayName ?? null,
      p_unit: f.unit ?? null,
      p_role: f.role ?? null,
      p_house: f.house ?? null,
    }),
  listVouchers: (status) => rpc('admin_list_vouchers', { p_status: status || null }),
  grantVoucher: (userId, title, reason) => rpc('admin_grant_voucher', { p_user: userId, p_title: title, p_reason: reason || null }),
  decideVoucher: (id, status, note) => rpc('admin_decide_voucher', { p_id: id, p_status: status, p_note: note || null }),
  setAllowedDomains: (domains) => rpc('admin_set_allowed_domains', { p_domains: domains }),
};

/**
 * Đọc một mục cấu hình (bảng game_settings cho phép mọi người đọc).
 *
 * @param {string} key
 */
export async function getSetting(key) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('game_settings').select('value').eq('key', key).maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}
