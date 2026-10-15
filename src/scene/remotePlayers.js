import * as THREE from 'three';
import { MULTIPLAYER } from '../config.js';
import { createMascot } from './mascot.js';
import { createNameTag } from './nameTag.js';
import { createWardrobe } from './outfits.js';
import { createStickerBubble } from './stickerBubble.js';
import { createPetFollower } from './pets.js';

/** Tốc độ bám theo vị trí nhận được (càng lớn càng sát, càng nhỏ càng mượt). */
const FOLLOW_SPEED = 10;
/** Bao lâu sắp xếp lại ai được vẽ đầy đủ (giây). */
const LOD_INTERVAL = 0.5;

/**
 * Kỳ lân của người chơi khác: bảng tên (hạng, tên, bộ phận, Nhà), trang phục đúng như họ đã mua,
 * di chuyển mượt (nội suy), cảm xúc. Kỳ lân ở xa chỉ hiện bảng tên để game vẫn mượt trên điện thoại.
 *
 * @param {{ scene: THREE.Scene, island: { groundHeight: (x: number, z: number) => number },
 *   onTap: (object: THREE.Object3D, handler: () => void) => () => void,
 *   onSelect: (id: string) => void }} deps
 */
export function createRemotePlayers({ scene, island, onTap, onSelect }) {
  /** @type {Map<string, object>} */
  const players = new Map();
  const tmp = new THREE.Vector3();
  let lodTimer = 0;

  function ensure(id) {
    let p = players.get(id);
    if (p) return p;
    const root = new THREE.Group();
    root.name = `peer:${id}`;
    root.visible = false; // hiện khi nhận vị trí đầu tiên
    scene.add(root);

    const tag = createNameTag();
    root.add(tag.sprite);

    // Vùng chạm vô hình (luôn có, kể cả khi chưa vẽ chi tiết) để mở thẻ hồ sơ.
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.8, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 1.4;
    root.add(hit);
    const offTap = onTap(hit, () => onSelect(id));
    const sticker = createStickerBubble(root);

    p = {
      id,
      root,
      tag,
      hit,
      offTap,
      sticker,
      pet: null,
      mascot: null,
      wardrobe: null,
      profile: null,
      target: { x: 0, z: 0, ry: 0, s: 0 },
      hasMotion: false,
      detailed: false,
      pendingEmote: null,
    };
    players.set(id, p);
    return p;
  }

  function buildDetail(p) {
    if (p.mascot) return;
    p.mascot = createMascot();
    p.wardrobe = createWardrobe(p.mascot);
    if (p.profile?.equipped) p.wardrobe.equipAll(p.profile.equipped);
    p.root.add(p.mascot.object);
    if (p.pendingEmote) p.mascot.emote(p.pendingEmote);
    syncPet(p);
  }

  /** Thú cưng chỉ vẽ cho Kỳ lân ở gần (đang vẽ chi tiết). */
  function syncPet(p) {
    const want = p.mascot ? (p.profile?.pet ?? null) : null;
    if (!want) {
      p.pet?.dispose();
      p.pet = null;
      return;
    }
    p.pet ??= createPetFollower(scene, island);
    p.pet.setPet(want);
  }

  function dropDetail(p) {
    if (!p.mascot) return;
    p.pet?.dispose();
    p.pet = null;
    p.root.remove(p.mascot.object);
    disposeTree(p.mascot.object);
    p.mascot = null;
    p.wardrobe = null;
  }

  /** Cập nhật hồ sơ (tên, hạng, Nhà, trang phục). */
  function updateProfile(profile) {
    const p = ensure(profile.id);
    const changedOutfit = JSON.stringify(p.profile?.equipped) !== JSON.stringify(profile.equipped);
    p.profile = profile;
    p.tag.set({ name: profile.displayName, unit: profile.unit, xp: profile.xp ?? 0, house: profile.house });
    if (changedOutfit && p.wardrobe && profile.equipped) p.wardrobe.equipAll(profile.equipped);
    syncPet(p);
  }

  /** Nhận vị trí mới. */
  function setMotion(id, { x, z, ry, s }) {
    const p = ensure(id);
    p.target = { x, z, ry, s };
    if (!p.hasMotion) {
      p.hasMotion = true;
      p.root.position.set(x, island.groundHeight(x, z), z);
      p.root.rotation.y = ry;
      p.root.visible = true;
      lodTimer = 0; // dựng hình ngay ở frame kế tiếp
    }
  }

  function playEmote(id, name) {
    const p = ensure(id);
    if (p.mascot) p.mascot.emote(name);
    else p.pendingEmote = name;
  }

  /** Hiện sticker trên đầu người chơi khác. */
  function playSticker(id, emoji) {
    const p = players.get(id);
    if (p?.hasMotion) p.sticker.show(emoji);
  }

  function remove(id) {
    const p = players.get(id);
    if (!p) return;
    p.offTap();
    p.sticker.dispose();
    dropDetail(p);
    p.tag.dispose();
    p.hit.geometry.dispose();
    p.hit.material.dispose();
    scene.remove(p.root);
    players.delete(id);
  }

  /**
   * Chọn những Kỳ lân gần điểm đang nhìn nhất để vẽ đầy đủ; còn lại chỉ hiện bảng tên.
   * Đo từ điểm camera nhìn vào (không phải từ camera) → xem toàn đảo / camera lùi xa trên điện thoại
   * vẫn thấy bạn bè. Đảo nhỏ nên bảng tên luôn hiện.
   */
  function updateLod(focus) {
    const list = [...players.values()].filter((p) => p.hasMotion);
    for (const p of list) p.dist = p.root.position.distanceTo(focus);
    list.sort((a, b) => a.dist - b.dist);
    list.forEach((p, i) => {
      const detailed = i < MULTIPLAYER.MAX_DETAILED && p.dist < MULTIPLAYER.DETAIL_DISTANCE;
      if (detailed) buildDetail(p);
      else dropDetail(p);
    });
  }

  /**
   * @param {number} delta
   * @param {number} elapsed
   * @param {THREE.Vector3} focus  điểm camera đang nhìn vào (controls.target)
   */
  function update(delta, elapsed, focus) {
    lodTimer -= delta;
    if (lodTimer <= 0) {
      lodTimer = LOD_INTERVAL;
      updateLod(focus);
    }
    const k = 1 - Math.exp(-delta * FOLLOW_SPEED);
    for (const p of players.values()) {
      if (!p.hasMotion) continue;
      const { x, z, ry, s } = p.target;
      p.root.position.x += (x - p.root.position.x) * k;
      p.root.position.z += (z - p.root.position.z) * k;
      p.root.position.y = island.groundHeight(p.root.position.x, p.root.position.z);
      const diff = Math.atan2(Math.sin(ry - p.root.rotation.y), Math.cos(ry - p.root.rotation.y));
      p.root.rotation.y += diff * k;
      const lagging = tmp.set(x - p.root.position.x, 0, z - p.root.position.z).length() > 0.05;
      if (p.mascot) {
        p.mascot.setLocomotion(s > 0.1 || lagging ? Math.max(s, 0.8) : 0);
        p.mascot.update(delta, elapsed);
        p.wardrobe.update(delta, elapsed);
        p.pet?.update(delta, elapsed, p.root);
      }
      p.tag.update(elapsed);
      p.sticker.update(delta);
    }
  }

  return {
    updateProfile,
    setMotion,
    playEmote,
    playSticker,
    remove,
    update,
    get: (id) => players.get(id),
    /** Danh sách người chơi đang thấy trên đảo (cho bảng "Ai đang online"). */
    list: () =>
      [...players.values()].filter((p) => p.hasMotion).map((p) => ({ id: p.id, profile: p.profile, position: p.root.position })),
    count: () => players.size,
  };
}

/** Giải phóng hình khối của một Kỳ lân (không đụng texture dùng chung của emoji). */
function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      if (m.map && !m.map.userData?.shared) m.map.dispose();
      m.dispose();
    }
  });
}
