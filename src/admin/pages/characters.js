import { ANIMATION_SLOTS, CLIP_PATTERNS, GENDERS } from '../../data/characters.js';
import { h } from '../../ui/dom.js';
import { confirmDialog, showToast } from '../../ui/feedback.js';
import { api, deleteCharacterModel, uploadCharacterModel } from '../api.js';
import { badge, dataTable, field, formDialog, select } from '../widgets.js';

/** File gốc chọn được tối đa (MB) — sẽ được nén trước khi tải lên. */
const MAX_SOURCE_MB = 300;
/** Sau khi nén vẫn lớn hơn mức này (MB) thì không tải lên — điện thoại tải quá lâu. */
const MAX_MODEL_MB = 25;
/** Khuyến nghị để người chơi tải nhanh trên 4G. */
const RECOMMENDED_MODEL_MB = 8;
/** File nhỏ hơn mức này (MB) thì tải thẳng, không cần nén. */
const COMPRESS_ABOVE_MB = 2;

const toMB = (bytes) => bytes / 1024 / 1024;

const GENDER_OPTIONS = Object.entries(GENDERS);

/**
 * Nhân vật: Kỳ lân Nam / Nữ dựng sẵn + tải lên nhân vật 3D (.glb) cho người chơi chọn.
 *
 * @param {HTMLElement} el
 * @param {{ role?: string }} [ctx]
 */
