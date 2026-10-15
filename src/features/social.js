import { sfx } from '../audio/sfx.js';
import {
  backendMode,
  friendlyError,
  getProfile,
  getPublicProfile,
  getPublicProfiles,
  getState,
  sendKudos,
} from '../game/progress.js';
import { createMultiplayer } from '../net/multiplayer.js';
import { createNameTag } from '../scene/nameTag.js';
import { createStickerBubble } from '../scene/stickerBubble.js';
import { getSticker } from '../data/stickers.js';
import { createRemotePlayers } from '../scene/remotePlayers.js';
import { say, showToast } from '../ui/feedback.js';
import { renderOnline } from '../ui/hud.js';
import { openProfileCard } from '../ui/profileCard.js';

/**
 * Nhiều người chơi trên cùng đảo: bảng tên của mình và người khác, Kỳ lân người khác (trang phục,
 * hạng, cảm xúc), thẻ hồ sơ khi chạm vào, thả tim / gửi lời cảm ơn.
 *
 * @param {{ world: object, island: object, mascot: object, supabase: object | null, userId: string,
 *   isMoving: () => boolean }} deps
 * @returns {{ update: (delta: number, elapsed: number) => void, notifyProfileChanged: () => void,
 *   sendSticker: (stickerId: string) => void }}
 */
export function setupSocial({ world, island, mascot, supabase, userId, isMoving }) {
  // ── Bảng tên của mình ───────────────────────────────────────────────
  const myTag = createNameTag();
  mascot.object.add(myTag.sprite);
  const mySticker = createStickerBubble(mascot.object);
  const refreshMyTag = () => {
    const p = getProfile();
    myTag.set({ name: p.displayName, unit: p.unit, xp: getState().xp, house: p.house, isMe: true });
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
    return { displayName: p.displayName, unit: p.unit, house: p.house, role: p.role, xp: s.xp, equipped: s.equipped, streak: s.streak.count };
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
    onKudos: ({ fromName, kind }) => {
      sfx.gift();
      mascot.emote(kind === 'thanks' ? 'cheer' : 'happy');
      say(kind === 'thanks' ? `${fromName ?? 'Một người bạn'} vừa gửi lời cảm ơn bạn! 💌` : `${fromName ?? 'Một người bạn'} thả tim cho bạn! ❤️`);
    },
    onRoomChange: ({ room, count }) => renderOnline(count, room),
  });
  mp.start().catch((err) => console.warn('[social] Không vào được đảo nhiều người:', err));

  // Cảm xúc của mình → người khác thấy.
  mascot.onEmote((name) => mp.sendEmote(name));

  let lastXp = getState().xp;
  /** Gọi khi đổi trang phục / lên hạng / đổi tên để cập nhật bảng tên & báo người khác. */
  function notifyProfileChanged() {
    refreshMyTag();
    mp.notifyProfileChanged();
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
      onThanks: async (message) => {
        const res = await sendKudos(id, 'thanks', message).catch((err) => {
          showToast(friendlyError(err), { type: 'warn' });
          return { ok: false };
        });
        if (res.ok) {
          sfx.cheer();
          mascot.emote('cheer');
          mp.sendKudos(id, 'thanks');
          showToast(`Đã gửi lời cảm ơn! +${res.reward?.coins ?? 0} Xu`, { type: 'success', icon: '💌' });
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
    remote.update(delta, elapsed, world.camera);
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
  return { update, notifyProfileChanged, sendSticker };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
