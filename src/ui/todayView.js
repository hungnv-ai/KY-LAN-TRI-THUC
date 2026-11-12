import { CHECK_IN, MISSIONS } from '../config.js';
import { h, formatNumber } from './dom.js';
import { openSheet, setSheetContent, isSheetOpen } from './sheet.js';

/**
 * Bảng "Hôm nay": điểm danh + chuỗi ngày, 3 nhiệm vụ hằng ngày và rương thưởng.
 *
 * @param {{
 *   getData: () => { checkedIn: boolean, streak: number, missions: { id: string, label: string, target: number,
 *     progress: number, done: boolean }[], chestClaimed: boolean,
 *     quests?: { id: string, icon: string, label: string, xp: number, coins: number, done: boolean,
 *       progress: { value: number, need: number } | null }[] },
 *   onCheckIn: () => Promise<void>,
 *   onClaimChest: () => Promise<void>,
 * }} handlers
 * @returns {{ refresh: () => void }}
 */
export function openToday({ getData, onCheckIn, onClaimChest }) {
  function render() {
    const { checkedIn, streak, missions, chestClaimed, quests = [] } = getData();
    const allDone = missions.length > 0 && missions.every((m) => m.done);

    const checkinBtn = h(
      'button',
      { class: 'btn btn-block', type: 'button', disabled: checkedIn },
      checkedIn ? '✓ Đã điểm danh hôm nay' : `📅 Điểm danh (+${CHECK_IN.XP} XP, +${CHECK_IN.COINS}+ Xu)`,
    );
    checkinBtn.addEventListener('click', () => busy(checkinBtn, onCheckIn));

    const chestBtn = h(
      'button',
      { class: `btn btn-block ${allDone && !chestClaimed ? 'btn-gold' : 'btn-secondary'}`, type: 'button', disabled: !allDone || chestClaimed },
      chestClaimed ? '✓ Đã mở rương hôm nay' : allDone ? '🎁 Mở rương thưởng!' : `🔒 Hoàn thành ${MISSIONS.PER_DAY} nhiệm vụ để mở rương`,
    );
    chestBtn.addEventListener('click', () => busy(chestBtn, onClaimChest));

    return h(
      'div',
      { class: 'today' },
      h(
        'div',
        { class: 'streak-card' },
        h('span', { class: 'streak-flame', 'aria-hidden': 'true' }, '🔥'),
        h(
          'div',
          {},
          h('div', { class: 'streak-count' }, `${streak} ngày liên tiếp`),
          h('div', { class: 'muted' }, 'Trách nhiệm là giữ lời hứa với chính mình — mỗi ngày một chút!'),
        ),
      ),
      checkinBtn,
      h('h3', { class: 'section-title' }, 'Nhiệm vụ hôm nay'),
      h(
        'ul',
        { class: 'mission-list' },
        missions.map((m) =>
          h(
            'li',
            { class: `mission ${m.done ? 'is-done' : ''}` },
            h('span', { class: 'mission-check', 'aria-hidden': 'true' }, m.done ? '✓' : ''),
            h(
              'div',
              { class: 'mission-body' },
              h('div', { class: 'mission-label' }, m.label),
              h(
                'div',
                { class: 'mission-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': m.target, 'aria-valuenow': m.progress },
                h('span', { style: { width: `${Math.round((m.progress / m.target) * 100)}%` } }),
              ),
            ),
            h('span', { class: 'mission-count' }, `${formatNumber(m.progress)}/${formatNumber(m.target)}`),
          ),
        ),
      ),
      h('p', { class: 'muted' }, `Rương thưởng: +${MISSIONS.CHEST_XP} XP, +${MISSIONS.CHEST_COINS} Xu.`),
      chestBtn,
      quests.length > 0 && h('h3', { class: 'section-title' }, '🧭 Khám phá đảo hôm nay'),
      quests.length > 0 &&
        h(
          'ul',
          { class: 'mission-list' },
          quests.map((q) =>
            h(
              'li',
              { class: `mission ${q.done ? 'is-done' : ''}` },
              h('span', { class: 'mission-check', 'aria-hidden': 'true' }, q.done ? '✓' : q.icon),
              h(
                'div',
                { class: 'mission-body' },
                h('div', { class: 'mission-label' }, q.label),
                q.progress &&
                  h(
                    'div',
                    { class: 'mission-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': q.progress.need, 'aria-valuenow': q.progress.value },
                    h('span', { style: { width: `${Math.round((q.done ? 1 : q.progress.value / q.progress.need) * 100)}%` } }),
                  ),
              ),
              h('span', { class: 'mission-count' }, q.done ? '✓' : `+${q.coins} Xu`),
            ),
          ),
        ),
      quests.length > 0 && h('p', { class: 'muted' }, 'Đi tới đúng nơi trên đảo là tự hoàn thành — xem dấu ⭐ trên bản đồ nhỏ.'),
    );
  }

  async function busy(btn, fn) {
    btn.disabled = true;
    try {
      await fn();
    } finally {
      refresh();
    }
  }

  function refresh() {
    if (isSheetOpen() && document.querySelector('.today')) setSheetContent(render());
  }

  openSheet({ title: '📅 Hôm nay', content: render() });
  return { refresh };
}
