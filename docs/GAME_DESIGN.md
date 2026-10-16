# Thiết kế game — Kỳ Lân Tri Thức (đã thống nhất 14/10/2026)

## Nhân vật

Linh vật Kỳ lân của VA Schools (KHÔNG phải ngựa trắng có sừng). Nét nhận diện bắt buộc:

- Đầu/bờm đỏ dạng ngọn lửa nhiều chóp, dáng chibi (đầu to)
- **Sừng vàng** xoắn trên đỉnh đầu
- **Lông mày vàng xoắn** (2 vòng xoắn)
- Mắt to tròn đen, mõm nhỏ, cười hiền
- **Bàn tay 4 ngón**, da đỏ cam
- Trang phục mặc định: áo khoác đỏ đô có logo VA, quần soóc nâu đỏ, giày đỏ đế kem, ba lô đen

Ảnh tham khảo: Google Drive thư mục thương hiệu VA Schools (các file `MASCOT*.png`, `mascot 1.png`...).

## Thương hiệu

- Màu 5 giá trị: Nhân Ái `#009082` · Bản Lĩnh `#725139` · Tri Thức `#9A0036` · Trách Nhiệm `#C49C57` · Khai Phóng `#1750B5`
- Font giao diện: **Be Vietnam Pro** (theo Design System Phòng Công Nghệ)
- Breakpoint: Mobile 375–767 · Tablet 768–1023 · Desktop ≥ 1024; spacing hệ 4px; contrast ≥ 4.5:1
- UX: mọi thao tác xoá phải hỏi lại + loading + toast góc phải

## Quyết định đã chốt

| Hạng mục | Quyết định |
|---|---|
| Người chơi giai đoạn đầu | Nội bộ giáo viên – nhân viên (2–4 tuần), sau đó mở cho học sinh |
| Câu hỏi đố vui | Claude soạn bộ mẫu ~100 câu (5 giá trị, văn hoá VA, kiến thức chung); sau này GV bổ sung |
| Hạng | 7 hạng, từ Đồng trở lên có bậc III–II–I |
| Đăng nhập | Google, chỉ email `@vaschools.edu.vn` |
| Hạ tầng | GitHub → Vercel (hosting) · Supabase (DB + Auth) · tên miền `game.vaschools.edu.vn` |

## Hai loại điểm

- **XP** — chỉ tăng, không tiêu, quyết định hạng.
- **Xu (Coins)** — tiêu để mua trang phục/phụ kiện.
- Mọi điểm phải được **tính và kiểm tra ở server** (chống sửa điểm từ trình duyệt).

## 7 hạng (giả định ~100 XP/ngày)

| Hạng | XP | Thưởng |
|---|---|---|
| Tập Sự | 0 | Áo khoác VA cơ bản |
| Thành Viên | 300 | Ba lô |
| Đồng | 1.500 | Khung avatar đồng |
| Bạc | 5.000 | Giày bạc |
| Vàng | 12.000 | Nón vàng + hiệu ứng |
| Kim Cương | 25.000 | Áo khoác viền kim cương |
| Kỳ Lân Huyền Thoại | 50.000 | Hào quang + danh hiệu |

## Vòng chơi theo 5 giá trị

- **Nhân Ái** — gửi "Lời cảm ơn" (cả hai được Xu, tối đa 3/ngày)
- **Bản Lĩnh** — Thử thách Boss cuối tuần, nhiệm vụ cho Nhà
- **Tri Thức** — Quiz 5 câu / 3 phút
- **Trách Nhiệm** — điểm danh, chuỗi ngày 🔥, làm lại câu sai vẫn được điểm
- **Khai Phóng** — mở vùng đất mới, mini-game sáng tạo

## Chế độ Khám phá Vùng Đất (đã làm)

- Điều khiển: mũi tên / WASD (Shift chạy nhanh); điện thoại dùng cần điều khiển ảo.
  Hướng chạy theo hướng camera; nút 🏠 về Quảng trường.
- Bản đồ: đảo bán kính ~30 m; Quảng trường ở giữa; 5 đường dẫn tới 5 Vùng Đất cách 16 m:
  Nhân Ái (vườn hoa, trái tim) · Bản Lĩnh (núi tuyết, đá) · Tri Thức (cây, chồng sách) ·
  Trách Nhiệm (cán cân, đồng hồ) · Khai Phóng (hồ, thuyền buồm, máy bay giấy).
- Thưởng (chỉnh trong `src/config.js` → `EXPLORE`):
  - Mỗi 100 m: 1 câu hỏi nhanh (đúng +5 XP +3 Xu, sai +1 XP), tối đa 6 câu có thưởng/ngày.
  - Chạm cột Vùng Đất: câu hỏi đúng giá trị đó (đúng +10 XP +8 Xu, sai +3 XP), mỗi cột 1 lần/ngày.
  - Ghé đủ 5 Vùng Đất trong ngày: "Nhà thám hiểm" +25 XP +25 Xu.
  - Xu vàng rơi: +1 Xu, tối đa 40/ngày. Hộp quà bất ngờ (cột sáng vàng): tối đa 5/ngày,
    60% Xu · 30% XP · 10% trang phục miễn phí.
