import { sfx } from '../audio/sfx.js';
import { backendMode, getActiveEvent, getMyKudos, getState, onProgressChange } from '../game/progress.js';
import { createEventDecor } from '../scene/eventDecor.js';
import { say } from '../ui/feedback.js';
import { openEventSheet } from '../ui/eventView.js';
import { addQuickAction } from '../ui/quickActions.js';

/** Số ngày còn lại tới ngày kết thúc sự kiện (MM-DD), tính từ "hôm nay" YYYY-MM-DD. */
function daysUntil(todayIso, endMd) {
  const today = new Date(`${todayIso}T00:00:00Z`);
  let end = new Date(`${today.getUTCFullYear()}-${endMd}T00:00:00Z`);
  if (end < today) end = new Date(`${today.getUTCFullYear() + 1}-${endMd}T00:00:00Z`);
  return Math.round((end - today) / 864e5);
}

/**
 * Sự kiện theo mùa: trang trí đảo, nút sự kiện bên phải, lời chào của Kỳ lân.
 *
 * @param {{ world: object, island: object, mascot: object, openWardrobe: () => void }} deps
 * @returns {{ update: (delta: number, elapsed: number) => void }}
 */
export function setupEvents({ world, island, mascot, openWardrobe }) {
  const decor = createEventDecor(world.scene, island);
  let greetedFor = null;

  const button = addQuickAction({
    icon: '🌸',
    label: 'Sự kiện',
    order: 5,
    onClick: async () => {
      const event = getActiveEvent();
      if (!event) return;
      let cardsReceived = 0;
      if (backendMode() === 'remote') {
        cardsReceived = (await getMyKudos().catch(() => [])).filter((k) => k.card).length;
      }
      const daysLeft = daysUntil(getState().daily.day, event.end);
      // Đang mở sớm (BGH bật trước lịch) → không đếm ngược sai.
      const early = daysLeft > daysUntil(`${getState().daily.day.slice(0, 4)}-${event.start}`, event.end);
      openEventSheet({
        event,
        daysLeft,
        early,
        cardsReceived,
        onOpenWardrobe: openWardrobe,
      });
    },
  });

  function sync() {
    const event = getActiveEvent();
    decor.setEvent(event?.id ?? null);
    button.setHidden(!event);
    button.setPulse(Boolean(event));
    if (event && greetedFor !== event.id) {
      greetedFor = event.id;
      setTimeout(() => {
        sfx.pop();
        mascot.emote('happy');
        say(`${event.icon} ${event.name} đang diễn ra! Bấm nút ${event.icon} bên phải để xem hoạt động nhé!`);
      }, 4000);
    }
  }
  onProgressChange(sync);
  sync();

  return { update: (delta, elapsed) => decor.update(delta, elapsed) };
}
