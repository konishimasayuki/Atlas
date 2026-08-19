// api/_lib/core.js ── コア共通処理（会社/テナント・スーパー管理者・セッション・権限）
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { redis } from "./redis.js";

// スーパー管理者（運営）用の予約会社コード
export const SUPER_CODE = "z.z";

// 全機能（①〜⑦）の id。modules.js と一致させること。
export const ALL_MODULES = ["sales", "inventory", "accounting", "payroll", "hr", "ga", "settings"];

const SID_COOKIE = "atlas_sid";
const SESSION_MAXAGE = 60 * 60 * 24 * 3650; // 約10年 = ログアウトまで保持

// ---- Redis キー（接続仕様書 §6）----
export const k = {
  // 運営領域
  superAdmin: (id) => `atlas:_super:admin:${id}`,
  superAdmins: () => `atlas:_super:admins`,
  companies: () => `atlas:_super:companies`,
  company: (code) => `atlas:_super:company:${code}`,
  // 会社領域
  user: (c, id) => `atlas:${c}:core:user:${id}`,
  users: (c) => `atlas:${c}:core:users`,
  // セッション（トークン単位・会社を横断して解決できるようグローバル）
  session: (token) => `atlas:session:${token}`,
};

// 会社コードの形式（英数・ハイフン・アンダースコア／z.z はドット含みで自動的に予約）
export function isValidCompanyCode(code) {
  return typeof code === "string" && /^[A-Za-z0-9_-]{2,20}$/.test(code);
}

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
export async function createSession(scope, companyCode, userId) {
  const token = randomUUID();
  await redis.set(k.session(token), {
    scope, // "super" | "company"
    companyCode: companyCode || null,
    userId,
    createdAt: Date.now(),
  });
  return token; // TTLなし = ログアウトで削除するまで保持
}
export async function destroySession(token) {
  if (token) await redis.del(k.session(token));
}

// ---- 現在のログインユーザー（未ログインは null）----
export async function getCurrentUser(req) {
  const token = getToken(req);
  if (!token) return null;
  const sess = await redis.get(k.session(token));
  if (!sess) return null;

  if (sess.scope === "super") {
    const admin = await redis.get(k.superAdmin(sess.userId));
    if (!admin || admin.isActive === false) return null;
    return { scope: "super", id: admin.id, name: admin.name, isSuper: true };
  }

  const company = await redis.get(k.company(sess.companyCode));
  if (!company || company.isActive === false) return null;
  const user = await redis.get(k.user(sess.companyCode, sess.userId));
  if (!user || user.isActive === false) return null;
  return companyUserView(user, company);
}

// 会社ユーザーがクライアントに見る形（実際に使える画面＝会社契約 ∩ 本人許可）
export function companyUserView(u, company) {
  const enabled = company.enabledModules || [];
  const allowed = u.allowedModules || [];
  const effective = enabled.filter((m) => allowed.includes(m));
  return {
    scope: "company",
    id: u.id,
    name: u.name,
    company: company.code,
    companyName: company.name,
    enabledModules: enabled,
    allowedModules: allowed,
    effectiveModules: effective,
    canManageUsers: !!u.canManageUsers,
  };
}

// ユーザー一覧などで返す最小形
export function safeUser(u) {
  return {
    id: u.id,
    name: u.name,
    allowedModules: u.allowedModules || [],
    canManageUsers: !!u.canManageUsers,
  };
}
