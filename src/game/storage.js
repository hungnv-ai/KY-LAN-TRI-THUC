/**
 * Đọc/ghi dữ liệu trong trình duyệt (localStorage). GĐ2 sẽ thay bằng Supabase.
 * Mọi thao tác đều bọc try/catch: trình duyệt ẩn danh hoặc chặn bộ nhớ vẫn chơi được (không lưu).
 */

/**
 * @param {string} key
 * @returns {any | null}
 */
export function loadJSON(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} key
 * @param {any} value
 * @returns {boolean} true nếu lưu thành công
 */
export function saveJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