export async function renderCharacters(el, { role } = {}) {
  const isAdmin = role === 'admin';
  const listEl = h('div', {}, h('p', { class: 'muted' }, 'Đang tải…'));
  const defaultNote = h(
    'p',
    { class: 'muted small' },
    '⭐ Nhân vật mặc định: dùng cho người chơi mới và người chưa tự chọn. Ai đã tự chọn trong Tủ đồ › 🦄 Nhân vật thì luôn giữ lựa chọn đó cho lần chơi sau.',
    isAdmin ? '' : ' (Chỉ Quản trị được đổi nhân vật mặc định.)',
  );
  el.replaceChildren(
    uploadCard(async (newId) => {
      const rows = await load();
      // Vừa tải lên → mở luôn hộp Kiểm tra để gán Đứng / Đi / Chạy.
      const added = rows?.find((r) => r.id === newId);
      if (added) inspect(added);
    }),
    h('section', { class: 'card' }, h('header', { class: 'card-head' }, h('h3', {}, '🦄 Danh sách nhân vật')), defaultNote, listEl),
    guideCard(),
  );

  async function load() {
    try {
      const rows = await api.listCharacters();
      listEl.replaceChildren(
        dataTable({
          empty: 'Chưa có nhân vật nào.',
          columns: [
            {
              key: 'name',
              label: 'Nhân vật',
              className: 'col-wide',
              render: (c) => {
                const slots = Object.keys(c.animations ?? {});
                const has = (id) => slots.includes(id);
                const sub = c.variant
                  ? 'Dựng sẵn trong game'
                  : slots.length
                    ? `Model 3D tải lên · 🎬 ${slots.length} động tác (${['idle', 'walk', 'run'].map((id) => `${has(id) ? '✓' : '✗'} ${ANIMATION_SLOTS.find((s) => s.id === id).label}`).join(', ')})`
                    : 'Model 3D tải lên · chưa gán động tác — bấm 🔍 Kiểm tra';
                return h(
                  'div',
                  {},
                  h('strong', {}, `${c.variant ? (c.variant === 'female' ? '🎀' : '🦄') : '🧊'} ${c.name} `),
                  c.isDefault ? badge('Mặc định', 'info', '⭐') : '',
                  h('div', { class: 'muted small' }, sub),
                );
              },
            },
            { key: 'gender', label: 'Giới tính', render: (c) => GENDERS[c.gender] ?? c.gender },
            { key: 'players', label: 'Đang dùng', render: (c) => `${c.players} người` },
            { key: 'active', label: 'Trạng thái', render: (c) => (c.active ? badge('Đang mở', 'success') : badge('Đã tắt', 'neutral')) },
            {
              key: 'actions',
              label: 'Thao tác',
              className: 'col-actions',
              render: (c) =>
                h(
                  'div',
                  { class: 'row-actions' },
                  isAdmin && !c.isDefault && c.active ? h('button', { class: 'btn-sm', type: 'button', onclick: () => makeDefault(c) }, '⭐ Đặt mặc định') : '',
                  c.modelUrl ? h('button', { class: 'btn-sm', type: 'button', onclick: () => inspect(c) }, '🔍 Kiểm tra') : '',
                  c.modelUrl ? h('button', { class: 'btn-sm', type: 'button', onclick: () => editAnimations(c) }, '🎬 Động tác') : '',
                  c.modelUrl ? h('a', { class: 'btn-sm', href: c.modelUrl, target: '_blank', rel: 'noopener' }, 'Tải file') : '',
                  h('button', { class: 'btn-sm', type: 'button', onclick: () => edit(c) }, 'Sửa'),
                  c.variant ? '' : h('button', { class: 'btn-sm btn-sm-danger', type: 'button', onclick: () => remove(c) }, 'Xoá'),
                ),
            },
          ],
          rows,
        }),
      );
      return rows;
    } catch (err) {
      listEl.replaceChildren(h('p', { class: 'notice notice-danger' }, err.message));
      return null;
    }
  }

  async function edit(c) {
    const name = h('input', { class: 'input', maxlength: 40, value: c.name, required: true });
    const gender = select(GENDER_OPTIONS, c.gender);
    const active = h('input', { type: 'checkbox', checked: c.active, disabled: c.id === 'kylan-nam' });
    const saved = await formDialog({
      title: `Sửa "${c.name}"`,
      body: h(
        'div',
        { class: 'form-grid' },
        field('Tên nhân vật', name),
        field('Giới tính', gender),
        h('label', { class: 'check' }, active, ' Đang mở cho người chơi chọn'),
        c.id === 'kylan-nam' ? h('p', { class: 'muted small' }, 'Kỳ lân Nam là nhân vật mặc định nên luôn mở.') : '',
      ),
      submitText: 'Lưu',
      onSubmit: () => api.saveCharacter({ id: c.id, name: name.value, gender: gender.value, active: active.checked }),
    });
    if (saved) {
      showToast('Đã lưu nhân vật', { type: 'success', icon: '✓' });
      load();
    }
  }

  /**
   * Kiểm tra file model: có khung xương không, có động tác nào; gán động tác trong file vào ô
   * (Đứng yên / Đi bộ / Chạy…) — game dùng đúng ô đã gán.
   */
  async function inspect(c) {
    let info;
    try {
      showToast('Đang đọc file 3D…', { icon: '🔍' });
      const [{ inspectGlb }, blob] = await Promise.all([import('../glbCompress.js'), fetch(c.modelUrl).then((r) => r.blob())]);
      info = await inspectGlb(blob);
    } catch (err) {
      showToast(`Không đọc được file: ${err.message}`, { type: 'warn' });
      return;
    }
    const current = c.animations ?? {};
    const slotOptions = [['', '— Không dùng —'], ...ANIMATION_SLOTS.map((s) => [s.id, `${s.icon} ${s.label}`])];
    const used = new Set();
    const rows = info.clips.map((clip) => {
      // Ô đã gán trước đó (cùng file + tên clip) → giữ; chưa có → đoán theo tên.
      let slot = Object.entries(current).find(([, v]) => v?.url === c.modelUrl && v?.clip === clip.name)?.[0] ?? '';
      if (!slot) slot = Object.keys(CLIP_PATTERNS).find((id) => !used.has(id) && !current[id] && CLIP_PATTERNS[id].test(clip.name)) ?? '';
      if (slot) used.add(slot);
      const sel = select(slotOptions, slot);
      return { clip, sel, row: h('div', { class: 'anim-row' }, h('div', { class: 'anim-label' }, h('strong', {}, clip.name), h('small', { class: 'muted' }, `${clip.seconds.toFixed(1)} giây`)), sel) };
    });

    const verdict = !info.joints
      ? h('p', { class: 'notice notice-danger' }, '✗ File CHƯA có khung xương (rig) → không thể có động tác thật; game sẽ cho nhân vật tự nhún nhảy. Hãy Rig trên Tripo (Humanoid) rồi xuất lại GLB kèm động tác.')
      : !info.clips.length
        ? h('p', { class: 'notice notice-warning' }, `✓ Có khung xương (${info.joints} xương) nhưng file KHÔNG có động tác nào. Trên Tripo: Animate → thêm Idle / Walk / Run → Export GLB, mục Number of Animations chọn hết. Hoặc bấm "🎬 Động tác" để tải từng file động tác.`)
        : h('p', { class: 'notice notice-success' }, `✓ Có khung xương (${info.joints} xương) và ${info.clips.length} động tác. Kiểm tra ô cho từng động tác bên dưới rồi bấm Lưu.`);

    const saved = await formDialog({
      title: `🔍 Kiểm tra "${c.name}"`,
      wide: true,
      body: h(
        'div',
        {},
        h('p', { class: 'muted small' }, `${info.triangles.toLocaleString('vi-VN')} tam giác · ${info.joints ? `${info.joints} xương` : 'không có xương'} · ${info.clips.length} động tác trong file`),
        verdict,
        rows.length ? h('div', { class: 'anim-list' }, rows.map((r) => r.row)) : '',
        rows.length ? h('p', { class: 'muted small' }, 'Cần tối thiểu: 🧍 Đứng yên, 🚶 Đi bộ, 🏃 Chạy. Mỗi ô chỉ chọn cho 1 động tác.') : '',
      ),
      submitText: rows.length ? 'Lưu gán động tác' : 'Đóng',
      onSubmit: async () => {
        if (!rows.length) return;
        const next = {};
        // Giữ các file động tác tải riêng (có path); gán lại các clip trong chính file model.
        for (const [slot, v] of Object.entries(current)) if (v?.url !== c.modelUrl) next[slot] = v;
        const seen = new Set();
        for (const { clip, sel } of rows) {
          if (!sel.value) continue;
          if (seen.has(sel.value)) throw new Error(`Ô "${ANIMATION_SLOTS.find((s) => s.id === sel.value).label}" được chọn cho 2 động tác.`);
          seen.add(sel.value);
          next[sel.value] = { url: c.modelUrl, clip: clip.name };
        }
        await api.saveCharacter({ id: c.id, name: c.name, gender: c.gender, active: c.active, animations: next });
      },
    });
    if (saved && rows.length) {
      showToast('Đã lưu gán động tác — người chơi thấy sau khi tải lại game', { type: 'success', icon: '🎬' });
      load();
    }
  }

  /** Đặt nhân vật mặc định cho người mới / người chưa tự chọn (chỉ Quản trị). */
  async function makeDefault(c) {
    const ok = await confirmDialog({
      icon: '⭐',
      title: `Đặt "${c.name}" làm mặc định?`,
      message: 'Người chơi mới và những ai CHƯA tự chọn nhân vật sẽ dùng nhân vật này. Ai đã tự chọn trong Tủ đồ thì giữ nguyên lựa chọn của họ.',
      confirmText: 'Đặt mặc định',
    });
    if (!ok) return;
    try {
      await api.setDefaultCharacter(c.id);
      showToast(`"${c.name}" là nhân vật mặc định — người chơi thấy sau khi tải lại game`, { type: 'success', icon: '⭐' });
      load();
    } catch (err) {
      showToast(err.message, { type: 'warn' });
    }
  }

  /** Tải / thay / gỡ file động tác cho nhân vật 3D. */
  async function editAnimations(c) {
    const current = c.animations ?? {};
    const rows = ANIMATION_SLOTS.map((slot) => {
      const input = h('input', { class: 'input input-file-sm', type: 'file', accept: '.glb,model/gltf-binary' });
      const drop = h('input', { type: 'checkbox' });
      const has = Boolean(current[slot.id]);
      const row = h(
        'div',
        { class: 'anim-row' },
        h('div', { class: 'anim-label' }, h('strong', {}, `${slot.icon} ${slot.label}`), slot.hint ? h('small', { class: 'muted' }, slot.hint) : ''),
        h('span', { class: `anim-state ${has ? 'is-on' : ''}` }, has ? '✓ Đã có' : '—'),
        input,
        has ? h('label', { class: 'check small' }, drop, ' Gỡ') : h('span', {}),
      );
      return { slot, input, drop, row };
    });
    const progress = h('p', { class: 'muted small', role: 'status' }, '');

    const saved = await formDialog({
      title: `🎬 Động tác của "${c.name}"`,
      wide: true,
      body: h(
        'div',
        {},
        h(
          'p',
          { class: 'muted small' },
          'Mỗi ô là 1 file .glb có động tác, xuất từ CÙNG một nhân vật đã gắn khung xương (rig) với model chính. ',
          'Trang tự bỏ lưới / hình bề mặt, chỉ giữ chuyển động nên file tải lên rất nhẹ. Ô nào để trống thì nhân vật tự nhún nhảy thay thế.',
        ),
        h('div', { class: 'anim-list' }, rows.map((r) => r.row)),
        progress,
      ),
      submitText: 'Lưu động tác',
      onSubmit: async () => {
        const next = { ...current };
        const oldPaths = [];
        const newPaths = [];
        const { extractAnimation } = await import('../glbCompress.js');
        try {
          for (const { slot, input, drop } of rows) {
            const f = input.files[0];
            if (f) {
              if (!/\.glb$/i.test(f.name)) throw new Error(`${slot.label}: chỉ nhận file .glb.`);
              progress.textContent = `Đang xử lý "${slot.label}"…`;
              const r = await extractAnimation(f);
              const up = await uploadCharacterModel(r.blob);
              newPaths.push(up.path);
              if (current[slot.id]?.path) oldPaths.push(current[slot.id].path);
              next[slot.id] = { url: up.url, path: up.path, clip: r.clips[0]?.name ?? '' };
            } else if (drop.checked && current[slot.id]) {
              if (current[slot.id].path) oldPaths.push(current[slot.id].path);
              delete next[slot.id];
            }
          }
          progress.textContent = 'Đang lưu…';
          await api.saveCharacter({ id: c.id, name: c.name, gender: c.gender, active: c.active, animations: next });
        } catch (err) {
          // Lưu thất bại → xoá các file vừa tải lên để kho không bị rác.
          await Promise.all(newPaths.map((p) => deleteCharacterModel(p)));
          progress.textContent = '';
          throw new Error(/Invalid|magic|JSON|glTF/i.test(err.message) ? 'Có file không đọc được — hãy chắc đây là file .glb hợp lệ.' : err.message);
        }
        await Promise.all(oldPaths.map((p) => deleteCharacterModel(p)));
      },
    });
    if (saved) {
      showToast('Đã lưu động tác — người chơi thấy sau khi tải lại game', { type: 'success', icon: '🎬' });
      load();
    }
  }

  async function remove(c) {
    const ok = await confirmDialog({
      icon: '🗑️',
      title: `Xoá "${c.name}"?`,
      message: `${c.players} người đang dùng sẽ tự chuyển về Kỳ lân Nam. File 3D cũng bị xoá khỏi kho.`,
      confirmText: 'Xoá',
    });
    if (!ok) return;
    try {
      const r = await api.deleteCharacter(c.id);
      await deleteCharacterModel(r.storagePath ?? c.storagePath);
      await Promise.all((r.animationPaths ?? []).map((p) => deleteCharacterModel(p)));
      showToast('Đã xoá nhân vật', { type: 'success', icon: '🗑️' });
      load();
    } catch (err) {
      showToast(err.message, { type: 'warn' });
    }
  }

  load();
}

