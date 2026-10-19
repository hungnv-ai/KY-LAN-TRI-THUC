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

/**
 * Ô động tác của nhân vật 3D (mỗi ô = 1 file .glb chứa animation, cùng khung xương với model).
 * id trùng tên cảm xúc trong scene/emotes.js để sticker / phản ứng gọi đúng động tác.
 */
export const ANIMATION_SLOTS = [
  { id: 'idle', label: 'Đứng yên', icon: '🧍', hint: 'thở nhẹ, đứng chờ' },
  { id: 'walk', label: 'Đi bộ', icon: '🚶' },
  { id: 'run', label: 'Chạy', icon: '🏃' },
  { id: 'wave', label: 'Vẫy tay', icon: '👋', hint: 'sticker chào' },
  { id: 'cheer', label: 'Vui mừng / nhảy', icon: '🎉', hint: 'trả lời đúng, lên hạng' },
  { id: 'happy', label: 'Cười / vỗ tay', icon: '😄' },
  { id: 'cry', label: 'Buồn / khóc', icon: '😢', hint: 'trả lời sai' },
  { id: 'think', label: 'Suy nghĩ', icon: '🤔', hint: 'khi làm câu hỏi' },
  { id: 'oops', label: 'Ngạc nhiên', icon: '😮' },
  { id: 'faint', label: 'Ngất / ngã', icon: '😵' },
  { id: 'cool', label: 'Tạo dáng ngầu', icon: '😎' },
  { id: 'bored', label: 'Chán / ngáp', icon: '🥱' },
];
