import { bump } from './dom.js';

/**
 * Hiệu ứng "nạp vào ví": icon xu / sao bay từ vị trí trên màn hình vào ô Xu hoặc thẻ hạng.
 */

const TARGETS = {
  coin: { selector: '.pill-coins', icon: '🪙' },
  xp: { selector: '#rank-card', icon: '⭐' },
};
const FLY_MS = 850;
const STAGGER_MS = 70;
const MAX_ICONS = 10;

/**
 * @param {'coin' | 'xp'} kind
 * @param {{ x: number, y: number }} from toạ độ màn hình (px)
 * @param {number} [count] số icon bay (tối đa 10)
 */
export function flyToHud(kind, from, count = 1) {
  const { selector, icon } = TARGETS[kind];
  const target = document.querySelector(selector);
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const to = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const n = Math.min(MAX_ICONS, Math.max(1, Math.round(count)));

  for (let i = 0; i < n; i++) {
    const el = document.createElement('span');
    el.className = 'fly-icon';
    el.textContent = icon;
    el.setAttribute('aria-hidden', 'true');
    document.body.append(el);

    const sx = from.x + (Math.random() - 0.5) * 60;
    const sy = from.y + (Math.random() - 0.5) * 40;
    const mx = (sx + to.x) / 2 + (Math.random() - 0.5) * 120;
    const my = Math.min(sy, to.y) - 60 - Math.random() * 60;

    const anim = el.animate(
      [
        { transform: `translate(${sx}px, ${sy}px) scale(0.4)`, opacity: 0 },
        { transform: `translate(${sx}px, ${sy - 30}px) scale(1.3)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${mx}px, ${my}px) scale(1.1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${to.x}px, ${to.y}px) scale(0.6)`, opacity: 0.9 },
      ],
      { duration: FLY_MS, delay: i * STAGGER_MS, easing: 'cubic-bezier(0.45, 0, 0.55, 1)', fill: 'backwards' },
    );
    anim.onfinish = () => {
      el.remove();
      bump(target);
    };
  }
}
