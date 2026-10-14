import { QUIZ } from '../config.js';
import { QUESTIONS } from '../data/questions.js';

/**
 * Tạo một lượt quiz: chọn ngẫu nhiên câu hỏi và xáo trộn đáp án.
 * Module thuần logic — không đụng DOM.
 *
 * @param {number} [count]
 * @returns {{ questions: { topic: string, q: string, options: string[], correctIndex: number, explain?: string }[] }}
 */
export function createQuizRound(count = QUIZ.QUESTIONS_PER_ROUND) {
  const picked = shuffle([...QUESTIONS]).slice(0, count);
  return { questions: picked.map(prepare) };
}

/**
 * Chọn 1 câu hỏi (dùng cho câu hỏi nhanh khi chạy và thử thách cột Vùng Đất).
 * Có `value`: ưu tiên câu thuộc giá trị đó; Vùng Tri Thức hỏi thêm cả kiến thức chung.
 *
 * @param {{ value?: string }} [options]
 * @returns {ReturnType<typeof prepare>}
 */
export function pickQuestion({ value } = {}) {
  let pool = QUESTIONS;
  if (value) {
    pool = QUESTIONS.filter((item) => item.value === value || (value === 'triThuc' && item.topic === 'general'));
  }
  const fresh = pool.filter((item) => !recentlyAsked.includes(item));
  const item = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length || pool.length))];
  recentlyAsked.push(item);
  if (recentlyAsked.length > RECENT_LIMIT) recentlyAsked.shift();
  return prepare(item);
}

/** Tránh hỏi lặp lại các câu vừa hỏi gần đây. */
const RECENT_LIMIT = 20;
const recentlyAsked = [];

function prepare(item) {
  const order = shuffle(item.a.map((_, i) => i));
  return {
    topic: item.topic,
    q: item.q,
    options: order.map((i) => item.a[i]),
    correctIndex: order.indexOf(0), // a[0] luôn là đáp án đúng
    explain: item.explain,
  };
}

/** Fisher–Yates shuffle (tại chỗ). */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
