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
npm run dev       # chạy dev server (không có .env.local → chế độ ngoại tuyến, lưu trên máy)
npm run build     # build production vào dist/ — chạy lệnh này để kiểm tra trước khi commit
npm run preview   # xem bản build
npm run gen:sql   # sinh lại supabase/setup.sql từ supabase/sql/*.sql + dữ liệu trong src/
npm run test:sql  # chạy kiểm thử máy chủ trên PostgreSQL 16 tạm (cần initdb/pg_ctl)
```

Chế độ trực tuyến bật khi có `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (Vercel env hoặc
`.env.local`). Hướng dẫn cài đặt cho người dùng: `docs/HUONG_DAN_TRIEN_KHAI.md`.

## Cấu trúc thư mục

```
docs/GAME_DESIGN.md   # thiết kế game đã chốt — nguồn sự thật cho tính năng
docs/HUONG_DAN_TRIEN_KHAI.md # hướng dẫn bấm chuột: Supabase, Google, Vercel, tên miền
docs/mascot-reference/ # ẢNH MẪU mascot chuẩn + bảng sticker → cảm xúc — đối chiếu khi chỉnh hình 3D
index.html            # game: canvas + HUD + thanh điều hướng + bảng trượt + toast + loading
admin.html            # trang quản trị (/admin) cho giáo viên, BGH, quản trị
vercel.json           # cache, header bảo mật, cleanUrls
public/               # icon, manifest.webmanifest + sw.js (PWA), og-image
supabase/
  sql/01..10_*.sql    # máy chủ: 01 bảng, 02 hàm phụ, 03 RPC người chơi, 04 xã hội, 05 nhân viên,
                      #   06 quyền (luôn chạy cuối), 07 đổi quà, 08 thú cưng, 09 sự kiện, 10 Rung Chuông Vàng
  setup.sql           # SINH TỰ ĐỘNG (npm run gen:sql) — file người dùng dán vào SQL Editor
  tests/              # auth_stub.sql + test_game.sql (npm run test:sql)
scripts/              # gen-seed.mjs (sinh setup.sql), test-sql.sh
src/
  main.js             # entry: lắp ráp module + animation loop duy nhất
  config.js           # hằng số cân bằng game (điểm thưởng, Giờ Vàng, giới hạn ngày…) — cũng được
                      #   gen-seed.mjs đẩy vào bảng game_settings, nên máy chủ dùng cùng con số
  tokens.css / components.css / style.css  # màu-font VA, nút/hộp thoại dùng chung, giao diện game
  data/               # dữ liệu tĩnh, không logic (cũng được sinh vào setup.sql)
    ranks.js          # 7 hạng + getRankInfo(xp)
    items.js          # danh mục trang phục, slot, độ hiếm
    questions.js      # ngân hàng câu hỏi (a[0] luôn là đáp án đúng)
    lines.js          # câu thoại của Kỳ lân
    stickers.js       # 12 sticker gửi nhanh (bộ cố định)
    gifts.js          # quà hiện vật ban đầu (đổi bằng Xu; BGH sửa trong trang quản trị)
    pets.js           # 8 thú cưng + thông số dựng hình (look) + tỉ lệ nở
    events.js         # sự kiện theo mùa (lịch MM-DD, thiệp, câu hỏi sự kiện) + activeEventId()
  game/               # logic thuần, KHÔNG đụng DOM/Three.js
    progress.js       # mặt tiền duy nhất UI gọi: đọc đồng bộ, ghi bất đồng bộ (trả {state})
    localBackend.js   # luật thưởng chạy trên máy (ngoại tuyến) — giữ khớp với supabase/sql
    remoteBackend.js  # gọi RPC Supabase cùng tên hàm
    missions.js       # nhiệm vụ ngày (chọn theo ngày) + tiến độ
    milestones.js     # mốc quãng đường (1–42 km): mốc kế tiếp, huy hiệu bảng tên
    storage.js        # localStorage an toàn
    time.js           # ngày (giờ VN), Giờ Vàng
    bellClock.js      # đồng hồ trận Rung Chuông Vàng (cùng công thức với _bell_phase)
    localBell.js      # Rung Chuông Vàng luyện tập ngoại tuyến (bạn ảo, cùng luật máy chủ)
  net/
    supabase.js       # client (tải lười), đăng nhập Google, kiểm tra tên miền email
    multiplayer.js    # cùng đảo: Realtime presence/broadcast (hoặc BroadcastChannel khi ngoại tuyến)
  audio/sfx.js        # âm thanh tổng hợp bằng Web Audio (không file âm thanh), nút tắt tiếng
  scene/              # Three.js
    world.js          # renderer, camera, OrbitControls, chạm vào object, lệch khung khi mở bảng
    lights.js         # ánh sáng + environment map
    island.js         # hòn đảo: quảng trường, 5 đường đi, 5 Vùng Đất (cột + cảnh), va chạm, độ cao
    movement.js       # điều khiển nhân vật theo hướng camera, va chạm, quay mặt
    pickups.js        # xu vàng rơi & hộp quà bất ngờ (hiển thị + phát hiện nhặt)
    mascot.js         # Kỳ lân VA: lắp ráp thân/đầu, nét mặt, tư thế, emote(), setMood()
    mascotParts.js    # dựng chi tiết: bờm lửa cánh hoa, sừng, mắt/miệng nhiều kiểu, tay, huy hiệu
    emotes.js         # bộ cảm xúc theo sticker (wave, happy, cheer, oops, think, cry, faint, cool, bored)
    outfits.js        # dựng & gắn trang phục 3D theo item.model
    fx.js             # hạt hiệu ứng (xu, sao, vòng sáng) dùng pool
    nameTag.js        # bảng tên trên đầu: tên, hạng, Nhà
    remotePlayers.js  # Kỳ lân người khác: nội suy, LOD theo khoảng cách
    quality.js        # tự giảm/tăng chất lượng theo FPS
    stickerBubble.js  # bong bóng sticker cạnh đầu Kỳ lân
    pets.js           # thú cưng chibi dựng bằng code + đi theo chủ
    eventDecor.js     # trang trí đảo theo sự kiện (cổng hoa, cánh hoa rơi)
    goldenBell.js     # chuông vàng 3D trên quảng trường
    scenery.js        # cảnh trang trí: mây, nước nông, đảo xa, hoa trên cỏ, chim
    labelFader.js     # biển chữ mờ dần khi ở xa (sprite.userData.fade = { near, far, overview })
    dayCycle.js       # ngày–hoàng hôn–đêm theo giờ VN (?time=19.5 để xem thử): trời, nắng, sao, đèn lồng, đom đóm
    sea.js            # biển lấp lánh, cá nhảy, thuyền buồm VA
    zoneGrowth.js     # trang trí Vùng Đất theo cấp 0–4 (hoa → pha lê → sao → cầu vồng)
    loader.js         # tải .glb (để dành cho model 3D thật)
  ui/                 # DOM
    dom.js            # h() tạo phần tử, formatNumber
    hud.js            # thanh hạng/XP/Xu/chuỗi, thanh Khám phá, số người online, nút âm thanh
    feedback.js       # toast, hộp thoại xác nhận/chúc mừng, bong bóng thoại
    sheet.js          # bảng trượt dùng chung (variant 'side' = không che Kỳ lân)
    controls.js       # bàn phím (mũi tên/WASD/Shift) + cần điều khiển ảo trên điện thoại
    accountView.js    # màn hình đăng nhập + đặt bảng tên
    profileCard.js    # thẻ người chơi khác: thả tim, gửi lời cảm ơn
    flyFx.js          # xu/XP "bay" lên HUD
    quickActions.js   # cột nút tròn bên phải (sticker, ảnh, quà, thú cưng, sự kiện, 🔔) + bảng chọn sticker
    photoView.js      # đếm ngược, khung ảnh VA, tải về/chia sẻ
    giftShopView.js / petView.js / cardView.js / eventView.js / bellView.js
    peopleView.js     # danh sách người cùng đảo (bấm 👥) + nút "Tới chỗ bạn"
    milestonesView.js # bảng mốc quãng đường (bấm ô 🏃)
    quizView.js / wardrobeView.js / ranksView.js / todayView.js / quickQuestionView.js
  features/           # điều phối 1 tính năng lớn: nối scene + game + ui (không chứa luật thưởng)
    session.js        # khởi động: ngoại tuyến hay đăng nhập + hồ sơ
    rewards.js        # hiệu ứng nhận thưởng, lên hạng
    milestones.js     # mốc quãng đường: bấm ô 🏃 xem mốc, ăn mừng khi vừa qua mốc
    menu.js           # các nút điều hướng → mở bảng tương ứng
    explore.js        # Khám phá Vùng Đất: chạy, câu hỏi mỗi 100 m, cột Vùng Đất, xu, hộp quà
    social.js         # nhiều người chơi trên đảo + chạm vào Kỳ lân người khác + thiệp sự kiện
    expressions.js    # sticker + chụp ảnh nhóm
    giftShop.js       # đổi Xu lấy quà hiện vật
    pets.js           # thú cưng của mình + trứng nở khi điểm danh
    events.js         # sự kiện theo mùa: trang trí + nút sự kiện
    goldenBell.js     # Rung Chuông Vàng: lịch trận, điều khiển bảng thi theo đồng hồ máy chủ
    overview.js       # 🔭 Toàn cảnh đảo (camera bay lên cao / bay về)
    intro.js          # màn chào: camera lượn quanh đảo (mỗi lần vào game, chạm để bỏ qua)
    zoneGrowth.js     # Vùng Đất lớn lên theo XP tháng của Nhà (house_standings, ZONE_GROWTH)
  admin/              # trang quản trị (chỉ chạy trực tuyến)
    main.js           # đăng nhập, khung sidebar, điều hướng theo #hash, nhận quyền admin đầu tiên
    api.js / widgets.js / charts.js / admin.css
    pages/            # dashboard, questions (CSV), players (vai trò), bell (Rung Chuông Vàng),
                      #   vouchers (+ danh mục quà), settings (+ bật/tắt sự kiện)
```

