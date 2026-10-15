# Hướng dẫn triển khai Kỳ Lân Tri Thức (dành cho người cài đặt)

Tài liệu này hướng dẫn **từng bước bấm chuột** để đưa game từ chế độ "chơi thử trên máy"
sang **chơi thật**: đăng nhập bằng email trường, lưu điểm trên máy chủ, nhiều người cùng
thấy nhau trên đảo, trang quản trị cho giáo viên/BGH và tên miền `game.vaschools.edu.vn`.

> ⏱️ Thời gian: khoảng **45–60 phút** cho lần đầu.
> 💡 Bạn **không cần viết code**. Chỉ copy – dán – bấm nút. Phần code Claude đã làm xong.
> 🧭 Giao diện các trang web (Supabase, Google, Vercel) thỉnh thoảng đổi tên nút. Nếu không
> thấy đúng chữ như hướng dẫn, hãy tìm chữ gần giống, hoặc chụp màn hình gửi Claude.

## Tổng quan: 3 "nhà cung cấp" và vai trò của chúng

| Dịch vụ | Làm gì cho game | Bạn đã có chưa? |
|---|---|---|
| **GitHub** | Cất giữ mã nguồn | ✅ Có rồi |
| **Vercel** | Đưa game lên mạng (`ky-lan-tri-thuc.vercel.app`) | ✅ Có rồi |
| **Supabase** | Máy chủ: lưu điểm, xu, đồ, xếp hạng, nhiều người chơi | ⬜ Làm ở Bước 1–3 |
| **Google Cloud** | Nút "Đăng nhập bằng Google" chỉ cho email `@vaschools.edu.vn` | ⬜ Làm ở Bước 4–5 |

Thứ tự làm: **Bước 1 → 9**. Đừng nhảy cóc, vì bước sau cần thông tin của bước trước.

Chuẩn bị một file ghi chú (Notepad) để dán tạm 4 thông tin sẽ gặp trên đường đi:

```
1. Project URL (Supabase):         https://xxxxxxxx.supabase.co
2. Publishable key (Supabase):     sb_publishable_xxxxxxxx   (hoặc chuỗi dài bắt đầu bằng eyJ...)
3. Google Client ID:               xxxxxxxx.apps.googleusercontent.com
4. Google Client Secret:           GOCSPX-xxxxxxxx
```

> 🔒 Database password của Supabase và Google Client Secret là **bí mật**: không gửi qua
> Zalo/nhóm chat, không dán vào GitHub. Publishable key thì công khai được (nó nằm sẵn
> trong game), máy chủ đã có luật bảo vệ riêng.

---

## Bước 1 — Tạo dự án Supabase

1. Vào **https://supabase.com** → bấm **Start your project** (hoặc **Sign in**).
2. Đăng nhập bằng **GitHub** (bấm *Continue with GitHub*). Dùng luôn tài khoản GitHub
   của dự án là tiện nhất.
3. Nếu được hỏi tạo **Organization**: đặt tên `VA Schools`, gói **Free** → **Create organization**.
4. Bấm **New project** và điền:
   - **Project name**: `ky-lan-tri-thuc`
   - **Database Password**: bấm **Generate a password** → bấm biểu tượng copy → **dán vào
     ghi chú và cất kỹ** (chỉ cần khi có sự cố, nhưng mất là khó lấy lại).
   - **Region**: chọn **Southeast Asia (Singapore)** — gần Việt Nam nhất nên game nhanh nhất.
5. Bấm **Create new project** và chờ khoảng 1–2 phút đến khi trang hết chữ "Setting up project".

## Bước 2 — Cài đặt cơ sở dữ liệu (dán 1 file, bấm Run)

File cài đặt đã được Claude chuẩn bị sẵn: **`supabase/setup.sql`**. Nó tạo toàn bộ bảng,
luật thưởng chống gian lận, 106 câu hỏi, 7 hạng, 23 món đồ.

1. Mở thẳng bản "chữ thô" của file (đã đăng nhập GitHub):
   **https://github.com/hungnv-ai/KY-LAN-TRI-THUC/raw/main/supabase/setup.sql**
   → trình duyệt hiện một trang toàn chữ (code).
   (Cách đi bằng chuột: trang repo → bấm thư mục **supabase** trong danh sách file → bấm
   **setup.sql**. Nếu không thấy thư mục: kiểm tra ô nhánh ở góc trên trái đang là **main**.)
