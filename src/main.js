import * as THREE from 'three';
import { initAudio, isMuted, setMuted, sfx } from './audio/sfx.js';
import { MASCOT_LINES } from './data/lines.js';
import { getRankInfo } from './data/ranks.js';
import { createExplore } from './features/explore.js';
import { setupExpressions } from './features/expressions.js';
import { setupGiftShop } from './features/giftShop.js';
import { setupPets } from './features/pets.js';
import { setupMenu } from './features/menu.js';
import { createRewards } from './features/rewards.js';
import { startSession } from './features/session.js';
import { setupSocial } from './features/social.js';
import {
  getActiveStreak,
  getState,
  hasCheckedInToday,
  onProgressChange,
  refreshState,
} from './game/progress.js';
import { isGoldenHour } from './game/time.js';
import { createFx } from './scene/fx.js';
import { createQualityManager } from './scene/quality.js';
import { setupIsland } from './scene/island.js';
import { setupLights } from './scene/lights.js';
import { createMascot } from './scene/mascot.js';
import { NAME_TAG_Y, nameTagPixelHeight } from './scene/nameTag.js';
import { createWardrobe } from './scene/outfits.js';
import { createWorld } from './scene/world.js';
import { say, setSpeechAnchor } from './ui/feedback.js';
import { hideLoading, renderHud, setupSoundButton, showAdminLink } from './ui/hud.js';

/**
 * Entry: lắp ráp các module và chạy vòng lặp duy nhất. Logic chi tiết nằm trong từng module.
 */

// ── 3D (vẽ ngay để màn hình đăng nhập có cảnh đảo phía sau) ─────────────
const world = createWorld(document.getElementById('canvas-container'));
const { sun } = setupLights(world.scene, world.renderer);
const island = setupIsland(world.scene);
const fx = createFx(world.scene);
const mascot = createMascot();
world.scene.add(mascot.object);
const wardrobe = createWardrobe(mascot);
const quality = createQualityManager(world.renderer, world.scene);

/** Các hệ thống chỉ chạy sau khi đã đăng nhập & nạp tiến trình. */
let explore = null;
let social = null;
let pets = null;

// ── Vòng lặp duy nhất ───────────────────────────────────────────────────
const timer = new THREE.Timer();
timer.connect(document); // tạm dừng delta khi tab bị ẩn
const tagPos = new THREE.Vector3();
/** Khoảng hở giữa bong bóng thoại và mép trên bảng tên (px). */
const SPEECH_GAP_PX = 10;

world.renderer.setAnimationLoop((timestamp) => {
  timer.update(timestamp);
  const delta = Math.min(timer.getDelta(), 0.1); // tránh "nhảy cóc" sau khi tab bị treo
  const elapsed = timer.getElapsed();

  quality.update(delta);
  explore?.update(delta, elapsed);
  social?.update(delta, elapsed);
  pets?.update(delta, elapsed);
  mascot.update(delta, elapsed);
  fx.update(delta);
  wardrobe.update(delta, elapsed);
  island.update(delta, elapsed);
  world.controls.update();
  world.update(delta);

  // Bong bóng thoại nằm ngay trên bảng tên (không đè lên nhau dù zoom gần/xa).
  mascot.object.getWorldPosition(tagPos);
  tagPos.y += NAME_TAG_Y;
  const p = world.toScreen(tagPos);
  setSpeechAnchor(p.x, p.y - nameTagPixelHeight(world.camera, window.innerHeight) - SPEECH_GAP_PX);

  world.renderer.render(world.scene, world.camera);
});

// ── Âm thanh ────────────────────────────────────────────────────────────
initAudio();
setupSoundButton(isMuted(), setMuted);
// Tiếng "tách" nhẹ khi bấm các nút giao diện (câu trả lời quiz có âm thanh riêng).
document.addEventListener('click', (e) => {
  if (e.target.closest('.nav-btn, .btn, .tab, .item-card, .icon-btn, .pill-btn, .rank-card')) sfx.click();
});

// Cài game như ứng dụng + mở lại nhanh hơn (chỉ ở bản chạy thật).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

hideLoading();
boot().catch((err) => {
  console.error('[main] Khởi động thất bại:', err);
  say('Ôi, có lỗi khi khởi động. Bạn tải lại trang giúp mình nhé!');
});

async function boot() {
  const session = await startSession();
  wardrobe.equipAll(getState().equipped);
  if (['teacher', 'bgh', 'admin'].includes(getState().profile.role)) showAdminLink();

  // HUD
  const refreshHud = () => {
    const state = getState();
    renderHud({
      xp: state.xp,
      coins: state.coins,
      streak: getActiveStreak(),
      rankInfo: getRankInfo(state.xp),
      golden: isGoldenHour(),
      canCheckIn: !hasCheckedInToday(),
    });
  };
  onProgressChange(refreshHud);
  refreshHud();
  setInterval(refreshHud, 60_000); // cập nhật Giờ Vàng
  // Quay lại tab sau một lúc (có thể đã sang ngày mới) → tải lại trạng thái.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshState().catch(() => {});
  });

  const rewards = createRewards({ world, mascot, fx, onRankUp: () => social?.notifyProfileChanged() });

  explore = createExplore({
    world,
    island,
    mascot,
    sun,
    fx,
    onRankUp: (reward) => rewards.announceRankUp(reward.rankUp),
  });

  social = setupSocial({
    world,
    island,
    mascot,
    supabase: session.supabase,
    userId: session.userId,
    isMoving: () => explore.isMoving(),
  });

  setupExpressions({ world, mascot, social });
  setupGiftShop({ mascot, fx });
  pets = setupPets({ world, island, mascot, fx, onPetChanged: () => social.notifyProfileChanged() });

  setupMenu({
    world,
    mascot,
    wardrobe,
    fx,
    rewards,
    onOutfitChanged: () => social.notifyProfileChanged(),
    onCheckedIn: (result) => pets.handleEgg(result.egg),
  });

  // Chạm vào Kỳ lân của mình: cảm xúc ngẫu nhiên + câu nói về 5 giá trị.
  const TAP_EMOTES = ['wave', 'happy', 'cool', 'think', 'cheer'];
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  world.onTap(mascot.object, () => {
    mascot.emote(pick(TAP_EMOTES));
    say(pick(MASCOT_LINES));
  });

  setTimeout(() => {
    mascot.emote('wave');
    const name = getState().profile.displayName;
    say(
      hasCheckedInToday()
        ? `Chào mừng trở lại${name ? `, ${name}` : ''}! Làm một lượt Tri Thức nhé?`
        : `Xin chào${name ? ` ${name}` : ''}! Bấm "Hôm nay" để điểm danh nhận quà nhé! 🎁`,
    );
  }, 700);
}
