/**
 * Sinh file supabase/setup.sql = toàn bộ cấu trúc + hàm (supabase/sql/*.sql) + dữ liệu ban đầu
 * lấy từ chính mã nguồn game (src/config.js, src/data/*.js) → một nguồn sự thật duy nhất.
 *
 * Chạy:  npm run gen:sql
 * Sau đó dán supabase/setup.sql vào Supabase → SQL Editor → Run. Chạy lại nhiều lần được.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as config from '../src/config.js';
import { RANKS } from '../src/data/ranks.js';
import { ITEMS, STARTER_ITEMS, DEFAULT_EQUIPPED } from '../src/data/items.js';
import { QUESTIONS } from '../src/data/questions.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sqlDir = join(root, 'supabase', 'sql');

const lit = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const jsonLit = (v) => `${lit(JSON.stringify(v))}::jsonb`;
const arrLit = (arr) => `array[${arr.map(lit).join(', ')}]::text[]`;

const settings = {
  QUIZ: config.QUIZ,
  CHECK_IN: config.CHECK_IN,
  GOLDEN_HOURS: config.GOLDEN_HOURS,
  EXPLORE: config.EXPLORE,
  MISSIONS: config.MISSIONS,
  KUDOS: config.KUDOS,
  VOUCHER: config.VOUCHER,
  VALUES: config.VALUES,
  ALLOWED_EMAIL_DOMAINS: config.ALLOWED_EMAIL_DOMAINS,
  DEFAULT_EQUIPPED,
};

const seed = [];
seed.push('-- ── Dữ liệu ban đầu (sinh tự động từ src/ — đừng sửa tay) ──');
for (const [key, value] of Object.entries(settings)) {
  // ALLOWED_EMAIL_DOMAINS: không ghi đè nếu admin đã đổi trong trang quản trị.
  const conflict = key === 'ALLOWED_EMAIL_DOMAINS' ? 'do nothing' : 'do update set value = excluded.value, updated_at = now()';
  seed.push(`insert into public.game_settings (key, value) values (${lit(key)}, ${jsonLit(value)}) on conflict (key) ${conflict};`);
}

RANKS.forEach((r, i) => {
  seed.push(
    `insert into public.ranks (id, sort, name, icon, xp, color, reward, tiers) values (${[
      lit(r.id), i, lit(r.name), lit(r.icon), r.xp, lit(r.color), lit(r.reward), r.tiers ? 'true' : 'false',
    ].join(', ')}) on conflict (id) do update set sort = excluded.sort, name = excluded.name, icon = excluded.icon, xp = excluded.xp, color = excluded.color, reward = excluded.reward, tiers = excluded.tiers;`,
  );
});

for (const it of ITEMS) {
  seed.push(
    `insert into public.items (id, slot, name, price, rank_id, rarity, model, starter) values (${[
      lit(it.id), lit(it.slot), lit(it.name), it.price, lit(it.rank ?? null), lit(it.rarity), lit(it.model), STARTER_ITEMS.includes(it.id) ? 'true' : 'false',
    ].join(', ')}) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter;`,
  );
}

// Câu hỏi mẫu: chỉ thêm câu chưa có (không ghi đè câu giáo viên đã sửa).
for (const q of QUESTIONS) {
  seed.push(
    `insert into public.questions (topic, value, q, options, explain) values (${[
      lit(q.topic), lit(q.value ?? null), lit(q.q), arrLit(q.a), lit(q.explain ?? null),
    ].join(', ')}) on conflict (md5(q)) do nothing;`,
  );
}

const files = readdirSync(sqlDir).filter((f) => f.endsWith('.sql')).sort();
const parts = [
  '-- ════════════════════════════════════════════════════════════════════════',
  '-- KỲ LÂN TRI THỨC — FILE CÀI ĐẶT MÁY CHỦ (Supabase)',
  '-- Cách dùng: Supabase → SQL Editor → New query → dán toàn bộ file này → Run.',
  '-- Chạy lại bất cứ lúc nào để cập nhật (không mất dữ liệu người chơi).',
  `-- Sinh tự động bởi scripts/gen-seed.mjs — đừng sửa tay; sửa trong supabase/sql/ và src/.`,
  '-- ════════════════════════════════════════════════════════════════════════',
  '',
];
for (const f of files.filter((f) => !f.startsWith('06'))) {
  parts.push(`-- >>> ${f}`, readFileSync(join(sqlDir, f), 'utf8'), '');
}
parts.push(seed.join('\n'), '');
// Phân quyền chạy CUỐI CÙNG để áp dụng cho mọi hàm.
for (const f of files.filter((f) => f.startsWith('06'))) {
  parts.push(`-- >>> ${f}`, readFileSync(join(sqlDir, f), 'utf8'), '');
}
parts.push("select 'Cài đặt Kỳ Lân Tri Thức thành công ✔' as ket_qua;", '');

const out = join(root, 'supabase', 'setup.sql');
writeFileSync(out, parts.join('\n'));
console.log(`✔ Đã sinh ${out} (${QUESTIONS.length} câu hỏi, ${ITEMS.length} trang phục, ${RANKS.length} hạng)`);
