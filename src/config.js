/**
 * Hằng số dùng chung toàn game. Chỉnh cân bằng game (điểm thưởng, giới hạn…) tại đây.
 */

/** Màu 5 giá trị cốt lõi VA Schools (theo Brand Guideline). */
export const VALUE_COLORS = {
  nhanAi: '#009082',
  banLinh: '#725139',
  triThuc: '#9A0036',
  trachNhiem: '#C49C57',
  khaiPhong: '#1750B5',
};

/** Thứ tự & tên hiển thị 5 giá trị. */
export const VALUES = [
  { id: 'nhanAi', name: 'Nhân Ái', color: VALUE_COLORS.nhanAi },
  { id: 'banLinh', name: 'Bản Lĩnh', color: VALUE_COLORS.banLinh },
  { id: 'triThuc', name: 'Tri Thức', color: VALUE_COLORS.triThuc },
  { id: 'trachNhiem', name: 'Trách Nhiệm', color: VALUE_COLORS.trachNhiem },
  { id: 'khaiPhong', name: 'Khai Phóng', color: VALUE_COLORS.khaiPhong },
];

/** Quiz Tri Thức. */
export const QUIZ = {
  QUESTIONS_PER_ROUND: 5,
  TIME_LIMIT_SEC: 180,
  XP_PER_CORRECT: 10,
  COINS_PER_CORRECT: 5,
  /** Tinh thần "thử sai": trả lời sai vẫn được một chút XP. */
  XP_PER_TRY: 2,
  PERFECT_BONUS_XP: 20,
  PERFECT_BONUS_COINS: 10,
  /** Số lượt quiz có thưởng mỗi ngày; sau đó vẫn chơi luyện tập nhưng không nhận điểm. */
  REWARDED_ROUNDS_PER_DAY: 3,
};

/** Điểm danh hằng ngày (Trách Nhiệm). */
export const CHECK_IN = {
  XP: 20,
  COINS: 15,
  /** Thưởng thêm Xu theo chuỗi ngày, tối đa 7 ngày. */
  STREAK_BONUS_COINS_PER_DAY: 2,
  STREAK_BONUS_MAX_DAYS: 7,
};

/** Giờ Vàng: nhân XP. Giờ theo đồng hồ máy người chơi, [giờ bắt đầu, giờ kết thúc). */
export const GOLDEN_HOURS = {
  RANGES: [
    [12, 13],
    [19, 21],
  ],
  XP_MULTIPLIER: 2,
};

/** Khoá lưu dữ liệu trong trình duyệt (GĐ1). Đổi version khi cấu trúc dữ liệu thay đổi. */
export const SAVE_KEY = 'klt-save-v1';
