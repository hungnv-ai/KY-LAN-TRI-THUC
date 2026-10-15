/**
 * Sự kiện theo mùa. Mỗi năm tự bật theo ngày (giờ Việt Nam, dạng MM-DD), hoặc BGH/Quản trị bật/tắt
 * thủ công trong trang quản trị (Cài đặt → Sự kiện). Thêm sự kiện mới = thêm một mục ở đây
 * (+ trang phục `event` trong items.js, câu hỏi `event` trong EVENT_QUESTIONS).
 */
export const EVENTS = [
  {
    id: 'tri-an-2011',
    name: 'Tuần lễ Tri ân 20/11',
    icon: '🌸',
    color: '#D81B60',
    start: '11-10',
    end: '11-22',
    banner: 'Tri ân Thầy Cô 20/11',
    intro: 'Cùng gửi thiệp tri ân thầy cô, đồng nghiệp; diện trang phục sự kiện và trả lời câu hỏi về nghề giáo!',
    activities: [
      'Gửi thiệp tri ân 20/11 (chạm vào Kỳ lân của đồng nghiệp) — cả hai được thêm Xu',
      'Diện trang phục giới hạn: Áo Tri ân, Vòng hoa, Mưa cánh hoa',
      'Trả lời câu hỏi chủ đề "Tôn sư trọng đạo" trong Tri Thức và khi chạy',
    ],
    /** Thiệp chỉ gửi được trong sự kiện. */
    cards: [
      { id: 'hoa-hong', icon: '🌹', title: 'Tri ân Thầy Cô', colors: ['#FCE4EC', '#D81B60'] },
      { id: 'sach-but', icon: '📚', title: 'Cảm ơn người lái đò', colors: ['#E3F2FD', '#1750B5'] },
      { id: 'trai-tim', icon: '💝', title: 'Biết ơn bạn thật nhiều', colors: ['#FFF8E1', '#C49C57'] },
    ],
    /** Xu thưởng thêm cho người gửi và người nhận thiệp (cộng vào lời cảm ơn thường). */
    cardBonusCoins: 5,
  },
];

/** Câu hỏi chỉ xuất hiện khi sự kiện đang diễn ra (a[0] là đáp án đúng). */
export const EVENT_QUESTIONS = [
  { event: 'tri-an-2011', topic: 'event', q: 'Ngày 20/11 hằng năm là ngày gì?', a: ['Ngày Nhà giáo Việt Nam', 'Ngày Phụ nữ Việt Nam', 'Ngày Sách và Văn hoá đọc', 'Ngày Khoa học và Công nghệ'] },
  { event: 'tri-an-2011', topic: 'event', q: 'Ngày 20/11 chính thức mang tên "Ngày Nhà giáo Việt Nam" từ năm nào?', a: ['1982', '1958', '1975', '1990'], explain: 'Quyết định 167-HĐBT ngày 28/9/1982 lấy ngày 20/11 làm Ngày Nhà giáo Việt Nam.' },
  { event: 'tri-an-2011', topic: 'event', q: 'Trước năm 1982, ngày 20/11 ở Việt Nam được kỷ niệm với tên gọi nào?', a: ['Ngày Quốc tế Hiến chương các nhà giáo', 'Ngày Khuyến học', 'Ngày Sách Việt Nam', 'Ngày Tựu trường'], explain: 'Từ năm 1958, Việt Nam kỷ niệm "Ngày Quốc tế Hiến chương các nhà giáo" vào 20/11.' },
  { event: 'tri-an-2011', topic: 'event', q: 'Ngày Nhà giáo Thế giới (do UNESCO khởi xướng) là ngày nào?', a: ['5/10', '20/11', '1/6', '8/9'] },
  { event: 'tri-an-2011', topic: 'event', q: 'Hoàn thành câu ca dao: "Muốn sang thì bắc cầu Kiều, muốn con hay chữ thì…"', a: ['yêu lấy thầy', 'chăm học bài', 'mua nhiều sách', 'đi học sớm'] },
  { event: 'tri-an-2011', topic: 'event', q: 'Theo tục ngữ "Mồng một tết cha, mồng hai tết mẹ…", Tết thầy là ngày nào?', a: ['Mồng ba', 'Mồng bốn', 'Rằm tháng Giêng', 'Mồng năm'] },
  { event: 'tri-an-2011', topic: 'event', q: '"Tôn sư trọng đạo" có nghĩa là gì?', a: ['Tôn kính thầy, coi trọng đạo lý', 'Tôn trọng luật giao thông', 'Học giỏi để làm thầy', 'Chỉ nghe lời thầy dạy'] },
  { event: 'tri-an-2011', topic: 'event', q: '"Nhất tự vi sư, bán tự vi sư" muốn nói điều gì?', a: ['Dạy ta một chữ, nửa chữ cũng là thầy', 'Một người thầy dạy nửa lớp', 'Chỉ cần học một chữ mỗi ngày', 'Thầy giỏi hơn trò một nửa'] },
  { event: 'tri-an-2011', topic: 'event', q: 'Câu tục ngữ nào nói về vai trò không thể thiếu của người thầy?', a: ['Không thầy đố mày làm nên', 'Ăn quả nhớ kẻ trồng cây', 'Có công mài sắt có ngày nên kim', 'Gần mực thì đen, gần đèn thì rạng'] },
  { event: 'tri-an-2011', topic: 'event', q: 'Người thầy nổi tiếng thời Trần, từng dâng "Thất trảm sớ", là ai?', a: ['Chu Văn An', 'Nguyễn Trãi', 'Lê Quý Đôn', 'Nguyễn Bỉnh Khiêm'] },
  { event: 'tri-an-2011', topic: 'event', q: 'Quốc Tử Giám — được xem là trường đại học đầu tiên của Việt Nam — lập năm nào?', a: ['1076', '1010', '1225', '1428'] },
  { event: 'tri-an-2011', topic: 'event', q: '"Vì lợi ích mười năm thì phải trồng cây, vì lợi ích trăm năm thì phải…"', a: ['trồng người', 'xây trường', 'đọc sách', 'giữ rừng'], explain: 'Lời Chủ tịch Hồ Chí Minh về sự nghiệp giáo dục.' },
  { event: 'tri-an-2011', topic: 'event', q: 'Hình ảnh "người lái đò" trong văn thơ thường ẩn dụ cho ai?', a: ['Thầy cô giáo', 'Người nông dân', 'Bác sĩ', 'Người lính'] },
  { event: 'tri-an-2011', topic: 'event', q: 'Gửi lời tri ân để người khác thấy được quan tâm, trân trọng — đó là biểu hiện của giá trị nào ở VA?', a: ['Nhân ái', 'Khai phóng', 'Bản lĩnh', 'Tri thức'], explain: 'Nhân ái là biết nghĩ cho người khác.' },
];

/**
 * Sự kiện đang diễn ra theo ngày (MM-DD); hỗ trợ sự kiện vắt qua năm mới.
 *
 * @param {Date} date
 * @param {{ id?: string, mode?: 'auto' | 'on' | 'off' } | null} [override]
 * @returns {string | null} id sự kiện
 */
export function activeEventId(date, override = null) {
  if (override?.mode === 'on' && override.id) return override.id;
  if (override?.mode === 'off') return null;
  const md = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const e = EVENTS.find((ev) => (ev.start <= ev.end ? md >= ev.start && md <= ev.end : md >= ev.start || md <= ev.end));
  return e?.id ?? null;
}

/**
 * @param {string | null | undefined} id
 * @returns {(typeof EVENTS)[number] | undefined}
 */
export function getEvent(id) {
  return EVENTS.find((e) => e.id === id);
}
