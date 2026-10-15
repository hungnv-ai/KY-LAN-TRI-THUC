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
  { id: 'nhanAi', name: 'Nhân Ái', color: VALUE_COLORS.nhanAi, motto: 'Biết nghĩ cho người khác' },
  { id: 'banLinh', name: 'Bản Lĩnh', color: VALUE_COLORS.banLinh, motto: 'Dám đặt đòi hỏi của bản thân ở phía sau' },
  { id: 'triThuc', name: 'Tri Thức', color: VALUE_COLORS.triThuc, motto: 'Học hỏi liên tục để mở rộng dung lượng trái tim' },
  { id: 'trachNhiem', name: 'Trách Nhiệm', color: VALUE_COLORS.trachNhiem, motto: 'Thử sai và chấp nhận các hệ quả' },
  { id: 'khaiPhong', name: 'Khai Phóng', color: VALUE_COLORS.khaiPhong, motto: 'Nung nấu hoài bão và nguyện ước lớn' },
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

/** Chế độ Khám phá Vùng Đất: di chuyển, câu hỏi theo quãng đường, cột Vùng Đất, xu & hộp quà. */
export const EXPLORE = {
  /** Tốc độ (mét/giây; 1 đơn vị 3D = 1 m). */
  WALK_SPEED: 4.2,
  RUN_SPEED: 7.5,
  /** Cứ chạy được bấy nhiêu mét thì có 1 câu hỏi nhanh. */
  QUESTION_EVERY_M: 100,
  RUN_QUESTION_XP: 5,
  RUN_QUESTION_COINS: 3,
  RUN_QUESTION_TRY_XP: 1,
  RUN_QUESTIONS_REWARDED_PER_DAY: 6,
  /** Thử thách ở cột Vùng Đất: mỗi cột 1 lần có thưởng / ngày. */
  STATION_XP: 10,
  STATION_COINS: 8,
  STATION_TRY_XP: 3,
  /** Thưởng "Nhà thám hiểm" khi ghé đủ 5 Vùng Đất trong ngày. */
  ALL_STATIONS_XP: 25,
  ALL_STATIONS_COINS: 25,
  /** Xu vàng rơi trên đường. */
  COIN_PICKUPS_PER_DAY: 40,
  COIN_RESPAWN_SEC: 45,
  COINS_ON_MAP: 18,
  /** Hộp quà bất ngờ. */
  GIFTS_PER_DAY: 5,
  GIFT_INTERVAL_SEC: 60,
  /** Tỉ lệ phần thưởng hộp quà (cộng dồn): xu → XP → trang phục miễn phí. */
  GIFT_COIN_CHANCE: 0.6,
  GIFT_XP_CHANCE: 0.3,
};

/**
 * Nhiệm vụ hằng ngày: mỗi ngày chọn 3 nhiệm vụ (giống nhau cho mọi người) từ danh mục này.
 * `counter` là bộ đếm trong ngày (xem daily trong game/progress.js và bảng daily_counters).
 */
export const MISSIONS = {
  PER_DAY: 3,
  CATALOG: [
    { id: 'checkin', label: 'Điểm danh hôm nay', counter: 'checkedIn', target: 1 },
    { id: 'quiz', label: 'Hoàn thành 1 lượt Tri Thức', counter: 'quizRounds', target: 1 },
    { id: 'stations', label: 'Chinh phục 2 Vùng Đất', counter: 'stationCount', target: 2 },
    { id: 'coins', label: 'Nhặt 10 xu vàng', counter: 'coinPickups', target: 10 },
    { id: 'distance', label: 'Chạy 300 m', counter: 'distance', target: 300 },
    { id: 'runq', label: 'Trả lời 2 câu hỏi dọc đường', counter: 'runQuestions', target: 2 },
    { id: 'gift', label: 'Mở 1 hộp quà bất ngờ', counter: 'gifts', target: 1 },
    { id: 'thanks', label: 'Gửi 1 lời cảm ơn', counter: 'thanksSent', target: 1 },
  ],
  CHEST_XP: 30,
  CHEST_COINS: 30,
};

/** Nhân Ái: thả tim & gửi lời cảm ơn cho người chơi khác. */
export const KUDOS = {
  THANKS_PER_DAY: 3,
  THANKS_COINS_SENDER: 5,
  THANKS_COINS_RECEIVER: 5,
  HEARTS_PER_DAY: 20,
  MESSAGE_MAX: 120,
};

/** Nhiều người chơi trên cùng đảo. */
export const MULTIPLAYER = {
  MAX_PER_ROOM: 20,
  /** Gửi vị trí tối đa bấy nhiêu lần/giây khi đang di chuyển. */
  SEND_RATE_HZ: 8,
  /** Gửi "nhịp tim" khi đứng yên (giây). */
  HEARTBEAT_SEC: 4,
  /** Không nhận tin quá lâu (giây) thì coi như đã rời đảo. */
  TIMEOUT_SEC: 15,
  /** Kỳ lân người khác xa hơn bấy nhiêu mét thì vẽ đơn giản (chỉ bảng tên). */
  DETAIL_DISTANCE: 22,
  /** Số Kỳ lân người khác vẽ đầy đủ tối đa (gần nhất trước). */
  MAX_DETAILED: 10,
};

/** Tên miền email được phép đăng nhập (GĐ2). Máy chủ kiểm tra lại danh sách này. */
export const ALLOWED_EMAIL_DOMAINS = ['vaschools.edu.vn'];

/** Phiếu quà hiện vật: tỉ lệ hộp quà ra phiếu (chờ BGH duyệt). 0 = tắt. */
/** Thú cưng: điểm danh đủ EGG_DAYS ngày (không cần liên tục) → trứng nở. Danh mục: src/data/pets.js. */
export const PETS_CONFIG = {
  EGG_DAYS: 3,
  /** Đã có đủ mọi thú cưng: trứng nở ra Xu. */
  DUPLICATE_COINS: 40,
};

/** Rung Chuông Vàng: trận loại trực tiếp theo giờ hẹn (BGH tạo trận trong trang quản trị). */
export const BELL = {
  /** Mở phòng chờ trước giờ bắt đầu (phút). */
  LOBBY_MIN: 30,
  /** Còn cho vào sau giờ bắt đầu (giây) — bù trễ mạng. */
  JOIN_GRACE_SEC: 5,
  /** Nhận đáp án trễ tối đa (giây) sau khi hết giờ — bù trễ mạng. */
  ANSWER_GRACE_SEC: 1,
  DEFAULT_ANSWER_SEC: 15,
  REVEAL_SEC: 6,
  /** Chỉ trao phiếu quà khi số người trụ lại không quá bấy nhiêu. */
  MAX_VOUCHER_WINNERS: 3,
  /** Chế độ luyện tập (ngoại tuyến): số "bạn ảo", số câu, đếm ngược trước khi bắt đầu. */
  PRACTICE_BOTS: 24,
  PRACTICE_QUESTIONS: 8,
  PRACTICE_DELAY_SEC: 12,
  PRACTICE_BOT_ACCURACY: 0.78,
};

/** Cửa hàng đổi Xu lấy quà hiện vật (danh mục: src/data/gifts.js, sửa trong trang quản trị). */
export const GIFT_SHOP = {
  /** Số phiếu đang chờ BGH duyệt tối đa cùng lúc. */
  MAX_PENDING: 2,
  /** Số lần đổi tối đa mỗi tháng. */
  MONTHLY_LIMIT: 3,
};

export const VOUCHER = {
  GIFT_CHANCE: 0.01,
  GIFT_TITLE: 'Phiếu quà may mắn',
};