## Quy tắc viết code mô-đun hoá

1. **Một module = một trách nhiệm.** Không nhồi logic mới vào `main.js`. `main.js` chỉ
   lắp ráp (wiring) các module và chạy vòng lặp. Tính năng mới → file mới đúng thư mục
   (`data/` dữ liệu, `game/` logic & luật thưởng, `scene/` 3D, `ui/` giao diện,
   `features/` điều phối một tính năng lớn dùng cả ba lớp).
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

## Máy chủ (Supabase) — quy tắc riêng

- **Máy chủ là trọng tài**: mọi phần thưởng tính trong hàm RPC `security definer`
  (`supabase/sql/`). Bảng bật RLS; trình duyệt không ghi bảng trực tiếp. Đáp án câu hỏi không
  bao giờ gửi xuống trình duyệt (dùng "vé câu hỏi").
- Đổi luật thưởng ở **cả hai** nơi: `game/localBackend.js` và hàm SQL tương ứng; con số lấy từ
  `src/config.js` (máy chủ đọc qua `game_settings` / `_cfg`). Thêm hàm RPC mới → thêm wrapper
  cùng tên trong `game/remoteBackend.js` (hoặc `admin/api.js`).
- SQL phải **chạy lại được nhiều lần**: `create … if not exists`, `create or replace function`,
  `drop policy if exists`. Cột mới cho bảng đã có → `alter table … add column if not exists`
  (vì `create table if not exists` không thêm cột). Hàm tên bắt đầu bằng `_` là nội bộ (bị thu
  quyền ở `06_realtime_grants.sql`), không gọi từ RLS policy.
- Câu hỏi sự kiện (`EVENT_QUESTIONS`) không được trùng chữ với câu hỏi thường (gen-seed báo lỗi).
- Rung Chuông Vàng chạy theo đồng hồ: đổi công thức thời gian thì sửa cả `_bell_phase` (SQL) và
  `game/bellClock.js`; luật chốt vòng sửa cả `_bell_settle` và `game/localBell.js`.
- Sau khi sửa `supabase/sql/` hoặc dữ liệu trong `src/data/`, `src/config.js`: chạy
  `npm run gen:sql` + `npm run test:sql`, commit cả `setup.sql`, và nhắc người dùng chạy lại
  Bước 2 trong `docs/HUONG_DAN_TRIEN_KHAI.md`.