- Quà hiện vật / "Phiếu quà": để GĐ2 (cần máy chủ chống gian lận, BGH duyệt).
- Mốc quãng đường (tổng mét cộng dồn mọi ngày; `src/config.js` → `MILESTONES`; bấm ô 🏃 để xem):
  1 km 👟 Bước chân đầu tiên +20 Xu · 5 km 🏃 Nhà thám hiểm nhỏ +50 Xu ·
  10 km 🧭 Lữ khách VA +100 Xu + Giày Lữ Khách (độc quyền) · 21 km 🥈 Bán marathon +150 Xu ·
  42 km 🏅 Marathon Kỳ Lân +300 Xu + bảng tên viền vàng. Máy chủ tự trao khi qua mốc, mỗi mốc 1 lần.
  Mốc cao nhất đã đạt hiện thành ô huy hiệu (vd 👟 1 km) bên phải bảng tên và trong danh sách 👥 — ai cũng thấy để thi đua.

## Tính năng mở rộng (đã làm, theo lựa chọn của người dùng)

- **Sticker & chụp ảnh nhóm**: 12 sticker cố định gửi cho mọi người cùng đảo (Kỳ lân làm cảm xúc
  tương ứng); chụp ảnh có đếm ngược và khung VA, tải về / chia sẻ.
- **Đổi Xu lấy quà thật**: cửa hàng quà hiện vật (sổ tay, bình nước, áo VA…), tối đa 2 phiếu chờ duyệt
  và 3 lần/tháng; BGH duyệt → trao tại trường; không duyệt → hoàn Xu tự động.
- **Thú cưng ấp trứng**: điểm danh 3 ngày → trứng nở 1 trong 8 bạn (Thường → Huyền thoại), dắt đi
  cùng, người khác nhìn thấy. Đủ bộ → trứng nở ra Xu.
- **Sự kiện theo mùa — Tuần lễ Tri ân 20/11** (10/11–22/11, BGH bật sớm được): cổng hoa + cánh hoa
  rơi, 3 trang phục giới hạn, thiệp tri ân (cả hai +5 Xu), 14 câu hỏi "Tôn sư trọng đạo".
- **Rung Chuông Vàng**: BGH hẹn giờ; cả trường cùng trả lời, sai là dừng chân, cả vòng sai thì cứu trợ;
  người trụ lại nhận XP + Xu (+ phiếu quà nếu ≤ 3 người). Ngoại tuyến có trận luyện tập với bạn ảo.

## Cơ chế giữ chân

Chuỗi ngày + Khiên bảo vệ · 3 nhiệm vụ ngày + 1 nhiệm vụ tuần + Rương · Giờ Vàng x2 XP
(12h–13h, 19h–21h) · 5 Nhà theo 5 giá trị + Cúp Kỳ Lân hàng tháng · BXH tuần theo lớp/khối/cơ sở
· Mùa giải theo học kỳ + trang phục giới hạn · Tủ đồ 4 độ hiếm, thăm và thả tim · Không tiền thật,
không gacha; giới hạn thời gian chơi cho học sinh.

## Lộ trình

1. ✅ **GĐ1 – Bản chơi thử**: Kỳ lân 3D đúng mascot, tủ đồ, quiz, Xu/XP/hạng (lưu tạm trên máy), deploy Vercel.
2. ✅ **Khám phá Vùng Đất** (thêm theo yêu cầu): chạy trên đảo, 5 Vùng Đất, câu hỏi theo quãng đường, xu, hộp quà.
3. ✅ **GĐ2 – Chơi thật**: đăng nhập Google `@vaschools.edu.vn`, lưu trên Supabase (máy chủ tính
   điểm, chống gian lận), nhiều người cùng đảo (bảng tên + hạng + trang phục), nhiệm vụ ngày + rương,
   thả tim / gửi lời cảm ơn, bảng xếp hạng, Phiếu quà.
4. ✅ **GĐ3 – Nhà & quản trị**: 5 Nhà theo 5 giá trị + Cúp tháng, trang `/admin` (thống kê, soạn/duyệt
   câu hỏi, nhập CSV, phân quyền, cấp/duyệt Phiếu quà, tên miền email được phép).
5. ✅ **GĐ4 – Hoàn thiện**: tự điều chỉnh chất lượng theo máy, cài như ứng dụng (PWA), biểu tượng,
   cache Vercel. Tên miền `game.vaschools.edu.vn`: chờ IT thêm bản ghi CNAME
   (xem `docs/HUONG_DAN_TRIEN_KHAI.md` Bước 8).

Việc của người dùng để chạy thật: làm theo `docs/HUONG_DAN_TRIEN_KHAI.md`.
6. ✅ **Mở rộng**: sticker & ảnh nhóm, đổi quà thật, thú cưng, sự kiện 20/11, Rung Chuông Vàng.

Ý tưởng tiếp theo (chưa làm): huy hiệu + quét QR sự kiện thật, mini-game ở 5 Vùng Đất, loa phát thanh
BGH, model 3D `.glb` vẽ bởi hoạ sĩ, mở cho học sinh, thêm sự kiện Tết / Trung thu.
