import { KUDOS, VALUES } from '../config.js';
import { ITEMS, getItem } from '../data/items.js';
import { getPet } from '../data/pets.js';
import { getRankInfo } from '../data/ranks.js';
import { h, formatNumber } from './dom.js';
import { openSheet, setSheetContent, isSheetOpen } from './sheet.js';

const HOUSE = Object.fromEntries(VALUES.map((v) => [v.id, v]));
const ROLE_LABEL = { teacher: 'Giáo viên', bgh: 'Ban Giám hiệu', admin: 'Quản trị' };

/**
 * Thẻ hồ sơ khi chạm vào Kỳ lân của người khác: hạng, Nhà, thành tích, bộ sưu tập trang phục,
 * nút ❤️ Thả tim và 💌 Gửi lời cảm ơn (Nhân Ái).
 *
 * @param {{
 *   load: () => Promise<object>,
 *   fallback?: object  hồ sơ rút gọn hiện ngay trong lúc tải,
 *   onHeart: () => Promise<{ ok: boolean, reason?: string }>,
 *   onThanks: (message: string, cardId?: string | null) => Promise<{ ok: boolean, reason?: string }>,
 *   canKudos: boolean,
 *   event?: { name: string, icon: string, cards: { id: string, icon: string, title: string, colors: string[] }[], cardBonusCoins: number } | null
 *     sự kiện đang diễn ra → gửi kèm thiệp,
 *   onClose?: () => void,
 * }} opts
 */
