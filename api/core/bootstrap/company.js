// api/core/bootstrap/company.js ── 【緊急用】スーパー管理者ログインを経由せず会社を作成する
// 秘密キーなし。/bootstrap のURLを知っていれば誰でも使える状態。
import { redis } from "../../_lib/redis.js";
import { k, ALL_MODULES, SUPER_CODE, isValidCompanyCode, hashPassword } from "../../_lib/core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  const { code, name, enabledModules, adminId, adminPassword } = req.body || {};
  if (!code || !name || !adminId || !adminPassword) {
    return res.status(400).json({ ok: false, error: "missing" });
  }
  if (code === SUPER_CODE || !isValidCompanyCode(code)) {
    return res.status(400).json({ ok: false, error: "invalid_code" });
  }
  const exists = await redis.get(k.company(code));
  if (exists) return res.status(409).json({ ok: false, error: "exists" });

  const req2 = Array.isArray(enabledModules) ? enabledModules : [];
  const enabled = ALL_MODULES.filter((m) => req2.includes(m) || m === "settings");

  const company = { code, name, enabledModules: enabled, isActive: true, createdAt: Date.now() };
  await redis.set(k.company(code), company);
  await redis.sadd(k.companies(), code);

  const admin = {
    id: adminId, name: adminId, company: code,
    passwordHash: await hashPassword(adminPassword),
    allowedModules: enabled, canManageUsers: true, isActive: true, createdAt: Date.now(),
  };
  await redis.set(k.user(code, adminId), admin);
  await redis.sadd(k.users(code), adminId);

  return res.status(200).json({ ok: true, data: { code, name, enabledModules: enabled } });
}
