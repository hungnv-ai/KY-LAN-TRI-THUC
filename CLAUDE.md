# CLAUDE.md — Kỳ Lân Tri Thức

Game giáo dục 3D trên web cho VA Schools. Nhân vật chính là **linh vật Kỳ lân của trường**
(đỏ, chibi, sừng vàng, lông mày vàng xoắn, tay 4 ngón — KHÔNG phải ngựa trắng có sừng), có thể
thay trang phục/phụ kiện. **Đọc `docs/GAME_DESIGN.md` trước** — đó là thiết kế game đã thống nhất
với người dùng (hạng, XP/Xu, 5 giá trị, lộ trình, màu & font thương hiệu).

Người dùng là người mới học lập trình: giải thích bằng tiếng Việt đơn giản, hướng dẫn từng bước
có thể làm theo bằng cách bấm chuột; Claude viết toàn bộ code.

## Stack

- **Vite** (dev server + build), **Three.js** (`three` + `three/addons/...`), HTML5/CSS thuần.
- JavaScript ES Modules (không TypeScript, không framework UI). Không thêm dependency mới
  nếu chưa thật sự cần — hỏi người dùng trước.

## Lệnh

```bash
npm install       # cài dependency
npm run dev       # chạy dev server
npm run build     # build production vào dist/ — chạy lệnh này để kiểm tra trước khi commit
npm run preview   # xem bản build
```

## Cấu trúc thư mục

```
docs/GAME_DESIGN.md   # thiết kế game đã chốt — nguồn sự thật cho tính năng
docs/mascot-reference/ # ẢNH MẪU mascot chuẩn + bảng sticker → cảm xúc — đối chiếu khi chỉnh hình 3D
index.html            # canvas + HUD + thanh điều hướng + bảng trượt + toast + loading
src/
  main.js             # entry: lắp ráp module + animation loop duy nhất
  config.js           # hằng số cân bằng game (điểm thưởng, Giờ Vàng, giới hạn ngày), màu 5 giá trị
  style.css           # giao diện (màu & font Be Vietnam Pro theo Design System VA)
  data/               # dữ liệu tĩnh, không logic
    ranks.js          # 7 hạng + getRankInfo(xp)
    items.js          # danh mục trang phục, slot, độ hiếm
    questions.js      # ngân hàng câu hỏi (a[0] luôn là đáp án đúng)
    lines.js          # câu thoại của Kỳ lân
  game/               # logic thuần, KHÔNG đụng DOM/Three.js
    progress.js       # XP, Xu, hạng, tủ đồ, điểm danh, chuỗi ngày, lưu trữ
    quiz.js           # tạo lượt quiz, xáo đáp án
    storage.js        # localStorage an toàn (GĐ2 thay bằng Supabase)
    time.js           # ngày, Giờ Vàng
  scene/              # Three.js
    world.js          # renderer, camera, OrbitControls, chạm vào object
    lights.js         # ánh sáng + environment map
    stage.js          # nền trời, bục 5 màu, 5 cột Vùng Đất
    mascot.js         # Kỳ lân VA: lắp ráp thân/đầu, nét mặt, tư thế, emote(), setMood()
    mascotParts.js    # dựng chi tiết: bờm lửa cánh hoa, sừng, mắt/miệng nhiều kiểu, tay, huy hiệu
    emotes.js         # bộ cảm xúc theo sticker (wave, happy, cheer, oops, think, cry, faint, cool, bored)
    outfits.js        # dựng & gắn trang phục 3D theo item.model
    loader.js         # tải .glb (để dành cho model 3D thật ở GĐ4)
  ui/                 # DOM
    dom.js            # h() tạo phần tử, formatNumber
    hud.js            # thanh hạng/XP/Xu/chuỗi + loading
    feedback.js       # toast, hộp thoại xác nhận/chúc mừng, bong bóng thoại
    sheet.js          # bảng trượt dùng chung
    quizView.js / wardrobeView.js / ranksView.js
```

## Quy tắc viết code mô-đun hoá

1. **Một module = một trách nhiệm.** Không nhồi logic mới vào `main.js`. `main.js` chỉ
   lắp ráp (wiring) các module và chạy vòng lặp. Tính năng mới → file mới đúng thư mục
   (`data/` dữ liệu, `game/` logic, `scene/` 3D, `ui/` giao diện).
