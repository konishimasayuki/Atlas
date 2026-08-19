// api/core/auth/setup.js ── 初回セットアップ：最初のスーパー管理者(z.z)を作成し、デモ会社TESTを投入
import { redis } from "../../_lib/redis.js";
import {
  k, ALL_MODULES, hashPassword, createSession, setSessionCookie,
} from "../../_lib/core.js";

async function seedDemoCompany() {
  const code = "TEST";
  const exists = await redis.get(k.company(code));
  if (exists) return; // 既にあれば何もしない

  const company = {
    code,
    name: "デモ会社",
    enabledModules: ALL_MODULES, // デモは全機能ON
    isActive: true,
    createdAt: Date.now(),
  };
  await redis.set(k.company(code), company);
  await redis.sadd(k.companies(), code);

  // デモの会社管理者（会社管理権限あり）
  const demo = {
    id: "demo",
    name: "デモ管理者",
    company: code,
    passwordHash: await hashPassword("demo1234"),
    allowedModules: ALL_MODULES,
    canManageUsers: true,
    isActive: true,
    createdAt: Date.now(),
  };
  await redis.set(k.user(code, "demo"), demo);
  await redis.sadd(k.users(code), "demo");
}

export default async function handler(req, res) {
  // 初期化済みか（＝スーパー管理者が既にいるか）
  if (req.method === "GET") {
    const count = await redis.scard(k.superAdmins());
    return res.status(200).json({ ok: true, data: { initialized: count > 0 } });
  }

  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  const count = await redis.scard(k.superAdmins());
  if (count > 0) return res.status(409).json({ ok: false, error: "already_initialized" });

  const { loginId, name, password } = req.body || {};
  if (!loginId || !password) return res.status(400).json({ ok: false, error: "missing" });

  const admin = {
    id: loginId,
    name: name || loginId,
    passwordHash: await hashPassword(password),
    isSuper: true,
    isActive: true,
    createdAt: Date.now(),
  };
  await redis.set(k.superAdmin(loginId), admin);
  await redis.sadd(k.superAdmins(), loginId);

  // デモ会社を自動投入
  await seedDemoCompany();

  // そのままスーパー管理者としてログイン
  const token = await createSession("super", null, loginId);
  setSessionCookie(res, token);
  return res.status(200).json({
    ok: true,
    data: { scope: "super", id: admin.id, name: admin.name, isSuper: true },
  });
}
