import { TOPICS } from '../data/questions.js';
import { h, formatNumber } from './dom.js';
import { openSheet, closeSheet } from './sheet.js';

const LETTERS = ['A', 'B', 'C', 'D'];

/**
 * Câu hỏi đơn (khi chạy đủ quãng đường, hoặc thử thách ở cột Vùng Đất).
 * Dạng bảng bên để vẫn thấy Kỳ lân phản ứng.
 *
 * @param {{
 *   title: string,
 *   intro?: string,
 *   accent?: string,
 *   question: { topic: string, q: string, options: string[], correctIndex: number, explain?: string },
 *   onAnswer: (correct: boolean) => { xp: number, coins: number, golden?: boolean, rewarded?: boolean, extra?: string },
 *   onClose?: () => void,
 * }} options
 */
export function openQuickQuestion({ title, intro, accent, question, onAnswer, onClose }) {
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

  function choose(i) {
    const correct = i === question.correctIndex;
    buttons.forEach((btn, j) => {
      btn.disabled = true;
      if (j === question.correctIndex) btn.classList.add('is-correct');
      else if (j === i) btn.classList.add('is-wrong');
    });
    const reward = onAnswer(correct);
    const rewardText =
      reward.rewarded === false
        ? 'Đã hết lượt thưởng hôm nay — vẫn là một lần luyện tập tốt!'
        : `+${formatNumber(reward.xp)} XP${reward.golden ? ' (x2 Giờ Vàng)' : ''}${reward.coins ? `, +${formatNumber(reward.coins)} Xu` : ''}`;
    feedback.hidden = false;
    feedback.replaceChildren(
      h('strong', {}, correct ? '🎉 Chính xác!' : '🌱 Chưa đúng — không sao, mình cùng học nhé!'),
      !correct ? `Đáp án đúng: ${question.options[question.correctIndex]}. ` : '',
      question.explain ? `${question.explain} ` : '',
      h('br'),
      `🎁 ${rewardText}`,
      reward.extra ? h('div', { style: { marginTop: '6px', fontWeight: '700' } }, reward.extra) : '',
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
