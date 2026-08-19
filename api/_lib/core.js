// api/_lib/core.js  ── コア共通処理（キー / パスワード / セッション / テナント）
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { redis } from "./redis.js";

// 単一テナント運用。将来ログイン時にテナント解決へ拡張する。
export const DEFAULT_TENANT = "t001";

const SID_COOKIE = "tng_sid";
// 約10年。実質「ログアウトされるまでずっと保持」
const SESSION_MAXAGE = 60 * 60 * 24 * 3650;

// ---- Redis キー（接続仕様書 §6: atlas:{tenant}:{module}:{entity}:{id}）----
export const k = {
  user: (t, id) => `atlas:${t}:core:user:${id}`,
  users: (t) => `atlas:${t}:core:users`, // loginId の SET
  session: (t, token) => `atlas:${t}:core:session:${token}`,
};

// ---- パスワード ----
export async function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw, hash) {
  return bcrypt.compare(pw, hash);
}

// ---- Cookie ----
export function parseCookies(req) {
  const raw = req.headers.cookie || "";
  const out = {};
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
export function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `${SID_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAXAGE}`
  );
}
export function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${SID_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  );
}

// ---- セッション ----
export function getToken(req) {
  return parseCookies(req)[SID_COOKIE] || null;
}
export async function createSession(tenant, userId) {
  const token = randomUUID();
  // TTL を付けない = ログアウトで削除するまで保持
  await redis.set(k.session(tenant, token), { userId, tenant, createdAt: Date.now() });
  return token;
}
export async function destroySession(tenant, token) {
  if (token) await redis.del(k.session(tenant, token));
}

// ---- 現在のログインユーザー（未ログインは null）----
export async function getCurrentUser(req) {
  const token = getToken(req);
  if (!token) return null;
  const tenant = DEFAULT_TENANT;
  const sess = await redis.get(k.session(tenant, token));
  if (!sess) return null;
  const user = await redis.get(k.user(tenant, sess.userId));
  if (!user || user.isActive === false) return null;
  return safeUser(user);
}

// パスワードハッシュ等を除いた、クライアントに返してよい形
export function safeUser(u) {
  return {
    id: u.id,
    name: u.name,
    tenant: u.tenant,
    allowedModules: u.allowedModules || [],
    canManageUsers: !!u.canManageUsers,
  };
}

// 接続仕様書で参照する getTenant。現状は単一テナント。
export function getTenant(_req) {
  return DEFAULT_TENANT;
}