2. Bấm vào trang chữ đó → **Ctrl + A** (chọn hết) → **Ctrl + C** (copy).
   (Hoặc ở trang xem file thường, bấm nút **Copy raw file** — biểu tượng 2 tờ giấy chồng nhau,
   góc phải phía trên khung code.)
3. Quay lại Supabase → thanh bên trái bấm **SQL Editor** (biểu tượng `>_`).
4. Bấm **+ New query** (hoặc dấu **+**) để có trang trống.
5. Bấm vào khung trống → **Ctrl + V** để dán → bấm nút **Run** (góc phải dưới, hoặc
   **Ctrl + Enter**).
6. Nếu hiện hộp cảnh báo kiểu *"Potential issue detected … destructive operations"* → bấm
   **Run this query** / **Confirm**. (File có lệnh "xoá luật cũ rồi tạo lại" nên Supabase cảnh
   báo cho chắc — **không mất dữ liệu người chơi**.)
7. Kết quả đúng: phía dưới hiện **Success. No rows returned** (hoặc một bảng nhỏ).

✅ Kiểm tra nhanh: thanh bên trái → **Table Editor** → thấy các bảng `questions`, `items`,
`ranks`, `profiles`… Bấm `questions` thấy khoảng 106 dòng là đúng.

> 🔁 **Sau này** mỗi khi Claude báo "có cập nhật máy chủ", bạn chỉ cần làm lại Bước 2 với
> file `setup.sql` mới. Chạy lại bao nhiêu lần cũng được.

## Bước 3 — Lấy địa chỉ & khoá kết nối của Supabase

1. Ở trang dự án Supabase, bấm nút **Connect** trên thanh phía trên cùng.
2. Trong hộp hiện ra (tab **App Frameworks** hoặc tương tự), bạn sẽ thấy 2 dòng dạng:
   ```
   ..._SUPABASE_URL=https://abcdefgh.supabase.co
   ..._SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   (hoặc ..._ANON_KEY=eyJ...)
   ```
3. Copy **phần sau dấu `=`** của từng dòng vào ghi chú, mục 1 và 2.

Cách khác nếu không thấy nút Connect: thanh trái → **Project Settings** (bánh răng) →
**API Keys** → copy khoá **Publishable** (hoặc khoá **anon** ở tab *Legacy API keys*).
Project URL nằm ở **Project Settings → Data API** (hoặc trang tổng quan dự án).

> ⚠️ **Tuyệt đối không dùng** khoá tên **secret** / **service_role** cho game — khoá đó
> có toàn quyền, chỉ dành cho máy chủ.

## Bước 4 — Tạo "chìa khoá đăng nhập Google" trong Google Cloud

Mục tiêu: chỉ người có email `@vaschools.edu.vn` đăng nhập được.

> 👤 Dùng **chính tài khoản `@vaschools.edu.vn`** của bạn để làm bước này (không dùng Gmail
> cá nhân) — để chọn được chế độ **Internal** (chỉ người trong trường).

### 4a. Lấy địa chỉ "Callback" từ Supabase (cần dán sang Google)

1. Supabase → thanh trái **Authentication** → **Sign In / Providers** (có nơi ghi là
   **Providers**).
2. Kéo xuống tìm **Google** → bấm vào để mở ra.
3. Thấy ô **Callback URL (for OAuth)** dạng `https://abcdefgh.supabase.co/auth/v1/callback`
   → bấm copy. **Để nguyên tab này**, lát quay lại.

### 4b. Tạo dự án Google Cloud & màn hình đồng ý

1. Mở tab mới: **https://console.cloud.google.com** → đăng nhập bằng email trường.
2. Ở thanh trên cùng, bấm ô chọn dự án (cạnh logo Google Cloud) → **New project**
   → tên `Ky Lan Tri Thuc` → **Organization** để là `vaschools.edu.vn` → **Create**.
   Chờ vài giây rồi chọn đúng dự án vừa tạo.
   > **Báo "quota limit for creating projects" (hết lượt tạo dự án)?** Dùng chung một dự án có sẵn
   > của trường (ví dụ `VA Runners Vote`): chọn dự án đó, **bỏ qua 4b mục 3–4** (màn hình đồng ý đã
   > có), chỉ kiểm tra ở **Audience** thấy **Internal** (hoặc *In production*), rồi làm **4c** để tạo
   > **client mới riêng** cho game. **Không sửa client cũ** — sẽ làm hỏng đăng nhập của ứng dụng kia.
3. Ô tìm kiếm trên cùng gõ **Google Auth Platform** (hoặc vào menu ☰ → **APIs & Services**
   → **OAuth consent screen**) → bấm **Get started**.
