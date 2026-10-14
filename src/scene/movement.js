import * as THREE from 'three';
import { EXPLORE } from '../config.js';

/** Bán kính "thân" Kỳ lân khi va chạm với vật cản (m). */
const BODY_RADIUS = 0.45;
/** Tốc độ xoay người theo hướng chạy. */
const TURN_SPEED = 12;
/** Gia tốc / hãm (càng lớn càng "dính tay"). */
const ACCEL = 10;

const tmpForward = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const tmpMove = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Điều khiển nhân vật: nhận hướng (x, y) từ bàn phím / cần điều khiển, di chuyển
 * theo hướng nhìn của camera, va chạm vật cản, bám độ cao mặt đất, xoay mặt theo hướng chạy.
 *
 * @param {{ object: THREE.Object3D, setLocomotion: (s: number) => void }} mascot
 * @param {{ groundHeight: (x: number, z: number) => number, resolve: (p: THREE.Vector3, r: number) => void }} island
 * @param {THREE.Camera} camera
 * @returns {{ update: (delta: number, input: { x: number, y: number, run: boolean }) => number,
 *   teleport: (x: number, z: number) => void, faceCamera: () => void }}
 *   `update` trả về số mét đã đi trong frame; `faceCamera` quay mặt Kỳ lân về phía người chơi.
 */
export function createMovement(mascot, island, camera) {
  const position = mascot.object.position;
  const velocity = new THREE.Vector3();
  let faceYaw = null; // hướng cần quay khi đứng yên (ví dụ quay mặt về camera)
  position.y = island.groundHeight(position.x, position.z);

  function update(delta, input) {
    // Hướng camera chiếu xuống mặt đất.
    camera.getWorldDirection(tmpForward);
    tmpForward.y = 0;
    tmpForward.normalize();
    tmpRight.crossVectors(tmpForward, UP);

    const magnitude = Math.min(1, Math.hypot(input.x, input.y));
    const speed = (input.run ? EXPLORE.RUN_SPEED : EXPLORE.WALK_SPEED) * magnitude;
    tmpMove.set(0, 0, 0).addScaledVector(tmpForward, input.y).addScaledVector(tmpRight, input.x);
    if (tmpMove.lengthSq() > 0) tmpMove.normalize().multiplyScalar(speed);

    const k = Math.min(1, delta * ACCEL);
    velocity.x += (tmpMove.x - velocity.x) * k;
    velocity.z += (tmpMove.z - velocity.z) * k;

    const before = { x: position.x, z: position.z };
    position.x += velocity.x * delta;
    position.z += velocity.z * delta;
    island.resolve(position, BODY_RADIUS);
    position.y = island.groundHeight(position.x, position.z);

    const moved = Math.hypot(position.x - before.x, position.z - before.z);
    const currentSpeed = delta > 0 ? moved / delta : 0;

    // Xoay mặt theo hướng chạy (hoặc về camera khi được yêu cầu và đang đứng yên).
    let targetYaw = null;
    if (currentSpeed > 0.3) {
      targetYaw = Math.atan2(velocity.x, velocity.z);
      faceYaw = null;
    } else if (faceYaw !== null) {
      targetYaw = faceYaw;
    }
    if (targetYaw !== null) {
      const diff = Math.atan2(Math.sin(targetYaw - mascot.object.rotation.y), Math.cos(targetYaw - mascot.object.rotation.y));
      mascot.object.rotation.y += diff * Math.min(1, delta * TURN_SPEED * 0.6);
    }
    mascot.setLocomotion(currentSpeed > 0.3 ? currentSpeed / EXPLORE.WALK_SPEED : 0);
    return moved;
  }

  function teleport(x, z) {
    position.set(x, island.groundHeight(x, z), z);
    velocity.set(0, 0, 0);
  }

  function faceCamera() {
    faceYaw = Math.atan2(camera.position.x - position.x, camera.position.z - position.z);
  }

  return { update, teleport, faceCamera };
}