/** Thẻ tải lên nhân vật 3D mới. */
function uploadCard(onDone) {
  const file = h('input', { class: 'input', type: 'file', accept: '.glb,model/gltf-binary' });
  const name = h('input', { class: 'input', maxlength: 40, placeholder: 'VD: Kỳ lân Nữ 3D' });
  const gender = select(GENDER_OPTIONS, 'nam');
  const status = h('p', { class: 'muted', role: 'status' }, '');
  const submit = h('button', { class: 'btn', type: 'button' }, '⬆️ Tải lên');

  file.addEventListener('change', () => {
    const f = file.files[0];
    if (!f) return;
    const mb = toMB(f.size);
    status.textContent = `${f.name} · ${mb.toFixed(1)} MB${mb > COMPRESS_ABOVE_MB ? ' — sẽ được tự động nén trước khi tải lên.' : ''}`;
    if (!name.value) name.value = f.name.replace(/\.glb$/i, '').replace(/[-_]+/g, ' ').slice(0, 40);
  });

  submit.addEventListener('click', async () => {
    const f = file.files[0];
    if (!f) return showToast('Chọn file .glb trước nhé.', { type: 'warn' });
    if (!/\.glb$/i.test(f.name)) return showToast('Chỉ nhận file .glb (glTF dạng nhị phân).', { type: 'warn' });
    if (toMB(f.size) > MAX_SOURCE_MB) return showToast(`File lớn hơn ${MAX_SOURCE_MB} MB — hãy xuất lại với chất lượng thấp hơn.`, { type: 'warn' });
    if (name.value.trim().length < 2) return showToast('Nhập tên nhân vật (ít nhất 2 ký tự).', { type: 'warn' });
    submit.disabled = true;
    let uploaded = null;
    try {
      let upload = f;
      if (toMB(f.size) > COMPRESS_ABOVE_MB) {
        // Tải lười: thư viện nén chỉ tải khi cần.
        const { compressGlb } = await import('../glbCompress.js');
        const r = await compressGlb(f, (step) => (status.textContent = step));
        status.textContent = `Đã nén: ${toMB(r.before).toFixed(1)} MB → ${toMB(r.after).toFixed(1)} MB`;
        upload = r.blob;
      }
      if (toMB(upload.size) > MAX_MODEL_MB) {
        throw new Error(`Sau khi nén file vẫn nặng ${toMB(upload.size).toFixed(1)} MB (tối đa ${MAX_MODEL_MB} MB). Hãy xuất lại từ công cụ 3D với ít lưới hơn.`);
      }
      status.textContent += ' · Đang tải lên kho…';
      uploaded = await uploadCharacterModel(upload);
      status.textContent = 'Đang lưu nhân vật…';
      const saved = await api.saveCharacter({ name: name.value, gender: gender.value, modelUrl: uploaded.url, storagePath: uploaded.path, active: true });
      showToast(`Đã thêm "${name.value.trim()}" — người chơi chọn trong Tủ đồ › 🦄 Nhân vật`, { type: 'success', icon: '🦄' });
      file.value = '';
      name.value = '';
      status.textContent = '';
      onDone(saved?.id);
    } catch (err) {
      if (uploaded) await deleteCharacterModel(uploaded.path);
      status.textContent = '';
      console.error(err);
      showToast(/Invalid|magic|JSON|glTF/i.test(err.message) ? 'File không đọc được — hãy chắc đây là file .glb hợp lệ.' : err.message, { type: 'warn' });
    }
    submit.disabled = false;
  });

  return h(
    'section',
    { class: 'card' },
    h('header', { class: 'card-head' }, h('h3', {}, '⬆️ Thêm nhân vật 3D')),
    h('p', { class: 'muted' }, 'Tải file .glb lên — người chơi sẽ thấy nhân vật mới trong Tủ đồ › 🦄 Nhân vật và chọn được ngay.'),
    h('div', { class: 'form-grid' }, field('File 3D (.glb)', file, `File lớn sẽ được tự động nén (thu nhỏ hình bề mặt, giảm lưới) — thường còn dưới ${RECOMMENDED_MODEL_MB} MB.`), field('Tên nhân vật', name), field('Giới tính', gender)),
    h('div', { class: 'page-actions' }, submit),
    status,
  );
}