4. Điền lần lượt:
   - **App name**: `Kỳ Lân Tri Thức`
   - **User support email**: chọn email của bạn → **Next**
   - **Audience**: chọn **Internal** → **Next**
   - **Contact information**: email của bạn → **Next**
   - Tick đồng ý chính sách → **Continue** → **Create**.

> Không thấy lựa chọn **Internal**? Nghĩa là tài khoản/dự án chưa thuộc Google Workspace
> của trường. Nhờ IT kiểm tra, hoặc tạm chọn **External** rồi ở mục **Audience** bấm
> **Publish app**. Dù chọn gì, máy chủ game **vẫn tự chặn** email ngoài `@vaschools.edu.vn`.

### 4c. Tạo Client (chìa khoá)

1. Trong Google Auth Platform → bấm **Clients** (thanh trái) → **+ Create client**.
2. **Application type**: chọn **Web application**. **Name**: `Ky Lan Tri Thuc Web`.
3. Mục **Authorized JavaScript origins** → **+ Add URI**, thêm lần lượt:
   ```
   https://ky-lan-tri-thuc.vercel.app
   https://game.vaschools.edu.vn
   ```
4. Mục **Authorized redirect URIs** → **+ Add URI** → dán **Callback URL** đã copy ở 4a
   (`https://abcdefgh.supabase.co/auth/v1/callback`).
5. Bấm **Create**. Hộp hiện **Client ID** và **Client secret** → copy cả hai vào ghi chú
   (mục 3 và 4). Nếu lỡ đóng: bấm lại vào tên client trong danh sách để xem.

## Bước 5 — Bật đăng nhập Google trong Supabase

1. Quay lại tab Supabase (Bước 4a, đang mở mục **Google**).
2. Gạt nút **Enable Sign in with Google** sang bật.
3. Dán **Client ID** (ô *Client IDs*) và **Client Secret** (ô *Client Secret (for OAuth)*).
4. Bấm **Save**.
5. Vẫn trong **Authentication**, bấm **URL Configuration**:
   - **Site URL**: `https://ky-lan-tri-thuc.vercel.app` → **Save**.
   - **Redirect URLs** → **Add URL**, thêm từng dòng (mỗi dòng bấm thêm một lần) → **Save URLs**:
     ```
     https://ky-lan-tri-thuc.vercel.app/**
     https://game.vaschools.edu.vn/**
     http://localhost:5173/**
     ```
   (Dòng `localhost` để Claude chạy thử trên máy. Hai dấu `**` nghĩa là "mọi trang con",
   gồm cả trang quản trị `/admin`.)

## Bước 6 — Nối game trên Vercel với Supabase

1. Vào **https://vercel.com** → mở dự án **ky-lan-tri-thuc**.
2. Bấm tab **Settings** → **Environment Variables**.
3. Thêm biến thứ nhất:
   - **Key**: `VITE_SUPABASE_URL`
   - **Value**: Project URL (ghi chú mục 1), ví dụ `https://abcdefgh.supabase.co`
   - **Environments**: để chọn cả **Production**, **Preview**, **Development** → **Save**.
4. Thêm biến thứ hai:
   - **Key**: `VITE_SUPABASE_ANON_KEY`
   - **Value**: Publishable key (ghi chú mục 2)
   - Chọn cả 3 môi trường → **Save**.
   > Tên biến phải gõ **đúng từng chữ** (chữ in hoa, có dấu gạch dưới). Không có dấu cách thừa.
5. **Bắt buộc build lại** để game nhận biến mới: tab **Deployments** → dòng trên cùng →
   bấm **⋯** → **Redeploy** → **Redeploy**. Chờ trạng thái **Ready** (khoảng 1 phút).

## Bước 7 — Chơi thử & nhận quyền Quản trị (làm ngay, trước khi thông báo)

1. Mở **https://ky-lan-tri-thuc.vercel.app** (nên dùng tab ẩn danh để chắc chắn bản mới).
2. Thấy màn hình **"Đăng nhập bằng Google"** là đã nối máy chủ thành công 🎉 → bấm vào →
   chọn email trường → vào game → điền **Tên hiển thị** và **Bộ phận / Lớp** → **Lưu & vào đảo**. (Game tự chia bạn vào một trong 5 Nhà cho cân bằng.)
3. Mở **https://ky-lan-tri-thuc.vercel.app/admin** → bấm nút
   **"Tôi là người cài đặt — nhận quyền Quản trị"**.
   > ⚠️ Nút này chỉ có tác dụng với **người đầu tiên** bấm. Vì vậy hãy làm ngay sau khi cài
   > xong, **trước khi gửi link cho mọi người**. Sau đó nút tự vô hiệu.
