// api/core/companies/update.js ── スーパー管理者専用：会社の契約機能 / 有効状態を更新
import { redis } from "../../_lib/redis.js";
import { getCurrentUser, k, ALL_MODULES } from "../../_lib/core.js";

export default async function handler(req, res) {
  const me = await getCurrentUser(req);
  if (!me || me.scope !== "super") return res.status(403).json({ ok: false, error: "forbidden" });
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  const { code, enabledModules, isActive } = req.body || {};
  if (!code) return res.status(400).json({ ok: false, error: "missing" });

  const company = await redis.get(k.company(code));
  if (!company) return res.status(404).json({ ok: false, error: "not_found" });

  if (Array.isArray(enabledModules)) {
    // 設定(⑦)は必ず残す
    company.enabledModules = ALL_MODULES.filter((m) => enabledModules.includes(m) || m === "settings");
  }
  if (typeof isActive === "boolean") company.isActive = isActive;

  await redis.set(k.company(code), company);
  return res.status(200).json({
    ok: true,
    data: {
      code: company.code, name: company.name,
      enabledModules: company.enabledModules, isActive: company.isActive !== false,
    },
  });
}
