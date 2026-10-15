import { sfx } from '../audio/sfx.js';
import { backendMode, friendlyError, getGiftShop, getMyVouchers, getState, redeemGift } from '../game/progress.js';
import { formatNumber } from '../ui/dom.js';
import { confirmDialog, say, showToast } from '../ui/feedback.js';
import { openGiftShop } from '../ui/giftShopView.js';
import { addQuickAction } from '../ui/quickActions.js';

/**
 * Đổi Xu lấy quà hiện vật: nút 🎁 bên phải → cửa hàng → xác nhận → phiếu chờ BGH duyệt.
 *
 * @param {{ mascot: object, fx: object }} deps
 */
export function setupGiftShop({ mascot, fx }) {
  addQuickAction({
    icon: '🎁',
    label: 'Đổi Xu lấy quà thật',
    order: 30,
    onClick: () =>
      openGiftShop({
        online: backendMode() === 'remote',
        getCoins: () => getState().coins,
        load: async () => {
          const [shop, vouchers] = await Promise.all([getGiftShop(), getMyVouchers()]);
          return { shop, vouchers };
        },
        onRedeem: async (gift) => {
          const coins = getState().coins;
          if (coins < gift.cost) {
            showToast(`Cần thêm ${formatNumber(gift.cost - coins)} Xu để đổi "${gift.name}". Cố lên!`, { type: 'warn', icon: '🪙' });
            mascot.emote('think');
            return false;
          }
          const ok = await confirmDialog({
            icon: gift.icon,
            title: `Đổi "${gift.name}"?`,
            message: `Trừ ${formatNumber(gift.cost)} Xu (còn ${formatNumber(coins - gift.cost)}). BGH duyệt xong bạn nhận quà tại trường; không duyệt sẽ được hoàn Xu.`,
            confirmText: 'Đổi quà',
          });
          if (!ok) return false;
          try {
            await redeemGift(gift.id);
          } catch (err) {
            showToast(friendlyError(err), { type: 'warn', icon: '⚠️' });
            return true;
          }
          sfx.gift();
          mascot.emote('cheer');
          fx.ring(mascot.object.position, '#FFD86B');
          say(`Đã gửi phiếu đổi "${gift.name}"! Chờ BGH duyệt nhé 🎟️`);
          return true;
        },
      }),
  });
}
