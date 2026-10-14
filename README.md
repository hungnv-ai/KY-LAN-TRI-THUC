# Kỳ Lân Tri Thức

Game giáo dục 3D trên web của VA Schools (Vite + Three.js + Supabase). Người chơi điều khiển
Kỳ lân VA chạy trên đảo 5 Vùng Đất, trả lời câu hỏi về 5 giá trị cốt lõi, tích XP lên 7 hạng,
kiếm Xu mua trang phục và gặp đồng nghiệp ngay trên đảo.

- Game: https://ky-lan-tri-thuc.vercel.app (sau này: https://game.vaschools.edu.vn)
- Trang quản trị: `/admin`

## Cài đặt để chơi thật (người không lập trình)

Làm theo **[docs/HUONG_DAN_TRIEN_KHAI.md](./docs/HUONG_DAN_TRIEN_KHAI.md)**. Hướng dẫn từng bước
bấm chuột cho Supabase, đăng nhập Google, Vercel và tên miền riêng.
Chưa cài thì game vẫn chạy ở chế độ ngoại tuyến (lưu trên máy).

## Tính năng

- **Kỳ lân VA 3D** đúng mascot: 9 cảm xúc theo bộ sticker, 23 món trang phục
- **Khám phá Vùng Đất**: phím mũi tên/WASD hoặc cần điều khiển; câu hỏi mỗi 100 m, xu vàng, hộp quà
- **Tri Thức**: 106 câu hỏi, Giờ Vàng x2 XP; điểm danh, chuỗi ngày 🔥, 3 nhiệm vụ ngày + rương
- **7 hạng** (Tập Sự → Kỳ Lân Huyền Thoại), **5 Nhà** và Cúp tháng, bảng xếp hạng
- **Nhiều người chơi**: thấy Kỳ lân của nhau (bảng tên, hạng, trang phục), thả tim, gửi lời cảm ơn
- **Đăng nhập Google** chỉ email `@vaschools.edu.vn`; máy chủ tính điểm, chống gian lận
- **Trang quản trị**: thống kê, soạn/duyệt câu hỏi (nhập CSV), phân quyền, Phiếu quà
- Hiệu ứng và âm thanh nhận thưởng, tự giảm chất lượng trên máy yếu, cài như ứng dụng (PWA)

## Dành cho lập trình viên

```bash
npm install
npm run dev        # ngoại tuyến; thêm .env.local (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) để trực tuyến
npm run build
npm run gen:sql    # sinh supabase/setup.sql
npm run test:sql   # kiểm thử máy chủ (PostgreSQL 16)
```

- Thiết kế game: [docs/GAME_DESIGN.md](./docs/GAME_DESIGN.md)
- Quy tắc viết code: [CLAUDE.md](./CLAUDE.md)
