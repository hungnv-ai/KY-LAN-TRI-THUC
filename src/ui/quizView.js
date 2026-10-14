import { QUIZ } from '../config.js';
import { TOPICS } from '../data/questions.js';
import { h, formatNumber } from './dom.js';
import { openSheet, setSheetContent, closeSheet, isSheetOpen } from './sheet.js';

const LETTERS = ['A', 'B', 'C', 'D'];

/**
 * Giao diện Quiz Tri Thức: giới thiệu → 5 câu hỏi (đếm ngược 3 phút) → kết quả.
 *
 * @param {{
 *   rewardedLeft: () => number,
 *   createRound: () => { questions: { topic: string, q: string, options: string[], correctIndex: number, explain?: string }[] },
 *   onAnswer: (isCorrect: boolean) => void,
 *   onComplete: (result: { correct: number, total: number }) => { xp: number, coins: number, golden: boolean, rewarded: boolean, perfect: boolean },
 * }} handlers
 */
export function openQuiz(handlers) {
  let timerId = 0;
  const stopTimer = () => clearInterval(timerId);

  openSheet({ title: '🧠 Thử thách Tri Thức', content: renderIntro(), onClose: stopTimer });

  function renderIntro() {
    const left = handlers.rewardedLeft();
    return h(
      'div',
      { class: 'quiz-intro' },
      h('div', { class: 'big-emoji', 'aria-hidden': 'true' }, '📚'),
      h('p', { class: 'muted' }, `${QUIZ.QUESTIONS_PER_ROUND} câu hỏi · ${QUIZ.TIME_LIMIT_SEC / 60} phút · về 5 giá trị cốt lõi, văn hoá VA và kiến thức chung.`),
      h(
        'ul',
        { class: 'rule-list' },
        h('li', {}, `✅ Đúng: +${QUIZ.XP_PER_CORRECT} XP, +${QUIZ.COINS_PER_CORRECT} Xu`),
        h('li', {}, `🌱 Sai cũng được +${QUIZ.XP_PER_TRY} XP — tinh thần thử sai!`),
        h('li', {}, `🌟 Đúng hết: thưởng thêm +${QUIZ.PERFECT_BONUS_XP} XP, +${QUIZ.PERFECT_BONUS_COINS} Xu`),
        h('li', {}, '⏰ Giờ Vàng (12h–13h, 19h–21h): x2 XP'),
      ),
      h(
        'p',
        { class: 'muted' },
        left > 0
          ? `Hôm nay còn ${left}/${QUIZ.REWARDED_ROUNDS_PER_DAY} lượt có thưởng.`
          : 'Hôm nay bạn đã dùng hết lượt có thưởng. Vẫn có thể chơi luyện tập!',
      ),
      h('button', { class: 'btn btn-block', type: 'button', onclick: startRound }, left > 0 ? 'Bắt đầu' : 'Luyện tập'),
    );
  }

  function startRound() {
    const { questions } = handlers.createRound();
    const results = []; // true/false theo từng câu
    let index = 0;
    let secondsLeft = QUIZ.TIME_LIMIT_SEC;

    const timerEl = h('span', { class: 'quiz-timer' });
    const updateTimer = () => {
      const m = Math.floor(secondsLeft / 60);
      const s = String(secondsLeft % 60).padStart(2, '0');
      timerEl.textContent = `⏱ ${m}:${s}`;
      timerEl.classList.toggle('is-low', secondsLeft <= 30);
    };
    updateTimer();
    timerId = setInterval(() => {
      secondsLeft -= 1;
      updateTimer();
      if (secondsLeft <= 0) {
        stopTimer();
        finish(true);
      }
    }, 1000);

    showQuestion();

    function showQuestion() {
      const question = questions[index];
      const steps = h(
        'div',
        { class: 'quiz-steps', 'aria-hidden': 'true' },
        questions.map((_, i) =>
          h('span', {
            class: `quiz-step ${i < results.length ? (results[i] ? 'is-correct' : 'is-wrong') : i === index ? 'is-current' : ''}`,
          }),
        ),
      );

      const feedback = h('div', { class: 'quiz-feedback', hidden: true, 'aria-live': 'polite' });
      const actions = h('div', { class: 'quiz-actions' });
      const optionButtons = question.options.map((text, i) =>
        h(
          'button',
          { class: 'quiz-option', type: 'button', onclick: () => choose(i) },
          h('span', { class: 'quiz-letter' }, LETTERS[i]),
          h('span', {}, text),
        ),
      );

      function choose(i) {
        const correct = i === question.correctIndex;
        results.push(correct);
        optionButtons.forEach((btn, j) => {
          btn.disabled = true;
          if (j === question.correctIndex) btn.classList.add('is-correct');
          else if (j === i) btn.classList.add('is-wrong');
        });
        feedback.hidden = false;
        feedback.replaceChildren(
          h('strong', {}, correct ? '🎉 Chính xác!' : '🌱 Chưa đúng — không sao, mình cùng học nhé!'),
          !correct ? `Đáp án đúng: ${question.options[question.correctIndex]}. ` : '',
          question.explain ?? '',
        );
        const isLast = index === questions.length - 1;
        const next = h(
          'button',
          {
            class: 'btn btn-block',
            type: 'button',
            onclick: () => {
              if (isLast) {
                finish(false);
              } else {
                index += 1;
                showQuestion();
              }
            },
          },
          isLast ? 'Xem kết quả' : 'Câu tiếp theo →',
        );
        actions.replaceChildren(next);
        next.focus();
        handlers.onAnswer(correct);
      }

      setSheetContent(
        h(
          'div',
          {},
          h('div', { class: 'quiz-top' }, steps, h('span', {}, `Câu ${index + 1}/${questions.length}`), timerEl),
          h('span', { class: 'quiz-topic' }, TOPICS[question.topic] ?? ''),
          h('h3', { class: 'quiz-question' }, question.q),
          h('div', { class: 'quiz-options' }, optionButtons),
          feedback,
          actions,
        ),
      );
      optionButtons[0].focus();
    }

    function finish(timedOut) {
      stopTimer();
      if (!isSheetOpen()) return;
      const correct = results.filter(Boolean).length;
      const total = questions.length;
      const reward = handlers.onComplete({ correct, total });
      setSheetContent(renderResult({ correct, total, reward, timedOut }));
    }
  }

  function renderResult({ correct, total, reward, timedOut }) {
    const ratio = correct / total;
    const [emoji, headline] =
      ratio === 1
        ? ['🏆', 'Xuất sắc! Đúng tất cả!']
        : ratio >= 0.6
          ? ['🌟', 'Làm tốt lắm!']
          : ['🌱', 'Mỗi lần thử là một lần lớn lên!'];

    return h(
      'div',
      { class: 'quiz-result' },
      h('div', { class: 'big-emoji', 'aria-hidden': 'true' }, emoji),
      h('h3', { class: 'dialog-title' }, headline),
      h('p', { class: 'muted' }, `${timedOut ? 'Hết giờ! ' : ''}Bạn trả lời đúng ${correct}/${total} câu.`),
      reward.rewarded
        ? h(
            'div',
            { class: 'reward-row' },
            h('span', { class: 'reward-chip' }, `⭐ +${formatNumber(reward.xp)} XP${reward.golden ? ' (x2)' : ''}`),
            h('span', { class: 'reward-chip' }, `🪙 +${formatNumber(reward.coins)}`),
          )
        : h('p', { class: 'muted' }, 'Lượt luyện tập — không tính thưởng.'),
      h(
        'div',
        { class: 'dialog-actions' },
        h('button', { class: 'btn btn-secondary', type: 'button', onclick: closeSheet }, 'Đóng'),
        h('button', { class: 'btn', type: 'button', onclick: () => setSheetContent(renderIntro()) }, 'Chơi tiếp'),
      ),
    );
  }
}