2. **Chỉ dùng named export.** Không `export default`. Module xuất hàm `setupX(scene)` /
   `createX()` trả về object cần thiết; không dựa vào biến toàn cục hay `window.*`.
3. **Không side-effect khi import**, trừ việc lấy tham chiếu DOM cố định trong `ui/*`.
   Khởi tạo phải được gọi tường minh từ `main.js`.
4. **Ranh giới DOM:** chỉ các module `ui/*` được đụng tới DOM (dùng `h()` — không chèn
   `innerHTML` từ dữ liệu). Nơi khác gọi API của chúng (`showToast`, `renderHud`…).
5. **Kỳ lân & trang phục.** Nhân vật dựng trong `scene/mascot.js` + `mascotParts.js`, giữ đủ nét
   nhận diện bắt buộc (đầu đỏ, sừng vàng, lông mày vàng xoắn, tay 4 ngón, bờm lửa cánh hoa, áo VA).
   **Luôn đối chiếu ảnh trong `docs/mascot-reference/`** trước/sau khi chỉnh hình.
   - Phản ứng của Kỳ lân: gọi `mascot.emote('tên')` (một lần) hoặc `mascot.setMood('tên' | null)`
     (kéo dài, ví dụ `think` khi đang làm quiz). Thêm cảm xúc mới = thêm entry trong `emotes.js`. Điểm gắn phụ kiện:
   `HeadTop`, `Face`, `Torso`, `Back`, `FootL/FootR`, `Root` (`mascot.anchors`).
   - Thêm trang phục = thêm entry vào `data/items.js` (+ builder trong `scene/outfits.js`
     nếu là `model` mới). Mỗi slot chỉ mặc một món; `createWardrobe().equip` tự gỡ món cũ.
   - File `.glb` chỉ tải qua `scene/loader.js`; không tạo `GLTFLoader` ở nơi khác.
6. **Logic game tách khỏi giao diện.** `game/*` không đụng DOM/Three.js; UI gọi API của
   `game/progress.js`. GĐ2 chuyển tính điểm sang server nhưng giữ nguyên API đó.
7. **Vòng lặp duy nhất:** chỉ có `renderer.setAnimationLoop` trong `main.js`. Module cần
   cập nhật theo frame thì xuất `update(delta, elapsed)` và được gọi từ hàm `update` của
   `main.js`. Dùng `delta` (giây) cho mọi chuyển động, không giả định FPS cố định.
8. **Three.js hiện đại (r18x):** import addon từ `three/addons/...`; dùng `THREE.Timer`
   (không dùng `THREE.Clock` — đã deprecated); dùng `PCFShadowMap` (`PCFSoftShadowMap`
   đã bị gỡ). Mesh mới cần đặt `castShadow`/`receiveShadow` phù hợp.
9. **Giải phóng bộ nhớ:** khi gỡ object khỏi scene vĩnh viễn, `dispose()` geometry,
   material, texture không còn dùng (xem `disposeTree` trong `outfits.js`). Lưu ý `loadGLB`
   trả bản clone dùng chung geometry/material với cache — không dispose tài nguyên đang cache.
10. **Hằng số đặt tên rõ ràng**, gom ở đầu file hoặc `src/config.js` khi dùng ở nhiều nơi.
   Không "magic number" rải rác.
11. **Tài liệu & đặt tên:** mỗi hàm export có JSDoc ngắn (mô tả, `@param`, `@returns`).
    Comment và text hiển thị cho người chơi viết bằng **tiếng Việt**; tên biến/hàm bằng
    tiếng Anh: `camelCase` cho hàm/biến, `PascalCase` cho class, `UPPER_SNAKE_CASE`
    cho hằng số.
12. **Style:** 2 spaces, dấu nháy đơn, có dấu chấm phẩy, trailing comma ở multiline.
13. **Hiệu năng:** `pixelRatio` tối đa 2; tránh tạo object mới (`new Vector3`, …) trong
    vòng lặp — tái sử dụng biến tạm ở cấp module.

## Quy trình cho mỗi phiên làm việc

- Đọc file này và các module liên quan trước khi sửa.
- Thay đổi nhỏ, tập trung; chạy `npm run build` (và `npm run dev` để kiểm tra trực quan
  nếu có thể) trước khi commit.
- Cập nhật mục **Cấu trúc thư mục** ở trên khi thêm/xoá module.
