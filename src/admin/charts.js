import { h, formatNumber } from '../ui/dom.js';

/**
 * Biểu đồ SVG nhẹ cho trang quản trị (theo hướng dẫn dataviz: nét mảnh, đầu cột bo 4px neo vào
 * trục, khe 2px giữa các cột, lưới mờ, chú thích khi rê chuột, luôn có chế độ xem bảng).
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const INK_MUTED = '#737373';
const GRID = '#eae4df';

function svg(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/** Đường dẫn cột chỉ bo 2 góc trên (đầu dữ liệu), đáy vuông neo vào trục. */
function topRoundedRect(x, y, w, hgt, r) {
  const rr = Math.min(r, w / 2, hgt);
  return `M${x},${y + hgt} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + hgt} Z`;
}

/** Bước chia trục "đẹp" (1, 2, 5 × 10^n). */
function niceMax(v) {
  if (v <= 0) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/**
 * Khung biểu đồ: tiêu đề + nút "Xem bảng" + vùng vẽ / bảng.
 *
 * @param {{ title: string, subtitle?: string, chart: Node, table: Node }} opts
 */
export function chartCard({ title, subtitle, chart, table }) {
  const body = h('div', { class: 'chart-body' }, chart);
  let showingTable = false;
  const toggle = h('button', { class: 'btn-sm', type: 'button', 'aria-pressed': 'false' }, 'Xem bảng');
  toggle.addEventListener('click', () => {
    showingTable = !showingTable;
    toggle.setAttribute('aria-pressed', String(showingTable));
    toggle.textContent = showingTable ? 'Xem biểu đồ' : 'Xem bảng';
    body.replaceChildren(showingTable ? table : chart);
  });
  return h(
    'section',
    { class: 'card chart-card' },
    h('header', { class: 'card-head' }, h('div', {}, h('h3', {}, title), subtitle ? h('p', { class: 'muted' }, subtitle) : ''), toggle),
    body,
  );
}

function simpleTable(headers, rows) {
  return h(
    'div',
    { class: 'table-wrap' },
    h(
      'table',
      { class: 'table table-compact' },
      h('thead', {}, h('tr', {}, headers.map((t) => h('th', { scope: 'col' }, t)))),
      h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c) => h('td', {}, c))))),
    ),
  );
}

/**
 * Biểu đồ cột một chuỗi (vd: người chơi hoạt động mỗi ngày).
 *
 * @param {{ data: { label: string, value: number, tooltip?: string }[], color: string, unit: string, valueLabel: string }} opts
 * @returns {{ chart: Node, table: Node }}
 */
export function columnChart({ data, color, unit, valueLabel }) {
  const W = 640;
  const H = 220;
  const pad = { l: 36, r: 8, t: 12, b: 28 };
  const max = niceMax(Math.max(...data.map((d) => d.value), 1));
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const slot = plotW / data.length;
  const gap = 2;
  const barW = Math.max(4, Math.min(28, slot - gap * 2));
  const labelStep = Math.ceil(data.length / 7);

  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${valueLabel} theo ngày`, class: 'chart-svg' });
  // Số vạch chia: luôn ra số nguyên (giá trị nhỏ thì mỗi vạch = 1).
  const ticks = max < 4 ? max : 4;
  for (let i = 0; i <= ticks; i++) {
    const y = pad.t + plotH - (plotH * i) / ticks;
    root.append(svg('line', { x1: pad.l, x2: W - pad.r, y1: y, y2: y, stroke: GRID, 'stroke-width': 1 }));
    const t = svg('text', { x: pad.l - 6, y: y + 4, 'text-anchor': 'end', 'font-size': 11, fill: INK_MUTED });
    t.textContent = formatNumber((max * i) / ticks);
    root.append(t);
  }

  const wrap = h('div', { class: 'chart-wrap' });
  const tip = h('div', { class: 'chart-tip', hidden: true, role: 'status' });

  data.forEach((d, i) => {
    const x = pad.l + slot * i + (slot - barW) / 2;
    const hgt = (plotH * d.value) / max;
    const y = pad.t + plotH - hgt;
    if (d.value > 0) root.append(svg('path', { d: topRoundedRect(x, y, barW, hgt, 4), fill: color }));
    // Vùng rê chuột rộng hơn cột.
    const hit = svg('rect', { x: pad.l + slot * i, y: pad.t, width: slot, height: plotH, fill: 'transparent', tabindex: 0 });
    const show = () => {
      tip.hidden = false;
      tip.textContent = d.tooltip ?? `${d.label}: ${formatNumber(d.value)} ${unit}`;
      const rect = wrap.getBoundingClientRect();
      const px = ((pad.l + slot * i + slot / 2) / W) * rect.width;
      tip.style.left = `${Math.min(rect.width - 120, Math.max(0, px - 60))}px`;
    };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('focus', show);
    hit.addEventListener('pointerleave', () => (tip.hidden = true));
    hit.addEventListener('blur', () => (tip.hidden = true));
    root.append(hit);
    // Nhãn cách đều tính từ ngày cuối (luôn có hôm nay, không bị chồng chữ).
    if ((data.length - 1 - i) % labelStep === 0) {
      const t = svg('text', { x: pad.l + slot * i + slot / 2, y: H - 8, 'text-anchor': 'middle', 'font-size': 11, fill: INK_MUTED });
      t.textContent = d.label;
      root.append(t);
    }
  });
  root.append(svg('line', { x1: pad.l, x2: W - pad.r, y1: pad.t + plotH, y2: pad.t + plotH, stroke: '#b4b4b4', 'stroke-width': 1 }));
  wrap.append(root, tip);
  return { chart: wrap, table: simpleTable(['Ngày', valueLabel], data.map((d) => [d.label, formatNumber(d.value)])) };
}

/**
 * Biểu đồ thanh ngang có nhãn trực tiếp (tên + số ở mỗi hàng → không phụ thuộc màu).
 *
 * @param {{ data: { label: string, value: number, color: string }[], unit: string, valueLabel: string }} opts
 * @returns {{ chart: Node, table: Node }}
 */
export function barList({ data, unit, valueLabel }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const chart = h(
    'ul',
    { class: 'bar-list' },
    data.map((d) =>
      h(
        'li',
        { title: `${d.label}: ${formatNumber(d.value)} ${unit}` },
        h('span', { class: 'bar-label' }, d.label),
        h(
          'span',
          { class: 'bar-track' },
          h('span', { class: 'bar-fill', style: { width: `${Math.max(d.value > 0 ? 2 : 0, (d.value / max) * 100)}%`, background: d.color } }),
        ),
        h('span', { class: 'bar-value' }, formatNumber(d.value)),
      ),
    ),
  );
  return { chart, table: simpleTable(['', valueLabel], data.map((d) => [d.label, formatNumber(d.value)])) };
}
