import { sfx } from '../audio/sfx.js';
import { backendMode, bellAnswer, bellJoin, bellPractice, bellState, bellUpcoming, friendlyError, refreshState } from '../game/progress.js';
import { bellEndsAt, bellPhase } from '../game/bellClock.js';
import { createGoldenBell } from '../scene/goldenBell.js';
import { openBellPanel } from '../ui/bellView.js';
import { say, showToast } from '../ui/feedback.js';
import { addQuickAction } from '../ui/quickActions.js';

/** Hỏi máy chủ có trận mới không (giây). */
const POLL_UPCOMING_SEC = 60;
/** Khi đang thi: hỏi lại trạng thái dự phòng (giây) — chính là theo mốc giờ của từng giai đoạn. */
const LIVE_FALLBACK_SEC = 4;
/** Chờ thêm sau khi hết giờ trả lời để máy chủ chốt vòng (ms). */
const REVEAL_FETCH_DELAY_MS = 1300;
/** Nhắc trước giờ bắt đầu (ms). */
const REMIND_BEFORE_MS = 60_000;

/**
 * Rung Chuông Vàng: theo dõi lịch trận, nút 🔔, chuông vàng 3D, điều khiển bảng thi theo đồng hồ máy chủ.
 *
 * @param {{ world: object, island: object, mascot: object, fx: object, rewards: object }} deps
 * @returns {{ update: (delta: number, elapsed: number) => void }}
 */
