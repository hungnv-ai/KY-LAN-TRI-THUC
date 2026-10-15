/**
 * Sticker gửi nhanh cho mọi người đang ở gần trên đảo. Bộ cố định (không gõ chữ tự do) nên an toàn.
 * `emote`: cảm xúc Kỳ lân làm theo khi gửi (xem scene/emotes.js).
 */
export const STICKERS = [
  { id: 'hi', emoji: '👋', label: 'Xin chào', emote: 'wave' },
  { id: 'love', emoji: '❤️', label: 'Thương quá', emote: 'happy' },
  { id: 'clap', emoji: '👏', label: 'Tuyệt vời', emote: 'cheer' },
  { id: 'haha', emoji: '😂', label: 'Haha', emote: 'happy' },
  { id: 'wow', emoji: '😮', label: 'Wow', emote: 'oops' },
  { id: 'think', emoji: '🤔', label: 'Để mình nghĩ', emote: 'think' },
  { id: 'cool', emoji: '😎', label: 'Ngầu', emote: 'cool' },
  { id: 'thanks', emoji: '🙏', label: 'Cảm ơn', emote: 'wave' },
  { id: 'flower', emoji: '🌸', label: 'Tặng hoa', emote: 'happy' },
  { id: 'fire', emoji: '🔥', label: 'Cháy quá', emote: 'cheer' },
  { id: 'gg', emoji: '🏆', label: 'Vô địch', emote: 'cheer' },
  { id: 'sleepy', emoji: '😴', label: 'Buồn ngủ', emote: 'bored' },
];

/** Khoảng nghỉ tối thiểu giữa 2 sticker (giây) — tránh spam. */
export const STICKER_COOLDOWN_SEC = 2;

/**
 * @param {string} id
 * @returns {(typeof STICKERS)[number] | undefined}
 */
export function getSticker(id) {
  return STICKERS.find((s) => s.id === id);
}
