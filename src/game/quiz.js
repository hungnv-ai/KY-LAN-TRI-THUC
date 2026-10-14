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
  const questions = picked.map((item) => {
    const order = shuffle(item.a.map((_, i) => i));
    return {
      topic: item.topic,
      q: item.q,
      options: order.map((i) => item.a[i]),
      correctIndex: order.indexOf(0), // a[0] luôn là đáp án đúng
      explain: item.explain,
    };
  });
  return { questions };
}

/** Fisher–Yates shuffle (tại chỗ). */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
