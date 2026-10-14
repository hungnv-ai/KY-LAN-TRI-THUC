import { VALUES } from '../config.js';
import { RANKS, getRankInfo } from '../data/ranks.js';
import { h, formatNumber } from './dom.js';
import { openSheet } from './sheet.js';

const HOUSE = Object.fromEntries(VALUES.map((v) => [v.id, v]));
const MEDALS = ['🥇', '🥈', '🥉'];
const VOUCHER_STATUS = {
  pending: { label: 'Chờ BGH duyệt', color: '#8F7562' },
  approved: { label: 'Đã duyệt — chờ nhận quà', color: '#1750B5' },
  redeemed: { label: 'Đã nhận quà', color: '#00796f' },
  rejected: { label: 'Không được duyệt', color: '#b4002f' },
};

/**
 * Bảng "Hạng" với 4 thẻ: Hành trình (7 hạng) · Bảng xếp hạng · 5 Nhà · Của tôi (phiếu quà, lời cảm ơn).
 *
 * @param {{
 *   xp: number, streak: number, stats: object, profile: object, online: boolean,
 *   loadLeaderboard: (scope: string, unit: string | null) => Promise<object>,
 *   loadHouses: () => Promise<object>,
 *   loadMine: () => Promise<{ vouchers: object[], kudos: object[] }>,
 *   initialTab?: 'journey' | 'board' | 'houses' | 'mine',
 * }} data
 */
