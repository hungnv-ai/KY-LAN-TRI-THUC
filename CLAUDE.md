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
index.html            # #canvas-container (Three.js) + #hud (Coins) + #loading-screen
vite.config.js
public/models/        # file .glb, phục vụ tại /models/...
  unicorn/unicorn.glb
  accessories/*.glb
src/
  main.js             # entry: Scene, Camera, Renderer, OrbitControls, animation loop, resize
  lights.js           # setupLights(scene): Hemisphere + Ambient + Directional (shadow)
  loader.js           # GLTFLoader, cache, loadUnicorn(), loadAccessory(), equipAccessory()
  hud.js              # mọi thao tác DOM của HUD (coins, loading)
  style.css
```

## Quy tắc viết code mô-đun hoá

1. **Một module = một trách nhiệm.** Không nhồi logic mới vào `main.js`. `main.js` chỉ
   lắp ráp (wiring) các module và chạy vòng lặp. Tính năng mới → file mới trong `src/`
   (ví dụ `src/wardrobe.js`, `src/quiz.js`); khi một nhóm lớn lên thì gom vào thư mục con
   (`src/ui/`, `src/systems/`, `src/entities/`).
2. **Chỉ dùng named export.** Không `export default`. Module xuất hàm `setupX(scene)` /
   `createX()` trả về object cần thiết; không dựa vào biến toàn cục hay `window.*`.
3. **Không side-effect khi import**, trừ việc lấy tham chiếu DOM cố định trong `hud.js`.
   Khởi tạo phải được gọi tường minh từ `main.js`.
4. **Ranh giới DOM:** chỉ các module UI (`hud.js`, sau này `src/ui/*`) được đụng tới DOM.
   Logic game gọi API của chúng (`addCoins(n)`, `setLoadingProgress(r)`), không tự
   `document.getElementById`.
5. **Tải tài nguyên chỉ qua `loader.js`.** Không tạo `GLTFLoader` ở nơi khác. Đường dẫn
   model khai báo trong `MODEL_PATHS` / `ACCESSORIES`. Thêm phụ kiện = thêm entry
   `{ path, slot, bone }` vào `ACCESSORIES` + đặt file `.glb` vào `public/models/accessories/`.
   - Mỗi `slot` (`head`, `feet`, …) chỉ mặc một món; `equipAccessory` tự gỡ món cũ.
   - `bone` là tên node trong model Kỳ lân để gắn phụ kiện; placeholder dùng tên
     `Root` và `Head` — model thật cũng phải giữ các tên này.
   - Khi chưa có file `.glb`, `loadUnicorn()` trả về placeholder — đừng xoá cơ chế này.
6. **Vòng lặp duy nhất:** chỉ có `renderer.setAnimationLoop` trong `main.js`. Module cần
   cập nhật theo frame thì xuất `update(delta, elapsed)` và được gọi từ hàm `update` của
   `main.js`. Dùng `delta` (giây) cho mọi chuyển động, không giả định FPS cố định.
7. **Three.js hiện đại (r18x):** import addon từ `three/addons/...`; dùng `THREE.Timer`
   (không dùng `THREE.Clock` — đã deprecated); dùng `PCFShadowMap` (`PCFSoftShadowMap`
   đã bị gỡ). Mesh mới cần đặt `castShadow`/`receiveShadow` phù hợp.
8. **Giải phóng bộ nhớ:** khi gỡ object khỏi scene vĩnh viễn, `dispose()` geometry,
   material, texture không còn dùng. Lưu ý `loadGLB` trả bản clone dùng chung
   geometry/material với cache — không dispose tài nguyên của model đang được cache.
9. **Hằng số đặt tên rõ ràng**, gom ở đầu file hoặc `src/config.js` khi dùng ở nhiều nơi.
   Không "magic number" rải rác.
10. **Tài liệu & đặt tên:** mỗi hàm export có JSDoc ngắn (mô tả, `@param`, `@returns`).
    Comment và text hiển thị cho người chơi viết bằng **tiếng Việt**; tên biến/hàm bằng
    tiếng Anh: `camelCase` cho hàm/biến, `PascalCase` cho class, `UPPER_SNAKE_CASE`
    cho hằng số.
11. **Style:** 2 spaces, dấu nháy đơn, có dấu chấm phẩy, trailing comma ở multiline.
12. **Hiệu năng:** `pixelRatio` tối đa 2; tránh tạo object mới (`new Vector3`, …) trong
    vòng lặp — tái sử dụng biến tạm ở cấp module.

## Quy trình cho mỗi phiên làm việc

- Đọc file này và các module liên quan trước khi sửa.
- Thay đổi nhỏ, tập trung; chạy `npm run build` (và `npm run dev` để kiểm tra trực quan
  nếu có thể) trước khi commit.
- Cập nhật mục **Cấu trúc thư mục** ở trên khi thêm/xoá module.
