/**
 * Danh mục quà hiện vật ban đầu (đổi bằng Xu, BGH duyệt rồi trao tại trường).
 * Chỉ dùng để khởi tạo máy chủ: sau đó BGH/Quản trị sửa giá, số lượng trong trang quản trị
 * (chạy lại setup.sql KHÔNG ghi đè những thay đổi đó).
 * `stock: null` = không giới hạn số lượng.
 */
export const GIFTS = [
  { id: 'but-va', name: 'Bút bi VA', icon: '🖊️', cost: 400, stock: null, description: 'Bút bi in logo VA Schools.' },
  { id: 'moc-khoa', name: 'Móc khoá Kỳ lân', icon: '🔑', cost: 600, stock: null, description: 'Móc khoá hình Kỳ lân VA dễ thương.' },
  { id: 'ca-phe', name: 'Phiếu cà phê căng tin', icon: '☕', cost: 700, stock: null, description: 'Một ly cà phê / trà sữa tại căng tin trường.' },
  { id: 'so-tay', name: 'Sổ tay VA', icon: '📒', cost: 800, stock: null, description: 'Sổ tay bìa cứng VA Schools.' },
  { id: 'ly-su', name: 'Ly sứ VA', icon: '🍵', cost: 1200, stock: 30, description: 'Ly sứ in hình Kỳ lân và 5 giá trị.' },
  { id: 'binh-nuoc', name: 'Bình nước VA', icon: '🧴', cost: 1500, stock: 30, description: 'Bình giữ nhiệt VA Schools.' },
  { id: 'ao-thun', name: 'Áo thun VA', icon: '👕', cost: 3000, stock: 20, description: 'Áo thun đỏ VA Schools (chọn size khi nhận).' },
  { id: 'gau-bong', name: 'Gấu bông Kỳ lân', icon: '🧸', cost: 4000, stock: 10, description: 'Kỳ lân nhồi bông — quà hiếm!' },
];
