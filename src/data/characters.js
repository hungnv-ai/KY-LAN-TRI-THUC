/**
 * Nhân vật có sẵn (dựng bằng code trong scene/mascot.js). Quản trị có thể tải thêm nhân vật 3D
 * (.glb) trong trang quản trị — các nhân vật đó lưu ở bảng `characters` trên máy chủ.
 *
 * - `variant`: 'male' | 'female' — kiểu dựng của Kỳ lân VA.
 * - `gender`: nam | nu | khac (để lọc / hiển thị).
 */

/** Nhân vật mặc định của mọi người chơi (không được xoá / tắt). */
export const DEFAULT_CHARACTER = 'kylan-nam';

export const BUILTIN_CHARACTERS = [
  { id: 'kylan-nam', name: 'Kỳ lân Nam', gender: 'nam', variant: 'male', sort: 1 },
  { id: 'kylan-nu', name: 'Kỳ lân Nữ', gender: 'nu', variant: 'female', sort: 2 },
];

export const GENDERS = { nam: 'Nam', nu: 'Nữ', khac: 'Khác' };
