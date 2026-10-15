import { MULTIPLAYER } from '../config.js';

/**
 * Nhiều người chơi trên cùng một đảo (thời gian thực).
 *
 * - Trực tuyến: kênh Supabase Realtime riêng tư "island-<số>" (Presence + Broadcast).
 *   Mỗi đảo tối đa MAX_PER_ROOM người; đầy thì tự sang đảo kế tiếp.
 *   Thông tin bảng tên (tên, hạng, trang phục) lấy từ MÁY CHỦ (public_profiles), không tin dữ liệu
 *   người khác gửi lên → không ai giả mạo được hạng.
 * - Ngoại tuyến / thử nghiệm: BroadcastChannel — các tab cùng trình duyệt thấy nhau.
 *
 * Module chỉ lo truyền tin; vẽ Kỳ lân người khác do scene/remotePlayers.js đảm nhiệm.
 */

const MAX_ROOMS = 50;

/**
 * @param {{
 *   myId: string,
 *   supabase?: import('@supabase/supabase-js').SupabaseClient | null,
 *   getLocalProfile: () => object  hồ sơ của mình (dùng cho chế độ BroadcastChannel),
 *   fetchProfiles: (ids: string[]) => Promise<object[]>  lấy hồ sơ công khai từ máy chủ,
 *   onPeerUpdate: (peer: object) => void,
 *   onPeerLeave: (id: string) => void,
 *   onMotion: (id: string, motion: { x: number, z: number, ry: number, s: number }) => void,
 *   onEmote: (id: string, name: string) => void,
 *   onKudos?: (msg: { from: string, fromName: string, kind: string }) => void,
 *   onRoomChange?: (info: { room: string, count: number }) => void,
 * }} opts
 * @returns {{ start: () => Promise<void>, sendMotion: (m: object, moving: boolean) => void, sendEmote: (name: string) => void,
 *   notifyProfileChanged: () => void, sendKudos: (to: string, kind: string) => void, stop: () => void,
 *   peerCount: () => number }}
 */
export function createMultiplayer(opts) {
  const transport = opts.supabase ? createSupabaseTransport(opts) : createLocalTransport(opts);
  const peers = new Map(); // id → { id, lastSeen, profile }
  let lastSend = 0;
  let lastMotion = null;
  let timeoutTimer = 0;

  // Cùng tài khoản mở ở tab/máy khác cũng gửi tin với id của mình → bỏ qua, không vẽ "bản sao".
  const isMe = (id) => !id || id === opts.myId;

  const handlers = {
    join(id) {
      if (isMe(id)) return;
      ensurePeer(id);
    },
    leave(id) {
      if (!peers.delete(id)) return;
      opts.onPeerLeave(id);
      emitRoom();
    },
    profile(id, profile) {
      // Chỉ dùng ở chế độ BroadcastChannel (ngoại tuyến).
      if (isMe(id)) return;
      const peer = ensurePeer(id);
      peer.profile = profile;
      opts.onPeerUpdate({ id, ...profile });
    },
    motion(id, motion) {
      if (isMe(id)) return;
      const peer = ensurePeer(id);
      peer.lastSeen = performance.now();
      opts.onMotion(id, motion);
    },
    emote(id, name) {
      if (isMe(id)) return;
      ensurePeer(id).lastSeen = performance.now();
      opts.onEmote(id, name);
    },
    profileChanged(id) {
      if (isMe(id) || !peers.has(id)) return;
      refreshProfiles([id]);
    },
    kudos(msg) {
      if (msg.to === opts.myId) opts.onKudos?.(msg);
    },
  };

  function ensurePeer(id) {
    if (!peers.has(id)) {
      peers.set(id, { id, lastSeen: performance.now(), profile: null });
      refreshProfiles([id]);
      emitRoom();
      greet();
    }
    return peers.get(id);
  }

  /** Có người mới: gửi ngay vị trí của mình để họ thấy mình liền (không đợi nhịp tim). */
  function greet() {
    if (lastMotion) transport.send('motion', { id: opts.myId, ...lastMotion });
  }

  function emitRoom() {
    opts.onRoomChange?.({ room: transport.room(), count: peers.size + 1 });
  }

  let pending = new Set();
  let fetchTimer = 0;
  /** Gom nhiều yêu cầu lấy hồ sơ thành một lần gọi máy chủ. */
  function refreshProfiles(ids) {
    if (!opts.supabase) return; // chế độ BroadcastChannel: hồ sơ đi kèm tin nhắn
    ids.forEach((id) => pending.add(id));
    clearTimeout(fetchTimer);
    fetchTimer = setTimeout(async () => {
      const list = [...pending];
      pending = new Set();
      try {
        const profiles = await opts.fetchProfiles(list);
        for (const p of profiles) {
          const peer = peers.get(p.id);
          if (!peer) continue;
          peer.profile = p;
          opts.onPeerUpdate(p);
        }
      } catch {
        /* thử lại khi có tin tiếp theo */
      }
    }, 150);
  }

  return {
    async start() {
      await transport.connect(handlers);
      emitRoom();
      // Người im lặng quá lâu (mất mạng, đóng máy) → coi như rời đảo.
      timeoutTimer = setInterval(() => {
        const now = performance.now();
        for (const [id, peer] of peers) {
          if (now - peer.lastSeen > MULTIPLAYER.TIMEOUT_SEC * 1000) handlers.leave(id);
        }
        if (lastMotion) transport.send('motion', { id: opts.myId, ...lastMotion }); // nhịp tim
      }, MULTIPLAYER.HEARTBEAT_SEC * 1000);
    },
    /** Gửi vị trí: tối đa SEND_RATE_HZ lần/giây khi di chuyển. */
    sendMotion(motion, moving) {
      const now = performance.now();
      lastMotion = motion;
      if (!moving && motion.s === 0 && lastSend && now - lastSend < MULTIPLAYER.HEARTBEAT_SEC * 1000) {
        if (this._wasMoving) {
          // Gửi một lần lúc vừa dừng để người khác thấy dừng đúng chỗ.
          transport.send('motion', { id: opts.myId, ...motion });
          this._wasMoving = false;
        }
        return;
      }
      if (now - lastSend < 1000 / MULTIPLAYER.SEND_RATE_HZ) return;
      lastSend = now;
      this._wasMoving = moving;
      transport.send('motion', { id: opts.myId, ...motion });
    },
    sendEmote(name) {
      transport.send('emote', { id: opts.myId, name });
    },
    /** Báo người khác tải lại hồ sơ của mình (vừa đổi đồ, lên hạng…). */
    notifyProfileChanged() {
      if (opts.supabase) transport.send('profileChanged', { id: opts.myId });
      else transport.send('profile', { id: opts.myId, profile: opts.getLocalProfile() });
    },
    sendKudos(to, kind) {
      transport.send('kudos', { to, from: opts.myId, fromName: opts.getLocalProfile().displayName, kind });
    },
    stop() {
      clearInterval(timeoutTimer);
      transport.disconnect();
    },
    peerCount: () => peers.size,
  };
}

