import { BUILTIN_CHARACTERS, DEFAULT_CHARACTER } from '../data/characters.js';
import { getCharacterId, listCharacters, setCharacter } from '../game/progress.js';
import { loadGLB } from '../scene/loader.js';

/** Gặp id nhân vật lạ (vừa được tải lên) → tải lại danh mục, nhưng không quá thường xuyên. */
const CATALOG_REFRESH_MS = 60000;

/**
 * Nhân vật: danh mục (Kỳ lân Nam/Nữ + nhân vật 3D quản trị tải lên), áp nhân vật lên một Kỳ lân
 * (của mình hoặc người khác), chọn nhân vật mới. Không chứa luật — máy chủ kiểm tra hợp lệ.
 *
 * @param {{ mascot: ReturnType<typeof import('../scene/mascot.js').createMascot>, onChanged?: () => void }} deps
 * @returns {{ ready: Promise<void>, catalog: () => object[], current: () => string,
 *   apply: (target: object, id: string | null | undefined) => Promise<void>, choose: (id: string) => Promise<void> }}
 */
export function setupCharacters({ mascot, onChanged }) {
  let catalog = BUILTIN_CHARACTERS.map(({ id, name, gender, variant }) => ({ id, name, gender, variant, modelUrl: null }));
  let lastRefresh = 0;
  /** Mỗi Kỳ lân chỉ giữ yêu cầu áp nhân vật mới nhất (tải .glb có thể về chậm). */
  const tokens = new WeakMap();

  async function refresh() {
    lastRefresh = Date.now();
    try {
      const list = await listCharacters();
      if (Array.isArray(list) && list.length) catalog = list;
    } catch {
      /* máy chủ cũ / mất mạng: dùng danh mục dựng sẵn */
    }
  }

  async function find(id) {
    let c = catalog.find((x) => x.id === id);
    if (!c && id && Date.now() - lastRefresh > CATALOG_REFRESH_MS) {
      await refresh();
      c = catalog.find((x) => x.id === id);
    }
    return c ?? catalog.find((x) => x.id === DEFAULT_CHARACTER) ?? catalog[0];
  }

  async function apply(target, id) {
    const token = (tokens.get(target) ?? 0) + 1;
    tokens.set(target, token);
    const c = await find(id || DEFAULT_CHARACTER);
    if (c?.modelUrl) {
      try {
        const glb = await loadGLB(c.modelUrl);
        if (tokens.get(target) !== token) return;
        target.setCustomModel(glb);
        return;
      } catch (err) {
        console.warn('[characters] Không tải được model 3D, dùng Kỳ lân Nam:', err);
      }
    }
    if (tokens.get(target) !== token) return;
    target.setCustomModel(null);
    target.setVariant(c?.variant === 'female' ? 'female' : 'male');
  }

  async function choose(id) {
    await setCharacter(id);
    await apply(mascot, id);
    mascot.emote('cheer');
    onChanged?.();
  }

  const ready = refresh().then(() => apply(mascot, getCharacterId()));

  return { ready, catalog: () => catalog, current: getCharacterId, apply, choose };
}
