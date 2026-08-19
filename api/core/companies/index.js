// api/core/companies/index.js ── スーパー管理者専用：会社の一覧 / 追加（初期管理者も同時作成）
import { redis } from "../../_lib/redis.js";
import {
  getCurrentUser, k, ALL_MODULES, SUPER_CODE, isValidCompanyCode, hashPassword,
} from "../../_lib/core.js";

export default async function handler(req, res) {
  const me = await getCurrentUser(req);
  if (!me || me.scope !== "super") return res.status(403).json({ ok: false, error: "forbidden" });

  if (req.method === "GET") {
    const codes = await redis.smembers(k.companies());
    const companies = [];
    for (const code of codes) {
      const c = await redis.get(k.company(code));
      if (c) {
        const userCount = await redis.scard(k.users(code));
        companies.push({
          code: c.code, name: c.name,
          enabledModules: c.enabledModules || [],
          isActive: c.isActive !== false,
          userCount,
        });
      }
    }
    companies.sort((a, b) => a.code.localeCompare(b.code));
    return res.status(200).json({ ok: true, data: companies });
  }

  if (req.method === "POST") {
    const { code, name, enabledModules, adminId, adminPassword } = req.body || {};
    if (!code || !name || !adminId || !adminPassword) {
      return res.status(400).json({ ok: false, error: "missing" });
    }
    if (code === SUPER_CODE || !isValidCompanyCode(code)) {
      return res.status(400).json({ ok: false, error: "invalid_code" });
    }
    const exists = await redis.get(k.company(code));
    if (exists) return res.status(409).json({ ok: false, error: "exists" });

    // 契約機能：指定分のうち有効なものだけ。設定(⑦)は必ず付与（管理者ロック回避）
    const req2 = Array.isArray(enabledModules) ? enabledModules : [];
    const enabled = ALL_MODULES.filter((m) => req2.includes(m) || m === "settings");

    const company = {
      code, name,
      enabledModules: enabled,
      isActive: true,
      createdAt: Date.now(),
    };
    await redis.set(k.company(code), company);
    await redis.sadd(k.companies(), code);

    // 初期管理者（会社の全契約機能＋ユーザー管理）
    const admin = {
      id: adminId,
      name: adminId,
      company: code,
      passwordHash: await hashPassword(adminPassword),
      allowedModules: enabled,
      canManageUsers: true,
      isActive: true,
      createdAt: Date.now(),
    };
    await redis.set(k.user(code, adminId), admin);
    await redis.sadd(k.users(code), adminId);

    return res.status(200).json({
      ok: true,
      data: { code, name, enabledModules: enabled, isActive: true, userCount: 1 },
    });
  }

  return res.status(405).json({ ok: false, error: "method" });
}
