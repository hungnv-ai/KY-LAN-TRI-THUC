import { GENDERS } from '../../data/characters.js';
import { h } from '../../ui/dom.js';
import { confirmDialog, showToast } from '../../ui/feedback.js';
import { api, deleteCharacterModel, uploadCharacterModel } from '../api.js';
import { badge, dataTable, field, formDialog, select } from '../widgets.js';

/** Giới hạn dung lượng file .glb (MB) — file nặng làm điện thoại tải lâu. */
const MAX_MODEL_MB = 25;
/** Khuyến nghị để người chơi tải nhanh trên 4G. */
const RECOMMENDED_MODEL_MB = 8;

const GENDER_OPTIONS = Object.entries(GENDERS);

/**
 * Nhân vật: Kỳ lân Nam / Nữ dựng sẵn + tải lên nhân vật 3D (.glb) cho người chơi chọn.
 *
 * @param {HTMLElement} el
 */
export async function renderCharacters(el) {
  const listEl = h('div', {}, h('p', { class: 'muted' }, 'Đang tải…'));
  el.replaceChildren(uploadCard(() => load()), h('section', { class: 'card' }, h('header', { class: 'card-head' }, h('h3', {}, '🦄 Danh sách nhân vật')), listEl), guideCard());

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
              render: (c) => h('div', {}, h('strong', {}, `${c.variant ? (c.variant === 'female' ? '🎀' : '🦄') : '🧊'} ${c.name}`), h('div', { class: 'muted small' }, c.variant ? 'Dựng sẵn trong game' : 'Model 3D tải lên')),
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
                  c.modelUrl ? h('a', { class: 'btn-sm', href: c.modelUrl, target: '_blank', rel: 'noopener' }, 'Tải file') : '',
                  h('button', { class: 'btn-sm', type: 'button', onclick: () => edit(c) }, 'Sửa'),
                  c.variant ? '' : h('button', { class: 'btn-sm btn-sm-danger', type: 'button', onclick: () => remove(c) }, 'Xoá'),
                ),
            },
          ],
          rows,
        }),
      );
    } catch (err) {
      listEl.replaceChildren(h('p', { class: 'notice notice-danger' }, err.message));
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
    const mb = f.size / 1024 / 1024;
    status.textContent = `${f.name} · ${mb.toFixed(1)} MB${mb > RECOMMENDED_MODEL_MB ? ' — hơi nặng, điện thoại sẽ tải lâu. Nên nén dưới ' + RECOMMENDED_MODEL_MB + ' MB.' : ''}`;
    if (!name.value) name.value = f.name.replace(/\.glb$/i, '').replace(/[-_]+/g, ' ').slice(0, 40);
  });

  submit.addEventListener('click', async () => {
    const f = file.files[0];
    if (!f) return showToast('Chọn file .glb trước nhé.', { type: 'warn' });
    if (!/\.glb$/i.test(f.name)) return showToast('Chỉ nhận file .glb (glTF dạng nhị phân).', { type: 'warn' });
    if (f.size > MAX_MODEL_MB * 1024 * 1024) return showToast(`File lớn hơn ${MAX_MODEL_MB} MB — hãy nén / giảm chi tiết rồi thử lại.`, { type: 'warn' });
    if (name.value.trim().length < 2) return showToast('Nhập tên nhân vật (ít nhất 2 ký tự).', { type: 'warn' });
    submit.disabled = true;
    status.textContent = 'Đang tải file lên kho…';
    let uploaded = null;
    try {
      uploaded = await uploadCharacterModel(f);
      status.textContent = 'Đang lưu nhân vật…';
      await api.saveCharacter({ name: name.value, gender: gender.value, modelUrl: uploaded.url, storagePath: uploaded.path, active: true });
      showToast(`Đã thêm "${name.value.trim()}" — người chơi chọn trong Tủ đồ › 🦄 Nhân vật`, { type: 'success', icon: '🦄' });
      file.value = '';
      name.value = '';
      status.textContent = '';
      onDone();
    } catch (err) {
      if (uploaded) await deleteCharacterModel(uploaded.path);
      status.textContent = '';
      showToast(err.message, { type: 'warn' });
    }
    submit.disabled = false;
  });

  return h(
    'section',
    { class: 'card' },
    h('header', { class: 'card-head' }, h('h3', {}, '⬆️ Thêm nhân vật 3D')),
    h('p', { class: 'muted' }, 'Tải file .glb lên — người chơi sẽ thấy nhân vật mới trong Tủ đồ › 🦄 Nhân vật và chọn được ngay.'),
    h('div', { class: 'form-grid' }, field('File 3D (.glb)', file, `Tối đa ${MAX_MODEL_MB} MB, nên dưới ${RECOMMENDED_MODEL_MB} MB.`), field('Tên nhân vật', name), field('Giới tính', gender)),
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
      h('li', {}, 'Dùng công cụ tạo 3D từ ảnh (VD: Meshy, Tripo3D) — tải ảnh Kỳ lân đứng thẳng, nền trơn, nhìn chính diện.'),
      h('li', {}, 'Nếu công cụ có "Rigging / Animation": chọn kiểu nhân vật hai chân và thêm động tác đứng (Idle), đi (Walk), chạy (Run).'),
      h('li', {}, 'Xuất file định dạng GLB, chọn mức chi tiết vừa phải (dưới 8 MB để điện thoại tải nhanh).'),
      h('li', {}, 'Tải lên ở thẻ phía trên. Game tự chỉnh chiều cao và đặt nhân vật đứng trên mặt đất.'),
    ),
    h('p', { class: 'muted' }, 'Lưu ý: nhân vật 3D tải lên chưa mặc được trang phục trong Tủ đồ và chỉ cử động theo animation có sẵn trong file. Mặt nhân vật nên hướng về phía trước (trục +Z của file).'),
  );
}
