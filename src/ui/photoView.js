import { h } from './dom.js';
import { openCustomDialog, showToast } from './feedback.js';

/**
 * Chụp ảnh trên đảo: đếm ngược 3-2-1, khung ảnh thương hiệu VA, xem trước + tải về / chia sẻ.
 */

const COUNTDOWN_STEP_MS = 800;
/** Chiều rộng ảnh xuất ra (px) — đủ nét cho mạng xã hội, file không quá nặng. */
const OUTPUT_WIDTH = 1280;
const BAND_RATIO = 0.13;
const BRAND = '#9A0036';

let mascotIcon = null;
function loadIcon() {
  if (mascotIcon) return Promise.resolve(mascotIcon);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve((mascotIcon = img));
    img.onerror = () => resolve(null);
    img.src = '/mascot-icon.png';
  });
}

/**
 * Hiện số đếm ngược giữa màn hình.
 *
 * @param {number} from số bắt đầu (vd 3)
 * @param {(n: number) => void} [onTick]
 * @returns {Promise<void>}
 */
export function runCountdown(from, onTick) {
  const el = h('div', { class: 'photo-countdown', 'aria-live': 'assertive' });
  document.body.append(el);
  loadIcon();
  return new Promise((resolve) => {
    let n = from;
    const step = () => {
      if (n === 0) {
        el.remove();
        resolve();
        return;
      }
      el.textContent = String(n);
      el.classList.remove('tick');
      void el.offsetWidth;
      el.classList.add('tick');
      onTick?.(n);
      n -= 1;
      setTimeout(step, COUNTDOWN_STEP_MS);
    };
    step();
  });
}

/** Chớp sáng như máy ảnh. */
export function flash() {
  const el = h('div', { class: 'photo-flash' });
  document.body.append(el);
  setTimeout(() => el.remove(), 500);
}

/**
 * Ghép ảnh 3D vừa chụp vào khung VA (dải đỏ dưới: logo Kỳ lân, tên game, ngày giờ, người chụp).
 *
 * @param {HTMLCanvasElement} source canvas WebGL (gọi ngay sau khi render)
 * @param {{ caption: string }} info
 * @returns {HTMLCanvasElement}
 */
export function composePhoto(source, { caption }) {
  const scale = OUTPUT_WIDTH / source.width;
  const w = OUTPUT_WIDTH;
  const photoH = Math.round(source.height * scale);
  const band = Math.round(w * BAND_RATIO * 0.6);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = photoH + band;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, w, photoH);

  // Viền trắng mỏng như ảnh in.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, w - 10, photoH - 10);

  ctx.fillStyle = BRAND;
  ctx.fillRect(0, photoH, w, band);
  const pad = band * 0.18;
  let x = pad;
  if (mascotIcon) {
    const ih = band - pad * 2;
    const iw = (mascotIcon.width / mascotIcon.height) * ih;
    ctx.drawImage(mascotIcon, x, photoH + pad, iw, ih);
    x += iw + pad;
  }
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(band * 0.34)}px "Be Vietnam Pro", Arial, sans-serif`;
  ctx.fillText('Kỳ Lân Tri Thức', x, photoH + band * 0.38);
  ctx.font = `500 ${Math.round(band * 0.22)}px "Be Vietnam Pro", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText(caption, x, photoH + band * 0.72);
  ctx.textAlign = 'right';
  ctx.font = `700 ${Math.round(band * 0.26)}px "Be Vietnam Pro", Arial, sans-serif`;
  ctx.fillStyle = '#F7D27A';
  ctx.fillText('VA Schools', w - pad, photoH + band / 2);
  return canvas;
}

/**
 * Xem trước ảnh + nút Tải về / Chia sẻ.
 *
 * @param {HTMLCanvasElement} canvas ảnh đã ghép khung
 */
export function showPhotoPreview(canvas) {
  const fileName = `ky-lan-tri-thuc-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.jpg`;
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  const download = h('a', { class: 'btn btn-secondary', href: dataUrl, download: fileName }, '⬇️ Tải ảnh');
  const actions = h('div', { class: 'dialog-actions' }, download);

  if (navigator.canShare) {
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        if (!navigator.canShare({ files: [file] })) return;
        const shareBtn = h('button', { class: 'btn', type: 'button' }, '📤 Chia sẻ');
        shareBtn.addEventListener('click', () =>
          navigator.share({ files: [file], title: 'Kỳ Lân Tri Thức', text: 'Ảnh của mình trên đảo Kỳ Lân Tri Thức 🦄' }).catch(() => {}),
        );
        actions.append(shareBtn);
      },
      'image/jpeg',
      0.9,
    );
  }

  openCustomDialog({
    className: 'photo-dialog',
    labelledBy: 'photo-title',
    children: [
      h('h2', { class: 'dialog-title', id: 'photo-title' }, '📸 Ảnh đẹp quá!'),
      h('img', { class: 'photo-preview', src: dataUrl, alt: 'Ảnh vừa chụp trên đảo' }),
      h('p', { class: 'muted small' }, 'Mẹo: rủ đồng nghiệp đứng gần nhau rồi chụp để có ảnh nhóm.'),
      actions,
    ],
  });
}

/** Báo lỗi khi trình duyệt không cho chụp. */
export function photoFailed() {
  showToast('Không chụp được ảnh trên trình duyệt này.', { type: 'warn', icon: '📷' });
}
