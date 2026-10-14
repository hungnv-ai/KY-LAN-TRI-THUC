# Kỳ Lân Tri Thức

Game giáo dục 3D trên web (Vite + Three.js): chăm sóc và thay trang phục cho chú Kỳ lân,
kiếm Coins qua các thử thách học tập.

## Chạy dự án

```bash
npm install
npm run dev
```

## Thêm model

- Kỳ lân: `public/models/unicorn/unicorn.glb` (cần có node `Root` và `Head`).
  Khi chưa có file, game hiển thị một Kỳ lân placeholder dựng bằng khối cơ bản.
- Phụ kiện: đặt `.glb` vào `public/models/accessories/` và khai báo trong
  `ACCESSORIES` ở `src/loader.js`.

Xem [CLAUDE.md](./CLAUDE.md) để biết quy tắc viết code.
