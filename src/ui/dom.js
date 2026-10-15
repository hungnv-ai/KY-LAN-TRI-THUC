/**
 * Tạo phần tử DOM gọn gàng: h('button', { class: 'btn', onclick }, 'Bấm').
 * Chuỗi con được chèn dạng text (an toàn, không chèn HTML).
 *
 * @param {string} tag
 * @param {Record<string, any>} [props]
 * @param {...(Node | string | number | null | false | undefined)} children
 * @returns {HTMLElement}
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2), value);
    } else if (key === 'class') {
      el.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      for (const [prop, v] of Object.entries(value)) {
        if (prop.startsWith('--')) el.style.setProperty(prop, v); // biến CSS
        else el.style[prop] = v;
      }
    } else if (key in el && typeof value !== 'string') {
      el[key] = value;
    } else {
      el.setAttribute(key, value === true ? '' : value);
    }
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

/** Định dạng số kiểu Việt Nam: 12500 → "12.500". */
export function formatNumber(n) {
  return Math.round(n).toLocaleString('vi-VN');
}

/** Chạy lại animation "nảy" cho một phần tử. */
export function bump(el) {
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}
