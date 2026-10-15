import { h, formatNumber } from './dom.js';
import { VOUCHER_STATUS } from './ranksView.js';
import { openSheet } from './sheet.js';

/**
 * Cửa hàng đổi Xu lấy quà hiện vật + danh sách phiếu đổi của tôi.
 *
 * @param {{
 *   online: boolean,
 *   getCoins: () => number,
 *   load: () => Promise<{ shop: object, vouchers: object[] }>,
 *   onRedeem: (gift: object) => Promise<boolean>,
 * }} handlers
 * @returns {{ refresh: () => void }}
 */
export function openGiftShop({ online, getCoins, load, onRedeem }) {
  const body = h('div', { class: 'gift-shop' }, h('p', { class: 'muted' }, 'Đang tải…'));

  async function refresh() {
    if (!online) {
      body.replaceChildren(
        h('p', { class: 'notice' }, '🔒 Đổi quà hiện vật cần đăng nhập bằng email trường (chế độ trực tuyến) để BGH duyệt và trao quà.'),
      );
      return;
    }
    let data;
    try {
      data = await load();
    } catch {
      body.replaceChildren(h('p', { class: 'notice' }, 'Không tải được cửa hàng. Thử lại sau nhé!'));
      return;
    }
    const { shop, vouchers } = data;
    const coins = getCoins();
    const blocked =
      shop.pending >= shop.maxPending
        ? `Bạn đang có ${shop.pending} phiếu chờ duyệt — đợi BGH duyệt rồi đổi tiếp nhé.`
        : shop.thisMonth >= shop.monthlyLimit
          ? `Tháng này bạn đã đổi ${shop.thisMonth}/${shop.monthlyLimit} lần. Hẹn tháng sau!`
          : null;

    body.replaceChildren(
      h(
        'div',
        { class: 'gift-summary' },
        h('span', {}, '🪙 ', h('strong', {}, formatNumber(coins)), ' Xu'),
        h('span', { class: 'muted small' }, `Tháng này: ${shop.thisMonth}/${shop.monthlyLimit} lần · Chờ duyệt: ${shop.pending}/${shop.maxPending}`),
      ),
      blocked ? h('p', { class: 'notice' }, blocked) : '',
      h(
        'div',
        { class: 'item-grid gift-grid' },
        shop.gifts.map((g) => {
          const soldOut = g.stock !== null && g.stock <= 0;
          const poor = coins < g.cost;
          const card = h(
            'button',
            {
              class: `item-card gift-card ${soldOut || poor ? 'is-locked' : ''}`,
              type: 'button',
              disabled: soldOut || Boolean(blocked),
              title: g.description ?? g.name,
            },
            h('span', { class: 'gift-icon', 'aria-hidden': 'true' }, g.icon),
            h('span', { class: 'item-name' }, g.name),
            h('span', { class: 'item-status' }, `🪙 ${formatNumber(g.cost)}`),
            h('span', { class: 'muted small' }, soldOut ? 'Hết quà' : g.stock !== null ? `Còn ${g.stock}` : poor ? `Thiếu ${formatNumber(g.cost - coins)} Xu` : 'Đổi ngay'),
          );
          card.addEventListener('click', async () => {
            if (await onRedeem(g)) refresh();
          });
          return card;
        }),
      ),
      h('h3', { class: 'section-title' }, '🎟️ Phiếu quà của tôi'),
      vouchers.length
        ? h(
            'ul',
            { class: 'voucher-list' },
            vouchers.slice(0, 8).map((v) =>
              h(
                'li',
                { class: 'voucher' },
                h('strong', {}, v.title),
                h('small', {}, [v.reason, v.note].filter(Boolean).join(' · ')),
                h(
                  'span',
                  { class: 'voucher-status', style: { color: VOUCHER_STATUS[v.status]?.color } },
                  VOUCHER_STATUS[v.status]?.label ?? v.status,
                  v.refunded ? ' — đã hoàn Xu' : '',
                ),
              ),
            ),
          )
        : h('p', { class: 'muted' }, 'Chưa có phiếu nào. Tích Xu mỗi ngày rồi đổi quà thật tại trường nhé!'),
      h('p', { class: 'muted small' }, 'Quy trình: Đổi quà → BGH duyệt → nhận quà tại văn phòng. Nếu không được duyệt, Xu được hoàn lại đầy đủ.'),
    );
  }

  openSheet({ title: '🎁 Đổi Xu lấy quà thật', content: body });
  refresh();
  return { refresh };
}