export function setupGoldenBell({ world, island, mascot, fx, rewards }) {
  const offline = backendMode() === 'local';
  const bell3d = createGoldenBell(world.scene, island);
  let info = null; // kết quả bell_upcoming
  let offset = 0; // giờ máy chủ - giờ máy (ms)
  let panel = null;
  let vm = { game: null, practiceAvailable: offline };
  let lastKey = '';
  let fetching = false;
  let pollTimer = 0;
  let lastFetchAt = 0;
  let reminded = false;
  let announcedLobby = null;
  let lastRevealRound = 0;
  let endedHandled = null;

  const now = () => Date.now() + offset;
  const syncClock = (serverTime) => {
    if (serverTime) offset = new Date(serverTime).getTime() - Date.now();
  };

  const button = addQuickAction({
    icon: '🔔',
    label: offline ? 'Luyện tập Rung Chuông Vàng' : 'Rung Chuông Vàng',
    order: 1,
    onClick: () => openPanel(),
  });
  button.setHidden(!offline);

  function openPanel() {
    if (panel?.isOpen()) return;
    panel = openBellPanel({
      onJoin: join,
      onAnswer: answer,
      onPractice: practice,
      onClose: () => (panel = null),
    });
    panel.render(vm);
    if (info?.game) fetchState();
  }

  async function pollUpcoming() {
    try {
      info = await bellUpcoming();
      syncClock(info.serverTime);
    } catch {
      return;
    }
    const g = info.game;
    if (!g) {
      vm = { game: null, practiceAvailable: offline };
      bell3d.setVisible(false);
      button.setHidden(!offline);
      if (panel?.isOpen()) panel.render(vm);
      return;
    }
    button.setHidden(false);
    if (!vm.game || vm.game.id !== g.id) vm = { ...vm, game: g, phase: bellPhase(g, now()).phase, players: info.players, me: { joined: info.joined } };
    else vm = { ...vm, game: g, players: info.players, me: { ...vm.me, joined: info.joined || vm.me?.joined } };
    if (panel?.isOpen() && vm.phase === 'lobby') panel.render(vm);
  }

  async function fetchState() {
    if (!info?.game || fetching) return;
    fetching = true;
    try {
      const s = await bellState(info.game.id);
      syncClock(s.serverTime);
      applyState(s);
    } catch (err) {
      console.warn('[bell]', err);
    } finally {
      fetching = false;
    }
  }

  function applyState(s) {
    const prevReveal = vm.reveal;
    vm = {
      game: s.game,
      practiceAvailable: offline,
      phase: s.phase,
      round: s.round,
      endsAtMs: s.endsAt ? new Date(s.endsAt).getTime() : null,
      players: s.players,
      alive: s.alive,
      me: s.me,
      question: s.question ?? null,
      myChoice: s.myChoice ?? null,
      reveal: s.reveal ?? null,
      results: s.results ?? null,
    };
    lastKey = `${s.phase}:${s.round}:${s.reveal ? 1 : 0}`;

    // Công bố đáp án → chuông ngân, Kỳ lân phản ứng.
    if (s.reveal && !prevReveal && lastRevealRound !== s.round) {
      lastRevealRound = s.round;
      bell3d.ring();
      sfx.bell();
      if (s.me?.joined && (s.me.outRound === null || s.me.outRound === s.round)) {
        if (s.reveal.myCorrect || s.me.outRound === null) {
          mascot.emote(s.reveal.myCorrect ? 'happy' : 'oops');
          if (s.reveal.myCorrect) sfx.correct();
        } else {
          mascot.emote('cry');
          sfx.wrong();
        }
      }
    }
    if (s.results && endedHandled !== s.game.id) {
      endedHandled = s.game.id;
      const win = s.results.winners.some((w) => w.me);
      bell3d.ring();
      sfx.bell();
      if (win) {
        sfx.cheer();
        rewards.celebrate('#E8B54E');
        fx.ring(mascot.object.position, '#FFD86B');
        mascot.emote('cheer');
        say('Rung chuông vàng rồi! 🔔🏆 Bạn là nhà vô địch Tri Thức!');
      } else if (s.me?.joined) {
        mascot.emote('wave');
        say('Trận đấu tuyệt vời! Hẹn bạn trận sau nhé 🔔');
      }
      refreshState().catch(() => {});
    }
    if (panel?.isOpen()) panel.render(vm);
  }

  async function join() {
    if (!info?.game) return;
    try {
      const r = await bellJoin(info.game.id);
      vm = { ...vm, me: { joined: true, outRound: null, correct: 0 }, players: r.players ?? vm.players };
      sfx.pop();
      mascot.emote('cheer');
      say('Đã vào phòng chờ Rung Chuông Vàng! Chuẩn bị tinh thần nhé 🔔');
      panel?.render(vm);
    } catch (err) {
      showToast(friendlyError(err), { type: 'warn', icon: '🔔' });
    }
  }

  async function answer(choice) {
    if (!info?.game || vm.myChoice != null) return;
    vm = { ...vm, myChoice: choice };
    panel?.render(vm);
    sfx.click();
    try {
      const r = await bellAnswer(info.game.id, vm.round, choice);
      if (!r.ok && r.choice != null) vm = { ...vm, myChoice: r.choice };
    } catch (err) {
      vm = { ...vm, myChoice: null };
      showToast(friendlyError(err), { type: 'warn', icon: '⏰' });
    }
    panel?.render(vm);
  }

  async function practice() {
    try {
      info = await bellPractice();
      syncClock(info.serverTime);
      vm = { game: info.game, practiceAvailable: true, phase: 'lobby', players: info.players, me: { joined: true, outRound: null } };
      lastKey = '';
      lastRevealRound = 0;
      endedHandled = null;
      bell3d.setVisible(true);
      panel?.render(vm);
      say('Trận luyện tập sắp bắt đầu! Cùng các bạn ảo thử sức nhé 🔔');
    } catch (err) {
      showToast(friendlyError(err), { type: 'warn' });
    }
  }

  function update(delta) {
    pollTimer -= delta;
    if (pollTimer <= 0) {
      pollTimer = POLL_UPCOMING_SEC;
      if (!vm.game || vm.phase === 'lobby' || vm.phase === 'ended' || !vm.phase) pollUpcoming();
    }
    bell3d.update(delta, performance.now() / 1000);
    const g = vm.game;
    if (!g) return;

    const t = now();
    const ph = bellPhase(g, t);
    const lobbyOpen = info?.lobbyOpensAt ? t >= new Date(info.lobbyOpensAt).getTime() : true;
    const recentlyEnded = t < bellEndsAt(g) + 300_000;
    const showBell = (lobbyOpen && recentlyEnded) || offline;
    bell3d.setVisible(showBell && g.status !== 'cancelled' && recentlyEnded);
    bell3d.setLive(ph.phase === 'answer' || ph.phase === 'reveal');

    // Nút 🔔: đếm ngược / LIVE.
    if (ph.phase === 'lobby') button.setBadge(new Date(g.startsAt).getTime() - t < 3600_000 ? clockShort(new Date(g.startsAt).getTime() - t) : '📅');
    else if (ph.phase === 'answer' || ph.phase === 'reveal') button.setBadge('LIVE');
    else button.setBadge(null);
    button.setPulse(lobbyOpen && (ph.phase === 'lobby' || ph.phase === 'answer' || ph.phase === 'reveal'));

    if (ph.phase === 'lobby' && lobbyOpen && announcedLobby !== g.id && !offline) {
      announcedLobby = g.id;
      say(`🔔 "${g.title}" mở phòng chờ! Bắt đầu lúc ${new Date(g.startsAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} — bấm 🔔 để tham gia!`);
    }
    if (ph.phase === 'lobby' && !reminded && vm.me?.joined && new Date(g.startsAt).getTime() - t < REMIND_BEFORE_MS) {
      reminded = true;
      sfx.bell();
      say('Rung Chuông Vàng sắp bắt đầu! Sẵn sàng nhé 🔔');
      openPanel();
    }

    // Khi trận bắt đầu: tự mở bảng cho người đã tham gia.
    if (ph.phase === 'answer' && ph.round === 1 && vm.me?.joined && !panel?.isOpen() && vm.phase === 'lobby') openPanel();

    // Theo mốc giờ: đổi giai đoạn → hỏi máy chủ; đang công bố mà chưa có đáp án → hỏi lại (tối đa 1 lần/giây).
    const live = ph.phase === 'answer' || ph.phase === 'reveal' || (ph.phase === 'ended' && !vm.results);
    if (live && (panel?.isOpen() || vm.me?.joined)) {
      const changed = !lastKey.startsWith(`${ph.phase}:${ph.round}`);
      const revealStarted = ph.phase === 'reveal' ? t - (ph.endsAt - g.revealSec * 1000) : Infinity;
      const waitSettle = ph.phase === 'reveal' && revealStarted <= REVEAL_FETCH_DELAY_MS;
      const missing = (ph.phase === 'reveal' && !vm.reveal) || (ph.phase === 'ended' && !vm.results);
      const sinceFetch = t - lastFetchAt;
      if (!waitSettle && ((changed && sinceFetch > 300) || (missing && sinceFetch > 1000) || sinceFetch > LIVE_FALLBACK_SEC * 1000)) {
        lastFetchAt = t;
        fetchState();
      }
    }
    if (ph.phase !== vm.phase && ph.phase === 'lobby' && panel?.isOpen()) panel.render(vm);
    panel?.isOpen() && panel.tick(t);
  }

  pollUpcoming();
  if (import.meta.env.DEV) window.__kltBell = { get vm() { return vm; }, get info() { return info; }, get offset() { return offset; } };
  return { update };
}

function clockShort(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}′` : `${s}s`;
}
