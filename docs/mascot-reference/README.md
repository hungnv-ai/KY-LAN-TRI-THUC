# Ảnh mẫu mascot Kỳ lân VA Schools

Ảnh chuẩn do người dùng (VA Schools) cung cấp. **Dùng để đối chiếu mỗi khi chỉnh hình 3D**
trong `src/scene/mascot.js`, `mascotParts.js` và bộ cảm xúc `emotes.js`.
Nguồn gốc: Brand Guideline VA Schools + thư mục mascot trên Google Drive của trường.

| File | Nội dung |
|---|---|
| `01-dung-chuan-chong-hong.png` | Dáng chuẩn chính diện, hai tay chống hông |
| `02-vay-tay.png` | Vẫy tay chào, miệng cười há |
| `03-bo-sticker-cam-xuc.jpg` | Bộ sticker cảm xúc (xem bảng bên dưới) |
| `04-icon-nho.png` | Icon nhỏ (avatar) |
| `05-guideline-5-tu-the.png` | 5 tư thế: ló ra, giơ ngón cái, vẫy tay, chống hông, nghiêng |
| `06-guideline-icon-hoat-dong.png` | Icon hoạt động: viết bài, cười híp mắt, kính lúp, trồng cây, giúp bạn, thí nghiệm |
| `07-guideline-dung-thang.png` | Dáng đứng thẳng, nhìn rõ áo khoác + ba lô |

## Nét nhận diện bắt buộc (không được làm sai)

- Đầu **đỏ** (không cam), dáng chibi, đầu to ~45% chiều cao.
- **Bờm lửa bản rộng như cánh hoa** ôm quanh đầu: ngọn giữa đỉnh cao nhất (sau sừng), hai bên
  vuốt lên-ra ngoài, ngọn tầm má chĩa ngang như tai.
- **Sừng vàng** xoắn ở đỉnh trán. **Lông mày vàng xoắn ốc** ngay trên mắt.
- Mắt to tròn đen bóng, viền nâu, 2 đốm sáng. Mõm nhỏ, cười hiền.
- **Bàn tay 4 ngón**, tay & chân màu cam đỏ.
- Áo khoác đỏ đô có **logo VA** ngực trái, khoá kéo; quần soóc nâu đỏ; giày đỏ đế kem; ba lô đen.

## Sticker → cảm xúc trong game (`src/scene/emotes.js`)

| Sticker | Emote | Dùng khi |
|---|---|---|
| Vẫy tay | `wave` | Mở game, chạm vào Kỳ lân, đã điểm danh rồi |
| Giơ ngón cái + nháy mắt | `happy` | Trả lời đúng, mặc đồ đã có |
| Nhảy cẫng hai tay giơ cao | `cheer` | Điểm danh, đúng 5/5, lên hạng |
| Hoảng hốt (mắt trắng, tay ôm má) | `oops` | Trả lời sai |
| Suy nghĩ (tay chống cằm, ❓) | `think` | Đang làm quiz, xem đồ bị khoá |
| Khóc | `cry` | Thiếu Xu, quiz đúng < 40% |
| Ngất xỉu (mắt X, 👻) | `faint` | Hết giờ quiz |
| Đeo kính râm ngầu | `cool` | Mua đồ mới |
| Lườm / khoanh tay | `bored` | Không tương tác ~30 giây |

Chưa dùng (ý tưởng sau): ôm mặt ngồi buồn, kính lúp (khám phá), trồng cây (Trách Nhiệm),
viết bài (Tri Thức), giúp bạn (Nhân Ái), thí nghiệm (Khai Phóng).
