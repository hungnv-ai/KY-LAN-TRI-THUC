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
import { GIFTS } from '../src/data/gifts.js';
import { PETS } from '../src/data/pets.js';
import { EVENTS, EVENT_QUESTIONS } from '../src/data/events.js';

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
  MILESTONES: config.MILESTONES,
  MISSIONS: config.MISSIONS,
  KUDOS: config.KUDOS,
  VOUCHER: config.VOUCHER,
  GIFT_SHOP: config.GIFT_SHOP,
  PETS: config.PETS_CONFIG,
  BELL: config.BELL,
  PET_CATALOG: PETS.map(({ id, name, rarity, weight }) => ({ id, name, rarity, weight })),
  EVENTS: EVENTS.map(({ id, name, start, end, cards, cardBonusCoins }) => ({ id, name, start, end, cards: cards.map((c) => c.id), cardBonusCoins })),
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

// Sự kiện: mặc định tự bật theo lịch; không ghi đè lựa chọn bật/tắt của BGH.
seed.push(`insert into public.game_settings (key, value) values ('EVENT_OVERRIDE', ${jsonLit({ mode: 'auto', id: null })}) on conflict (key) do nothing;`);
seed.push(`insert into public.game_settings (key, value) values ('MAINTENANCE', ${jsonLit({ on: false, message: '' })}) on conflict (key) do nothing;`);

RANKS.forEach((r, i) => {
  seed.push(
    `insert into public.ranks (id, sort, name, icon, xp, color, reward, tiers) values (${[
      lit(r.id), i, lit(r.name), lit(r.icon), r.xp, lit(r.color), lit(r.reward), r.tiers ? 'true' : 'false',
    ].join(', ')}) on conflict (id) do update set sort = excluded.sort, name = excluded.name, icon = excluded.icon, xp = excluded.xp, color = excluded.color, reward = excluded.reward, tiers = excluded.tiers;`,
  );
});

for (const it of ITEMS) {
  seed.push(
    `insert into public.items (id, slot, name, price, rank_id, rarity, model, starter, event, milestone) values (${[
      lit(it.id), lit(it.slot), lit(it.name), it.price, lit(it.rank ?? null), lit(it.rarity), lit(it.model), STARTER_ITEMS.includes(it.id) ? 'true' : 'false', lit(it.event ?? null), lit(it.milestone ?? null),
    ].join(', ')}) on conflict (id) do update set slot = excluded.slot, name = excluded.name, price = excluded.price, rank_id = excluded.rank_id, rarity = excluded.rarity, model = excluded.model, starter = excluded.starter, event = excluded.event, milestone = excluded.milestone;`,
  );
}

// Quà hiện vật: chỉ thêm món chưa có (BGH có thể đã sửa giá / số lượng).
GIFTS.forEach((g, i) => {
  seed.push(
    `insert into public.gift_catalog (id, name, icon, description, cost, stock, sort) values (${[
      lit(g.id), lit(g.name), lit(g.icon), lit(g.description), g.cost, g.stock ?? 'null', i,
    ].join(', ')}) on conflict (id) do nothing;`,
  );
});

// Câu hỏi mẫu: chỉ thêm câu chưa có (không ghi đè câu giáo viên đã sửa).
for (const q of QUESTIONS) {
  seed.push(
    `insert into public.questions (topic, value, q, options, explain) values (${[
      lit(q.topic), lit(q.value ?? null), lit(q.q), arrLit(q.a), lit(q.explain ?? null),
    ].join(', ')}) on conflict (md5(q)) do nothing;`,
  );
}

// Câu hỏi sự kiện: gắn mã sự kiện (chỉ xuất hiện khi sự kiện đang diễn ra).
// Không được trùng chữ với câu hỏi thường (nếu trùng, câu thường sẽ bị biến thành câu sự kiện).
const baseTexts = new Set(QUESTIONS.map((q) => q.q));
const dup = EVENT_QUESTIONS.filter((q) => baseTexts.has(q.q));
if (dup.length) throw new Error(`Câu hỏi sự kiện trùng câu thường: ${dup.map((q) => q.q).join(' | ')}`);
for (const q of EVENT_QUESTIONS) {
  seed.push(
    `insert into public.questions (topic, value, q, options, explain, event) values (${[
      lit(q.topic), lit(q.value ?? null), lit(q.q), arrLit(q.a), lit(q.explain ?? null), lit(q.event),
    ].join(', ')}) on conflict (md5(q)) do update set event = excluded.event;`,
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
