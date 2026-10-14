/**
 * Đầu vào di chuyển: bàn phím (mũi tên / WASD, Shift chạy nhanh) và cần điều khiển ảo
 * trên màn hình cảm ứng. Trả về hướng chuẩn hoá { x: trái(-)/phải(+), y: lùi(-)/tiến(+) }.
 */
const joystick = document.getElementById('joystick');
const knob = document.getElementById('joystick-knob');
const keyHint = document.getElementById('key-hint');

const KEYS = {
  ArrowUp: [0, 1],
  KeyW: [0, 1],
  ArrowDown: [0, -1],
  KeyS: [0, -1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};
/** Đẩy cần quá tỉ lệ này thì tự chạy nhanh. */
const JOYSTICK_RUN_THRESHOLD = 0.85;
const KEY_HINT_MS = 9000;

const pressed = new Set();
let shift = false;
const stick = { x: 0, y: 0, active: false, pointerId: null };
let enabled = true;

/**
 * Bắt đầu lắng nghe bàn phím & cần điều khiển.
 *
 * @param {{ onFirstMove?: () => void }} [options]
 */
export function initControls({ onFirstMove } = {}) {
  let moved = false;
  const notifyMove = () => {
    if (!moved) {
      moved = true;
      keyHint.hidden = true;
      onFirstMove?.();
    }
  };

  window.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea')) return;
    if (KEYS[e.code]) {
      pressed.add(e.code);
      if (enabled) {
        e.preventDefault(); // không cuộn trang khi bấm mũi tên
        notifyMove();
      }
    }
    if (e.key === 'Shift') shift = true;
  });
  window.addEventListener('keyup', (e) => {
    pressed.delete(e.code);
    if (e.key === 'Shift') shift = false;
  });
  window.addEventListener('blur', () => {
    pressed.clear();
    shift = false;
  });

  // Cần điều khiển ảo (chỉ hiện trên thiết bị cảm ứng).
  const touch = window.matchMedia('(pointer: coarse)').matches;
  joystick.hidden = !touch;
  keyHint.hidden = touch;
  if (!touch) setTimeout(() => (keyHint.hidden = true), KEY_HINT_MS);

  joystick.addEventListener('pointerdown', (e) => {
    stick.active = true;
    stick.pointerId = e.pointerId;
    joystick.setPointerCapture(e.pointerId);
    moveStick(e);
    notifyMove();
  });
  joystick.addEventListener('pointermove', (e) => stick.active && e.pointerId === stick.pointerId && moveStick(e));
  const release = () => {
    stick.active = false;
    stick.x = 0;
    stick.y = 0;
    knob.style.transform = 'translate(-50%, -50%)';
  };
  joystick.addEventListener('pointerup', release);
  joystick.addEventListener('pointercancel', release);
}

function moveStick(e) {
  const rect = joystick.getBoundingClientRect();
  const radius = rect.width / 2;
  let dx = (e.clientX - (rect.left + radius)) / radius;
  let dy = (e.clientY - (rect.top + radius)) / radius;
  const len = Math.hypot(dx, dy);
  if (len > 1) {
    dx /= len;
    dy /= len;
  }
  stick.x = dx;
  stick.y = -dy;
  knob.style.transform = `translate(calc(-50% + ${dx * radius * 0.6}px), calc(-50% + ${dy * radius * 0.6}px))`;
}

/**
 * Tạm khoá di chuyển (khi đang mở bảng câu hỏi, tủ đồ…).
 *
 * @param {boolean} value
 */
export function setControlsEnabled(value) {
  enabled = value;
  joystick.classList.toggle('is-disabled', !value);
}

/** @returns {{ x: number, y: number, run: boolean }} */
export function readInput() {
  if (!enabled) return { x: 0, y: 0, run: false };
  let x = 0;
  let y = 0;
  for (const code of pressed) {
    x += KEYS[code][0];
    y += KEYS[code][1];
  }
  if (stick.active) {
    x += stick.x;
    y += stick.y;
  }
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x, y, run: shift || (stick.active && Math.hypot(stick.x, stick.y) > JOYSTICK_RUN_THRESHOLD) };
}
