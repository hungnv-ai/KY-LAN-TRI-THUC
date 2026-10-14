/*
 * Service worker Kỳ Lân Tri Thức: lưu sẵn tệp tĩnh để lần sau mở game nhanh hơn.
 * - Tệp có mã băm trong tên (/assets/*) và ảnh/icon: lấy từ bộ nhớ đệm trước (không bao giờ đổi).
 * - Trang HTML: lấy từ mạng trước để luôn có bản mới nhất; mất mạng mới dùng bản đã lưu.
 * - KHÔNG đụng tới yêu cầu khác tên miền (Supabase, Google, font) → dữ liệu điểm luôn mới.
 */
const CACHE = 'klt-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  const immutable = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || /\.(png|jpg|webp)$/.test(url.pathname);
  if (immutable) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/'))),
    );
  }
});
