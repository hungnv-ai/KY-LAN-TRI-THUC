import { BELL } from '../config.js';
import { bellPhase } from './bellClock.js';

/**
 * Rung Chuông Vàng — chế độ LUYỆN TẬP ngoại tuyến: một trận với các "bạn ảo" để làm quen luật chơi.
 * Cùng giao diện với các hàm RPC trên máy chủ (bell_upcoming, bell_state…), luật giống hệt
 * supabase/sql/10_golden_bell.sql (kể cả luật cứu trợ).
 */

const BOT_NAMES = [
  'Cô Hoa', 'Thầy Nam', 'Minh Anh', 'Bảo Ngọc', 'Cô Thu', 'Thầy Phúc', 'Gia Huy', 'Khánh Linh', 'Cô Yến', 'Thầy Long',
  'Tuệ Nhi', 'Đức Anh', 'Cô Mai', 'Thầy Tùng', 'Hà My', 'Quốc Bảo', 'Cô Lan', 'Thầy Hải', 'Ngọc Hân', 'Minh Khang',
  'Cô Trang', 'Thầy Dũng', 'An Nhiên', 'Hoàng Nam', 'Cô Hằng', 'Thầy Quân', 'Thảo Vy', 'Tuấn Kiệt',
];

/**
 * @param {{ pickQuestions: (n: number) => { q: string, a: string[], explain?: string }[],
 *   applyReward: (xp: number, coins: number, kind: string) => object, myName: () => string }} deps
 */
export function createLocalBell({ pickQuestions, applyReward, myName }) {
  let game = null;

  function settle(now) {
    if (!game || game.status !== 'scheduled') return;
    const cycle = (game.answerSec + game.revealSec) * 1000;
    const start = new Date(game.startsAt).getTime();
    while (game.settledRound < game.questionCount) {
      const r = game.settledRound + 1;
      if (now < start + (r - 1) * cycle + (game.answerSec + BELL.ANSWER_GRACE_SEC) * 1000) break;
      const round = game.rounds[r - 1];
      // Bạn ảo còn trụ trả lời (đúng theo xác suất).
      for (const p of game.players) {
        if (p.bot && p.outRound === null) round.answers.set(p.id, Math.random() < BELL.PRACTICE_BOT_ACCURACY ? round.correctIndex : (round.correctIndex + 1) % round.options.length);
      }
      const alive = game.players.filter((p) => p.outRound === null);
      const correct = alive.filter((p) => round.answers.get(p.id) === round.correctIndex);
      if (correct.length > 0) alive.filter((p) => !correct.includes(p)).forEach((p) => (p.outRound = r));
      correct.forEach((p) => (p.correct += 1));
      game.settledRound = r;
    }
    if (game.settledRound >= game.questionCount) {
      game.status = 'finished';
      const me = game.players.find((p) => p.id === 'me');
      if (me) game.myReward = me.outRound === null ? applyReward(game.prizeXp + game.joinXp, game.prizeCoins, 'bell_win') : applyReward(game.joinXp, 0, 'bell_join');
    }
  }

  function gameJson() {
    const { rounds: _r, players: _p, settledRound: _s, myReward: _m, ...rest } = game;
    return { ...rest, endsAt: new Date(game.startsAt).getTime() + game.questionCount * (game.answerSec + game.revealSec) * 1000 };
  }

  return {
    async upcoming() {
      const now = Date.now();
      if (game && now > new Date(gameJson().endsAt).getTime() + 300_000) game = null;
      if (!game) return { game: null, practice: true, serverTime: new Date(now).toISOString() };
      return { game: gameJson(), joined: true, players: game.players.length, practice: true, serverTime: new Date(now).toISOString() };
    },

    /** Tạo trận luyện tập bắt đầu sau vài giây, tự tham gia. */
    async practice() {
      const qs = pickQuestions(BELL.PRACTICE_QUESTIONS);
      const bots = [...BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, BELL.PRACTICE_BOTS);
      game = {
        id: Date.now(),
        title: 'Trận luyện tập',
        startsAt: new Date(Date.now() + BELL.PRACTICE_DELAY_SEC * 1000).toISOString(),
        questionCount: qs.length,
        answerSec: BELL.DEFAULT_ANSWER_SEC,
        revealSec: BELL.REVEAL_SEC,
        prizeXp: 20,
        prizeCoins: 20,
        joinXp: 2,
        winnerVoucher: null,
        status: 'scheduled',
        settledRound: 0,
        rounds: qs.map((q) => {
          const order = q.a.map((_, i) => i).sort(() => Math.random() - 0.5);
          return { q: q.q, options: order.map((i) => q.a[i]), correctIndex: order.indexOf(0), explain: q.explain ?? null, answers: new Map() };
        }),
        players: [{ id: 'me', name: myName(), outRound: null, correct: 0 }, ...bots.map((name, i) => ({ id: `bot${i}`, name, bot: true, outRound: null, correct: 0 }))],
      };
      return this.upcoming();
    },

    async join() {
      return { ok: true, players: game?.players.length ?? 0 };
    },

    async state() {
      if (!game) throw new Error('bell_not_found');
      const now = Date.now();
      settle(now);
      const ph = bellPhase(game, now);
      const me = game.players.find((p) => p.id === 'me');
      const res = {
        serverTime: new Date(now).toISOString(),
        game: gameJson(),
        phase: ph.phase,
        round: ph.round,
        endsAt: ph.endsAt ? new Date(ph.endsAt).toISOString() : null,
        players: game.players.length,
        alive: game.players.filter((p) => p.outRound === null).length,
        me: { joined: true, outRound: me.outRound, correct: me.correct },
      };
      if (ph.phase === 'answer' || ph.phase === 'reveal') {
        const round = game.rounds[ph.round - 1];
        res.question = { q: round.q, options: round.options };
        if (round.answers.has('me')) res.myChoice = round.answers.get('me');
        if (ph.phase === 'reveal' && game.settledRound >= ph.round) {
          res.reveal = {
            correctIndex: round.correctIndex,
            explain: round.explain,
            myCorrect: round.answers.get('me') === round.correctIndex,
            eliminated: game.players.filter((p) => p.outRound === ph.round).length,
            answeredCorrect: [...round.answers.values()].filter((c) => c === round.correctIndex).length,
          };
        }
      }
      if (game.status === 'finished') {
        const winners = game.players.filter((p) => p.outRound === null).sort((a, b) => b.correct - a.correct);
        res.results = {
          survivors: winners.length,
          winners: winners.slice(0, 30).map((p) => ({ name: p.name, unit: p.bot ? 'Bạn ảo' : null, correct: p.correct, me: p.id === 'me' })),
        };
        res.myReward = game.myReward ?? null;
      }
      return res;
    },

    async answer(_gameId, round, choice) {
      if (!game) throw new Error('bell_not_found');
      const now = Date.now();
      settle(now);
      const me = game.players.find((p) => p.id === 'me');
      if (me.outRound !== null) throw new Error('bell_eliminated');
      const ph = bellPhase(game, now - BELL.ANSWER_GRACE_SEC * 1000);
      const current = bellPhase(game, now);
      const open = (current.phase === 'answer' && current.round === round) || (ph.phase === 'answer' && ph.round === round);
      if (!open) throw new Error('bell_round_closed');
      const r = game.rounds[round - 1];
      if (r.answers.has('me')) return { ok: false, reason: 'already', choice: r.answers.get('me') };
      r.answers.set('me', choice);
      return { ok: true, choice };
    },
  };
}
