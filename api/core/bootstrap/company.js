// api/core/bootstrap/company.js ── 【緊急用】スーパー管理者ログインを経由せず会社を作成する
//
// 通常の会社作成は api/core/companies/index.js（要スーパー管理者ログイン）だが、
// z.z のID・パスワードが分からなくなった場合の救済用に、Vercelの環境変数
// BOOTSTRAP_SECRET と一致する secret を渡した場合のみ会社作成を許可する。
//
// ★重要★ 使い方：
// 1. Vercelのプロジェクト設定 → Environment Variables で BOOTSTRAP_SECRET を設定する
//    （長くてランダムな文字列を推奨。誰にも教えない）
// 2. BOOTSTRAP_SECRET を設定していない間は、このAPIは常に403を返し、絶対に使えない
// 3. 使い終わったら、Vercelの環境変数から BOOTSTRAP_SECRET を削除するか値を変更しておくと安全
import { redis } from "../../_lib/redis.js";
import { k, ALL_MODULES, SUPER_CODE, isValidCompanyCode, hashPassword } from "../../_lib/core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });

  const secretEnv = process.env.BOOTSTRAP_SECRET;
  if (!secretEnv) {
    // 環境変数が未設定なら、このAPI自体を完全に無効化する（fail-closed）
    return res.status(403).json({ ok: false, error: "bootstrap_disabled" });
  }
  const { secret, code, name, enabledModules, adminId, adminPassword } = req.body || {};
  if (!secret || secret !== secretEnv) {
    return res.status(403).json({ ok: false, error: "invalid_secret" });
  }
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
