import { sfx } from '../audio/sfx.js';
import {
  backendMode,
  friendlyError,
  getActiveEvent,
  getMyKudos,
  getProfile,
  getPublicProfile,
  getPublicProfiles,
  getState,
  sendKudos,
} from '../game/progress.js';
import { milestoneBadge } from '../game/milestones.js';
import { createMultiplayer } from '../net/multiplayer.js';
import { createNameTag } from '../scene/nameTag.js';
import { createStickerBubble } from '../scene/stickerBubble.js';
import { getSticker } from '../data/stickers.js';
import { getEvent } from '../data/events.js';
import { showCard } from '../ui/cardView.js';
import { createRemotePlayers } from '../scene/remotePlayers.js';
import { say, showToast } from '../ui/feedback.js';
import { onOnlineClick, renderOnline } from '../ui/hud.js';
import { openPeople } from '../ui/peopleView.js';
import { closeSheet } from '../ui/sheet.js';
import { openProfileCard } from '../ui/profileCard.js';

/**
 * Nhiều người chơi trên cùng đảo: bảng tên của mình và người khác, Kỳ lân người khác (trang phục,
 * hạng, cảm xúc), thẻ hồ sơ khi chạm vào, thả tim / gửi lời cảm ơn.
 *
 * @param {{ world: object, island: object, mascot: object, supabase: object | null, userId: string,
 *   isMoving: () => boolean, onGoTo?: (x: number, z: number) => void }} deps
 * @returns {{ update: (delta: number, elapsed: number) => void, notifyProfileChanged: () => void,
 *   sendSticker: (stickerId: string) => void, nameTagSprites: () => import('three').Sprite[] }}
 */
