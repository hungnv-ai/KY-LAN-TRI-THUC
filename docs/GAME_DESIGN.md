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

## Cơ chế giữ chân

Chuỗi ngày + Khiên bảo vệ · 3 nhiệm vụ ngày + 1 nhiệm vụ tuần + Rương · Giờ Vàng x2 XP
(12h–13h, 19h–21h) · 5 Nhà theo 5 giá trị + Cúp Kỳ Lân hàng tháng · BXH tuần theo lớp/khối/cơ sở
· Mùa giải theo học kỳ + trang phục giới hạn · Tủ đồ 4 độ hiếm, thăm và thả tim · Không tiền thật,
không gacha; giới hạn thời gian chơi cho học sinh.

## Lộ trình

1. ✅ **GĐ1 – Bản chơi thử** (đang review): Kỳ lân 3D đúng mascot, tủ đồ, quiz, Xu/XP/hạng (lưu tạm trên máy), deploy Vercel.
2. **GĐ2:** Đăng nhập Google + Supabase, BXH, nhiệm vụ ngày, chuỗi ngày.
3. **GĐ3:** 5 Nhà, Cúp, công cụ soạn câu hỏi cho GV, dashboard thống kê.
4. **GĐ4:** Tên miền riêng, tối ưu tốc độ, model 3D chất lượng cao.