4. Trong trang quản trị → **Người chơi**: khi đồng nghiệp đã đăng nhập ít nhất 1 lần, tìm tên
   họ và đổi **Vai trò**:
   - **Giáo viên**: soạn/duyệt câu hỏi.
   - **Ban Giám hiệu**: xem thống kê, duyệt **Phiếu quà**.
   - **Quản trị**: toàn quyền (chỉ nên 1–2 người).

## Bước 8 — Tên miền riêng `game.vaschools.edu.vn`

Phần này cần **bộ phận IT** (người quản lý tên miền `vaschools.edu.vn`) thêm 1 dòng cấu hình.

1. Vercel → dự án → **Settings** → **Domains** → **Add Domain** → gõ
   `game.vaschools.edu.vn` → **Add** (nếu hỏi chuyển hướng www thì chọn mặc định).
2. Vercel báo **Invalid Configuration** và hiện bảng cần thêm, dạng:
   | Type | Name | Value |
   |---|---|---|
   | CNAME | game | `xxxxxx.vercel-dns-xxx.com` (hoặc `cname.vercel-dns.com`) |
   → Copy **đúng giá trị Vercel hiển thị** (mỗi dự án có thể khác).
3. Gửi IT tin nhắn mẫu dưới đây (thay giá trị CNAME):

   > Chào anh/chị IT, em cần tạo tên miền con cho game nội bộ "Kỳ Lân Tri Thức".
   > Nhờ anh/chị thêm bản ghi DNS cho tên miền vaschools.edu.vn:
   > • Loại: **CNAME** • Tên/Host: **game** • Giá trị: **xxxxxx.vercel-dns-xxx.com** • TTL: mặc định
   > (Nếu đang bật proxy Cloudflare thì để chế độ "DNS only" – đám mây xám.)
   > Em cảm ơn ạ!

4. Sau khi IT thêm (thường vài phút đến vài giờ), trang **Domains** của Vercel chuyển sang
   **Valid Configuration** ✅ và tự cấp ổ khoá **https**.
5. Hoàn tất: Supabase → **Authentication → URL Configuration** → đổi **Site URL** thành
   `https://game.vaschools.edu.vn` → **Save**. (Google và Redirect URLs đã thêm sẵn tên miền
   này ở Bước 4c và 5.)

## Bước 9 — Danh sách kiểm tra trước khi mời mọi người

Đánh dấu từng mục khi đã thử:

- [ ] Đăng nhập bằng email `@vaschools.edu.vn` vào được; email Gmail cá nhân **bị từ chối**.
- [ ] Điểm danh → nhận Xu/XP. Tải lại trang → điểm **vẫn còn**.
- [ ] Đăng nhập cùng tài khoản trên điện thoại → thấy **đúng số điểm** như trên máy tính.
- [ ] Hai người (2 máy khác nhau) vào game cùng lúc → **thấy Kỳ lân của nhau**, có bảng tên & hạng.
- [ ] Làm 1 lượt Tri Thức, chạy Khám phá nhặt xu, mở hộp quà.
- [ ] Tab **Hạng** → Bảng xếp hạng & Cúp 5 Nhà hiện đúng.
- [ ] Chạm vào Kỳ lân của đồng nghiệp → **❤️ Thả tim** / **💌 Gửi lời cảm ơn**.
- [ ] Trang `/admin`: Tổng quan có số liệu, **Ngân hàng câu hỏi** thêm thử 1 câu, cấp thử 1 Phiếu quà.
- [ ] Điện thoại: mở game bằng Chrome/Safari → **Thêm vào màn hình chính** → mở như ứng dụng.

---

## Dùng các tính năng mới (dành cho BGH / Quản trị)

| Muốn | Vào đâu |
|---|---|
| Hẹn giờ một trận **Rung Chuông Vàng** | `/admin` → **Rung Chuông Vàng** → **+ Tạo trận mới** (chọn giờ, số câu, giải). Phòng chờ mở trước 30 phút, Kỳ lân tự nhắc mọi người. |
| Xem / sửa **quà đổi bằng Xu** (giá, số lượng, ẩn/hiện) | `/admin` → **Phiếu quà** → tab **🛍️ Danh mục quà** |
| Duyệt phiếu đổi quà | `/admin` → **Phiếu quà** → **Chờ duyệt** (Không duyệt = tự hoàn Xu cho người chơi) |
| Mở **Tuần lễ Tri ân 20/11** sớm để xem thử | `/admin` → **Cài đặt & phân quyền** → **Sự kiện theo mùa** → chọn "Bật ngay" → **Áp dụng**. Xem xong chọn lại "Tự động theo lịch". |