export function openProfileCard({ load, fallback, onHeart, onThanks, canKudos, event = null, onClose }) {
  openSheet({
    title: '🦄 Hồ sơ Kỳ lân',
    variant: 'side',
    onClose,
    content: fallback ? render(fallback, true) : h('p', { class: 'muted' }, 'Đang tải hồ sơ…'),
  });

  load()
    .then((p) => isSheetOpen() && setSheetContent(render(p, false)))
    .catch(() => isSheetOpen() && !fallback && setSheetContent(h('p', { class: 'notice' }, 'Không tải được hồ sơ.')));

  function render(p, loading) {
    const info = getRankInfo(p.xp ?? 0);
    const house = HOUSE[p.house];
    const equipped = Object.values(p.equipped ?? {})
      .map(getItem)
      .filter((it) => it?.model);
    const owned = p.owned?.length ?? null;

    const heartBtn = h('button', { class: 'btn btn-secondary', type: 'button', disabled: !canKudos || loading || p.heartedToday }, p.heartedToday ? '❤️ Đã thả tim' : '❤️ Thả tim');
    const thanksLabel = event ? `${event.icon} Gửi thiệp tri ân` : '💌 Gửi lời cảm ơn';
    const thanksBtn = h('button', { class: 'btn', type: 'button', disabled: !canKudos || loading || p.thankedToday }, p.thankedToday ? '💌 Đã cảm ơn hôm nay' : thanksLabel);
    const status = h('p', { class: 'muted', 'aria-live': 'polite' });
    const thanksBox = h('div', { class: 'thanks-box', hidden: true });

    heartBtn.addEventListener('click', async () => {
      heartBtn.disabled = true;
      const res = await onHeart().catch(() => ({ ok: false }));
      if (res.ok) heartBtn.textContent = '❤️ Đã thả tim';
      else status.textContent = res.reason === 'limit' ? 'Hôm nay bạn đã thả hết tim rồi.' : 'Bạn đã thả tim cho bạn này hôm nay.';
    });

    thanksBtn.addEventListener('click', () => {
      thanksBox.hidden = false;
      thanksBtn.hidden = true;
      thanksBox.querySelector('textarea').focus();
    });
    const textarea = h('textarea', {
      class: 'input',
      rows: 2,
      maxlength: KUDOS.MESSAGE_MAX,
      placeholder: 'Ví dụ: Cảm ơn bạn đã giúp mình chuẩn bị tiết học hôm nay!',
      'aria-label': 'Lời cảm ơn',
    });
    // Sự kiện: chọn mẫu thiệp (cả hai được thêm Xu).
    let cardId = event?.cards[0]?.id ?? null;
    const bonus = event ? event.cardBonusCoins : 0;
    const cardPicker = event
      ? h(
          'div',
          { class: 'card-picker', role: 'radiogroup', 'aria-label': 'Chọn mẫu thiệp' },
          event.cards.map((c) => {
            const btn = h(
              'button',
              {
                class: 'card-option',
                type: 'button',
                role: 'radio',
                'aria-checked': String(c.id === cardId),
                style: { background: c.colors[0], borderColor: c.colors[1] },
              },
              h('span', { 'aria-hidden': 'true' }, c.icon),
              h('small', {}, c.title),
            );
            btn.addEventListener('click', () => {
              cardId = c.id;
              cardPicker.querySelectorAll('.card-option').forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
            });
            return btn;
          }),
        )
      : '';
    if (event) textarea.placeholder = 'Ví dụ: Cảm ơn cô đã luôn tận tâm với học trò! Chúc cô 20/11 thật vui!';
    const sendBtn = h(
      'button',
      { class: 'btn btn-block', type: 'button' },
      `Gửi (+${KUDOS.THANKS_COINS_SENDER + bonus} Xu cho bạn, +${KUDOS.THANKS_COINS_RECEIVER + bonus} Xu cho người nhận)`,
    );
    sendBtn.addEventListener('click', async () => {
      sendBtn.disabled = true;
      const res = await onThanks(textarea.value, cardId).catch(() => ({ ok: false }));
      if (res.ok) {
        thanksBox.replaceChildren(h('p', { class: 'notice' }, '💌 Đã gửi lời cảm ơn! Nhân Ái là biết nghĩ cho người khác.'));
      } else {
        sendBtn.disabled = false;
        status.textContent =
          res.reason === 'limit' ? `Mỗi ngày gửi tối đa ${KUDOS.THANKS_PER_DAY} lời cảm ơn.` : res.reason === 'already' ? 'Hôm nay bạn đã cảm ơn bạn này rồi.' : 'Không gửi được, thử lại nhé.';
      }
    });
    thanksBox.append(cardPicker, textarea, sendBtn);

    return h(
      'div',
      { class: 'profile-card' },
      h(
        'div',
        { class: 'profile-head', style: { borderColor: info.rank.color } },
        h('span', { class: 'rank-icon big', 'aria-hidden': 'true' }, info.rank.icon),
        h(
          'div',
          {},
          h('h3', { class: 'profile-name' }, p.displayName ?? 'Kỳ lân'),
          h('div', { class: 'muted' }, [p.unit, ROLE_LABEL[p.role]].filter(Boolean).join(' · ')),
          h('div', { class: 'profile-rank', style: { color: info.rank.color } }, `${info.label} · ${formatNumber(p.xp ?? 0)} XP`),
        ),
      ),
      house
        ? h('div', { class: 'profile-house' }, h('span', { class: 'house-dot', style: { background: house.color } }), `Nhà ${house.name} — “${house.motto}”`)
        : '',
      h(
        'div',
        { class: 'stats' },
        statBox(`${p.streak ?? 0} 🔥`, 'Chuỗi ngày'),
        statBox(p.accuracy != null ? `${p.accuracy}%` : '—', 'Trả lời đúng'),
        statBox(p.stationsToday != null ? `${p.stationsToday}/5` : '—', 'Vùng Đất hôm nay'),
      ),
      h(
        'div',
        { class: 'stats' },
        statBox(p.distance != null ? `${formatNumber(p.distance)} m` : '—', 'Đã chạy'),
        statBox(p.heartsReceived != null ? `❤️ ${formatNumber(p.heartsReceived)}` : '—', 'Tim nhận'),
        statBox(p.thanksReceived != null ? `💌 ${formatNumber(p.thanksReceived)}` : '—', 'Lời cảm ơn'),
      ),
      h('h4', { class: 'section-title' }, `👕 Đang mặc${owned != null ? ` · bộ sưu tập ${owned}/${ITEMS.length}` : ''}`),
      equipped.length
        ? h('div', { class: 'chip-row' }, equipped.map((it) => h('span', { class: 'chip' }, it.icon ?? '•', ' ', it.name)))
        : h('p', { class: 'muted' }, 'Trang phục cơ bản'),
      getPet(p.pet)
        ? h('p', { class: 'muted' }, `🐾 Thú cưng: ${getPet(p.pet).emoji} ${getPet(p.pet).name}${p.petCount ? ` · bộ sưu tập ${p.petCount} bạn` : ''}`)
        : '',
      p.recentThanks?.length
        ? h(
            'div',
            {},
            h('h4', { class: 'section-title' }, '💬 Lời cảm ơn gần đây'),
            h('ul', { class: 'kudos-list' }, p.recentThanks.map((k) => h('li', {}, h('strong', {}, k.from), `: “${k.message}”`))),
          )
        : '',
      canKudos ? h('div', { class: 'dialog-actions' }, heartBtn, thanksBtn) : h('p', { class: 'notice' }, '🔒 Đăng nhập để thả tim và gửi lời cảm ơn.'),
      thanksBox,
      status,
    );
  }
}

function statBox(value, label) {
  return h('div', { class: 'stat' }, h('span', { class: 'stat-value' }, value), h('span', { class: 'stat-label' }, label));
}
