import { WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

/**
 * Nén file nhân vật 3D (.glb) ngay trong trình duyệt trước khi tải lên kho:
 * gộp dữ liệu trùng → giảm lưới khi quá nhiều tam giác → thu nhỏ hình bề mặt về 1024px WebP
 * → nén khung 3D (EXT_meshopt_compression; game giải nén bằng MeshoptDecoder trong scene/loader.js).
 * Chỉ dùng trong trang quản trị (tải lười), game không phải tải các thư viện này.
 */

/** Hình bề mặt tối đa (px) — đủ nét cho nhân vật nhỏ trên màn hình điện thoại. */
const TEXTURE_MAX_PX = 1024;
/** Số tam giác tối đa sau khi giảm lưới (Kỳ lân dựng sẵn khoảng 60 nghìn). */
const TARGET_TRIANGLES = 120000;
/** Sai số hình dạng cho phép khi giảm lưới (tỉ lệ so với kích thước model). */
const SIMPLIFY_ERROR = 0.001;

/**
 * @param {File | Blob} file file .glb gốc
 * @param {(step: string) => void} [onStep] báo bước đang làm (hiện cho người dùng)
 * @returns {Promise<{ blob: Blob, before: number, after: number, trianglesBefore: number, trianglesAfter: number }>}
 */
export async function compressGlb(file, onStep = () => {}) {
  onStep('Đang đọc file 3D…');
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
  const io = new WebIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.readBinary(new Uint8Array(await file.arrayBuffer()));

  const trianglesBefore = countTriangles(doc);
  const ratio = Math.min(1, TARGET_TRIANGLES / Math.max(1, trianglesBefore));

  onStep('Đang dọn dữ liệu trùng…');
  await doc.transform(dedup(), prune(), resample(), weld());
  if (ratio < 1) {
    onStep(`Đang giảm lưới (${formatK(trianglesBefore)} → ~${formatK(TARGET_TRIANGLES)} tam giác)…`);
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: SIMPLIFY_ERROR }), prune());
  }
  onStep(`Đang thu nhỏ hình bề mặt về ${TEXTURE_MAX_PX}px…`);
  await doc.transform(textureCompress({ targetFormat: 'webp', resize: [TEXTURE_MAX_PX, TEXTURE_MAX_PX] }));
  onStep('Đang nén khung 3D…');
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));

  const out = await io.writeBinary(doc);
  return {
    blob: new Blob([out], { type: 'model/gltf-binary' }),
    before: file.size,
    after: out.byteLength,
    trianglesBefore,
    trianglesAfter: countTriangles(doc),
  };
}

/** Tổng số tam giác của mọi lưới trong file. */
function countTriangles(doc) {
  let total = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      const count = indices ? indices.getCount() : (prim.getAttribute('POSITION')?.getCount() ?? 0);
      total += Math.floor(count / 3);
    }
  }
  return total;
}

function formatK(n) {
  return n >= 1000 ? `${Math.round(n / 1000)} nghìn` : String(n);
}

/**
 * Tách riêng phần động tác (animation) từ file .glb: bỏ lưới, vật liệu, hình bề mặt — chỉ giữ
 * khung xương + chuyển động → file rất nhẹ (thường vài chục KB).
 *
 * @param {File | Blob} file
 * @returns {Promise<{ blob: Blob, clips: { name: string, seconds: number }[], before: number, after: number }>}
 */
export async function extractAnimation(file) {
  await MeshoptDecoder.ready;
  const io = new WebIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.readBinary(new Uint8Array(await file.arrayBuffer()));
  const root = doc.getRoot();
  const animations = root.listAnimations();
  if (!animations.length) throw new Error('File này không có động tác nào (animation). Hãy xuất file kèm animation từ công cụ 3D.');

  for (const node of root.listNodes()) node.setMesh(null);
  for (const mesh of root.listMeshes()) mesh.dispose();
  for (const material of root.listMaterials()) material.dispose();
  for (const texture of root.listTextures()) texture.dispose();
  await doc.transform(prune({ keepLeaves: true }), resample());

  const clips = root.listAnimations().map((anim) => {
    let seconds = 0;
    for (const sampler of anim.listSamplers()) {
      const input = sampler.getInput();
      if (input) seconds = Math.max(seconds, input.getMax([0])[0]);
    }
    return { name: anim.getName() || 'Động tác', seconds };
  });
  const out = await io.writeBinary(doc);
  return { blob: new Blob([out], { type: 'model/gltf-binary' }), clips, before: file.size, after: out.byteLength };
}
