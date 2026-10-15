import { VALUES } from '../config.js';
import { h, formatNumber } from './dom.js';
import { openSheet } from './sheet.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const HOUSE = Object.fromEntries(VALUES.map((v) => [v.id, v]));

function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)} giờ ${m % 60} phút` : `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function timeOfDay(iso) {
  return new Date(iso).toLocaleString('vi-VN', { weekday: 'long', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

/**
 * Bảng Rung Chuông Vàng (đặt bên cạnh để vẫn thấy Kỳ lân): phòng chờ, câu hỏi + đồng hồ,
 * công bố đáp án, kết quả. Nội dung vẽ lại theo "view model" do features/goldenBell.js cung cấp.
 *
 * @param {{ onJoin: () => void, onAnswer: (choice: number) => void, onPractice: () => void, onClose?: () => void }} handlers
 * @returns {{ render: (vm: object) => void, tick: (nowMs: number) => void, isOpen: () => boolean }}
 */
export function openBellPanel({ onJoin, onAnswer, onPractice, onClose }) {
  const root = h('div', { class: 'bell' });
  let timerFill = null;
  let timerText = null;
  let countdownEl = null;
  let vm = null;
  let signature = '';

  openSheet({ title: '🔔 Rung Chuông Vàng', content: root, variant: 'side', onClose });

  /** Chỉ vẽ lại khi nội dung đổi — tránh thay nút giữa lúc người chơi đang bấm. */
  function render(next) {
    vm = next;
    const sig = JSON.stringify([
      next.game?.id, next.game?.startsAt, next.phase, next.round, next.players, next.alive, next.me,
      next.question?.q, next.myChoice, Boolean(next.reveal), Boolean(next.results), next.practiceAvailable,
    ]);
    if (sig === signature && root.childElementCount) return;
    signature = sig;
    timerFill = timerText = countdownEl = null;
    root.replaceChildren(...view(next));
  }

  function view(v) {
    if (!v.game) {
      return [
        h('div', { class: 'bell-hero' }, h('span', { 'aria-hidden': 'true' }, '🔔'), h('strong', {}, 'Rung Chuông Vàng')),
        h('p', {}, 'Cả trường cùng trả lời một câu hỏi trong thời gian ngắn. Sai là dừng chân — người trụ lại cuối cùng rung chuông vàng!'),
        v.practiceAvailable
          ? h('button', { class: 'btn btn-block btn-gold', type: 'button', onclick: onPractice }, '🎯 Luyện tập với các bạn ảo')
          : h('p', { class: 'notice' }, '📅 Chưa có trận nào được lên lịch. BGH sẽ thông báo giờ thi đấu — Kỳ lân sẽ nhắc bạn!'),
      ];
    }
    const g = v.game;
    const prize = [`+${g.prizeXp} XP`, `+${formatNumber(g.prizeCoins)} Xu`, g.winnerVoucher ? `🎟️ ${g.winnerVoucher}` : null].filter(Boolean).join(' · ');
    const header = h(
      'div',
      { class: 'bell-head' },
      h('strong', {}, g.title),
      h('span', { class: 'muted small' }, `🏆 ${prize}`),
    );

    if (v.phase === 'cancelled') return [header, h('p', { class: 'notice' }, 'Trận này đã bị huỷ.')];

    if (v.phase === 'lobby') {
      countdownEl = h('div', { class: 'bell-countdown' }, '--:--');
      return [
        header,
        h('div', { class: 'bell-lobby' }, h('span', { class: 'muted' }, 'Bắt đầu sau'), countdownEl, h('span', { class: 'muted small' }, timeOfDay(g.startsAt))),
        h('p', {}, `👥 ${v.players} người đã vào phòng chờ · ${g.questionCount} câu · ${g.answerSec} giây/câu`),
        h(
          'ul',
          { class: 'bell-rules' },
          h('li', {}, 'Trả lời sai hoặc không kịp → dừng chân (vẫn được xem tiếp).'),
          h('li', {}, 'Nếu cả phòng đều sai → tất cả được cứu trợ, đi tiếp!'),
          h('li', {}, `Ai tham gia cũng có +${g.joinXp} XP; người trụ lại nhận ${prize}.`),
        ),
        v.me?.joined
          ? h('p', { class: 'notice notice-success' }, '✓ Bạn đã vào phòng chờ. Giữ trang mở — trận tự bắt đầu đúng giờ!')
          : h('button', { class: 'btn btn-block btn-gold', type: 'button', onclick: onJoin }, '🔔 Tham gia ngay'),
      ];
    }

    if (v.phase === 'ended' || v.results) {
      const r = v.results;
      if (!r) return [header, h('p', { class: 'muted' }, 'Đang tổng kết…')];
      const meWin = r.winners.some((w) => w.me);
      return [
        header,
        h(
          'div',
          { class: `bell-result ${meWin ? 'is-win' : ''}` },
          h('span', { class: 'bell-result-icon', 'aria-hidden': 'true' }, meWin ? '🏆' : v.me?.joined ? '🎗️' : '🔔'),
          h(
            'div',
            {},
            h('strong', {}, meWin ? 'Bạn đã rung chuông vàng!' : v.me?.joined ? `Bạn dừng chân ở câu ${v.me.outRound}` : 'Trận đã kết thúc'),
            h('div', { class: 'small' }, meWin ? `Phần thưởng: ${prize}` : v.me?.joined ? `+${g.joinXp} XP tham gia — lần sau cố lên nhé!` : ''),
          ),
        ),
        h('h3', { class: 'section-title' }, `🎉 ${r.survivors} người trụ lại đến cuối`),
        r.winners.length
          ? h(
              'ol',
              { class: 'bell-winners' },
              r.winners.map((w) =>
                h(
                  'li',
                  { class: w.me ? 'is-me' : '' },
                  w.house ? h('span', { class: 'house-dot', style: { background: HOUSE[w.house]?.color } }) : '',
                  h('strong', {}, w.name ?? 'Kỳ lân'),
                  w.unit ? h('span', { class: 'muted small' }, ` · ${w.unit}`) : '',
                  h('span', { class: 'muted small' }, ` · ${w.correct} câu đúng`),
                ),
              ),
            )
          : '',
        v.practiceAvailable ? h('button', { class: 'btn btn-block btn-secondary', type: 'button', onclick: onPractice }, '🔁 Luyện tập trận mới') : '',
      ];
    }

    // Đang thi: câu hỏi (answer) hoặc công bố (reveal).
    const playing = v.me?.joined && v.me.outRound === null;
    const eliminatedNow = v.me?.joined && v.me.outRound === v.round;
    const spectator = !v.me?.joined || (v.me.outRound !== null && !eliminatedNow);
    timerFill = h('span', {});
    timerText = h('span', { class: 'bell-timer-text' }, '');
    const top = h(
      'div',
      { class: 'bell-status' },
      h('span', {}, `Câu ${v.round}/${g.questionCount}`),
      h('span', {}, `🙋 Còn ${v.alive}/${v.players} người`),
    );
    const timer = h('div', { class: `bell-timer ${v.phase === 'reveal' ? 'is-reveal' : ''}` }, timerFill, timerText);
    const q = v.question;
    const rev = v.reveal;
    const options = q
      ? h(
          'div',
          { class: 'bell-options' },
          q.options.map((opt, i) => {
            let cls = 'bell-option';
            if (v.myChoice === i) cls += ' is-chosen';
            if (rev) {
              if (i === rev.correctIndex) cls += ' is-correct';
              else if (v.myChoice === i) cls += ' is-wrong';
            }
            const disabled = !playing || v.phase !== 'answer' || v.myChoice != null;
            return h(
              'button',
              { class: cls, type: 'button', disabled, onclick: () => onAnswer(i) },
              h('span', { class: 'bell-letter' }, LETTERS[i]),
              h('span', {}, opt),
            );
          }),
        )
      : '';

    let message = '';
    if (v.phase === 'answer') {
      if (playing) message = v.myChoice != null ? h('p', { class: 'notice' }, '🔒 Đã chốt đáp án! Chờ công bố…') : h('p', { class: 'muted' }, 'Chọn một đáp án trước khi hết giờ!');
    } else if (!rev) {
      message = h('p', { class: 'muted' }, '⏳ Đang chốt đáp án…');
    } else if (rev.eliminated === 0 && rev.answeredCorrect === 0) {
      message = h('p', { class: 'notice notice-success' }, '🛟 Không ai trả lời đúng — cả phòng được cứu trợ, đi tiếp!');
    } else if (playing || (v.me?.joined && rev.myCorrect)) {
      message = h('p', { class: 'notice notice-success' }, `✅ Chính xác! Bạn đi tiếp. (${rev.eliminated} người dừng chân)`);
    } else if (eliminatedNow) {
      message = h('p', { class: 'notice notice-danger' }, `Tiếc quá! Bạn dừng chân ở câu ${v.round}. Ở lại cổ vũ mọi người nhé! 📣`);
    } else {
      message = h('p', { class: 'muted' }, `${rev.eliminated} người dừng chân ở câu này.`);
    }

    return [
      header,
      spectator ? h('p', { class: 'bell-spectator' }, v.me?.joined ? '👀 Bạn đang xem và cổ vũ' : '👀 Trận đã bắt đầu — bạn đang xem') : '',
      top,
      timer,
      q ? h('p', { class: 'bell-question' }, q.q) : h('p', { class: 'muted' }, 'Đang tải câu hỏi…'),
      options,
      message,
      rev?.explain ? h('p', { class: 'quiz-feedback' }, `💡 ${rev.explain}`) : '',
    ];
  }

  /** Cập nhật đồng hồ mỗi khung hình (không vẽ lại toàn bộ). */
  function tick(nowMs) {
    if (!vm?.game) return;
    if (countdownEl) countdownEl.textContent = clock(new Date(vm.game.startsAt).getTime() - nowMs);
    if (timerFill && vm.endsAtMs) {
      const total = (vm.phase === 'answer' ? vm.game.answerSec : vm.game.revealSec) * 1000;
      const left = Math.max(0, vm.endsAtMs - nowMs);
      timerFill.style.width = `${(left / total) * 100}%`;
      timerText.textContent = vm.phase === 'answer' ? `${Math.ceil(left / 1000)} giây` : 'Câu tiếp theo…';
    }
  }

  return { render, tick, isOpen: () => root.isConnected };
}
