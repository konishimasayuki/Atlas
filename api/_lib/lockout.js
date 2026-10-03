// api/_lib/lockout.js ── ログイン試行回数の制限
// 同じ「会社コード＋ログインID」で3回続けて失敗すると3時間ロック。成功するとカウントはリセット。
// スーパー管理者は運営コンソールからロック解除できる（clearLock）。
import { redis } from "./redis.js";

export const MAX_FAILS = 3;
export const LOCK_SECONDS = 3 * 60 * 60; // 3時間

const failKey = (code, id) => `atlas:_sec:fail:${String(code).toLowerCase()}:${String(id).toLowerCase()}`;

// ロック中なら残り分数、そうでなければ 0
export async function lockedMinutes(code, id) {
  const n = Number(await redis.get(failKey(code, id))) || 0;
  if (n < MAX_FAILS) return 0;
  const ttl = await redis.ttl(failKey(code, id));
  return ttl > 0 ? Math.ceil(ttl / 60) : 0;
}

// 失敗を記録。今回でロックに達したら残り分数、そうでなければ 0 と残り回数を返す
export async function recordFail(code, id) {
  const key = failKey(code, id);
  const n = await redis.incr(key);
  if (n === 1 || n === MAX_FAILS) await redis.expire(key, LOCK_SECONDS); // 3回目で3時間に延長
  return { locked: n >= MAX_FAILS, remaining: Math.max(0, MAX_FAILS - n), minutes: n >= MAX_FAILS ? LOCK_SECONDS / 60 : 0 };
}

export async function clearLock(code, id) {
  await redis.del(failKey(code, id));
}

export async function lockState(code, id) {
  const n = Number(await redis.get(failKey(code, id))) || 0;
  return { fails: n, locked: n >= MAX_FAILS, minutes: n >= MAX_FAILS ? await lockedMinutes(code, id) : 0 };
}