export function openRanks(data) {
  const tabs = [
    { id: 'journey', label: '🗺️ Hành trình', render: renderJourney },
    { id: 'board', label: '🏆 Xếp hạng', render: renderBoard },
    { id: 'houses', label: '🏠 5 Nhà', render: renderHouses },
    { id: 'mine', label: '🎟️ Của tôi', render: renderMine },
  ];
  let active = data.initialTab ?? 'journey';
  const panel = h('div', { role: 'tabpanel' });
  const tabBar = h(
    'div',
    { class: 'tabs', role: 'tablist' },
    tabs.map((t) =>
      h('button', { class: 'tab', type: 'button', role: 'tab', 'data-tab': t.id, onclick: () => select(t.id) }, t.label),
    ),
  );

  function select(id) {
    active = id;
    tabBar.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    panel.replaceChildren(tabs.find((t) => t.id === id).render());
  }

  // ── Hành trình ──────────────────────────────────────────────────────
  function renderJourney() {
    const { xp, streak, stats } = data;
    const info = getRankInfo(xp);
    const accuracy = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : 0;
    return h(
      'div',
      {},
      h('div', { class: 'stats' }, stat(formatNumber(xp), 'Tổng XP'), stat(`${streak} 🔥`, 'Chuỗi ngày'), stat(`${accuracy}%`, 'Trả lời đúng')),
      h(
        'ol',
        { class: 'rank-list' },
        RANKS.map((rank, i) => {
          const state = i < info.index ? 'past' : i === info.index ? 'current' : 'future';
          const row = h(
            'li',
            { class: `rank-row is-${state}` },
            h('span', { class: 'rank-icon', 'aria-hidden': 'true' }, rank.icon),
            h(
              'span',
              {},
              h('span', { class: 'rank-row-name', style: { color: rank.color } }, rank.name),
              h('br'),
              h('span', { class: 'rank-row-meta' }, `${formatNumber(rank.xp)} XP · 🎁 ${rank.reward}`),
            ),
            h('span', { class: 'rank-row-badge' }, state === 'current' ? `Bạn ở đây${info.tier ? ` · ${info.tier}` : ''}` : state === 'past' ? '✓ Đã đạt' : ''),
          );
          row.style.setProperty('--row-color', rank.color);
          return row;
        }),
      ),
      h('p', { class: 'muted', style: { marginTop: '12px' } }, 'Từ hạng Đồng trở lên, mỗi hạng có 3 bậc III → II → I.'),
    );
  }

  // ── Bảng xếp hạng ───────────────────────────────────────────────────
  let boardScope = 'week';
  let boardUnitOnly = false;
  function renderBoard() {
    const wrap = h('div', {});
    const scopes = [
      { id: 'week', label: 'Tuần này' },
      { id: 'month', label: 'Tháng này' },
      { id: 'all', label: 'Tất cả' },
    ];
    const controls = h(
      'div',
      { class: 'board-controls' },
      h(
        'div',
        { class: 'segmented', role: 'group', 'aria-label': 'Khoảng thời gian' },
        scopes.map((s) =>
          h('button', { type: 'button', 'aria-pressed': String(s.id === boardScope), onclick: () => { boardScope = s.id; select('board'); } }, s.label),
        ),
      ),
      data.profile.unit
        ? h(
            'label',
            { class: 'check' },
            h('input', { type: 'checkbox', checked: boardUnitOnly, onchange: (e) => { boardUnitOnly = e.target.checked; select('board'); } }),
            ` Chỉ ${data.profile.unit}`,
          )
        : '',
    );
    const list = h('div', { class: 'board-list' }, h('p', { class: 'muted' }, 'Đang tải bảng xếp hạng…'));
    wrap.append(controls, list);

    data
      .loadLeaderboard(boardScope, boardUnitOnly ? data.profile.unit : null)
      .then((res) => {
        const rows = res.rows ?? [];
        list.replaceChildren(
          res.offline ? h('p', { class: 'notice' }, '🔒 Đăng nhập để thi đua cùng cả trường. Hiện chỉ có điểm của bạn.') : '',
          rows.length === 0
            ? h('p', { class: 'muted' }, 'Chưa có ai ghi điểm trong kỳ này — hãy là người đầu tiên!')
            : h(
                'ol',
                { class: 'board' },
                rows.map((r) => boardRow(r, boardScope === 'all' ? 'XP' : 'XP kỳ này')),
              ),
          res.me && !rows.some((r) => r.me)
            ? h('div', { class: 'board-me' }, `Bạn đang ở hạng #${res.me.pos} · ${formatNumber(res.me.score)} XP`)
            : '',
        );
      })
      .catch(() => list.replaceChildren(h('p', { class: 'notice' }, 'Không tải được bảng xếp hạng. Thử lại sau nhé.')));
    return wrap;
  }

  function boardRow(r, unitLabel) {
    const house = HOUSE[r.house];
    return h(
      'li',
      { class: `board-row ${r.me ? 'is-me' : ''}` },
      h('span', { class: 'board-pos' }, MEDALS[r.pos - 1] ?? `#${r.pos}`),
      h('span', { class: 'house-dot', style: { background: house?.color ?? '#ccc' }, title: house ? `Nhà ${house.name}` : '' }),
      h(
        'span',
        { class: 'board-name' },
        h('strong', {}, r.me ? `${r.name ?? 'Bạn'} (bạn)` : r.name ?? '—'),
        h('small', {}, `${r.unit ?? ''} · ${getRankInfo(r.xp).label}`),
      ),
      h('span', { class: 'board-score' }, formatNumber(r.score), h('small', {}, unitLabel)),
    );
  }

  // ── 5 Nhà ───────────────────────────────────────────────────────────
  function renderHouses() {
    const wrap = h('div', {}, h('p', { class: 'muted' }, 'Đang tải điểm 5 Nhà…'));
    data
      .loadHouses()
      .then((res) => {
        const max = Math.max(1, ...res.standings.map((s) => s.points));
        const mine = HOUSE[res.myHouse];
        wrap.replaceChildren(
          mine
            ? h(
                'div',
                { class: 'house-card', style: { borderColor: mine.color } },
                h('span', { class: 'house-badge', style: { background: mine.color } }, mine.name[0]),
                h('div', {}, h('strong', {}, `Bạn thuộc Nhà ${mine.name}`), h('div', { class: 'muted' }, `“${mine.motto}”`)),
              )
            : '',
          res.offline ? h('p', { class: 'notice' }, '🔒 Đăng nhập để cùng Nhà thi đua giành Cúp Kỳ Lân hằng tháng.') : '',
          h('h3', { class: 'section-title' }, 'Cúp Kỳ Lân tháng này'),
          h(
            'ol',
            { class: 'house-standings' },
            res.standings.map((s, i) => {
              const house = HOUSE[s.house];
              return h(
                'li',
                { class: `house-row ${s.house === res.myHouse ? 'is-mine' : ''}` },
                h('span', { class: 'board-pos' }, MEDALS[i] ?? `#${i + 1}`),
                h(
                  'div',
                  { class: 'house-info' },
                  h('div', { class: 'house-name' }, `Nhà ${house.name}`, h('small', {}, ` · ${formatNumber(s.members)} thành viên`)),
                  h('div', { class: 'house-bar' }, h('span', { style: { width: `${Math.round((s.points / max) * 100)}%`, background: house.color } })),
                ),
                h('span', { class: 'board-score' }, formatNumber(s.points), h('small', {}, 'điểm')),
              );
            }),
          ),
          h('p', { class: 'muted' }, 'Điểm Nhà = tổng XP các thành viên kiếm được trong tháng. Cuối tháng, Nhà dẫn đầu giành Cúp Kỳ Lân 🏆.'),
          res.cups?.length
            ? h(
                'div',
                {},
                h('h3', { class: 'section-title' }, 'Các tháng trước'),
                h(
                  'ul',
                  { class: 'cup-list' },
                  res.cups.map((c) =>
                    h('li', {}, `🏆 Tháng ${new Date(c.month).getMonth() + 1}/${new Date(c.month).getFullYear()}: Nhà ${HOUSE[c.house]?.name ?? c.house} (${formatNumber(c.points)} điểm)`),
                  ),
                ),
              )
            : '',
        );
      })
      .catch(() => wrap.replaceChildren(h('p', { class: 'notice' }, 'Không tải được điểm Nhà. Thử lại sau nhé.')));
    return wrap;
  }

  // ── Của tôi ─────────────────────────────────────────────────────────
  function renderMine() {
    const wrap = h('div', {}, h('p', { class: 'muted' }, 'Đang tải…'));
    if (!data.online) {
      wrap.replaceChildren(h('p', { class: 'notice' }, '🔒 Phiếu quà hiện vật và lời cảm ơn từ đồng nghiệp/bạn bè cần đăng nhập.'));
      return wrap;
    }
    data
      .loadMine()
      .then(({ vouchers, kudos }) => {
        wrap.replaceChildren(
          h('h3', { class: 'section-title' }, '🎟️ Phiếu quà hiện vật'),
          vouchers.length
            ? h(
                'ul',
                { class: 'voucher-list' },
                vouchers.map((v) =>
                  h(
                    'li',
                    { class: 'voucher' },
                    h('strong', {}, v.title),
                    h('small', {}, v.reason ?? ''),
                    h('span', { class: 'voucher-status', style: { color: VOUCHER_STATUS[v.status]?.color } }, VOUCHER_STATUS[v.status]?.label ?? v.status),
                  ),
                ),
              )
            : h('p', { class: 'muted' }, 'Chưa có phiếu quà. Top bảng xếp hạng và hộp quà may mắn có thể mang lại phiếu quà đó!'),
          h('h3', { class: 'section-title' }, '💌 Lời cảm ơn bạn nhận được'),
          kudos.filter((k) => k.kind === 'thanks').length
            ? h(
                'ul',
                { class: 'kudos-list' },
                kudos
                  .filter((k) => k.kind === 'thanks')
                  .map((k) => h('li', {}, h('strong', {}, k.from), k.message ? `: “${k.message}”` : ' đã gửi lời cảm ơn')),
              )
            : h('p', { class: 'muted' }, 'Chưa có lời cảm ơn nào. Hãy là người gửi trước nhé — Nhân Ái là biết nghĩ cho người khác!'),
          h('p', { class: 'muted' }, `❤️ ${formatNumber(data.stats.heartsReceived ?? 0)} tim · 💌 ${formatNumber(data.stats.thanksReceived ?? 0)} lời cảm ơn đã nhận`),
        );
      })
      .catch(() => wrap.replaceChildren(h('p', { class: 'notice' }, 'Không tải được. Thử lại sau nhé.')));
    return wrap;
  }

  openSheet({ title: '🏆 Hạng & Thi đua', content: h('div', {}, tabBar, panel) });
  select(active);
}

function stat(value, label) {
  return h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, value), h('span', { class: 'stat-label' }, label));
}
