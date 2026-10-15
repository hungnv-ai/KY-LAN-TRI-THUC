/**
 * Đồng hồ trận Rung Chuông Vàng — cùng công thức với _bell_phase trên máy chủ.
 * Vòng r (1..N) mở lúc startsAt + (r-1)·(answerSec+revealSec), nhận đáp án answerSec giây,
 * rồi công bố đáp án revealSec giây.
 */

/**
 * @param {{ startsAt: string | number, questionCount: number, answerSec: number, revealSec: number, status?: string }} game
 * @param {number} nowMs thời điểm (ms) theo giờ máy chủ
 * @returns {{ phase: 'lobby' | 'answer' | 'reveal' | 'ended' | 'cancelled', round: number, endsAt: number | null }}
 */
export function bellPhase(game, nowMs) {
  if (game.status === 'cancelled') return { phase: 'cancelled', round: 0, endsAt: null };
  const start = new Date(game.startsAt).getTime();
  const cycle = (game.answerSec + game.revealSec) * 1000;
  const el = nowMs - start;
  if (el < 0) return { phase: 'lobby', round: 0, endsAt: start };
  const round = Math.floor(el / cycle) + 1;
  if (round > game.questionCount) return { phase: 'ended', round: game.questionCount, endsAt: null };
  const inCycle = el - (round - 1) * cycle;
  if (inCycle < game.answerSec * 1000) return { phase: 'answer', round, endsAt: start + (round - 1) * cycle + game.answerSec * 1000 };
  return { phase: 'reveal', round, endsAt: start + round * cycle };
}

/**
 * Thời điểm kết thúc trận (ms).
 *
 * @param {{ startsAt: string | number, questionCount: number, answerSec: number, revealSec: number }} game
 */
export function bellEndsAt(game) {
  return new Date(game.startsAt).getTime() + game.questionCount * (game.answerSec + game.revealSec) * 1000;
}
