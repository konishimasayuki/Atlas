// api/core/auth/setup.js  ── 初回セットアップ（最初の管理者を作成）
import { redis } from "../../_lib/redis.js";
import {
  DEFAULT_TENANT, k, hashPassword, createSession, setSessionCookie, safeUser,
} from "../../_lib/core.js";

const ALL_MODULES = ["sales", "inventory", "accounting", "payroll", "hr", "ga", "settings"];

export default async function handler(req, res) {
  const t = DEFAULT_TENANT;

  // 初期化済みかどうかを返す（ログイン画面が初回判定に使う）
  if (req.method === "GET") {
    const count = await redis.scard(k.users(t));
    return res.status(200).json({ ok: true, data: { initialized: count > 0 } });
  }

  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  const count = await redis.scard(k.users(t));
  if (count > 0) return res.status(409).json({ ok: false, error: "already_initialized" });

  const { loginId, name, password } = req.body || {};
  if (!loginId || !password) return res.status(400).json({ ok: false, error: "missing" });

  const user = {
    id: loginId,
    name: name || loginId,
    tenant: t,
    passwordHash: await hashPassword(password),
    allowedModules: ALL_MODULES, // 最初の管理者は全画面 + ユーザー管理
    canManageUsers: true,
    isActive: true,
    createdAt: Date.now(),
  };
  await redis.set(k.user(t, loginId), user);
  await redis.sadd(k.users(t), loginId);

  // そのままログイン状態にする
  const token = await createSession(t, loginId);
  setSessionCookie(res, token);
  return res.status(200).json({ ok: true, data: safeUser(user) });
}
