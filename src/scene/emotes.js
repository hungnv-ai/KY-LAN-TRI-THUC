/**
 * Bộ cảm xúc của Kỳ lân (theo bộ sticker mascot VA Schools).
 *
 * - `face`: kiểu mắt (open | lookUp | half | wide | happy | wink | squeeze | x), miệng, `browLift`,
 *   `shades` (đeo kính râm).
 * - `pose`: góc tay [xoay X, xoay Z] (radian). Tay trái = bên phải người xem; Z dương = giơ ra ngoài
 *   với tay trái (âm với tay phải); X âm = đưa ra trước/lên. `head`: [cúi/ngửa, nghiêng].
 * - `prop`: hiệu ứng emoji quanh đầu (xem PROPS). `motion`: chuyển động thêm (xem mascot.js).
 * - `duration`: giây. Cảm xúc dùng làm "tâm trạng" (setMood) thì lặp tới khi tắt.
 */

/** Tư thế nghỉ. */
export const REST_POSE = {
  armL: [0.06, 0.16],
  armR: [0.06, -0.16],
  head: [0, 0],
};

export const EMOTES = {
  idle: { duration: 0, face: { eyes: 'open', mouth: 'smile' }, pose: {} },
  wave: {
    duration: 1.8,
    face: { eyes: 'open', mouth: 'open' },
    pose: { armR: [0, -2.7], head: [0, 0.1] },
    motion: 'wave',
  },
  happy: {
    duration: 1.6,
    face: { eyes: 'wink', mouth: 'open' },
    pose: { armR: [-1.45, -0.3], head: [0, -0.12] },
    prop: 'sparkle',
    motion: 'hop',
  },
  cheer: {
    duration: 1.5,
    face: { eyes: 'happy', mouth: 'open', browLift: 0.03 },
    pose: { armL: [0, 2.7], armR: [0, -2.7] },
    prop: 'burst',
    motion: 'jumpSpin',
  },
  oops: {
    duration: 1.4,
    face: { eyes: 'wide', mouth: 'o', browLift: 0.05 },
    pose: { armL: [-2.45, -0.15], armR: [-2.45, 0.15], head: [-0.08, 0] },
    prop: 'exclaim',
    motion: 'shake',
  },
  think: {
    duration: 2.2,
    face: { eyes: 'lookUp', mouth: 'flat' },
    pose: { armR: [-2.3, 0.5], head: [-0.1, -0.12] },
    prop: 'question',
  },
  cry: {
    duration: 2.2,
    face: { eyes: 'squeeze', mouth: 'open', browLift: -0.02 },
    pose: { armL: [-2.6, -0.3], armR: [-2.6, 0.3], head: [0.12, 0] },
    prop: 'tears',
    motion: 'sob',
  },
  faint: {
    duration: 2.8,
    face: { eyes: 'x', mouth: 'tongue' },
    pose: { armL: [0, 1.5], armR: [0, -1.5] },
    prop: 'ghost',
    motion: 'faint',
  },
  cool: {
    duration: 1.8,
    face: { eyes: 'half', mouth: 'smirk', shades: true },
    pose: { armL: [-1.35, 0.4], armR: [-1.35, -0.4], head: [0, 0.1] },
    prop: 'sparkle',
    motion: 'lean',
  },
  bored: {
    duration: 3.2,
    face: { eyes: 'half', mouth: 'flat' },
    pose: { armL: [-1.25, -0.85], armR: [-1.25, 0.85], head: [0.05, -0.1] },
    prop: 'sleepy',
  },
};

/**
 * Hiệu ứng emoji: vị trí tính theo nhóm đầu (tâm hộp sọ ở y = 0.48), `anim` xem mascot.js.
 */
export const PROPS = {
  sparkle: [
    { char: '✨', pos: [0.72, 1.05, 0.2], scale: 0.32, anim: 'twinkle' },
    { char: '✨', pos: [-0.78, 0.7, 0.2], scale: 0.22, anim: 'twinkle' },
  ],
  burst: [
    { char: '🎉', pos: [0.78, 1.0, 0.2], scale: 0.38, anim: 'pop' },
    { char: '✨', pos: [-0.8, 1.05, 0.2], scale: 0.3, anim: 'twinkle' },
  ],
  exclaim: [{ char: '❗', pos: [0.72, 1.12, 0.1], scale: 0.4, anim: 'pop' }],
  question: [{ char: '❓', pos: [0.72, 1.1, 0.1], scale: 0.4, anim: 'bob' }],
  tears: [
    { char: '💦', pos: [-0.52, 0.42, 0.35], scale: 0.28, anim: 'drip' },
    { char: '💦', pos: [0.52, 0.42, 0.35], scale: 0.28, anim: 'drip' },
  ],
  ghost: [{ char: '👻', pos: [0.45, 1.0, 0.2], scale: 0.4, anim: 'rise' }],
  sleepy: [{ char: '💤', pos: [0.7, 1.05, 0.1], scale: 0.36, anim: 'bob' }],
};
