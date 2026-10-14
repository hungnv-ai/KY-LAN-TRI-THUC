import * as THREE from 'three';
import { EXPLORE } from '../config.js';

/** Khoảng cách (m) từ Kỳ lân tới vật phẩm để nhặt được. */
const COIN_PICK_RADIUS = 1.0;
const GIFT_PICK_RADIUS = 1.3;

/**
 * Vật phẩm trên đảo: xu vàng xoay tròn rải khắp nơi và hộp quà bất ngờ (có cột sáng chỉ đường).
 * Module chỉ lo hiển thị & phát hiện va chạm; việc cộng thưởng do nơi gọi quyết định.
 *
 * @param {THREE.Scene} scene
 * @param {{ randomOpenPoint: () => THREE.Vector3 }} island
 * @param {{ onCoin: (pos: THREE.Vector3) => boolean, onGift: (pos: THREE.Vector3) => void, canSpawnGift: () => boolean }} handlers
 *   `onCoin` trả về false nếu đã hết lượt nhặt xu hôm nay (xu vẫn biến mất cho vui mắt).
 * @returns {{ update: (delta: number, elapsed: number, player: THREE.Vector3, canCollect: boolean) => void,
 *   giftPosition: () => THREE.Vector3 | null, coinPositions: () => THREE.Vector3[] }}
 */
export function createPickups(scene, island, handlers) {
  const coinGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.07, 24);
  coinGeo.rotateX(Math.PI / 2);
  const coinMat = new THREE.MeshStandardMaterial({
    color: 0xf5c542,
    emissive: 0xc49c57,
    emissiveIntensity: 0.35,
    roughness: 0.3,
    metalness: 0.6,
  });

  const coins = [];
  for (let i = 0; i < EXPLORE.COINS_ON_MAP; i++) {
    const coin = new THREE.Mesh(coinGeo, coinMat);
    coin.castShadow = true;
    scene.add(coin);
    coins.push({ mesh: coin, respawnIn: 0, phase: Math.random() * 6 });
    placeCoin(coins[i]);
  }

  function placeCoin(c) {
    const p = island.randomOpenPoint(3, 27);
    c.mesh.position.set(p.x, 0.7, p.z);
    c.mesh.visible = true;
    c.respawnIn = 0;
  }

  // Hộp quà (1 hộp tại một thời điểm).
  const gift = createGiftBox();
  gift.visible = false;
  scene.add(gift);
  let giftTimer = EXPLORE.GIFT_INTERVAL_SEC * 0.4;

  function update(delta, elapsed, player, canCollect) {
    for (const c of coins) {
      if (!c.mesh.visible) {
        c.respawnIn -= delta;
        if (c.respawnIn <= 0) placeCoin(c);
        continue;
      }
      c.mesh.rotation.y = elapsed * 2.5 + c.phase;
      c.mesh.position.y = 0.7 + Math.sin(elapsed * 3 + c.phase) * 0.12;
      if (canCollect && distXZ(c.mesh.position, player) < COIN_PICK_RADIUS) {
        c.mesh.visible = false;
        c.respawnIn = EXPLORE.COIN_RESPAWN_SEC;
        handlers.onCoin(c.mesh.position);
      }
    }

    if (gift.visible) {
      gift.userData.box.rotation.y = elapsed * 1.2;
      gift.userData.box.position.y = 0.45 + Math.abs(Math.sin(elapsed * 2.5)) * 0.2;
      if (canCollect && distXZ(gift.position, player) < GIFT_PICK_RADIUS) {
        gift.visible = false;
        giftTimer = EXPLORE.GIFT_INTERVAL_SEC;
        handlers.onGift(gift.position);
      }
    } else {
      giftTimer -= delta;
      if (giftTimer <= 0) {
        if (handlers.canSpawnGift()) {
          const p = island.randomOpenPoint(6, 26);
          gift.position.set(p.x, 0, p.z);
          gift.visible = true;
        } else {
          giftTimer = EXPLORE.GIFT_INTERVAL_SEC;
        }
      }
    }
  }

  return {
    update,
    giftPosition: () => (gift.visible ? gift.position : null),
    coinPositions: () => coins.filter((c) => c.mesh.visible).map((c) => c.mesh.position),
  };
}

function distXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Hộp quà màu Tri Thức, ruy băng vàng, cột sáng vàng để dễ tìm từ xa. */
function createGiftBox() {
  const group = new THREE.Group();
  const box = new THREE.Group();
  group.add(box);
  group.userData.box = box;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.55, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x9a0036, roughness: 0.5 }),
  );
  box.add(body);
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 0.16, 0.78),
    new THREE.MeshStandardMaterial({ color: 0xb4002f, roughness: 0.5 }),
  );
  lid.position.y = 0.33;
  box.add(lid);

  const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xf5c542, roughness: 0.3, metalness: 0.4 });
  for (const rotY of [0, Math.PI / 2]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.73, 0.8), ribbonMat);
    band.rotation.y = rotY;
    band.position.y = 0.04;
    box.add(band);
  }
  for (const s of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.04, 8, 16), ribbonMat);
    loop.position.set(0.1 * s, 0.5, 0);
    loop.rotation.z = 0.5 * s;
    box.add(loop);
  }
  box.traverse((o) => o.isMesh && (o.castShadow = true));

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 14, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd86b,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  beam.position.y = 7;
  group.add(beam);
  return group;
}