## Cập nhật về sau

| Tình huống | Bạn làm gì |
|---|---|
| Claude sửa giao diện/game (file trong `src/`) | Merge Pull Request trên GitHub → Vercel tự cập nhật. |
| Claude báo **"có cập nhật máy chủ"** | Merge PR **và** làm lại **Bước 2** với `supabase/setup.sql` mới. |
| Thêm / sửa câu hỏi | Trang `/admin` → **Ngân hàng câu hỏi** (thêm từng câu hoặc nhập file CSV). |
| Cho phép thêm tên miền email (vd. học sinh) | `/admin` → **Cài đặt & phân quyền** → **Tên miền email được phép đăng nhập**. |
| Cấp/duyệt phần thưởng hiện vật | `/admin` → **Phiếu quà**. |

## Gặp sự cố?

| Dấu hiệu | Nguyên nhân thường gặp | Cách sửa |
|---|---|---|
| Game vẫn vào thẳng, **không có màn hình đăng nhập** | Chưa thêm biến môi trường hoặc chưa Redeploy | Kiểm tra lại Bước 6 (đúng tên biến), rồi Redeploy. Mở tab ẩn danh. |
| Google báo **Error 400: redirect_uri_mismatch** | Callback URL dán sai ở Google | Bước 4c mục 4: phải đúng `https://<mã>.supabase.co/auth/v1/callback`, không thừa dấu cách/`/`. |
| Google báo **"Access blocked … can only be used within its organization"** | Đang dùng Gmail cá nhân với ứng dụng Internal | Đăng nhập bằng email trường. Đây là đúng thiết kế. |
| Đăng nhập xong bị đưa về **localhost:3000** hoặc trang lỗi | Site URL / Redirect URLs chưa đúng | Làm lại Bước 5 mục 5. |
| Báo **"Email không thuộc trường"** | Email ngoài danh sách cho phép | Đúng thiết kế. Muốn mở thêm: `/admin` → Cài đặt & phân quyền. |
| Báo lỗi có chữ **function … does not exist** | Máy chủ chưa cập nhật bản SQL mới | Làm lại Bước 2. |
| Không thấy người khác trên đảo | Mỗi đảo tối đa 20 người; người kia ở đảo khác, hoặc mạng chặn | Tải lại trang; thử mạng 4G. Ô **👥 + số** trên thanh Khám phá cho biết số người đang cùng đảo. |
| Trang báo không kết nối được máy chủ sau thời gian dài không ai chơi | Gói Free của Supabase **tạm dừng** dự án không hoạt động khoảng 1 tuần | Vào Supabase → mở dự án → bấm **Restore project**. Khi game được chơi đều đặn thì không bị. |

Không tự sửa được: chụp màn hình (cả thanh địa chỉ) gửi Claude kèm mô tả bạn đã bấm gì.

## Chi phí

Gói **Free** của Supabase và Vercel đủ cho giai đoạn thử nghiệm với giáo viên – nhân viên
(vài trăm người). Khi mở cho toàn bộ học sinh, nên cân nhắc gói **Supabase Pro** để có sao
lưu hằng ngày và không bị tạm dừng.

## Dành cho người kỹ thuật (tham khảo)

- Mã SQL gốc nằm trong `supabase/sql/01..06_*.sql`; `supabase/setup.sql` được sinh bằng
  `npm run gen:sql` (kèm dữ liệu hạng/đồ/câu hỏi/cấu hình từ `src/`). Đừng sửa tay `setup.sql`.
- Kiểm thử máy chủ trên PostgreSQL tạm: `npm run test:sql` (cần `initdb`/`pg_ctl` của PostgreSQL 16).
- Mọi việc ghi dữ liệu đi qua hàm RPC `security definer`; bảng bật RLS, trình duyệt không ghi
  trực tiếp được. Đáp án câu hỏi chỉ nằm trên máy chủ (cơ chế "vé câu hỏi").
- Nhiều người chơi dùng kênh Realtime riêng tư `island-N` (presence + broadcast), có luật
  trên `realtime.messages` trong `06_realtime_grants.sql`.
- Chạy thử chế độ trực tuyến trên máy: tạo file `.env.local` với `VITE_SUPABASE_URL` và
  `VITE_SUPABASE_ANON_KEY` rồi `npm run dev`. Không có file này → game chạy ngoại tuyến.
