import { TOPICS } from '../data/questions.js';
import { h, formatNumber } from './dom.js';
import { openSheet, closeSheet } from './sheet.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * Câu hỏi đơn (khi chạy đủ quãng đường, hoặc thử thách ở cột Vùng Đất).
 * Dạng bảng bên để vẫn thấy Kỳ lân phản ứng. Đáp án do bộ xử lý (máy chủ) chấm.
 *
 * @param {{
 *   title: string,
 *   intro?: string,
 *   accent?: string,
 *   question: { ticketId: string, topic: string, q: string, options: string[] },
 *   answer: (ticketId: string, choice: number) => Promise<{ correct: boolean, correctIndex: number, explain: string | null,
 *     reward: { xp: number, coins: number, golden?: boolean, rewarded?: boolean } | null }>,
 *   onResult: (res: object) => string | void  trả về dòng thông báo thêm (nếu có),
 *   onError: (err: unknown) => void,
 *   onClose?: () => void,
 * }} options
 */
export function openQuickQuestion({ title, intro, accent, question, answer, onResult, onError, onClose }) {
  const feedback = h('div', { class: 'quiz-feedback', hidden: true, 'aria-live': 'polite' });
  const actions = h('div', { class: 'quiz-actions' });

  const buttons = question.options.map((text, i) =>
    h(
      'button',
      { class: 'quiz-option', type: 'button', onclick: () => choose(i) },
      h('span', { class: 'quiz-letter' }, LETTERS[i]),
      h('span', {}, text),
    ),
  );

  async function choose(i) {
    buttons.forEach((btn) => (btn.disabled = true));
    buttons[i].classList.add('is-pending');
    let res;
    try {
      res = await answer(question.ticketId, i);
    } catch (err) {
      onError(err);
      buttons.forEach((btn) => (btn.disabled = false));
      buttons[i].classList.remove('is-pending');
      return;
    }
    buttons[i].classList.remove('is-pending');
    buttons.forEach((btn, j) => {
      if (j === res.correctIndex) btn.classList.add('is-correct');
      else if (j === i) btn.classList.add('is-wrong');
    });
    const extra = onResult(res);
    const reward = res.reward ?? { xp: 0, coins: 0, rewarded: false };
    const rewardText =
      reward.rewarded === false
        ? 'Đã hết lượt thưởng hôm nay — vẫn là một lần luyện tập tốt!'
        : `+${formatNumber(reward.xp)} XP${reward.golden ? ' (x2 Giờ Vàng)' : ''}${reward.coins ? `, +${formatNumber(reward.coins)} Xu` : ''}`;
    feedback.hidden = false;
    feedback.replaceChildren(
      h('strong', {}, res.correct ? '🎉 Chính xác!' : '🌱 Chưa đúng — không sao, mình cùng học nhé!'),
      !res.correct ? `Đáp án đúng: ${question.options[res.correctIndex]}. ` : '',
      res.explain ? `${res.explain} ` : '',
      h('br'),
      `🎁 ${rewardText}`,
      extra ? h('div', { style: { marginTop: '6px', fontWeight: '700' } }, extra) : '',
    );
    const done = h('button', { class: 'btn btn-block', type: 'button', onclick: closeSheet }, 'Chạy tiếp 🏃');
    actions.replaceChildren(done);
    done.focus();
  }

  openSheet({
    title,
    variant: 'side',
    onClose,
    content: h(
      'div',
      {},
      intro ? h('p', { class: 'muted', style: { marginBottom: '8px' } }, intro) : '',
      h('span', { class: 'quiz-topic', style: accent ? { color: accent } : {} }, TOPICS[question.topic] ?? ''),
      h('h3', { class: 'quiz-question' }, question.q),
      h('div', { class: 'quiz-options' }, buttons),
      feedback,
      actions,
    ),
  });
  buttons[0].focus();
}