/** Hướng dẫn làm file .glb cho người không chuyên. */
function guideCard() {
  return h(
    'section',
    { class: 'card' },
    h('header', { class: 'card-head' }, h('h3', {}, '💡 Làm file nhân vật 3D thế nào?')),
    h(
      'ol',
      { class: 'role-list' },
      h('li', {}, 'Dùng công cụ tạo 3D từ ảnh (VD: Tripo3D, Meshy) — ảnh Kỳ lân đứng thẳng, nền trơn, nhìn chính diện, HAI TAY BUÔNG XOÈ RA (tư thế chữ A). Tư thế vẫy tay / chống hông sẽ làm tay méo khi cử động.'),
      h('li', {}, 'Giảm lưới (Retopo) còn khoảng 10–50 nghìn mặt trước khi gắn khung xương.'),
      h('li', {}, 'Muốn nhân vật có động tác: dùng chức năng "Rigging / Animation" của công cụ (chọn kiểu nhân vật 2 chân) → tải model đã rig lên ở đây.'),
      h('li', {}, 'Sau đó bấm "🎬 Động tác" ở danh sách → tải từng file động tác (Đứng yên, Đi bộ, Chạy, Vẫy tay, Vui mừng…) xuất từ cùng nhân vật đó.'),
      h('li', {}, 'Xuất file định dạng GLB. File nặng cũng được — trang này tự nén trước khi tải lên.'),
      h('li', {}, 'Tải lên ở thẻ phía trên. Game tự chỉnh chiều cao và đặt nhân vật đứng trên mặt đất.'),
    ),
    h('p', { class: 'muted' }, 'Lưu ý: nhân vật 3D tải lên chưa mặc được trang phục trong Tủ đồ. Chưa có động tác thì game tự cho nhân vật nhún nhảy, lắc lư khi chạy. Mặt nhân vật nên hướng về phía trước (trục +Z của file).'),
  );
}