// ── Truyền tin qua Supabase Realtime ──────────────────────────────────────
function createSupabaseTransport({ supabase, myId }) {
  let channel = null;
  let roomName = '';

  async function tryRoom(n, handlers) {
    const name = `island-${n}`;
    const ch = supabase.channel(name, {
      config: { private: true, presence: { key: myId }, broadcast: { self: false } },
    });
    const synced = new Promise((resolve) => ch.on('presence', { event: 'sync' }, () => resolve()));
    ch.on('presence', { event: 'join' }, ({ key }) => handlers.join(key));
    ch.on('presence', { event: 'leave' }, ({ key }) => handlers.leave(key));
    ch.on('broadcast', { event: 'motion' }, ({ payload }) => handlers.motion(payload.id, payload));
    ch.on('broadcast', { event: 'emote' }, ({ payload }) => handlers.emote(payload.id, payload.name));
    ch.on('broadcast', { event: 'profileChanged' }, ({ payload }) => handlers.profileChanged(payload.id));
    ch.on('broadcast', { event: 'kudos' }, ({ payload }) => handlers.kudos(payload));

    await new Promise((resolve, reject) => {
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(status));
      });
    });
    await Promise.race([synced, new Promise((r) => setTimeout(r, 1500))]);
    const others = Object.keys(ch.presenceState()).filter((k) => k !== myId);
    if (others.length >= MULTIPLAYER.MAX_PER_ROOM) {
      await supabase.removeChannel(ch);
      return null;
    }
    await ch.track({ joinedAt: Date.now() });
    others.forEach((id) => handlers.join(id));
    roomName = name;
    return ch;
  }

  return {
    async connect(handlers) {
      for (let n = 1; n <= MAX_ROOMS && !channel; n++) {
        channel = await tryRoom(n, handlers);
      }
    },
    send(event, payload) {
      channel?.send({ type: 'broadcast', event, payload });
    },
    disconnect() {
      if (channel) supabase.removeChannel(channel);
      channel = null;
    },
    room: () => roomName,
  };
}

// ── Truyền tin giữa các tab cùng trình duyệt (ngoại tuyến / thử nghiệm) ───
function createLocalTransport({ myId, getLocalProfile }) {
  let bc = null;
  return {
    async connect(handlers) {
      if (typeof BroadcastChannel === 'undefined') return;
      bc = new BroadcastChannel('klt-island');
      bc.onmessage = ({ data }) => {
        const { event, payload } = data;
        if (!payload || payload.id === myId) return;
        if (event === 'hello') {
          handlers.profile(payload.id, payload.profile);
          bc.postMessage({ event: 'profile', payload: { id: myId, profile: getLocalProfile() } });
        } else if (event === 'profile') {
          handlers.profile(payload.id, payload.profile);
        } else if (event === 'bye') {
          handlers.leave(payload.id);
        } else if (event === 'motion') {
          handlers.motion(payload.id, payload);
        } else if (event === 'emote') {
          handlers.emote(payload.id, payload.name);
        } else if (event === 'kudos') {
          handlers.kudos(payload);
        }
      };
      bc.postMessage({ event: 'hello', payload: { id: myId, profile: getLocalProfile() } });
      window.addEventListener('pagehide', () => bc?.postMessage({ event: 'bye', payload: { id: myId } }));
    },
    send(event, payload) {
      bc?.postMessage({ event, payload });
    },
    disconnect() {
      bc?.postMessage({ event: 'bye', payload: { id: myId } });
      bc?.close();
      bc = null;
    },
    room: () => 'island-local',
  };
}
