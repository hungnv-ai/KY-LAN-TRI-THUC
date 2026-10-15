import { sfx } from '../audio/sfx.js';
import { getPet } from '../data/pets.js';
import { equipPet, friendlyError, getPets, onProgressChange } from '../game/progress.js';
import { say, showToast } from '../ui/feedback.js';
import { openPets, showHatched } from '../ui/petView.js';
import { addQuickAction } from '../ui/quickActions.js';
import { createPetFollower } from '../scene/pets.js';

/**
 * Thú cưng của mình: đi theo Kỳ lân, nút 🐾 (bộ sưu tập + trứng), chúc mừng khi trứng nở.
 *
 * @param {{ world: object, island: object, mascot: object, fx: object, onPetChanged: () => void }} deps
 * @returns {{ update: (delta: number, elapsed: number) => void, handleEgg: (egg: object | undefined) => Promise<void> }}
 */
export function setupPets({ world, island, mascot, fx, onPetChanged }) {
  const follower = createPetFollower(world.scene, island);
  follower.setPet(getPets().active);

  const button = addQuickAction({
    icon: '🐾',
    label: 'Thú cưng',
    order: 25,
    onClick: () =>
      openPets({
        getData: getPets,
        onEquip: async (petId) => {
          try {
            await equipPet(petId);
            if (petId) {
              sfx.pop();
              mascot.emote('happy');
              say(`${getPet(petId)?.name} đi cùng bạn nè! 🐾`);
            }
            onPetChanged();
          } catch (err) {
            showToast(friendlyError(err), { type: 'warn' });
          }
        },
      }),
  });

  const sync = () => {
    const pets = getPets();
    follower.setPet(pets.active);
    button.setBadge(`${pets.egg}/${pets.eggNeed}`);
  };
  onProgressChange(sync);
  sync();

  /** Gọi sau khi điểm danh: báo tiến độ ấp trứng / chúc mừng trứng nở. */
  async function handleEgg(egg) {
    if (!egg) return;
    if (egg.hatched) {
      const pet = getPet(egg.hatched.id);
      if (!pet) return;
      sfx.hatch();
      mascot.emote('cheer');
      setTimeout(() => {
        const pos = follower.position();
        if (pos) fx.burst(pos.clone().setY(pos.y + 0.4), { count: 40, speed: 2.2, up: 2.5, life: 1.1 });
      }, 200);
      await showHatched(pet);
      onPetChanged();
    } else if (egg.coins) {
      showToast(`Trứng nở ra ${egg.coins} Xu — bạn đã có đủ bộ thú cưng! 🏆`, { type: 'success', icon: '🥚' });
    } else {
      showToast(`Trứng thần kỳ: ${egg.progress}/${egg.need} ngày — sắp nở rồi!`, { icon: '🥚' });
    }
  }

  return {
    update: (delta, elapsed) => follower.update(delta, elapsed, mascot.object),
    handleEgg,
  };
}
