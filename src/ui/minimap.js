import { h } from './dom.js';

/** Kích thước vẽ (px, chưa nhân mật độ điểm ảnh). */
const SIZE = 104;

/**
 * Bản đồ nhỏ hình tròn ở góc màn hình: đảo, đường đi, hồ, 5 Vùng Đất, bạn bè (chấm trắng),
 * vị trí & hướng của mình (mũi tên đỏ). Bấm vào để mở Toàn cảnh.
 *
 * @returns {{ draw: (state: {
 *   beachRadius: number, grassRadius: number, ringRadius: number, pathEnd: number,
 *   lake: { x: number, z: number, r: number },
 *   stations: { x: number, z: number, color: string, done: boolean }[],
 *   landmarks: { x: number, z: number, icon: string }[],
 *   targets?: { x: number, z: number }[],
 *   peers: { x: number, z: number }[],
 *   me: { x: number, z: number, heading: number },
 * }) => void }}
 */
export function createMinimap() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = h('canvas', { width: SIZE * ratio, height: SIZE * ratio, 'aria-hidden': 'true' });
  const button = h('button', { class: 'minimap', type: 'button', title: 'Bản đồ đảo — bấm để xem toàn cảnh', 'aria-label': 'Bản đồ đảo, bấm để xem toàn cảnh', onclick: () => document.getElementById('overview-btn')?.click() }, canvas);
  document.body.append(button);
  const ctx = canvas.getContext('2d');

  function draw(state) {
    const c = SIZE / 2;
    const k = (c - 3) / state.beachRadius; // mét → px
    const px = (x) => c + x * k;
    const py = (z) => c + z * k;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);

    const disc = (x, z, r, fill) => {
      ctx.beginPath();
      ctx.arc(px(x), py(z), r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
    };
    disc(0, 0, state.beachRadius * k, '#F3DFAE');
    disc(0, 0, state.grassRadius * k, '#A9D98B');
    disc(state.lake.x, state.lake.z, state.lake.r * k, '#6FBDE6');

    // Đường đi.
    ctx.strokeStyle = '#F4E8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c, c, state.ringRadius * k, 0, Math.PI * 2);
    ctx.stroke();
    for (const s of state.stations) {
      const d = Math.hypot(s.x, s.z) || 1;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.lineTo(px((s.x / d) * state.pathEnd), py((s.z / d) * state.pathEnd));
      ctx.stroke();
    }

    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const lm of state.landmarks) ctx.fillText(lm.icon, px(lm.x), py(lm.z));

    // Nhiệm vụ khám phá chưa xong: vòng vàng nhấp nháy quanh nơi cần tới.
    const pulse = 4.5 + Math.sin(performance.now() / 260) * 1.2;
    ctx.strokeStyle = '#F2B705';
    ctx.lineWidth = 1.6;
    for (const t of state.targets ?? []) {
      ctx.beginPath();
      ctx.arc(px(t.x), py(t.z), pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const s of state.stations) {
      disc(s.x, s.z, 5, '#FFFFFF');
      disc(s.x, s.z, 3.8, s.color);
      if (s.done) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 7px sans-serif';
        ctx.fillText('✓', px(s.x), py(s.z) + 0.5);
      }
    }
    for (const p of state.peers) {
      disc(p.x, p.z, 3, '#2E2017');
      disc(p.x, p.z, 2, '#FFFFFF');
    }

    // Mình: mũi tên đỏ quay theo hướng nhìn.
    ctx.save();
    ctx.translate(px(state.me.x), py(state.me.z));
    ctx.rotate(-state.me.heading);
    ctx.beginPath();
    ctx.moveTo(0, 6.5);
    ctx.lineTo(4.4, -4.5);
    ctx.lineTo(0, -2);
    ctx.lineTo(-4.4, -4.5);
    ctx.closePath();
    ctx.fillStyle = '#C8102E';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  return { draw };
}
