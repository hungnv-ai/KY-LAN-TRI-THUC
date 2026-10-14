/**
 * Tự điều chỉnh chất lượng hình ảnh để game luôn mượt trên điện thoại/máy yếu:
 * đo FPS trung bình; thấp kéo dài → giảm độ phân giải, rồi tắt bóng đổ; dư sức → tăng lại.
 */

const SAMPLE_SEC = 2;
const LOW_FPS = 38;
const HIGH_FPS = 57;
/** Các mức: tỉ lệ điểm ảnh tối đa + có bóng đổ hay không (mức 0 = đẹp nhất). */
const LEVELS = [
  { ratio: 2, shadows: true },
  { ratio: 1.5, shadows: true },
  { ratio: 1, shadows: true },
  { ratio: 1, shadows: false },
  { ratio: 0.75, shadows: false },
];

/**
 * @param {import('three').WebGLRenderer} renderer
 * @param {import('three').Scene} scene
 * @returns {{ update: (delta: number) => void, level: () => number }}
 */
export function createQualityManager(renderer, scene) {
  const deviceRatio = window.devicePixelRatio || 1;
  // Điện thoại bắt đầu ở mức 1 cho chắc; máy tính ở mức 0.
  let level = window.matchMedia('(pointer: coarse)').matches ? 1 : 0;
  let frames = 0;
  let time = 0;
  let cooldown = 0;
  apply();

  function apply() {
    const { ratio, shadows } = LEVELS[level];
    renderer.setPixelRatio(Math.min(deviceRatio, ratio));
    if (renderer.shadowMap.enabled !== shadows) {
      renderer.shadowMap.enabled = shadows;
      renderer.shadowMap.needsUpdate = true;
      // Bật/tắt bóng cần biên dịch lại shader của vật liệu.
      scene.traverse((o) => {
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        mats.forEach((m) => (m.needsUpdate = true));
      });
    }
  }

  function update(delta) {
    // Bỏ qua lúc tab vừa quay lại (delta lớn) để không đánh giá sai.
    if (delta > 0.25 || document.hidden) return;
    frames += 1;
    time += delta;
    if (time < SAMPLE_SEC) return;
    const fps = frames / time;
    frames = 0;
    time = 0;
    if (cooldown > 0) {
      cooldown -= 1;
      return;
    }
    if (fps < LOW_FPS && level < LEVELS.length - 1) {
      level += 1;
      apply();
      cooldown = 1;
    } else if (fps > HIGH_FPS && level > 0) {
      level -= 1;
      apply();
      cooldown = 3; // tăng chậm hơn giảm để tránh dao động
    }
  }

  return { update, level: () => level };
}
