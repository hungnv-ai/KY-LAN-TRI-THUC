import { QUESTS } from '../config.js';

/**
 * Nhiệm vụ khám phá (logic thuần — dùng cho chế độ ngoại tuyến; máy chủ có bản SQL trong 12_quests.sql).
 */

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * @param {string} day YYYY-MM-DD
 * @returns {typeof QUESTS.CATALOG} PER_DAY nhiệm vụ khám phá của ngày
 */
export function questsForDay(day) {
  return [...QUESTS.CATALOG].sort((a, b) => hash(`${day}quest${a.id}`) - hash(`${day}quest${b.id}`)).slice(0, QUESTS.PER_DAY);
}

/**
 * @param {{ day: string, quests?: string[] }} daily
 * @returns {{ id: string, icon: string, label: string, xp: number, coins: number, need: number, done: boolean }[]}
 */
export function questStatus(daily) {
  const done = daily.quests ?? [];
  return questsForDay(daily.day).map((q) => ({ id: q.id, icon: q.icon, label: q.label, xp: q.xp, coins: q.coins, need: q.need ?? 1, done: done.includes(q.id) }));
}
