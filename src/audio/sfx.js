import { loadJSON, saveJSON } from '../game/storage.js';

/**
 * Hiệu ứng âm thanh tổng hợp bằng Web Audio (không cần file âm thanh → tải nhanh, nhẹ).
 * Trình duyệt chỉ cho phát âm thanh sau thao tác đầu tiên của người chơi, nên AudioContext
 * được tạo ở lần chạm/bấm phím đầu tiên.
 */

const MUTE_KEY = 'klt-muted';
const MASTER_VOLUME = 0.5;

let ctx = null;
let master = null;
let muted = loadJSON(MUTE_KEY) === true;

/** Gắn sự kiện mở khoá âm thanh ở thao tác đầu tiên. Gọi một lần lúc khởi động. */
export function initAudio() {
  const unlock = () => {
    ensureContext();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

function ensureContext() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_VOLUME;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** @returns {boolean} */
export function isMuted() {
  return muted;
}

/** @param {boolean} value */
export function setMuted(value) {
  muted = value;
  saveJSON(MUTE_KEY, muted);
  if (master) master.gain.value = muted ? 0 : MASTER_VOLUME;
}

/**
 * Một nốt có bao âm (attack nhanh, tắt dần).
 *
 * @param {number} freq Hz
 * @param {number} at giây tính từ bây giờ
 * @param {number} dur giây
 * @param {{ type?: OscillatorType, vol?: number, slideTo?: number }} [opts]
 */
function tone(freq, at, dur, { type = 'sine', vol = 0.25, slideTo } = {}) {
  const c = ensureContext();
  if (!c || muted) return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Tiếng lấp lánh (nhiễu trắng lọc cao) cho hiệu ứng quà, lên hạng. */
function shimmer(at, dur, vol = 0.08) {
  const c = ensureContext();
  if (!c || muted) return;
  const t0 = c.currentTime + at;
  const length = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 6000;
  const gain = c.createGain();
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(master);
  src.start(t0);
}

// Tần số nốt (Hz).
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880;
const B5 = 987.77;
const C6 = 1046.5;
const E6 = 1318.5;
const G6 = 1568;

/** Thư viện âm thanh của game. */
export const sfx = {
  /** Nhặt xu: "ting-ting" kiểu nạp tiền. */
  coin() {
    tone(B5, 0, 0.08, { type: 'square', vol: 0.12 });
    tone(E6, 0.07, 0.22, { type: 'square', vol: 0.12 });
  },
  /** Nhiều xu đổ vào ví. */
  coins(count = 5) {
    const n = Math.min(count, 8);
    for (let i = 0; i < n; i++) tone(i % 2 ? E6 : B5, i * 0.06, 0.12, { type: 'square', vol: 0.08 });
  },
  /** Mở hộp quà: arpeggio đi lên + lấp lánh. */
  gift() {
    [C5, E5, G5, C6, E6].forEach((f, i) => tone(f, i * 0.08, 0.35, { type: 'triangle', vol: 0.2 }));
    shimmer(0.25, 0.8);
  },
  /** Trả lời đúng. */
  correct() {
    tone(E5, 0, 0.12, { type: 'triangle', vol: 0.22 });
    tone(A5, 0.1, 0.28, { type: 'triangle', vol: 0.22 });
  },
  /** Trả lời sai: nhẹ nhàng, không gây áp lực. */
  wrong() {
    tone(330, 0, 0.18, { type: 'sine', vol: 0.18, slideTo: 247 });
  },
  /** Ăn mừng (điểm danh, đúng hết). */
  cheer() {
    [C5, E5, G5, C6].forEach((f, i) => tone(f, i * 0.09, 0.25, { type: 'triangle', vol: 0.2 }));
    tone(G6, 0.4, 0.4, { type: 'sine', vol: 0.1 });
    shimmer(0.3, 0.6, 0.06);
  },
  /** Lên hạng: kèn chiến thắng. */
  rankUp() {
    [C5, C5, C5, G5].forEach((f, i) => tone(f, i * 0.12, i === 3 ? 0.5 : 0.1, { type: 'sawtooth', vol: 0.1 }));
    [E5, G5, C6].forEach((f) => tone(f, 0.6, 0.9, { type: 'triangle', vol: 0.14 }));
    shimmer(0.6, 1.2, 0.08);
  },
  /** Mở câu hỏi / bảng. */
  pop() {
    tone(G5, 0, 0.09, { type: 'sine', vol: 0.15, slideTo: C6 });
  },
  /** Bấm nút. */
  click() {
    tone(1200, 0, 0.04, { type: 'sine', vol: 0.06 });
  },
  /** Ngất xỉu (hết giờ). */
  faint() {
    tone(440, 0, 0.6, { type: 'triangle', vol: 0.16, slideTo: 110 });
  },
};