export function setupSocial({ world, island, mascot, supabase, userId, isMoving, onGoTo }) {
  // ── Bảng tên của mình ───────────────────────────────────────────────
  let currentRoom = '';
  const myTag = createNameTag();
  mascot.object.add(myTag.sprite);
  const mySticker = createStickerBubble(mascot.object);
  const myBadge = () => milestoneBadge(Number(getState().stats.distance) || 0);
  const badgeText = (b) => (b ? `${b.icon} ${b.label}` : '');
  const refreshMyTag = () => {
    const p = getProfile();
    myTag.set({ name: p.fullName || p.displayName, unit: p.unit, xp: getState().xp, house: p.house, badge: myBadge(), isMe: true });
  };
  refreshMyTag();

  // ── Người chơi khác ─────────────────────────────────────────────────
  const remote = createRemotePlayers({
    scene: world.scene,
    island,
    onTap: world.onTap,
    onSelect: (id) => openPeer(id),
  });

  function localProfile() {
    const p = getProfile();
    const s = getState();
    return { displayName: p.displayName, fullName: p.fullName ?? null, unit: p.unit, house: p.house, role: p.role, xp: s.xp, equipped: s.equipped, streak: s.streak.count, pet: s.pets?.active ?? null, distance: Math.floor(Number(s.stats.distance) || 0) };
  }

  const mp = createMultiplayer({
    myId: userId,
    supabase,
    getLocalProfile: localProfile,
    fetchProfiles: getPublicProfiles,
    onPeerUpdate: (profile) => remote.updateProfile(profile),
    onPeerLeave: (id) => remote.remove(id),
    onMotion: (id, m) => remote.setMotion(id, m),
    onEmote: (id, name) => remote.playEmote(id, name),
    onSticker: (id, stickerId) => {
      const sticker = getSticker(stickerId);
      if (sticker) remote.playSticker(id, sticker.emoji);
    },
    onKudos: ({ from, fromName, kind }) => {
      sfx.gift();
      mascot.emote(kind === 'thanks' ? 'cheer' : 'happy');
      say(kind === 'thanks' ? `${fromName ?? 'Một người bạn'} vừa gửi lời cảm ơn bạn! 💌` : `${fromName ?? 'Một người bạn'} thả tim cho bạn! ❤️`);
      if (kind === 'thanks') openReceivedCard(from);
    },
    onRoomChange: ({ room, count }) => {
      currentRoom = room;
      renderOnline(count, room);
    },
  });
  mp.start().catch((err) => console.warn('[social] Không vào được đảo nhiều người:', err));

  // Quay lại tab: báo vị trí ngay (trình duyệt làm chậm nhịp tim khi tab bị ẩn).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') mp.pingNow();
  });

  // Bấm 👥: danh sách người cùng đảo + chạy tới chỗ bạn.
  onOnlineClick(() => {
    const me = mascot.object.position;
    openPeople({
      room: !currentRoom || currentRoom === 'island-local' ? 'đảo' : currentRoom.replace('island-', 'Đảo '),
      people: remote.list().map((p) => ({
        id: p.id,
        name: p.profile?.displayName,
        unit: p.profile?.unit,
        xp: p.profile?.xp ?? 0,
        house: p.profile?.house,
        badge: badgeText(milestoneBadge(Number(p.profile?.distance) || 0)),
        distance: Math.hypot(p.position.x - me.x, p.position.z - me.z),
      })),
      onGo: (id) => {
        const p = remote.get(id);
        if (!p) return;
        closeSheet();
        onGoTo?.(p.root.position.x, p.root.position.z);
        say(`Tới chỗ ${p.profile?.displayName ?? 'bạn'} rồi! Chạm vào bạn ấy để thả tim nhé ❤️`);
      },
      onView: (id) => openPeer(id),
    });
  });

  // Cảm xúc của mình → người khác thấy.
  mascot.onEmote((name) => mp.sendEmote(name));

  let lastXp = getState().xp;
  /** Gọi khi đổi trang phục / lên hạng / đổi tên để cập nhật bảng tên & báo người khác. */
  function notifyProfileChanged() {
    refreshMyTag();
    mp.notifyProfileChanged();
  }

  /** Thiệp sự kiện: lấy nội dung từ MÁY CHỦ (không tin tin nhắn người khác gửi) rồi mở thiệp. */
  async function openReceivedCard(fromId) {
    if (backendMode() !== 'remote') return;
    const list = await getMyKudos().catch(() => []);
    const k = list.find((x) => x.fromId === fromId && x.kind === 'thanks');
    if (!k?.card) return;
    const event = getEvent(getState().event);
    const card = event?.cards.find((c) => c.id === k.card);
    if (card) showCard({ card, fromName: k.from, message: k.message, eventName: event.name });
  }

  /** Hiện sticker trên đầu Kỳ lân của mình và gửi cho mọi người cùng đảo. */
  function sendSticker(stickerId) {
    const sticker = getSticker(stickerId);
    if (!sticker) return;
    mySticker.show(sticker.emoji);
    mp.sendSticker(stickerId);
  }

  function openPeer(id) {
    const peer = remote.get(id);
    const online = backendMode() === 'remote';
    openProfileCard({
      fallback: peer?.profile ? { ...peer.profile } : undefined,
      load: () => (online ? getPublicProfile(id) : Promise.resolve(peer?.profile ?? {})),
      canKudos: online,
      onHeart: async () => {
        const res = await sendKudos(id, 'heart').catch((err) => {
          showToast(friendlyError(err), { type: 'warn' });
          return { ok: false };
        });
        if (res.ok) {
          sfx.pop();
          mascot.emote('happy');
          mp.sendKudos(id, 'heart');
        }
        return res;
      },
      event: getActiveEvent(),
      onThanks: async (message, cardId) => {
        const res = await sendKudos(id, 'thanks', message, cardId).catch((err) => {
          showToast(friendlyError(err), { type: 'warn' });
          return { ok: false };
        });
        if (res.ok) {
          sfx.cheer();
          mascot.emote('cheer');
          mp.sendKudos(id, 'thanks');
          showToast(`${res.card ? 'Đã gửi thiệp tri ân' : 'Đã gửi lời cảm ơn'}! +${res.reward?.coins ?? 0} Xu`, { type: 'success', icon: res.card ? '🌸' : '💌' });
        }
        return res;
      },
    });
  }

  function update(delta, elapsed) {
    const pos = mascot.object.position;
    mp.sendMotion(
      { x: round2(pos.x), z: round2(pos.z), ry: round2(mascot.object.rotation.y), s: isMoving() ? 1 : 0 },
      isMoving(),
    );
    remote.update(delta, elapsed, world.controls.target);
    myTag.update(elapsed);
    mySticker.update(delta);
    const xp = getState().xp;
    if (xp !== lastXp) {
      // XP đổi → bảng tên đổi hạng; báo người khác khi qua mốc hạng (đỡ tốn băng thông).
      lastXp = xp;
      refreshMyTag();
    }
  }

  if (import.meta.env.DEV) window.__kltSocial = { remote, mp };
  return { update, notifyProfileChanged, sendSticker, nameTagSprites: () => [myTag.sprite, ...remote.tagSprites()] };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
